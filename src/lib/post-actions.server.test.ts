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

vi.mock("@/lib/submissions.server", () => ({
	deleteSubmission: vi.fn(),
	updateSubmission: vi.fn(),
}));

vi.mock("@/lib/lifecycle.server", () => ({
	authorRestoreSubmission: vi.fn(),
	setSubmissionProfilePinnedState: vi.fn(),
	setSubmissionSavedState: vi.fn(),
}));

vi.mock("@/lib/search.server", () => ({ indexSubmissionBestEffort: vi.fn() }));

vi.mock("@/lib/notifications.server", () => ({
	setSubmissionSubscriptionState: vi.fn(),
}));

import type { SafeUser } from "@/lib/auth.server";
import {
	authorRestoreSubmission,
	setSubmissionProfilePinnedState,
	setSubmissionSavedState,
} from "@/lib/lifecycle.server";
import { setSubmissionSubscriptionState } from "@/lib/notifications.server";
import {
	deleteSubmissionFn,
	pinSubmissionToProfileFn,
	restoreSubmissionFn,
	saveSubmissionFn,
	setSubmissionSubscriptionFn,
	updateSubmissionFn,
} from "@/lib/post-actions.server";
import { indexSubmissionBestEffort } from "@/lib/search.server";
import { getCurrentUser } from "@/lib/sessions.server";
import { deleteSubmission, updateSubmission } from "@/lib/submissions.server";

const mockUser: SafeUser = {
	id: 7,
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

describe("post-actions.server", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("restores only the author's eligible post and reindexes it", async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
		vi.mocked(authorRestoreSubmission)
			.mockResolvedValueOnce(false)
			.mockResolvedValueOnce(true);
		await expect(restoreSubmissionFn({ data: { id: 4 } })).resolves.toEqual({
			success: false,
			error: "You cannot restore this post",
		});
		await expect(restoreSubmissionFn({ data: { id: 4 } })).resolves.toEqual({
			success: true,
		});
		expect(authorRestoreSubmission).toHaveBeenCalledWith(4, 7);
		expect(indexSubmissionBestEffort).toHaveBeenCalledWith(4);
	});

	it("allows an author to pin their post to their profile", async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
		vi.mocked(setSubmissionProfilePinnedState).mockResolvedValue(true);
		await expect(
			pinSubmissionToProfileFn({ data: { id: 5, pinned: true } }),
		).resolves.toEqual({ success: true });
		expect(setSubmissionProfilePinnedState).toHaveBeenCalledWith({
			submissionId: 5,
			authorId: 7,
			pinned: true,
		});
	});

	it("rejects submission updates when logged out", async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(null);

		await expect(
			updateSubmissionFn({
				data: {
					id: 1,
					title: "Title",
					url: "https://example.com",
					body: "",
					isNsfw: false,
				},
			}),
		).resolves.toEqual({
			success: false,
			error: "Not logged in",
		});
	});

	it("updates submissions and normalizes blank body and url values", async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
		vi.mocked(updateSubmission).mockResolvedValue(true);

		await expect(
			updateSubmissionFn({
				data: {
					id: 12,
					title: "Updated title",
					url: "",
					body: "",
					isNsfw: true,
				},
			}),
		).resolves.toEqual({ success: true });

		expect(updateSubmission).toHaveBeenCalledWith(
			12,
			7,
			{
				title: "Updated title",
				url: undefined,
				body: undefined,
				isNsfw: true,
			},
			false,
		);
	});

	it("returns an authorization-style error when submission edits fail", async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
		vi.mocked(updateSubmission).mockResolvedValue(false);

		await expect(
			updateSubmissionFn({
				data: {
					id: 12,
					title: "Updated title",
					url: "https://example.com",
					body: "body",
					isNsfw: false,
				},
			}),
		).resolves.toEqual({
			success: false,
			error: "You cannot edit this post",
		});
	});

	it("handles delete submission authorization and success paths", async () => {
		vi.mocked(getCurrentUser).mockResolvedValueOnce(null);
		await expect(deleteSubmissionFn({ data: { id: 5 } })).resolves.toEqual({
			success: false,
			error: "Not logged in",
		});

		vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
		vi.mocked(deleteSubmission).mockResolvedValueOnce(false);
		await expect(deleteSubmissionFn({ data: { id: 5 } })).resolves.toEqual({
			success: false,
			error: "You cannot delete this post",
		});

		vi.mocked(deleteSubmission).mockResolvedValueOnce(true);
		await expect(deleteSubmissionFn({ data: { id: 5 } })).resolves.toEqual({
			success: true,
		});
		expect(deleteSubmission).toHaveBeenLastCalledWith(5, 7);
	});

	it("handles save submission authorization and persistence", async () => {
		vi.mocked(getCurrentUser).mockResolvedValueOnce(null);
		await expect(
			saveSubmissionFn({ data: { id: 9, saved: true } }),
		).resolves.toEqual({
			success: false,
			error: "Not logged in",
		});

		vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
		await expect(
			saveSubmissionFn({ data: { id: 9, saved: false } }),
		).resolves.toEqual({
			success: true,
		});

		expect(setSubmissionSavedState).toHaveBeenCalledWith({
			submissionId: 9,
			userId: 7,
			saved: false,
		});
	});

	it("toggles submission subscriptions for logged-in users", async () => {
		vi.mocked(getCurrentUser).mockResolvedValueOnce(null);
		await expect(
			setSubmissionSubscriptionFn({ data: { id: 13, subscribed: true } }),
		).resolves.toEqual({
			success: false,
			error: "Not logged in",
		});

		vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
		await expect(
			setSubmissionSubscriptionFn({ data: { id: 13, subscribed: false } }),
		).resolves.toEqual({
			success: true,
		});

		expect(setSubmissionSubscriptionState).toHaveBeenCalledWith({
			userId: 7,
			submissionId: 13,
			subscribed: false,
		});
	});
});

import {
	saveSubmissionInputSchema,
	submissionSubscriptionInputSchema,
} from "@/lib/post-actions.server";

describe("post-actions input schemas", () => {
	it("rejects non-boolean flags and bad ids", () => {
		expect(
			saveSubmissionInputSchema.safeParse({ id: 1, saved: "yes" }).success,
		).toBe(false);
		expect(
			submissionSubscriptionInputSchema.safeParse({ id: -1, subscribed: true })
				.success,
		).toBe(false);
	});

	it("accepts valid input", () => {
		expect(
			saveSubmissionInputSchema.safeParse({ id: 1, saved: true }).success,
		).toBe(true);
	});
});
