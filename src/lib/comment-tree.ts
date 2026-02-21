import type {
	CommentFlat,
	CommentSortType,
	CommentWithReplies,
} from "@/lib/comments.server";

function compareComments(
	a: CommentWithReplies,
	b: CommentWithReplies,
	sort: CommentSortType,
) {
	switch (sort) {
		case "new":
			return b.createdUtc - a.createdUtc;
		case "old":
			return a.createdUtc - b.createdUtc;
		default:
			return b.score - a.score;
	}
}

function sortReplies(
	comments: CommentWithReplies[],
	sort: CommentSortType,
) {
	comments.sort((a, b) => compareComments(a, b, sort));
	for (const comment of comments) {
		if (comment.replies.length > 0) {
			sortReplies(comment.replies, sort);
		}
	}
}

export function buildCommentForest(
	comments: CommentFlat[],
	sort: CommentSortType,
): { roots: CommentWithReplies[]; byId: Map<number, CommentWithReplies> } {
	const byId = new Map<number, CommentWithReplies>();
	const roots: CommentWithReplies[] = [];

	for (const comment of comments) {
		byId.set(comment.id, { ...comment, replies: [] });
	}

	for (const comment of byId.values()) {
		if (comment.parentCommentId === null) {
			roots.push(comment);
			continue;
		}
		const parent = byId.get(comment.parentCommentId);
		if (parent) {
			parent.replies.push(comment);
		} else {
			roots.push(comment);
		}
	}

	sortReplies(roots, sort);

	return { roots, byId };
}

export function buildCommentTree(
	comments: CommentFlat[],
	sort: CommentSortType,
): CommentWithReplies[] {
	return buildCommentForest(comments, sort).roots;
}
