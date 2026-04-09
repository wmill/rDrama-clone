import { describe, expect, it } from "vitest";

import { buildCommentForest, buildCommentTree } from "./comment-tree";

function makeComment(
	id: number,
	overrides: Partial<Parameters<typeof buildCommentTree>[0][number]> = {},
): Parameters<typeof buildCommentTree>[0][number] {
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
		descendantCount: 0,
		isDeleted: false,
		isModHidden: false,
		pinnedBy: null,
		distinguishLevel: 0,
		userVote: 0,
		visibilityMessage: null,
		...overrides,
	};
}

describe("comment-tree", () => {
	it("builds parent-child relationships and indexes comments by id", () => {
		const { roots, byId } = buildCommentForest(
			[
				makeComment(1),
				makeComment(2, { parentCommentId: 1, level: 2 }),
				makeComment(3, { parentCommentId: 2, level: 3 }),
			],
			"old",
		);

		expect(roots).toHaveLength(1);
		expect(roots[0]?.id).toBe(1);
		expect(roots[0]?.replies[0]?.id).toBe(2);
		expect(roots[0]?.replies[0]?.replies[0]?.id).toBe(3);
		expect(byId.get(2)?.replies[0]?.id).toBe(3);
	});

	it("treats comments with missing parents as roots", () => {
		const tree = buildCommentTree(
			[makeComment(10, { parentCommentId: 999, level: 2 }), makeComment(11)],
			"old",
		);

		expect(tree.map((comment) => comment.id)).toEqual([10, 11]);
	});

	it("sorts by score, newest, and oldest recursively", () => {
		const comments = [
			makeComment(1, {
				score: 10,
				createdUtc: 100,
			}),
			makeComment(2, {
				score: 20,
				createdUtc: 200,
			}),
			makeComment(3, {
				score: 5,
				createdUtc: 300,
				parentCommentId: 1,
				level: 2,
			}),
			makeComment(4, {
				score: 15,
				createdUtc: 400,
				parentCommentId: 1,
				level: 2,
			}),
		];

		expect(
			buildCommentTree(comments, "top").map((comment) => comment.id),
		).toEqual([2, 1]);
		expect(
			buildCommentTree(comments, "top")[1]?.replies.map(
				(comment) => comment.id,
			),
		).toEqual([4, 3]);

		expect(
			buildCommentTree(comments, "new").map((comment) => comment.id),
		).toEqual([2, 1]);
		expect(
			buildCommentTree(comments, "old").map((comment) => comment.id),
		).toEqual([1, 2]);
	});
});
