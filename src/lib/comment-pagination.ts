import type { CommentWithReplies } from "@/lib/comments.server";

export function getVisibleCommentIds(
	comments: CommentWithReplies[],
	limit: number,
): { visibleIds: Set<number>; totalCount: number } {
	const visibleIds = new Set<number>();
	let totalCount = 0;

	function dfs(commentList: CommentWithReplies[]) {
		for (const comment of commentList) {
			totalCount++;
			if (visibleIds.size < limit) {
				visibleIds.add(comment.id);
			}
			dfs(comment.replies);
		}
	}

	dfs(comments);
	return { visibleIds, totalCount };
}
