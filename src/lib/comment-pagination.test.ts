import { describe, expect, it } from "vitest";

import { filterCommentTree, getVisibleCommentIds } from "./comment-pagination";

type TreeComment = Parameters<typeof getVisibleCommentIds>[0][number];

function makeComment(id: number, replies: TreeComment[] = []): TreeComment {
	return {
		id,
		authorId: id,
		authorName: `user${id}`,
		body: `comment ${id}`,
		bodyHtml: `<p>comment ${id}</p>`,
		createdUtc: id,
		editedUtc: 0,
		upvotes: 1,
		downvotes: 0,
		score: id,
		level: 1,
		parentCommentId: null,
		parentSubmissionId: 1,
		descendantCount: replies.length,
		isDeleted: false,
		isRemoved: false,
		isPinned: false,
		isSaved: false,
		isModHidden: false,
		pinnedBy: null,
		distinguishLevel: 0,
		userVote: 0,
		visibilityMessage: null,
		replies,
	};
}

describe("comment-pagination", () => {
	it("collects visible ids in depth-first order and tracks total count", () => {
		const tree = [
			makeComment(1, [makeComment(2), makeComment(3)]),
			makeComment(4),
		];

		const result = getVisibleCommentIds(tree, 3);

		expect([...result.visibleIds]).toEqual([1, 2, 3]);
		expect(result.totalCount).toBe(4);
	});

	it("reuses original objects when filtering does not change a subtree", () => {
		const child = makeComment(2);
		const root = makeComment(1, [child]);

		const filtered = filterCommentTree([root], new Set([1, 2]));

		expect(filtered[0]).toBe(root);
		expect(filtered[0]?.replies[0]).toBe(child);
	});

	it("creates shallow copies only for branches with removed descendants", () => {
		const preservedLeaf = makeComment(3);
		const removedLeaf = makeComment(4);
		const root = makeComment(1, [makeComment(2, [preservedLeaf, removedLeaf])]);

		const filtered = filterCommentTree([root], new Set([1, 2, 3]));

		expect(filtered).toHaveLength(1);
		expect(filtered[0]).not.toBe(root);
		expect(filtered[0]?.replies[0]).not.toBe(root.replies[0]);
		expect(filtered[0]?.replies[0]?.replies).toEqual([preservedLeaf]);
		expect(filtered[0]?.replies[0]?.replies[0]).toBe(preservedLeaf);
	});

	it("drops comments that are not visible", () => {
		const tree = [makeComment(1, [makeComment(2)]), makeComment(3)];

		const filtered = filterCommentTree(tree, new Set([3]));

		expect(filtered).toEqual([tree[1]]);
	});
});
