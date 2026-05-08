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

vi.mock("@/lib/comments.server", () => ({
	createComment: vi.fn(),
	deleteComment: vi.fn(),
	getCommentById: vi.fn(),
	getCommentsBySubmissionSince: vi.fn(),
	updateComment: vi.fn(),
}));

vi.mock("@/lib/lifecycle.server", () => ({
	setCommentSavedState: vi.fn(),
}));

import type { SafeUser } from "@/lib/auth.server";
import {
	createComment,
	deleteComment,
	getCommentById,
	getCommentsBySubmissionSince,
	updateComment,
} from "@/lib/comments.server";
import {
	createCommentFn,
	deleteCommentFn,
	getCommentsSinceFn,
	saveCommentFn,
	updateCommentFn,
} from "@/lib/comment-actions.server";
import { setCommentSavedState } from "@/lib/lifecycle.server";
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

describe("comment-actions.server", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("rejects comment creation when logged out", async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(null);

		await expect(
			createCommentFn({
				data: { body: "hello", parentSubmissionId: 3, parentCommentId: 1 },
			}),
		).resolves.toEqual({
			success: false,
			error: "Not logged in",
		});
	});

	it("creates a comment and returns the fetched comment payload", async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
		vi.mocked(createComment).mockResolvedValue(42);
		vi.mocked(getCommentById).mockResolvedValue({
			id: 42,
			body: "hello",
		} as never);

		await expect(
			createCommentFn({
				data: { body: "hello", parentSubmissionId: 3, parentCommentId: 1 },
			}),
		).resolves.toEqual({
			success: true,
			id: 42,
			comment: { id: 42, body: "hello" },
		});

		expect(createComment).toHaveBeenCalledWith({
			authorId: 11,
			body: "hello",
			parentSubmissionId: 3,
			parentCommentId: 1,
		});
		expect(getCommentById).toHaveBeenCalledWith(42, 11);
	});

	it("returns useful comment creation errors", async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
		vi.mocked(createComment).mockRejectedValueOnce(new Error("Too long"));

		await expect(
			createCommentFn({
				data: { body: "hello", parentSubmissionId: 3 },
			}),
		).resolves.toEqual({
			success: false,
			error: "Too long",
		});

		vi.mocked(createComment).mockRejectedValueOnce("bad");
		await expect(
			createCommentFn({
				data: { body: "hello", parentSubmissionId: 3 },
			}),
		).resolves.toEqual({
			success: false,
			error: "Failed to create comment",
		});
	});

	it("handles update and delete authorization plus delegated results", async () => {
		vi.mocked(getCurrentUser).mockResolvedValueOnce(null);
		await expect(
			updateCommentFn({ data: { id: 5, body: "edit" } }),
		).resolves.toEqual({
			success: false,
			error: "Not logged in",
		});

		vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
		vi.mocked(updateComment).mockResolvedValue(true);
		await expect(
			updateCommentFn({ data: { id: 5, body: "edit" } }),
		).resolves.toEqual({
			success: true,
		});
		expect(updateComment).toHaveBeenCalledWith(5, 11, "edit");

		vi.mocked(getCurrentUser).mockResolvedValueOnce(null);
		await expect(deleteCommentFn({ data: { id: 6 } })).resolves.toEqual({
			success: false,
			error: "Not logged in",
		});

		vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
		vi.mocked(deleteComment).mockResolvedValue(false);
		await expect(deleteCommentFn({ data: { id: 6 } })).resolves.toEqual({
			success: false,
		});
		expect(deleteComment).toHaveBeenCalledWith(6, 11);
	});

	it("handles save comment authorization and persistence", async () => {
		vi.mocked(getCurrentUser).mockResolvedValueOnce(null);
		await expect(
			saveCommentFn({ data: { id: 8, saved: true } }),
		).resolves.toEqual({
			success: false,
			error: "Not logged in",
		});

		vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
		await expect(
			saveCommentFn({ data: { id: 8, saved: false } }),
		).resolves.toEqual({
			success: true,
		});

		expect(setCommentSavedState).toHaveBeenCalledWith({
			commentId: 8,
			userId: 11,
			saved: false,
		});
	});

	it("returns fetched comments and uses the latest timestamp", async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
		vi.mocked(getCommentsBySubmissionSince).mockResolvedValue([
			{ id: 1, createdUtc: 9 },
			{ id: 2, createdUtc: 15 },
		] as never);

		await expect(
			getCommentsSinceFn({ data: { submissionId: 3, since: 5 } }),
		).resolves.toEqual({
			success: true,
			comments: [
				{ id: 1, createdUtc: 9 },
				{ id: 2, createdUtc: 15 },
			],
			lastFetchedAt: 15,
		});

		expect(getCommentsBySubmissionSince).toHaveBeenCalledWith(3, 5, 11);
	});

	it("falls back to Date.now when no comments are returned", async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(null);
		vi.mocked(getCommentsBySubmissionSince).mockResolvedValue([] as never);
		vi.spyOn(Date, "now").mockReturnValue(123_000);

		await expect(
			getCommentsSinceFn({ data: { submissionId: 4, since: 10 } }),
		).resolves.toEqual({
			success: true,
			comments: [],
			lastFetchedAt: 123,
		});

		expect(getCommentsBySubmissionSince).toHaveBeenCalledWith(4, 10, undefined);
	});
});
