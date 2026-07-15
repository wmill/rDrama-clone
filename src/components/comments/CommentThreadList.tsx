import { Loader2 } from "lucide-react";
import { type Dispatch, type SetStateAction, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
	filterCommentTree,
	getVisibleCommentIds,
} from "@/lib/comment-pagination";
import type { CommentFlat, CommentWithReplies } from "@/lib/comments.server";
import { Comment } from "./Comment";

const COMMENTS_PAGE_SIZE =
	Number(import.meta.env.VITE_RESULTS_PER_PAGE_COMMENTS) ?? 50;

type CommentThreadListProps = {
	comments: CommentWithReplies[];
	submissionId: number;
	submissionAuthorId: number;
	currentUserId?: number;
	currentUserAdminLevel?: number;
	onReplyAdded: (comment?: CommentFlat) => void;
	visibleLimit: number;
	onVisibleLimitChange: Dispatch<SetStateAction<number>>;
	isLoading?: boolean;
	highlightComments?: boolean;
	highlightSince?: number;
};

export function CommentThreadList({
	comments,
	submissionId,
	submissionAuthorId,
	currentUserId,
	currentUserAdminLevel = 0,
	onReplyAdded,
	visibleLimit,
	onVisibleLimitChange,
	isLoading,
	highlightComments = false,
	highlightSince = Number.POSITIVE_INFINITY,
}: CommentThreadListProps) {
	const { visibleIds, totalCount } = useMemo(
		() => getVisibleCommentIds(comments, visibleLimit),
		[comments, visibleLimit],
	);

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
		<div
			style={{ contentVisibility: "auto" }}
			className="relative min-h-screen space-y-1"
		>
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
					submissionAuthorId={submissionAuthorId}
					currentUserId={currentUserId}
					currentUserAdminLevel={currentUserAdminLevel}
					onReplyAdded={onReplyAdded}
					highlightComments={highlightComments}
					highlightSince={highlightSince}
				/>
			))}

			{!isLoading && visibleLimit < totalCount && (
				<div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-slate-900/80 to-transparent pt-3 text-center">
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
