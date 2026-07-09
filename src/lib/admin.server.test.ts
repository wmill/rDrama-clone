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
	getReportedComments,
	getReportedSubmissions,
	getUserAdminDetails,
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
