import { Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
import { buildCommentTree } from "@/lib/comment-tree";
import type {
	CommentFlat,
	CommentSortType,
	CommentWithReplies,
} from "@/lib/comments.server";
import { withIdentity } from "../utils/withIdentity";

const COMMENTS_PAGE_SIZE =
	Number(import.meta.env.VITE_RESULTS_PER_PAGE_COMMENTS) ?? 50;

const sortOptions: { value: CommentSortType; label: string }[] = [
	{ value: "top", label: "Top" },
	{ value: "new", label: "New" },
	{ value: "old", label: "Old" },
	{ value: "controversial", label: "Controversial" },
];
const ROOT_BATCH_SIZE = 5;

type CommentThreadProps = {
	submissionId: number;
	comments: CommentFlat[];
	commentCount: number;
	commentsLastFetchedAt: number;
	currentUserId?: number;
	initialSort?: CommentSortType;
	onCommentCountChange?: (count: number) => void;
};

type CommentThreadState = {
	byId: Record<number, CommentFlat>;
	allIds: number[];
	commentCount: number;
	lastFetchedAt: number;
};

function buildInitialCommentState(
	comments: CommentFlat[],
	commentCount: number,
	lastFetchedAt: number,
): CommentThreadState {
	const byId: Record<number, CommentFlat> = {};
	const allIds: number[] = [];
	for (const comment of comments) {
		byId[comment.id] = comment;
		allIds.push(comment.id);
	}
	return { byId, allIds, commentCount, lastFetchedAt };
}

function mergeCommentState(
	state: CommentThreadState,
	newComments: CommentFlat[],
	fetchedAt: number,
): { nextState: CommentThreadState; newCount: number } {
	let newCount = 0;
	const byId = { ...state.byId };
	const allIds = state.allIds.slice();

	for (const comment of newComments) {
		if (!byId[comment.id]) {
			newCount += 1;
			allIds.push(comment.id);
		}
		byId[comment.id] = comment;
	}

	return {
		nextState: {
			byId,
			allIds,
			commentCount: state.commentCount + newCount,
			lastFetchedAt: Math.max(state.lastFetchedAt, fetchedAt),
		},
		newCount,
	};
}

export function CommentThreadBase({
	submissionId,
	comments,
	commentCount,
	commentsLastFetchedAt,
	currentUserId,
	initialSort = "top",
	onCommentCountChange,
}: CommentThreadProps) {
	const [sort, setSort] = useState<CommentSortType>(initialSort);
	const [visibleLimit, setVisibleLimit] = useState(COMMENTS_PAGE_SIZE);
	const [isSyncing, setIsSyncing] = useState(false);
	const [commentState, setCommentState] = useState<CommentThreadState>(() =>
		buildInitialCommentState(comments, commentCount, commentsLastFetchedAt),
	);
	const commentStateRef = useRef(commentState);

	const [rootRenderedCount, setRootRenderedCount] = useState(0);

	useEffect(() => {
		commentStateRef.current = commentState;
	}, [commentState]);

	const flatComments = useMemo(() => {
		return commentState.allIds
			.map((id) => commentState.byId[id])
			.filter(Boolean);
	}, [commentState]);

	const localCommentCount = commentState.commentCount;
	const lastFetchedAt = commentState.lastFetchedAt;

	const commentTree = useMemo(
		() => buildCommentTree(flatComments, sort),
		[flatComments, sort],
	);

	const handleMerge = useCallback(
		(newComments: CommentFlat[], fetchedAt: number) => {
			const { nextState, newCount } = mergeCommentState(
				commentStateRef.current,
				newComments,
				fetchedAt,
			);
			commentStateRef.current = nextState;
			setCommentState(nextState);
			onCommentCountChange?.(nextState.commentCount);
			if (newCount > 0) {
				setVisibleLimit((prev) => prev + newCount);
			}
		},
		[onCommentCountChange],
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
			setRootRenderedCount(0);

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
		[handleMerge, lastFetchedAt, submissionId],
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
				rootRenderedCount={rootRenderedCount}
				setRootRenderedCount={setRootRenderedCount}
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
	rootRenderedCount: number;
	setRootRenderedCount: React.Dispatch<React.SetStateAction<number>>;
};

function ActualComments({
	comments,
	submissionId,
	currentUserId,
	onReplyAdded,
	visibleLimit,
	onVisibleLimitChange,
	isLoading,
	rootRenderedCount,
	setRootRenderedCount,
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
	const rootTarget = filteredComments.length;

	useEffect(() => {
		if (rootRenderedCount > rootTarget) {
			setRootRenderedCount(rootTarget);
		}
	}, [rootRenderedCount, rootTarget, setRootRenderedCount]);

	useEffect(() => {
		if (rootRenderedCount >= rootTarget) return;
		let cancelled = false;

		const intervalId = window.setInterval(() => {
			if (cancelled) return;
			setRootRenderedCount((prev) => {
				const next = Math.min(prev + ROOT_BATCH_SIZE, rootTarget);
				if (next >= rootTarget) {
					window.clearInterval(intervalId);
				}
				return next;
			});
		}, 10);

		return () => {
			cancelled = true;
			window.clearInterval(intervalId);
		};
	}, [rootRenderedCount, rootTarget, setRootRenderedCount]);

	const stagedComments = useMemo(
		() => filteredComments.slice(0, rootRenderedCount),
		[filteredComments, rootRenderedCount],
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
		<div
			style={{ contentVisibility: "auto" }}
			className="relative space-y-1 min-h-screen"
		>
			{isLoading && (
				<div className="absolute inset-0 z-10 flex items-start justify-center rounded-xl bg-slate-900/80 backdrop-blur-sm">
					<Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
				</div>
			)}

			{stagedComments.map((comment) => (
				<Comment
					key={comment.id}
					comment={comment}
					submissionId={submissionId}
					currentUserId={currentUserId}
					onReplyAdded={onReplyAdded}
				/>
			))}

			{!isLoading && visibleLimit < totalCount && (
				<div className="pt-3 text-center absolute bottom-0 left-0 w-full bg-gradient-to-t from-slate-900/80 to-transparent">
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

export const CommentThread = withIdentity(
	CommentThreadBase,
	(props) => props.submissionId,
);
