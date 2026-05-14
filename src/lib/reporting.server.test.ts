import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({
	db: {
		transaction: vi.fn(),
	},
}));

import { db } from "@/db";
import {
	isSuspendedPermanently,
	normalizeReportReason,
	ReportTargetNotFoundError,
	reportComment,
	reportSubmission,
} from "@/lib/reporting.server";

function createSelectChain<T>(result: T) {
	return {
		from: vi.fn().mockReturnThis(),
		where: vi.fn().mockReturnThis(),
		limit: vi.fn().mockResolvedValue(result),
	};
}

function createInsertChain() {
	return {
		values: vi.fn().mockResolvedValue(undefined),
	};
}

function createUpdateChain() {
	return {
		set: vi.fn().mockReturnValue({
			where: vi.fn().mockResolvedValue(undefined),
		}),
	};
}

describe("reporting helpers", () => {
	it("normalizes report reasons like legacy title sanitization", () => {
		expect(normalizeReportReason("  hello \u200b  world  ")).toBe(
			"hello world",
		);
		expect(normalizeReportReason("x".repeat(120))).toHaveLength(100);
	});

	it("detects permanent suspension from ban state", () => {
		expect(isSuspendedPermanently({ isBanned: 1, unbanUtc: 0 })).toBe(true);
		expect(isSuspendedPermanently({ isBanned: 1, unbanUtc: 123 })).toBe(false);
	});
});

describe("reportSubmission", () => {
	const user = {
		id: 7,
		adminLevel: 0,
		isBanned: 0,
		unbanUtc: 0,
		shadowBanned: null,
	};

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("creates a flag and marks the post reported", async () => {
		const selectChain = createSelectChain([
			{ id: 10, stateReport: "UNREPORTED" },
		]);
		const insertChain = createInsertChain();
		const updateChain = createUpdateChain();
		const tx = {
			select: vi.fn(() => selectChain),
			insert: vi.fn(() => insertChain),
			update: vi.fn(() => updateChain),
		};

		vi.mocked(db.transaction).mockImplementation(async (callback) =>
			callback(tx as never),
		);

		const result = await reportSubmission({
			submissionId: 10,
			user,
			reason: "  test report  ",
		});

		expect(result.message).toBe("Post reported!");
		expect(insertChain.values).toHaveBeenCalledWith({
			postId: 10,
			userId: 7,
			reason: "test report",
		});
		expect(updateChain.set).toHaveBeenCalledWith({ stateReport: "REPORTED" });
	});

	it("uses !reason as admin flair and logs a mod action", async () => {
		const selectChain = createSelectChain([
			{ id: 11, stateReport: "UNREPORTED" },
		]);
		const updateChain = createUpdateChain();
		const modActionInsertChain = createInsertChain();
		const tx = {
			select: vi.fn(() => selectChain),
			insert: vi.fn(() => modActionInsertChain),
			update: vi.fn(() => updateChain),
		};

		vi.mocked(db.transaction).mockImplementation(async (callback) =>
			callback(tx as never),
		);

		await reportSubmission({
			submissionId: 11,
			user: { ...user, adminLevel: 2 },
			reason: "!announcement",
		});

		expect(updateChain.set).toHaveBeenCalledWith({ flair: "announcement" });
		expect(modActionInsertChain.values).toHaveBeenCalledWith({
			kind: "flair_post",
			userId: 7,
			targetSubmissionId: 11,
			note: '"announcement"',
		});
	});

	it("throws when the post does not exist", async () => {
		const tx = {
			select: vi.fn(() => createSelectChain([])),
			insert: vi.fn(),
			update: vi.fn(),
		};

		vi.mocked(db.transaction).mockImplementation(async (callback) =>
			callback(tx as never),
		);

		await expect(
			reportSubmission({
				submissionId: 999,
				user,
				reason: "test",
			}),
		).rejects.toBeInstanceOf(ReportTargetNotFoundError);
	});
});

describe("reportComment", () => {
	const user = {
		id: 8,
		adminLevel: 0,
		isBanned: 0,
		unbanUtc: 0,
		shadowBanned: null,
	};

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("creates a comment flag and marks the comment reported", async () => {
		const selectChain = createSelectChain([
			{ id: 21, stateReport: "UNREPORTED" },
		]);
		const insertChain = createInsertChain();
		const updateChain = createUpdateChain();
		const tx = {
			select: vi.fn(() => selectChain),
			insert: vi.fn(() => insertChain),
			update: vi.fn(() => updateChain),
		};

		vi.mocked(db.transaction).mockImplementation(async (callback) =>
			callback(tx as never),
		);

		const result = await reportComment({
			commentId: 21,
			user,
			reason: " comment report ",
		});

		expect(result.message).toBe("Comment reported!");
		expect(insertChain.values).toHaveBeenCalledWith({
			commentId: 21,
			userId: 8,
			reason: "comment report",
		});
		expect(updateChain.set).toHaveBeenCalledWith({ stateReport: "REPORTED" });
	});

	it("silently ignores reports from permanently banned or shadowbanned users", async () => {
		const result = await reportComment({
			commentId: 21,
			user: {
				...user,
				isBanned: 1,
				unbanUtc: 0,
				shadowBanned: "AutoJanny",
			},
			reason: "ignored",
		});

		expect(result.message).toBe("Comment reported!");
		expect(db.transaction).not.toHaveBeenCalled();
	});
});
