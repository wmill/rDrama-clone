import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-start", () => ({
	createServerFn: () => {
		const chain = {
			inputValidator: () => chain,
			handler: (handler: unknown) => handler,
		};
		return chain;
	},
}));

vi.mock("@/lib/sessions.server", () => ({
	getCurrentUser: vi.fn(),
}));

vi.mock("@/lib/reporting.server", () => ({
	ReportTargetNotFoundError: class ReportTargetNotFoundError extends Error {},
	reportComment: vi.fn(),
	reportSubmission: vi.fn(),
}));

import type { SafeUser } from "@/lib/auth.server";
import {
	ReportTargetNotFoundError,
	reportComment,
	reportSubmission,
} from "@/lib/reporting.server";
import {
	reportCommentFn,
	reportSubmissionFn,
} from "@/lib/reporting-actions.server";
import { getCurrentUser } from "@/lib/sessions.server";

const mockUser: SafeUser = {
	id: 11,
	username: "alice",
	email: "alice@example.com",
	adminLevel: 0,
	createdUtc: 0,
	isActivated: true,
	isBanned: 0,
	banReason: null,
	unbanUtc: 0,
	shadowBanned: null,
	coins: 0,
	proCoins: 0,
	profileUrl: null,
	bannerUrl: null,
	bio: null,
	customTitle: null,
};

describe("reportSubmissionFn", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("rejects reports when logged out", async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(null);

		await expect(
			reportSubmissionFn({ data: { id: 3, reason: "spam" } }),
		).resolves.toEqual({
			success: false,
			error: "Not logged in",
		});
		expect(reportSubmission).not.toHaveBeenCalled();
	});

	it("delegates to reportSubmission and returns its message", async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
		vi.mocked(reportSubmission).mockResolvedValue({ message: "Reported" });

		await expect(
			reportSubmissionFn({ data: { id: 3, reason: "spam" } }),
		).resolves.toEqual({
			success: true,
			message: "Reported",
		});

		expect(reportSubmission).toHaveBeenCalledWith({
			submissionId: 3,
			user: mockUser,
			reason: "spam",
		});
	});

	it("maps a missing target to a friendly error", async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
		vi.mocked(reportSubmission).mockRejectedValue(
			new ReportTargetNotFoundError("nope"),
		);

		await expect(
			reportSubmissionFn({ data: { id: 999, reason: "" } }),
		).resolves.toEqual({
			success: false,
			error: "Post not found",
		});
	});

	it("surfaces other error messages", async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
		vi.mocked(reportSubmission).mockRejectedValue(
			new Error("You already reported this post"),
		);

		await expect(
			reportSubmissionFn({ data: { id: 3, reason: "" } }),
		).resolves.toEqual({
			success: false,
			error: "You already reported this post",
		});
	});
});

describe("reportCommentFn", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("rejects reports when logged out", async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(null);

		await expect(
			reportCommentFn({ data: { id: 5, reason: "" } }),
		).resolves.toEqual({
			success: false,
			error: "Not logged in",
		});
		expect(reportComment).not.toHaveBeenCalled();
	});

	it("delegates to reportComment and returns its message", async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
		vi.mocked(reportComment).mockResolvedValue({ message: "Reported" });

		await expect(
			reportCommentFn({ data: { id: 5, reason: "rude" } }),
		).resolves.toEqual({
			success: true,
			message: "Reported",
		});

		expect(reportComment).toHaveBeenCalledWith({
			commentId: 5,
			user: mockUser,
			reason: "rude",
		});
	});

	it("maps a missing target to a friendly error", async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
		vi.mocked(reportComment).mockRejectedValue(
			new ReportTargetNotFoundError("nope"),
		);

		await expect(
			reportCommentFn({ data: { id: 999, reason: "" } }),
		).resolves.toEqual({
			success: false,
			error: "Comment not found",
		});
	});

	it("falls back to a generic message for non-Error throws", async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
		vi.mocked(reportComment).mockRejectedValue("boom");

		await expect(
			reportCommentFn({ data: { id: 5, reason: "" } }),
		).resolves.toEqual({
			success: false,
			error: "Failed to report comment",
		});
	});
});
