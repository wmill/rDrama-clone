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

/**
 * Returns a filtered copy of the comment tree containing only visible comments.
 * Uses structural sharing: subtrees where nothing changed keep the same object
 * reference, so React.memo can skip re-rendering them.
 */
export function filterCommentTree(
	comments: CommentWithReplies[],
	visibleIds: Set<number>,
): CommentWithReplies[] {
	const result: CommentWithReplies[] = [];

	for (const comment of comments) {
		if (!visibleIds.has(comment.id)) continue;

		const filteredReplies = filterCommentTree(comment.replies, visibleIds);

		// Structural sharing: if all replies survived filtering unchanged,
		// reuse the original comment object so React.memo sees the same reference.
		if (filteredReplies.length === comment.replies.length) {
			let same = true;
			for (let i = 0; i < filteredReplies.length; i++) {
				if (filteredReplies[i] !== comment.replies[i]) {
					same = false;
					break;
				}
			}
			if (same) {
				result.push(comment);
				continue;
			}
		}

		result.push({ ...comment, replies: filteredReplies });
	}

	return result;
}
