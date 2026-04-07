import { describe, expect, it } from "vitest";

import {
	type CommentViewerContext,
	getCommentVisibility,
	shouldIncludeCommentInFeed,
} from "./comment-visibility.server";
import { filterThreadComments, type RawCommentRow } from "./comments.server";

const baseViewer: CommentViewerContext = {
	viewerId: 100,
	adminLevel: 0,
	canModerate: false,
	canSeeShadowbanned: false,
	blockedAuthorIds: new Set<number>(),
};

function makeRow(overrides: Partial<RawCommentRow>): RawCommentRow {
	return {
		id: 1,
		authorId: 1,
		authorName: "author",
		authorShadowBanned: null,
		body: "body",
		bodyHtml: "<p>body</p>",
		createdUtc: 1,
		editedUtc: 0,
		upvotes: 1,
		downvotes: 0,
		level: 1,
		parentCommentId: null,
		parentSubmissionId: 1,
		descendantCount: 0,
		isPinned: null,
		distinguishLevel: 0,
		stateUserDeletedUtc: null,
		stateMod: "VISIBLE",
		stateModSetBy: null,
		userVoteType: 0,
		isBlocking: false,
		parentSubmissionPrivate: false,
		parentSubmissionDeletedUtc: null,
		parentSubmissionStateMod: "VISIBLE",
		...overrides,
	};
}

describe("comment visibility", () => {
	it("hides blocked comments for normal viewers", () => {
		const result = getCommentVisibility(
			{
				authorId: 2,
				authorName: "blocked",
				distinguishLevel: 0,
				stateMod: "VISIBLE",
				stateModSetBy: null,
				stateUserDeletedUtc: null,
				authorShadowBanned: null,
				isBlocking: true,
			},
			baseViewer,
		);

		expect(result).toEqual({
			isVisible: false,
			message: "You are blocking @blocked",
		});
	});

	it("keeps distinguished blocked comments visible", () => {
		const result = getCommentVisibility(
			{
				authorId: 2,
				authorName: "mod",
				distinguishLevel: 1,
				stateMod: "VISIBLE",
				stateModSetBy: null,
				stateUserDeletedUtc: null,
				authorShadowBanned: null,
				isBlocking: true,
			},
			baseViewer,
		);

		expect(result.isVisible).toBe(true);
		expect(result.message).toContain("official post");
	});

	it("keeps hidden parents as placeholders when a visible descendant exists", () => {
		const rows = filterThreadComments(
			[
				makeRow({
					id: 10,
					authorId: 2,
					authorName: "blocked",
					isBlocking: true,
					level: 1,
				}),
				makeRow({
					id: 11,
					authorId: 3,
					authorName: "reply",
					parentCommentId: 10,
					level: 2,
				}),
			],
			baseViewer,
		);

		expect(rows.map((row) => row.id)).toEqual([10, 11]);
		expect(rows[0]?.isModHidden).toBe(true);
		expect(rows[0]?.visibilityMessage).toBe("You are blocking @blocked");
	});

	it("omits hidden leaves without visible descendants", () => {
		const rows = filterThreadComments(
			[
				makeRow({
					id: 10,
					authorId: 2,
					authorName: "blocked",
					isBlocking: true,
				}),
			],
			baseViewer,
		);

		expect(rows).toEqual([]);
	});

	it("excludes blocked and deleted comments from feed surfaces", () => {
		const viewer = {
			...baseViewer,
			blockedAuthorIds: new Set([2]),
		};

		expect(
			shouldIncludeCommentInFeed(
				{
					authorId: 2,
					authorName: "blocked",
					distinguishLevel: 0,
					stateMod: "VISIBLE",
					stateModSetBy: null,
					stateUserDeletedUtc: null,
					authorShadowBanned: null,
					isBlocking: true,
					parentSubmissionId: 1,
					parentSubmissionPrivate: false,
					parentSubmissionDeletedUtc: null,
					parentSubmissionStateMod: "VISIBLE",
				},
				viewer,
			),
		).toBe(false);

		expect(
			shouldIncludeCommentInFeed(
				{
					authorId: 3,
					authorName: "deleted",
					distinguishLevel: 0,
					stateMod: "VISIBLE",
					stateModSetBy: null,
					stateUserDeletedUtc: new Date(),
					authorShadowBanned: null,
					isBlocking: false,
					parentSubmissionId: 1,
					parentSubmissionPrivate: false,
					parentSubmissionDeletedUtc: null,
					parentSubmissionStateMod: "VISIBLE",
				},
				viewer,
			),
		).toBe(false);
	});
});
