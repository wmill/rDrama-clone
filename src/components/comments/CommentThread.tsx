import { Link } from "@tanstack/react-router";
import { useCallback } from "react";
import { createCommentFn } from "@/lib/comment-actions.server";
import type { CommentFlat, CommentSortType } from "@/lib/comments.server";
import { withIdentity } from "../utils/withIdentity";
import { CommentForm } from "./CommentForm";
import { CommentThreadList } from "./CommentThreadList";
import { useCommentThreadState } from "./useCommentThreadState";

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
	currentUserAdminLevel?: number;
	initialSort?: CommentSortType;
	onCommentCountChange?: (count: number) => void;
};

export function CommentThreadBase({
	submissionId,
	comments,
	commentCount,
	commentsLastFetchedAt,
	currentUserId,
	currentUserAdminLevel = 0,
	initialSort = "top",
	onCommentCountChange,
}: CommentThreadProps) {
	const {
		sort,
		visibleLimit,
		isPending,
		flatComments,
		commentTree,
		localCommentCount,
		handleReplyAdded,
		handleSortChange,
		setVisibleLimit,
	} = useCommentThreadState({
		submissionId,
		comments,
		commentCount,
		commentsLastFetchedAt,
		initialSort,
		onCommentCountChange,
	});

	const createTopLevelComment = useCallback(
		async (text: string) => {
			const result = await createCommentFn({
				data: { body: text, parentSubmissionId: submissionId },
			});
			if (result.success && result.comment) {
				handleReplyAdded(result.comment);
			}
			return result;
		},
		[handleReplyAdded, submissionId],
	);

	return (
		<div className="space-y-4">
			<CommentThreadHeader
				currentUserId={currentUserId}
				commentCount={localCommentCount}
				onCreateComment={createTopLevelComment}
				sort={sort}
				onSortChange={handleSortChange}
				showSortControls={flatComments.length > 0}
				isPending={isPending}
			/>

			<CommentThreadList
				submissionId={submissionId}
				currentUserId={currentUserId}
				currentUserAdminLevel={currentUserAdminLevel}
				onReplyAdded={handleReplyAdded}
				isLoading={isPending}
				comments={commentTree}
				visibleLimit={visibleLimit}
				onVisibleLimitChange={setVisibleLimit}
			/>
		</div>
	);
}

type CommentThreadHeaderProps = {
	currentUserId?: number;
	commentCount: number;
	onCreateComment: (
		text: string,
	) => Promise<{ success: boolean; error?: string }>;
	sort: CommentSortType;
	onSortChange: (sort: CommentSortType) => Promise<void>;
	showSortControls: boolean;
	isPending: boolean;
};

function CommentThreadHeader({
	currentUserId,
	commentCount,
	onCreateComment,
	sort,
	onSortChange,
	showSortControls,
	isPending,
}: CommentThreadHeaderProps) {
	return (
		<>
			<div className="space-y-3">
				<h2 className="text-lg font-semibold text-white">
					{commentCount} {commentCount === 1 ? "Comment" : "Comments"}
				</h2>

				{currentUserId ? (
					<CommentForm mode="new" onSubmit={onCreateComment} />
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

			{showSortControls && (
				<div className="flex items-center gap-2">
					<span className="text-sm text-slate-400">Sort by:</span>
					<div className="flex gap-1 rounded-lg bg-slate-800 p-1">
						{sortOptions.map((option) => (
							<SortButton
								key={option.value}
								option={option}
								sort={sort}
								isPending={isPending}
								onSortChange={onSortChange}
							/>
						))}
					</div>
				</div>
			)}
		</>
	);
}

type SortButtonProps = {
	option: { value: CommentSortType; label: string };
	onSortChange: (sort: CommentSortType) => Promise<void>;
	sort: CommentSortType;
	isPending: boolean;
};

function SortButton({
	option,
	onSortChange,
	sort,
	isPending,
}: SortButtonProps) {
	const isActive = sort === option.value;

	return (
		<button
			type="button"
			onClick={() => void onSortChange(option.value)}
			disabled={isPending}
			className={`rounded-md px-3 py-1 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-70 ${
				isActive ? "bg-cyan-500 text-white" : "text-slate-400 hover:text-white"
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
