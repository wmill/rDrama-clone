import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock } = vi.hoisted(() => ({
	dbMock: {
		select: vi.fn(),
		update: vi.fn(),
		insert: vi.fn(),
	},
}));

vi.mock("@tanstack/react-start", () => ({
	createServerFn: () => {
		const chain = {
			inputValidator: () => chain,
			handler: (handler: unknown) => handler,
		};
		return chain;
	},
}));

vi.mock("@/db", () => ({
	db: dbMock,
}));

vi.mock("@/lib/sessions.server", () => ({
	getCurrentUser: vi.fn(),
}));

vi.mock("@/lib/lifecycle.server", () => ({
	setCommentPinnedState: vi.fn(),
	setCommentRemovedState: vi.fn(),
	setSubmissionRemovedState: vi.fn(),
	setSubmissionStickyState: vi.fn(),
}));

import type { SafeUser } from "@/lib/auth.server";
import {
	banUserFn,
	createUserNoteFn,
	distinguishCommentFn,
	distinguishSubmissionFn,
	pinCommentFn,
	removeCommentFn,
	removeSubmissionFn,
	shadowbanUserFn,
	stickySubmissionFn,
	unbanUserFn,
	unshadowbanUserFn,
	updateCommentFilterStatusFn,
	updateSubmissionFilterStatusFn,
} from "@/lib/admin-actions.server";
import {
	setCommentPinnedState,
	setCommentRemovedState,
	setSubmissionRemovedState,
	setSubmissionStickyState,
} from "@/lib/lifecycle.server";
import { getCurrentUser } from "@/lib/sessions.server";

function createSelectChain<T>(result: T) {
	return {
		from: vi.fn().mockReturnThis(),
		where: vi.fn().mockReturnThis(),
		limit: vi.fn().mockResolvedValue(result),
	};
}

function createUpdateChain() {
	return {
		set: vi.fn().mockReturnValue({
			where: vi.fn().mockResolvedValue(undefined),
		}),
	};
}

function createInsertChain() {
	return {
		values: vi.fn().mockResolvedValue(undefined),
	};
}

const moderator: SafeUser = {
	id: 2,
	username: "mod",
	email: "mod@example.com",
	adminLevel: 2,
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

const janitor: SafeUser = {
	...moderator,
	id: 3,
	username: "janitor",
	adminLevel: 1,
};

describe("admin-actions.server", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("rejects filter updates from unauthorized users", async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(null);

		await expect(
			updateSubmissionFilterStatusFn({ data: { id: 1, action: "normal" } }),
		).resolves.toEqual({
			success: false,
			error: "Unauthorized",
		});
		await expect(
			updateCommentFilterStatusFn({ data: { id: 1, action: "removed" } }),
		).resolves.toEqual({
			success: false,
			error: "Unauthorized",
		});
	});

	it("delegates submission and comment filter actions to lifecycle helpers", async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(moderator);

		await expect(
			updateSubmissionFilterStatusFn({ data: { id: 10, action: "normal" } }),
		).resolves.toEqual({ success: true });
		await expect(
			updateSubmissionFilterStatusFn({ data: { id: 11, action: "removed" } }),
		).resolves.toEqual({ success: true });
		await expect(
			updateCommentFilterStatusFn({ data: { id: 20, action: "normal" } }),
		).resolves.toEqual({ success: true });
		await expect(
			updateCommentFilterStatusFn({ data: { id: 21, action: "removed" } }),
		).resolves.toEqual({ success: true });

		expect(setSubmissionRemovedState).toHaveBeenNthCalledWith(
			1,
			{
				submissionId: 10,
				moderatorId: 2,
				moderatorName: "mod",
				removed: false,
				actionKind: "approve_post",
			},
			dbMock,
		);
		expect(setSubmissionRemovedState).toHaveBeenNthCalledWith(2, {
			submissionId: 11,
			moderatorId: 2,
			moderatorName: "mod",
			removed: true,
		}, dbMock);
		expect(setCommentRemovedState).toHaveBeenNthCalledWith(
			1,
			{
				commentId: 20,
				moderatorId: 2,
				moderatorName: "mod",
				removed: false,
				actionKind: "approve_comment",
			},
			dbMock,
		);
		expect(setCommentRemovedState).toHaveBeenNthCalledWith(2, {
			commentId: 21,
			moderatorId: 2,
			moderatorName: "mod",
			removed: true,
		}, dbMock);
	});

	it("marks ignored reports directly in the database", async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(moderator);
		const submissionUpdate = createUpdateChain();
		const commentUpdate = createUpdateChain();
		dbMock.update
			.mockReturnValueOnce(submissionUpdate)
			.mockReturnValueOnce(commentUpdate);

		await expect(
			updateSubmissionFilterStatusFn({ data: { id: 12, action: "ignored" } }),
		).resolves.toEqual({ success: true });
		await expect(
			updateCommentFilterStatusFn({ data: { id: 22, action: "ignored" } }),
		).resolves.toEqual({ success: true });

		expect(submissionUpdate.set).toHaveBeenCalledWith({ stateReport: "IGNORED" });
		expect(commentUpdate.set).toHaveBeenCalledWith({ stateReport: "IGNORED" });
	});

	it("handles direct lifecycle moderation actions and not-found failures", async () => {
		vi.mocked(getCurrentUser).mockResolvedValueOnce(null);
		await expect(
			removeSubmissionFn({ data: { id: 1, removed: true } }),
		).resolves.toEqual({
			success: false,
			error: "Unauthorized",
		});

		vi.mocked(getCurrentUser).mockResolvedValue(moderator);
		vi.mocked(setSubmissionRemovedState).mockResolvedValueOnce(false);
		await expect(
			removeSubmissionFn({ data: { id: 1, removed: true } }),
		).resolves.toEqual({
			success: false,
			error: "Post not found",
		});

		vi.mocked(setSubmissionStickyState).mockResolvedValueOnce(true);
		await expect(
			stickySubmissionFn({ data: { id: 1, stickied: true } }),
		).resolves.toEqual({
			success: true,
		});

		vi.mocked(setCommentRemovedState).mockResolvedValueOnce(true);
		await expect(
			removeCommentFn({ data: { id: 5, removed: false } }),
		).resolves.toEqual({
			success: true,
		});

		vi.mocked(setCommentPinnedState).mockResolvedValueOnce(false);
		await expect(
			pinCommentFn({ data: { id: 6, pinned: true } }),
		).resolves.toEqual({
			success: false,
			error: "Comment not found",
		});
	});

	it("updates user ban and shadowban state with modaction logs", async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(moderator);
		const banUpdate = createUpdateChain();
		const unbanUpdate = createUpdateChain();
		const shadowbanUpdate = createUpdateChain();
		const unshadowbanUpdate = createUpdateChain();
		const firstInsert = createInsertChain();
		const secondInsert = createInsertChain();
		const thirdInsert = createInsertChain();
		const fourthInsert = createInsertChain();
		dbMock.update
			.mockReturnValueOnce(banUpdate)
			.mockReturnValueOnce(unbanUpdate)
			.mockReturnValueOnce(shadowbanUpdate)
			.mockReturnValueOnce(unshadowbanUpdate);
		dbMock.insert
			.mockReturnValueOnce(firstInsert)
			.mockReturnValueOnce(secondInsert)
			.mockReturnValueOnce(thirdInsert)
			.mockReturnValueOnce(fourthInsert);
		vi.spyOn(Date, "now").mockReturnValue(100_000);

		await expect(
			banUserFn({ data: { userId: 9, reason: "spam", durationDays: 2 } }),
		).resolves.toEqual({ success: true });
		await expect(unbanUserFn({ data: { userId: 9 } })).resolves.toEqual({
			success: true,
		});
		await expect(shadowbanUserFn({ data: { userId: 9 } })).resolves.toEqual({
			success: true,
		});
		await expect(
			unshadowbanUserFn({ data: { userId: 9 } }),
		).resolves.toEqual({
			success: true,
		});

		expect(banUpdate.set).toHaveBeenCalledWith({
			isBanned: 1,
			banReason: "spam",
			unbanUtc: 172900,
		});
		expect(unbanUpdate.set).toHaveBeenCalledWith({
			isBanned: 0,
			banReason: null,
			unbanUtc: 0,
		});
		expect(shadowbanUpdate.set).toHaveBeenCalledWith({
			shadowBanned: "shadowbanned",
		});
		expect(unshadowbanUpdate.set).toHaveBeenCalledWith({
			shadowBanned: null,
		});
		expect(firstInsert.values).toHaveBeenCalledWith({
			userId: 2,
			targetUserId: 9,
			kind: "ban_user",
			note: "spam",
		});
		expect(secondInsert.values).toHaveBeenCalledWith({
			userId: 2,
			targetUserId: 9,
			kind: "unban_user",
		});
		expect(thirdInsert.values).toHaveBeenCalledWith({
			userId: 2,
			targetUserId: 9,
			kind: "shadowban",
		});
		expect(fourthInsert.values).toHaveBeenCalledWith({
			userId: 2,
			targetUserId: 9,
			kind: "unshadowban",
		});
	});

	it("creates user notes, rejects bad tags, and enforces admin-only access", async () => {
		vi.mocked(getCurrentUser).mockResolvedValueOnce(janitor);
		await expect(
			createUserNoteFn({
				data: { userId: 9, note: "note", tag: "Quality" },
			}),
		).resolves.toEqual({
			success: false,
			error: "Unauthorized",
		});

		vi.mocked(getCurrentUser).mockResolvedValueOnce(moderator);
		await expect(
			createUserNoteFn({
				data: { userId: 9, note: "note", tag: "BadTag" },
			}),
		).resolves.toEqual({
			success: false,
			error: "Invalid tag",
		});

		const insertChain = createInsertChain();
		dbMock.insert.mockReturnValueOnce(insertChain);
		vi.mocked(getCurrentUser).mockResolvedValueOnce(moderator);
		await expect(
			createUserNoteFn({
				data: {
					userId: 9,
					note: "watch closely",
					tag: "Warning",
					referencePost: 1,
				},
			}),
		).resolves.toEqual({
			success: true,
		});

		expect(insertChain.values).toHaveBeenCalledWith({
			authorId: 2,
			referenceUser: 9,
			note: "watch closely",
			tag: "Warning",
			referencePost: 1,
			referenceComment: null,
		});
	});

	it("toggles submission distinguish state with author and moderator permissions", async () => {
		vi.mocked(getCurrentUser).mockResolvedValueOnce(null);
		await expect(
			distinguishSubmissionFn({ data: { id: 40 } }),
		).resolves.toEqual({
			success: false,
			error: "Unauthorized",
		});

		vi.mocked(getCurrentUser).mockResolvedValueOnce(janitor);
		dbMock.select.mockReturnValueOnce(createSelectChain([]));
		await expect(
			distinguishSubmissionFn({ data: { id: 40 } }),
		).resolves.toEqual({
			success: false,
			error: "Post not found",
		});

		vi.mocked(getCurrentUser).mockResolvedValueOnce(janitor);
		dbMock.select.mockReturnValueOnce(
			createSelectChain([{ id: 40, authorId: 99, distinguishLevel: 0 }]),
		);
		await expect(
			distinguishSubmissionFn({ data: { id: 40 } }),
		).resolves.toEqual({
			success: false,
			error: "Unauthorized",
		});

		const updateChain = createUpdateChain();
		const insertChain = createInsertChain();
		vi.mocked(getCurrentUser).mockResolvedValueOnce(janitor);
		dbMock.select.mockReturnValueOnce(
			createSelectChain([{ id: 40, authorId: 3, distinguishLevel: 0 }]),
		);
		dbMock.update.mockReturnValueOnce(updateChain);
		dbMock.insert.mockReturnValueOnce(insertChain);
		await expect(
			distinguishSubmissionFn({ data: { id: 40 } }),
		).resolves.toEqual({
			success: true,
			distinguishLevel: 1,
		});
		expect(updateChain.set).toHaveBeenCalledWith({ distinguishLevel: 1 });
		expect(insertChain.values).toHaveBeenCalledWith({
			userId: 3,
			targetSubmissionId: 40,
			kind: "distinguish_post",
		});
	});

	it("toggles comment distinguish state and logs the correct action kind", async () => {
		const updateChain = createUpdateChain();
		const insertChain = createInsertChain();
		vi.mocked(getCurrentUser).mockResolvedValue(moderator);
		dbMock.select.mockReturnValueOnce(
			createSelectChain([{ id: 50, authorId: 9, distinguishLevel: 1 }]),
		);
		dbMock.update.mockReturnValueOnce(updateChain);
		dbMock.insert.mockReturnValueOnce(insertChain);

		await expect(
			distinguishCommentFn({ data: { id: 50 } }),
		).resolves.toEqual({
			success: true,
			distinguishLevel: 0,
		});

		expect(updateChain.set).toHaveBeenCalledWith({ distinguishLevel: 0 });
		expect(insertChain.values).toHaveBeenCalledWith({
			userId: 2,
			targetCommentId: 50,
			kind: "undistinguish_comment",
		});
	});
});
