import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({
	db: {
		select: vi.fn(),
		insert: vi.fn(),
		update: vi.fn(),
		delete: vi.fn(),
		transaction: vi.fn(),
		execute: vi.fn(),
	},
}));

vi.mock("@/lib/comment-visibility.server", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("@/lib/comment-visibility.server")>();
	return {
		...actual,
		getCommentViewerContext: vi.fn(),
	};
});

vi.mock("@/lib/lifecycle.server", () => ({
	authorDeleteComment: vi.fn(),
}));

vi.mock("@/lib/notifications.server", () => ({
	createNotificationsForComment: vi.fn(),
}));

vi.mock("@/lib/search.server", () => ({
	indexCommentBestEffort: vi.fn(),
}));

vi.mock("@/lib/site-settings.server", () => ({
	getSiteSetting: vi.fn(),
}));

vi.mock("@/lib/awards.server", () => ({
	getCommentAwardCounts: vi.fn(async () => new Map()),
}));

import { db } from "@/db";
import {
	type CommentViewerContext,
	getCommentViewerContext,
} from "@/lib/comment-visibility.server";
import {
	createComment,
	deleteComment,
	getCommentById,
	type RawCommentRow,
	updateComment,
} from "@/lib/comments.server";
import { authorDeleteComment } from "@/lib/lifecycle.server";
import { renderCommentMarkdown } from "@/lib/markdown";
import { createNotificationsForComment } from "@/lib/notifications.server";
import { indexCommentBestEffort } from "@/lib/search.server";
import { getSiteSetting } from "@/lib/site-settings.server";

function makeViewer(
	overrides: Partial<CommentViewerContext> = {},
): CommentViewerContext {
	return {
		viewerId: null,
		adminLevel: 0,
		canModerate: false,
		canSeeShadowbanned: false,
		blockedAuthorIds: new Set<number>(),
		...overrides,
	};
}

type RawRowSelectResult = Omit<RawCommentRow, "isBlocking"> & {
	blockedTargetId: number | null;
};

function makeRawRow(
	overrides: Partial<RawRowSelectResult> = {},
): RawRowSelectResult {
	return {
		id: 5,
		authorId: 7,
		authorName: "alice",
		authorShadowBanned: null,
		body: "hello **world**",
		bodyHtml: "<p>hello <strong>world</strong></p>",
		createdUtc: 100,
		editedUtc: 0,
		upvotes: 3,
		downvotes: 1,
		level: 1,
		parentCommentId: null,
		parentSubmissionId: 42,
		descendantCount: 0,
		pinnedBy: null,
		distinguishLevel: 0,
		stateUserDeletedUtc: null,
		stateMod: "VISIBLE",
		stateModSetBy: null,
		userVoteType: null,
		savedCommentId: null,
		blockedTargetId: null,
		...overrides,
	};
}

function createCommentRowChain(result: unknown) {
	const chain: Record<string, ReturnType<typeof vi.fn>> = {};
	chain.from = vi.fn(() => chain);
	chain.innerJoin = vi.fn(() => chain);
	chain.leftJoin = vi.fn(() => chain);
	chain.where = vi.fn(() => chain);
	chain.limit = vi.fn().mockResolvedValue(result);
	return chain;
}

function createUpdateChain(returningResult?: unknown) {
	const returning = vi.fn().mockResolvedValue(returningResult ?? []);
	const where =
		returningResult === undefined
			? vi.fn().mockResolvedValue(undefined)
			: vi.fn(() => ({ returning }));
	const set = vi.fn(() => ({ where }));
	return { set, where, returning };
}

function createTx(insertedCommentId: number, duplicateRows: unknown[] = []) {
	const commentInsert = {
		values: vi.fn(() => ({
			returning: vi.fn().mockResolvedValue([{ id: insertedCommentId }]),
		})),
	};
	const voteInsert = { values: vi.fn().mockResolvedValue(undefined) };
	const updateChains: ReturnType<typeof createUpdateChain>[] = [];
	const tx = {
		select: vi.fn(() => createCommentRowChain(duplicateRows)),
		insert: vi
			.fn()
			.mockReturnValueOnce(commentInsert)
			.mockReturnValueOnce(voteInsert),
		update: vi.fn(() => {
			const chain = createUpdateChain();
			updateChains.push(chain);
			return chain;
		}),
		execute: vi.fn().mockResolvedValue({ rows: [] }),
	};
	return { tx, commentInsert, voteInsert, updateChains };
}

describe("createComment", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(getSiteSetting).mockResolvedValue(0 as never);
	});

	function authorChain(overrides: Record<string, unknown> = {}) {
		return createCommentRowChain([
			{
				adminLevel: 0,
				commentCount: 10,
				createdUtc: 0,
				filterBehavior: "AUTOMATIC",
				trueScore: 10,
				...overrides,
			},
		]);
	}

	it("creates a top-level comment with rendered bodyHtml, level 1, and a self-upvote", async () => {
		vi.mocked(db.select).mockReturnValueOnce(authorChain() as never);
		const { tx, commentInsert, voteInsert } = createTx(55);
		vi.mocked(db.transaction).mockImplementationOnce(
			async (fn) => fn(tx as never) as never,
		);

		await expect(
			createComment({
				authorId: 7,
				body: "hello **world**",
				parentSubmissionId: 42,
			}),
		).resolves.toBe(55);

		expect(commentInsert.values).toHaveBeenCalledWith(
			expect.objectContaining({
				authorId: 7,
				body: "hello **world**",
				bodyHtml: renderCommentMarkdown("hello **world**"),
				parentSubmission: 42,
				parentCommentId: null,
				level: 1,
				topCommentId: null,
				stateMod: "VISIBLE",
			}),
		);
		expect(voteInsert.values).toHaveBeenCalledWith(
			expect.objectContaining({ userId: 7, commentId: 55, voteType: 1 }),
		);
		expect(createNotificationsForComment).toHaveBeenCalledWith(55, tx);
		expect(indexCommentBestEffort).toHaveBeenCalledWith(55);
	});

	it("nests a reply one level under its parent and bumps the descendant count", async () => {
		vi.mocked(db.select)
			.mockReturnValueOnce(authorChain() as never)
			.mockReturnValueOnce({
				from: vi.fn(() => ({
					where: vi.fn(() => ({
						limit: vi.fn().mockResolvedValue([{ level: 2, topCommentId: 9 }]),
					})),
				})),
			} as never);
		const { tx, commentInsert, updateChains } = createTx(56);
		vi.mocked(db.transaction).mockImplementationOnce(
			async (fn) => fn(tx as never) as never,
		);

		await expect(
			createComment({
				authorId: 7,
				body: "a reply",
				parentSubmissionId: 42,
				parentCommentId: 12,
			}),
		).resolves.toBe(56);

		expect(commentInsert.values).toHaveBeenCalledWith(
			expect.objectContaining({
				parentCommentId: 12,
				level: 3,
				topCommentId: 9,
			}),
		);
		// descendant count on the parent comment + comment count on the author
		expect(tx.update).toHaveBeenCalledTimes(2);
		expect(updateChains).toHaveLength(2);
	});

	it.each([
		["FILTERED", 0, "FILTERED"],
		["UNFILTERED", 0, "VISIBLE"],
		["FILTERED", 2, "VISIBLE"],
	] as const)(
		"applies %s behavior at admin level %i",
		async (filterBehavior, adminLevel, expectedState) => {
			vi.mocked(db.select).mockReturnValueOnce(
				authorChain({ filterBehavior, adminLevel }) as never,
			);
			const { tx, commentInsert } = createTx(60);
			vi.mocked(db.transaction).mockImplementationOnce(
				async (fn) => fn(tx as never) as never,
			);

			await createComment({
				authorId: 7,
				body: "test",
				parentSubmissionId: 42,
			});
			expect(commentInsert.values).toHaveBeenCalledWith(
				expect.objectContaining({ stateMod: expectedState }),
			);
		},
	);

	it("filters automatic comments when any configured threshold is unmet", async () => {
		vi.mocked(db.select).mockReturnValueOnce(
			authorChain({
				commentCount: 2,
				createdUtc: Math.floor(Date.now() / 1000),
				trueScore: 50,
			}) as never,
		);
		vi.mocked(getSiteSetting).mockImplementation(async (key) =>
			key === "filter_comments_min_comments"
				? 3
				: key === "filter_comments_min_age_days"
					? 1
					: (0 as never),
		);
		const { tx, commentInsert } = createTx(61);
		vi.mocked(db.transaction).mockImplementationOnce(
			async (fn) => fn(tx as never) as never,
		);

		await createComment({ authorId: 7, body: "test", parentSubmissionId: 42 });
		expect(commentInsert.values).toHaveBeenCalledWith(
			expect.objectContaining({ stateMod: "FILTERED" }),
		);
	});

	it("hard-rejects an identical active comment under the same parent while holding the race lock", async () => {
		vi.mocked(db.select).mockReturnValueOnce(authorChain() as never);
		const { tx } = createTx(62, [{ id: 50 }]);
		vi.mocked(db.transaction).mockImplementationOnce(
			async (fn) => fn(tx as never) as never,
		);

		await expect(
			createComment({ authorId: 7, body: "same", parentSubmissionId: 42 }),
		).rejects.toThrow("identical active comment");
		expect(tx.execute).toHaveBeenCalledTimes(1);
		expect(tx.insert).not.toHaveBeenCalled();
	});
});

describe("updateComment", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("re-renders bodyHtml and reindexes on success", async () => {
		const chain = createUpdateChain([{ id: 5 }]);
		vi.mocked(db.update).mockReturnValueOnce(chain as never);

		await expect(updateComment(5, 7, "**edited**")).resolves.toBe(true);

		expect(chain.set).toHaveBeenCalledWith(
			expect.objectContaining({
				body: "**edited**",
				bodyHtml: renderCommentMarkdown("**edited**"),
				editedUtc: expect.any(Number),
			}),
		);
		expect(indexCommentBestEffort).toHaveBeenCalledWith(5);
	});

	it("returns false and skips reindexing when the caller is not the author", async () => {
		const chain = createUpdateChain([]);
		vi.mocked(db.update).mockReturnValueOnce(chain as never);

		await expect(updateComment(5, 999, "**edited**")).resolves.toBe(false);
		expect(indexCommentBestEffort).not.toHaveBeenCalled();
	});
});

describe("deleteComment", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("delegates to authorDeleteComment and propagates rejection", async () => {
		vi.mocked(authorDeleteComment).mockResolvedValueOnce(false);
		await expect(deleteComment(5, 999)).resolves.toBe(false);
		expect(authorDeleteComment).toHaveBeenCalledWith(5, 999);

		vi.mocked(authorDeleteComment).mockResolvedValueOnce(true);
		await expect(deleteComment(5, 7)).resolves.toBe(true);
	});
});

describe("getCommentById visibility mapping", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	function mockRow(row: RawRowSelectResult | null) {
		vi.mocked(db.select).mockReturnValueOnce(
			createCommentRowChain(row ? [row] : []) as never,
		);
	}

	it("returns null for a missing comment", async () => {
		vi.mocked(getCommentViewerContext).mockResolvedValue(makeViewer());
		mockRow(null);

		await expect(getCommentById(12345)).resolves.toBeNull();
	});

	it("returns full content for a visible comment", async () => {
		vi.mocked(getCommentViewerContext).mockResolvedValue(makeViewer());
		mockRow(makeRawRow());

		await expect(getCommentById(5)).resolves.toMatchObject({
			id: 5,
			authorName: "alice",
			bodyHtml: "<p>hello <strong>world</strong></p>",
			score: 2,
			isModHidden: false,
			visibilityMessage: null,
		});
	});

	it("hides a REMOVED comment from normal viewers behind a placeholder", async () => {
		vi.mocked(getCommentViewerContext).mockResolvedValue(
			makeViewer({ viewerId: 1 }),
		);
		mockRow(makeRawRow({ stateMod: "REMOVED", stateModSetBy: "modbob" }));

		await expect(getCommentById(5, 1)).resolves.toMatchObject({
			authorName: "[deleted]",
			bodyHtml: "<p>Removed by @modbob</p>",
			isModHidden: true,
			visibilityMessage: "Removed by @modbob",
		});
	});

	it("shows a REMOVED comment's real content to moderators", async () => {
		vi.mocked(getCommentViewerContext).mockResolvedValue(
			makeViewer({
				viewerId: 99,
				adminLevel: 2,
				canModerate: true,
				canSeeShadowbanned: true,
			}),
		);
		mockRow(makeRawRow({ stateMod: "REMOVED", stateModSetBy: "modbob" }));

		await expect(getCommentById(5, 99)).resolves.toMatchObject({
			authorName: "alice",
			bodyHtml: "<p>hello <strong>world</strong></p>",
			isModHidden: false,
			isRemoved: true,
		});
	});

	it("hides an author-deleted comment behind a placeholder", async () => {
		vi.mocked(getCommentViewerContext).mockResolvedValue(makeViewer());
		mockRow(makeRawRow({ stateUserDeletedUtc: new Date(1000) }));

		await expect(getCommentById(5)).resolves.toMatchObject({
			authorName: "[deleted]",
			bodyHtml: "<p>Deleted by author</p>",
			isModHidden: true,
			isDeleted: true,
		});
	});

	it("hides a FILTERED comment from normal viewers", async () => {
		vi.mocked(getCommentViewerContext).mockResolvedValue(makeViewer());
		mockRow(makeRawRow({ stateMod: "FILTERED" }));

		await expect(getCommentById(5)).resolves.toMatchObject({
			authorName: "[deleted]",
			bodyHtml: "<p>Filtered</p>",
			isModHidden: true,
			isFiltered: true,
		});
	});

	it("hides shadowbanned authors' comments from normal viewers", async () => {
		vi.mocked(getCommentViewerContext).mockResolvedValue(
			makeViewer({ viewerId: 1 }),
		);
		mockRow(makeRawRow({ authorShadowBanned: "modbob" }));

		await expect(getCommentById(5, 1)).resolves.toMatchObject({
			authorName: "[deleted]",
			isModHidden: true,
		});
	});

	it("always shows authors their own moderated comments", async () => {
		vi.mocked(getCommentViewerContext).mockResolvedValue(
			makeViewer({ viewerId: 7 }),
		);
		mockRow(makeRawRow({ stateMod: "REMOVED", stateModSetBy: "modbob" }));

		await expect(getCommentById(5, 7)).resolves.toMatchObject({
			authorName: "alice",
			bodyHtml: "<p>hello <strong>world</strong></p>",
			isModHidden: false,
		});
	});
});
