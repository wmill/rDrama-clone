import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({
	db: {
		select: vi.fn(),
		insert: vi.fn(),
		update: vi.fn(),
		delete: vi.fn(),
	},
}));

import { db } from "@/db";
import {
	getModLog,
	getModQueueComments,
	getModQueueSubmissions,
	getReportedComments,
	getReportedSubmissions,
	getUserAdminDetails,
	MOD_LOG_PER_PAGE,
	searchUsers,
} from "@/lib/admin.server";

function createChain(terminal: string, result: unknown) {
	const chain: Record<string, ReturnType<typeof vi.fn>> = {};
	for (const method of [
		"from",
		"innerJoin",
		"leftJoin",
		"where",
		"orderBy",
		"limit",
		"offset",
	]) {
		chain[method] = vi.fn(() => chain);
	}
	chain[terminal] = vi.fn().mockResolvedValue(result);
	return chain;
}

describe("getReportedSubmissions", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns an empty list without querying flags when nothing is reported", async () => {
		vi.mocked(db.select).mockReturnValueOnce(
			createChain("orderBy", []) as never,
		);

		await expect(getReportedSubmissions()).resolves.toEqual([]);
		expect(db.select).toHaveBeenCalledTimes(1);
	});

	it("groups reporter flags onto their submissions", async () => {
		vi.mocked(db.select)
			.mockReturnValueOnce(
				createChain("orderBy", [
					{
						id: 1,
						title: "First",
						titleHtml: "First",
						authorId: 7,
						authorName: "alice",
						createdUtc: 100,
						stateReport: "REPORTED",
						stateMod: "VISIBLE",
					},
					{
						id: 2,
						title: "Second",
						titleHtml: "Second",
						authorId: 8,
						authorName: "bob",
						createdUtc: 200,
						stateReport: "REPORTED",
						stateMod: "VISIBLE",
					},
				]) as never,
			)
			.mockReturnValueOnce(
				createChain("where", [
					{ postId: 1, userId: 20, reporterName: "carol", reason: "spam" },
					{ postId: 1, userId: 21, reporterName: "dave", reason: null },
				]) as never,
			);

		const result = await getReportedSubmissions();

		expect(result).toHaveLength(2);
		expect(result[0].flags).toEqual([
			{ userId: 20, reporterName: "carol", reason: "spam" },
			{ userId: 21, reporterName: "dave", reason: null },
		]);
		expect(result[1].flags).toEqual([]);
	});
});

describe("getReportedComments", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns an empty list without querying flags when nothing is reported", async () => {
		vi.mocked(db.select).mockReturnValueOnce(
			createChain("orderBy", []) as never,
		);

		await expect(getReportedComments()).resolves.toEqual([]);
		expect(db.select).toHaveBeenCalledTimes(1);
	});

	it("groups reporter flags onto their comments", async () => {
		vi.mocked(db.select)
			.mockReturnValueOnce(
				createChain("orderBy", [
					{
						id: 9,
						bodyHtml: "<p>rude</p>",
						authorId: 7,
						authorName: "alice",
						createdUtc: 100,
						stateReport: "REPORTED",
						stateMod: "VISIBLE",
						parentSubmissionId: 42,
						parentSubmissionTitle: "A post",
					},
				]) as never,
			)
			.mockReturnValueOnce(
				createChain("where", [
					{ commentId: 9, userId: 20, reporterName: "carol", reason: "rude" },
				]) as never,
			);

		const result = await getReportedComments();

		expect(result).toHaveLength(1);
		expect(result[0].flags).toEqual([
			{ userId: 20, reporterName: "carol", reason: "rude" },
		]);
	});
});

describe("getModQueueSubmissions", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns submissions in the requested moderation state", async () => {
		const rows = [
			{
				id: 3,
				titleHtml: "Held post",
				authorId: 7,
				authorName: "alice",
				authorShadowBanned: null,
				createdUtc: 100,
				stateMod: "FILTERED",
				stateModSetBy: "AUTOMATIC",
			},
		];
		vi.mocked(db.select).mockReturnValueOnce(
			createChain("limit", rows) as never,
		);

		await expect(getModQueueSubmissions("FILTERED")).resolves.toEqual(rows);
		expect(db.select).toHaveBeenCalledTimes(1);
	});

	it("returns visible submissions from shadowbanned authors", async () => {
		const rows = [
			{
				id: 4,
				titleHtml: "Sneaky post",
				authorId: 8,
				authorName: "bob",
				authorShadowBanned: "shadowbanned",
				createdUtc: 200,
				stateMod: "VISIBLE",
				stateModSetBy: null,
			},
		];
		vi.mocked(db.select).mockReturnValueOnce(
			createChain("limit", rows) as never,
		);

		await expect(getModQueueSubmissions("SHADOWBANNED")).resolves.toEqual(rows);
	});
});

describe("getModQueueComments", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns comments in the requested moderation state with their parent post", async () => {
		const rows = [
			{
				id: 9,
				bodyHtml: "<p>removed comment</p>",
				authorId: 7,
				authorName: "alice",
				authorShadowBanned: null,
				createdUtc: 100,
				stateMod: "REMOVED",
				stateModSetBy: "modbob",
				parentSubmissionId: 42,
				parentSubmissionTitle: "A post",
			},
		];
		vi.mocked(db.select).mockReturnValueOnce(
			createChain("limit", rows) as never,
		);

		await expect(getModQueueComments("REMOVED")).resolves.toEqual(rows);
	});
});

describe("getModLog", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	function makeEntry(id: number) {
		return {
			id,
			kind: "ban_user",
			note: "spam",
			createdDatetimez: new Date(1000 + id),
			actorId: 1,
			actorName: "modbob",
			targetUserId: 7,
			targetUserName: "alice",
			targetSubmissionId: null,
			targetSubmissionTitle: null,
			targetCommentId: null,
		};
	}

	it("returns entries without hasMore when under a full page", async () => {
		const rows = [makeEntry(2), makeEntry(1)];
		vi.mocked(db.select).mockReturnValueOnce(
			createChain("offset", rows) as never,
		);

		await expect(getModLog(1)).resolves.toEqual({
			entries: rows,
			page: 1,
			hasMore: false,
		});
	});

	it("trims the extra row and reports hasMore on a full page", async () => {
		const rows = Array.from({ length: MOD_LOG_PER_PAGE + 1 }, (_, i) =>
			makeEntry(MOD_LOG_PER_PAGE + 1 - i),
		);
		vi.mocked(db.select).mockReturnValueOnce(
			createChain("offset", rows) as never,
		);

		const result = await getModLog(1);
		expect(result.entries).toHaveLength(MOD_LOG_PER_PAGE);
		expect(result.hasMore).toBe(true);
	});

	it("clamps invalid page numbers to 1", async () => {
		vi.mocked(db.select).mockReturnValueOnce(
			createChain("offset", []) as never,
		);

		const result = await getModLog(-3);
		expect(result.page).toBe(1);
	});
});

describe("searchUsers", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns matching users", async () => {
		const rows = [
			{
				id: 7,
				username: "alice",
				adminLevel: 0,
				isBanned: 0,
				shadowBanned: null,
			},
		];
		vi.mocked(db.select).mockReturnValueOnce(
			createChain("limit", rows) as never,
		);

		await expect(searchUsers("ali")).resolves.toEqual(rows);
	});
});

describe("getUserAdminDetails", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns null for an unknown user", async () => {
		vi.mocked(db.select).mockReturnValueOnce(createChain("limit", []) as never);

		await expect(getUserAdminDetails(12345)).resolves.toBeNull();
		expect(db.select).toHaveBeenCalledTimes(1);
	});

	it("returns the user with their moderation notes", async () => {
		const user = { id: 7, username: "alice" };
		const notes = [
			{
				id: 1,
				note: "warned once",
				tag: "warning",
				authorName: "modbob",
				createdDatetimez: new Date(1000),
				referencePost: null,
				referenceComment: null,
			},
		];
		vi.mocked(db.select)
			.mockReturnValueOnce(createChain("limit", [user]) as never)
			.mockReturnValueOnce(createChain("orderBy", notes) as never);

		await expect(getUserAdminDetails(7)).resolves.toEqual({ user, notes });
	});
});
