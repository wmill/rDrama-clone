import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock } = vi.hoisted(() => ({
	dbMock: {
		select: vi.fn(),
	},
}));

vi.mock("@/db", () => ({
	db: dbMock,
}));

import {
	type CommentViewerContext,
	getCommentViewerContext,
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
		pinnedBy: null,
		distinguishLevel: 0,
		stateUserDeletedUtc: null,
		stateMod: "VISIBLE",
		stateModSetBy: null,
		userVoteType: 0,
		savedCommentId: null,
		isBlocking: false,
		parentSubmissionPrivate: false,
		parentSubmissionDeletedUtc: null,
		parentSubmissionStateMod: "VISIBLE",
		...overrides,
	};
}

describe("comment visibility", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

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

	it("keeps self-authored comments visible regardless of state", () => {
		expect(
			getCommentVisibility(
				{
					authorId: 100,
					authorName: "self",
					distinguishLevel: 0,
					stateMod: "REMOVED",
					stateModSetBy: "mod",
					stateUserDeletedUtc: new Date(),
					authorShadowBanned: "AutoJanny",
					isBlocking: true,
				},
				baseViewer,
			),
		).toEqual({
			isVisible: true,
			message: null,
		});
	});

	it("hides removed, filtered, deleted, and shadowbanned comments for normal viewers", () => {
		expect(
			getCommentVisibility(
				{
					authorId: 2,
					authorName: "removed",
					distinguishLevel: 0,
					stateMod: "REMOVED",
					stateModSetBy: "mod",
					stateUserDeletedUtc: null,
					authorShadowBanned: null,
					isBlocking: false,
				},
				baseViewer,
			),
		).toEqual({
			isVisible: false,
			message: "Removed by @mod",
		});

		expect(
			getCommentVisibility(
				{
					authorId: 2,
					authorName: "removed",
					distinguishLevel: 0,
					stateMod: "REMOVED",
					stateModSetBy: null,
					stateUserDeletedUtc: null,
					authorShadowBanned: null,
					isBlocking: false,
				},
				baseViewer,
			),
		).toEqual({
			isVisible: false,
			message: "Removed",
		});

		expect(
			getCommentVisibility(
				{
					authorId: 2,
					authorName: "filtered",
					distinguishLevel: 0,
					stateMod: "FILTERED",
					stateModSetBy: null,
					stateUserDeletedUtc: null,
					authorShadowBanned: null,
					isBlocking: false,
				},
				baseViewer,
			),
		).toEqual({
			isVisible: false,
			message: "Filtered",
		});

		expect(
			getCommentVisibility(
				{
					authorId: 2,
					authorName: "deleted",
					distinguishLevel: 0,
					stateMod: "VISIBLE",
					stateModSetBy: null,
					stateUserDeletedUtc: new Date(),
					authorShadowBanned: null,
					isBlocking: false,
				},
				baseViewer,
			),
		).toEqual({
			isVisible: false,
			message: "Deleted by author",
		});

		expect(
			getCommentVisibility(
				{
					authorId: 2,
					authorName: "shadow",
					distinguishLevel: 0,
					stateMod: "VISIBLE",
					stateModSetBy: null,
					stateUserDeletedUtc: null,
					authorShadowBanned: "AutoJanny",
					isBlocking: false,
				},
				baseViewer,
			),
		).toEqual({
			isVisible: false,
			message: "Removed",
		});
	});

	it("keeps moderator-visible removed and shadowbanned comments visible", () => {
		const moderatorViewer: CommentViewerContext = {
			...baseViewer,
			canModerate: true,
			canSeeShadowbanned: true,
		};

		expect(
			getCommentVisibility(
				{
					authorId: 2,
					authorName: "mod-visible",
					distinguishLevel: 0,
					stateMod: "REMOVED",
					stateModSetBy: "mod",
					stateUserDeletedUtc: null,
					authorShadowBanned: null,
					isBlocking: false,
				},
				moderatorViewer,
			),
		).toEqual({
			isVisible: true,
			message: null,
		});

		expect(
			getCommentVisibility(
				{
					authorId: 2,
					authorName: "shadow",
					distinguishLevel: 0,
					stateMod: "VISIBLE",
					stateModSetBy: null,
					stateUserDeletedUtc: null,
					authorShadowBanned: "AutoJanny",
					isBlocking: false,
				},
				moderatorViewer,
			),
		).toEqual({
			isVisible: true,
			message: null,
		});
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

	it("builds viewer context for anonymous, missing, normal, moderator, and shadowbanned viewers", async () => {
		expect(await getCommentViewerContext()).toEqual({
			viewerId: null,
			adminLevel: 0,
			canModerate: false,
			canSeeShadowbanned: false,
			blockedAuthorIds: new Set<number>(),
		});

		const createSelectChain = <T,>(result: T) => ({
			from: vi.fn().mockReturnThis(),
			where: vi.fn().mockReturnThis(),
			limit: vi.fn().mockResolvedValue(result),
		});

		dbMock.select
			.mockReturnValueOnce(createSelectChain([]))
			.mockReturnValueOnce({
				from: vi.fn().mockReturnThis(),
				where: vi.fn().mockResolvedValue([{ targetId: 9 }]),
			});
		expect(await getCommentViewerContext(5)).toEqual({
			viewerId: null,
			adminLevel: 0,
			canModerate: false,
			canSeeShadowbanned: false,
			blockedAuthorIds: new Set([9]),
		});

		dbMock.select
			.mockReturnValueOnce(
				createSelectChain([{ id: 7, adminLevel: 0, shadowBanned: null }]),
			)
			.mockReturnValueOnce({
				from: vi.fn().mockReturnThis(),
				where: vi.fn().mockResolvedValue([{ targetId: 3 }, { targetId: 4 }]),
			});
		expect(await getCommentViewerContext(7)).toEqual({
			viewerId: 7,
			adminLevel: 0,
			canModerate: false,
			canSeeShadowbanned: false,
			blockedAuthorIds: new Set([3, 4]),
		});

		dbMock.select
			.mockReturnValueOnce(
				createSelectChain([{ id: 8, adminLevel: 2, shadowBanned: null }]),
			)
			.mockReturnValueOnce({
				from: vi.fn().mockReturnThis(),
				where: vi.fn().mockResolvedValue([]),
			});
		expect(await getCommentViewerContext(8)).toEqual({
			viewerId: 8,
			adminLevel: 2,
			canModerate: true,
			canSeeShadowbanned: true,
			blockedAuthorIds: new Set<number>(),
		});

		dbMock.select
			.mockReturnValueOnce(
				createSelectChain([
					{ id: 9, adminLevel: 0, shadowBanned: "AutoJanny" },
				]),
			)
			.mockReturnValueOnce({
				from: vi.fn().mockReturnThis(),
				where: vi.fn().mockResolvedValue([]),
			});
		expect(await getCommentViewerContext(9)).toEqual({
			viewerId: 9,
			adminLevel: 0,
			canModerate: false,
			canSeeShadowbanned: true,
			blockedAuthorIds: new Set<number>(),
		});
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

	it("excludes feed comments with hidden parents or non-visible state and allows moderator shadowban visibility", () => {
		const moderatorViewer: CommentViewerContext = {
			...baseViewer,
			canModerate: true,
			canSeeShadowbanned: true,
		};

		expect(
			shouldIncludeCommentInFeed(
				{
					authorId: 3,
					authorName: "orphaned",
					distinguishLevel: 0,
					stateMod: "VISIBLE",
					stateModSetBy: null,
					stateUserDeletedUtc: null,
					authorShadowBanned: null,
					isBlocking: false,
					parentSubmissionId: null,
				},
				baseViewer,
			),
		).toBe(false);

		expect(
			shouldIncludeCommentInFeed(
				{
					authorId: 3,
					authorName: "private-post",
					distinguishLevel: 0,
					stateMod: "VISIBLE",
					stateModSetBy: null,
					stateUserDeletedUtc: null,
					authorShadowBanned: null,
					isBlocking: false,
					parentSubmissionId: 1,
					parentSubmissionPrivate: true,
					parentSubmissionDeletedUtc: null,
					parentSubmissionStateMod: "VISIBLE",
				},
				baseViewer,
			),
		).toBe(false);

		expect(
			shouldIncludeCommentInFeed(
				{
					authorId: 3,
					authorName: "removed-post",
					distinguishLevel: 0,
					stateMod: "VISIBLE",
					stateModSetBy: null,
					stateUserDeletedUtc: null,
					authorShadowBanned: null,
					isBlocking: false,
					parentSubmissionId: 1,
					parentSubmissionPrivate: false,
					parentSubmissionDeletedUtc: new Date(),
					parentSubmissionStateMod: "VISIBLE",
				},
				baseViewer,
			),
		).toBe(false);

		expect(
			shouldIncludeCommentInFeed(
				{
					authorId: 3,
					authorName: "removed-comment",
					distinguishLevel: 0,
					stateMod: "REMOVED",
					stateModSetBy: "mod",
					stateUserDeletedUtc: null,
					authorShadowBanned: null,
					isBlocking: false,
					parentSubmissionId: 1,
					parentSubmissionPrivate: false,
					parentSubmissionDeletedUtc: null,
					parentSubmissionStateMod: "VISIBLE",
				},
				baseViewer,
			),
		).toBe(false);

		expect(
			shouldIncludeCommentInFeed(
				{
					authorId: 3,
					authorName: "filtered-post",
					distinguishLevel: 0,
					stateMod: "VISIBLE",
					stateModSetBy: null,
					stateUserDeletedUtc: null,
					authorShadowBanned: null,
					isBlocking: false,
					parentSubmissionId: 1,
					parentSubmissionPrivate: false,
					parentSubmissionDeletedUtc: null,
					parentSubmissionStateMod: "REMOVED",
				},
				baseViewer,
			),
		).toBe(false);

		expect(
			shouldIncludeCommentInFeed(
				{
					authorId: 3,
					authorName: "shadow",
					distinguishLevel: 0,
					stateMod: "VISIBLE",
					stateModSetBy: null,
					stateUserDeletedUtc: null,
					authorShadowBanned: "AutoJanny",
					isBlocking: false,
					parentSubmissionId: 1,
					parentSubmissionPrivate: false,
					parentSubmissionDeletedUtc: null,
					parentSubmissionStateMod: "VISIBLE",
				},
				baseViewer,
			),
		).toBe(false);

		expect(
			shouldIncludeCommentInFeed(
				{
					authorId: 3,
					authorName: "shadow",
					distinguishLevel: 0,
					stateMod: "VISIBLE",
					stateModSetBy: null,
					stateUserDeletedUtc: null,
					authorShadowBanned: "AutoJanny",
					isBlocking: false,
					parentSubmissionId: 1,
					parentSubmissionPrivate: false,
					parentSubmissionDeletedUtc: null,
					parentSubmissionStateMod: "VISIBLE",
				},
				moderatorViewer,
			),
		).toBe(true);
	});
});
