import { Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Comment } from "@/components/comments/Comment";
import { CommentForm } from "@/components/comments/CommentForm";
import { Button } from "@/components/ui/button";
import {
	createCommentFn,
	getCommentsSinceFn,
} from "@/lib/comment-actions.server";
import {
	filterCommentTree,
	getVisibleCommentIds,
} from "@/lib/comment-pagination";
import { useCommentStore } from "@/lib/comment-store";
import { buildCommentTree } from "@/lib/comment-tree";
import type {
	CommentFlat,
	CommentSortType,
	CommentWithReplies,
} from "@/lib/comments.server";

const COMMENTS_PAGE_SIZE = Number(
	import.meta.env.VITE_RESULTS_PER_PAGE_COMMENTS ?? 50,
);

const sortOptions: { value: CommentSortType; label: string }[] = [
	{ value: "top", label: "Top" },
	{ value: "new", label: "New" },
	{ value: "old", label: "Old" },
	{ value: "controversial", label: "Controversial" },
];

type CommentThreadProps = {
	submissionId: number;
	comments: CommentFlat[];
	commentCount: number;
	commentsLastFetchedAt: number;
	currentUserId?: number;
	initialSort?: CommentSortType;
};

export function CommentThread({
	submissionId,
	comments,
	commentCount,
	commentsLastFetchedAt,
	currentUserId,
	initialSort = "top",
}: CommentThreadProps) {
	const [sort, setSort] = useState<CommentSortType>(initialSort);
	const [visibleLimit, setVisibleLimit] = useState(COMMENTS_PAGE_SIZE);
	const [isSyncing, setIsSyncing] = useState(false);

	const initSubmission = useCommentStore((state) => state.initSubmission);
	const mergeComments = useCommentStore((state) => state.mergeComments);
	const submissionState = useCommentStore(
		(state) => state.submissions[submissionId],
	);

	useEffect(() => {
		initSubmission(
			submissionId,
			comments,
			commentCount,
			commentsLastFetchedAt,
		);
		setVisibleLimit(COMMENTS_PAGE_SIZE);
	}, [
		commentCount,
		comments,
		commentsLastFetchedAt,
		initSubmission,
		submissionId,
	]);

	useEffect(() => {
		setSort(initialSort);
	}, [initialSort, submissionId]);

	const flatComments = useMemo(() => {
		if (!submissionState) return [];
		return submissionState.allIds
			.map((id) => submissionState.byId[id])
			.filter(Boolean);
	}, [submissionState]);

	const localCommentCount = submissionState?.commentCount ?? commentCount;
	const lastFetchedAt =
		submissionState?.lastFetchedAt ?? commentsLastFetchedAt;

	const commentTree = useMemo(
		() => buildCommentTree(flatComments, sort),
		[flatComments, sort],
	);

	const handleMerge = useCallback(
		(newComments: CommentFlat[], fetchedAt: number) => {
			const newCount = mergeComments(
				submissionId,
				newComments,
				fetchedAt,
			);
			if (newCount > 0) {
				setVisibleLimit((prev) => prev + newCount);
			}
		},
		[mergeComments, submissionId],
	);

	const handleReplyAdded = useCallback(
		(comment?: CommentFlat) => {
			if (!comment) return;
			handleMerge([comment], comment.createdUtc);
		},
		[handleMerge],
	);

	const handleSortChange = useCallback(
		async (nextSort: CommentSortType) => {
			setSort(nextSort);

			if (!submissionState) return;
			setIsSyncing(true);
			try {
				const result = await getCommentsSinceFn({
					data: { submissionId, since: lastFetchedAt },
				});
				if (result.success) {
					handleMerge(result.comments, result.lastFetchedAt);
				}
			} finally {
				setIsSyncing(false);
			}
		},
		[handleMerge, lastFetchedAt, submissionId, submissionState],
	);

	return (
		<div className="space-y-4">
			{/* Comment form */}
			<div className="space-y-3">
				<h2 className="text-lg font-semibold text-white">
					{localCommentCount} {localCommentCount === 1 ? "Comment" : "Comments"}
				</h2>

				{currentUserId ? (
					<CommentForm
						mode="new"
						onSubmit={async (text) => {
							const result = await createCommentFn({
								data: { body: text, parentSubmissionId: submissionId },
							});
							if (result.success && result.comment) {
								handleReplyAdded(result.comment);
							}
							return result;
						}}
					/>
				) : (
					<div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4 text-center">
						<p className="text-slate-400">
							<Link to="/login" className="text-cyan-400 hover:text-cyan-300">
								Sign in
							</Link>{" "}
							to join the conversation
						</p>
					</div>
				)}
			</div>

			{/* Sort options */}
			{flatComments.length > 0 && (
				<div className="flex items-center gap-2">
					<span className="text-sm text-slate-400">Sort by:</span>
					<div className="flex gap-1 rounded-lg bg-slate-800 p-1">
						{sortOptions.map((option) => (
							<SortButton
								option={option}
								onSortChange={handleSortChange}
								sort={sort}
								key={option.value}
							/>
						))}
					</div>
				</div>
			)}

			{/* Comments list */}
			<ActualComments
				submissionId={submissionId}
				currentUserId={currentUserId}
				onReplyAdded={handleReplyAdded}
				isLoading={isSyncing}
				comments={commentTree}
				visibleLimit={visibleLimit}
				onVisibleLimitChange={setVisibleLimit}
			/>
		</div>
	);
}

type ActualCommentsProps = {
	comments: CommentWithReplies[];
	submissionId: number;
	currentUserId?: number;
	onReplyAdded: (comment?: CommentFlat) => void;
	visibleLimit: number;
	onVisibleLimitChange: (updater: (prev: number) => number) => void;
	isLoading?: boolean;
};

function ActualComments({
	comments,
	submissionId,
	currentUserId,
	onReplyAdded,
	visibleLimit,
	onVisibleLimitChange,
	isLoading,
}: ActualCommentsProps) {
	const { visibleIds, totalCount } = useMemo(
		() => getVisibleCommentIds(comments, visibleLimit),
		[comments, visibleLimit],
	);

	// Pre-filter the tree so only visible comments are passed down.
	// Uses structural sharing: unchanged subtrees keep the same object
	// reference, allowing React.memo on Comment to skip re-renders.
	const filteredComments = useMemo(
		() => filterCommentTree(comments, visibleIds),
		[comments, visibleIds],
	);

	if (comments.length === 0) {
		return (
			<div className="rounded-lg border border-dashed border-slate-700 p-8 text-center">
				<p className="text-slate-500">
					No comments yet. Be the first to share your thoughts!
				</p>
			</div>
		);
	}

	return (
		<div style={{contentVisibility: "auto"}} className="relative space-y-1">
			{isLoading && (
				<div className="absolute inset-0 z-10 flex items-start justify-center rounded-xl bg-slate-900/80 backdrop-blur-sm">
					<Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
				</div>
			)}

			{filteredComments.map((comment) => (
				<Comment
					key={comment.id}
					comment={comment}
					submissionId={submissionId}
					currentUserId={currentUserId}
					onReplyAdded={onReplyAdded}
				/>
			))}

			{visibleLimit < totalCount && (
				<div className="pt-3 text-center">
					<Button
						variant="outline"
						onClick={() =>
							onVisibleLimitChange((prev) => prev + COMMENTS_PAGE_SIZE)
						}
						className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
					>
						Load more comments ({totalCount - visibleLimit} remaining)
					</Button>
				</div>
			)}
		</div>
	);
}

type SortButtonProps = {
	option: { value: CommentSortType; label: string };
	onSortChange: (sort: CommentSortType) => void;
	sort?: CommentSortType;
};
function SortButton({ option, onSortChange, sort }: SortButtonProps) {
	const [loading, setLoading] = useState(false);

	if (loading) {
		return (
			<button
				key={option.value}
				type="button"
				className={`rounded-md px-3 py-1 text-sm font-medium transition-colors scale-110 ${
					sort === option.value
						? "bg-cyan-500 text-white"
						: "text-slate-400 hover:text-white"
				}`}
			>
				{option.label}
			</button>
		);
	}
	return (
		<button
			key={option.value}
			type="button"
			onClick={() => {
				setLoading(true);
				setTimeout(() => {
					Promise.resolve()
						.then(() => onSortChange(option.value))
						.finally(() => setLoading(false));
				});
			}}
			className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
				sort === option.value
					? "bg-cyan-500 text-white"
					: "text-slate-400 hover:text-white"
			}`}
		>
			{option.label}
		</button>
	);
}
