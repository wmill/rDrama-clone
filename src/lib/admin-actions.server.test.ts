import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock } = vi.hoisted(() => ({
	dbMock: {
		select: vi.fn(),
		update: vi.fn(),
		insert: vi.fn(),
		delete: vi.fn(),
		transaction: vi.fn(),
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
	setCommentModerationState: vi.fn(),
	setCommentRemovedState: vi.fn(),
	setSubmissionModerationState: vi.fn(),
	setSubmissionRemovedState: vi.fn(),
	setSubmissionStickyState: vi.fn(),
}));

vi.mock("@/lib/users.server", () => ({
	getUserByUsernameCanonical: vi.fn(),
}));

import {
	addBannedDomainFn,
	banUserFn,
	createUserNoteFn,
	distinguishCommentFn,
	distinguishSubmissionFn,
	linkUserAltFn,
	pinCommentFn,
	removeBannedDomainFn,
	removeCommentFn,
	removeSubmissionFn,
	setCommentModerationStateFn,
	setSubmissionModerationStateFn,
	shadowbanUserFn,
	stickySubmissionFn,
	unbanUserFn,
	unlinkUserAltFn,
	unshadowbanUserFn,
	updateCommentFilterStatusFn,
	updateSubmissionFilterStatusFn,
	updateSubmissionModerationDetailsFn,
	updateUserModerationProfileFn,
} from "@/lib/admin-actions.server";
import type { SafeUser } from "@/lib/auth.server";
import {
	setCommentModerationState,
	setCommentPinnedState,
	setCommentRemovedState,
	setSubmissionModerationState,
	setSubmissionRemovedState,
	setSubmissionStickyState,
} from "@/lib/lifecycle.server";
import { getCurrentUser } from "@/lib/sessions.server";
import { getUserByUsernameCanonical } from "@/lib/users.server";

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
			updateSubmissionFilterStatusFn({ data: { id: 1, action: "approve" } }),
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
			updateSubmissionFilterStatusFn({ data: { id: 10, action: "approve" } }),
		).resolves.toEqual({ success: true });
		await expect(
			updateSubmissionFilterStatusFn({ data: { id: 11, action: "filtered" } }),
		).resolves.toEqual({ success: true });
		await expect(
			updateSubmissionFilterStatusFn({ data: { id: 12, action: "removed" } }),
		).resolves.toEqual({ success: true });
		await expect(
			updateCommentFilterStatusFn({ data: { id: 20, action: "approve" } }),
		).resolves.toEqual({ success: true });
		await expect(
			updateCommentFilterStatusFn({ data: { id: 21, action: "filtered" } }),
		).resolves.toEqual({ success: true });
		await expect(
			updateCommentFilterStatusFn({ data: { id: 22, action: "removed" } }),
		).resolves.toEqual({ success: true });

		expect(setSubmissionModerationState).toHaveBeenNthCalledWith(
			1,
			{
				submissionId: 10,
				moderatorId: 2,
				moderatorName: "mod",
				state: "VISIBLE",
				actionKind: "approve_post",
			},
			dbMock,
		);
		expect(setSubmissionModerationState).toHaveBeenNthCalledWith(
			2,
			{
				submissionId: 11,
				moderatorId: 2,
				moderatorName: "mod",
				state: "FILTERED",
			},
			dbMock,
		);
		expect(setSubmissionModerationState).toHaveBeenNthCalledWith(
			3,
			{
				submissionId: 12,
				moderatorId: 2,
				moderatorName: "mod",
				state: "REMOVED",
			},
			dbMock,
		);
		expect(setCommentModerationState).toHaveBeenNthCalledWith(
			1,
			{
				commentId: 20,
				moderatorId: 2,
				moderatorName: "mod",
				state: "VISIBLE",
				actionKind: "approve_comment",
			},
			dbMock,
		);
		expect(setCommentModerationState).toHaveBeenNthCalledWith(
			2,
			{
				commentId: 21,
				moderatorId: 2,
				moderatorName: "mod",
				state: "FILTERED",
			},
			dbMock,
		);
		expect(setCommentModerationState).toHaveBeenNthCalledWith(
			3,
			{
				commentId: 22,
				moderatorId: 2,
				moderatorName: "mod",
				state: "REMOVED",
			},
			dbMock,
		);
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

		expect(submissionUpdate.set).toHaveBeenCalledWith({
			stateReport: "IGNORED",
		});
		expect(commentUpdate.set).toHaveBeenCalledWith({ stateReport: "IGNORED" });
	});

	it("handles direct lifecycle moderation actions and not-found failures", async () => {
		vi.mocked(getCurrentUser).mockResolvedValueOnce(null);
		await expect(
			setSubmissionModerationStateFn({ data: { id: 1, state: "REMOVED" } }),
		).resolves.toEqual({
			success: false,
			error: "Unauthorized",
		});

		vi.mocked(getCurrentUser).mockResolvedValue(moderator);
		vi.mocked(setSubmissionModerationState).mockResolvedValueOnce(false);
		await expect(
			setSubmissionModerationStateFn({ data: { id: 1, state: "REMOVED" } }),
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

		vi.mocked(setCommentModerationState).mockResolvedValueOnce(true);
		await expect(
			setCommentModerationStateFn({ data: { id: 5, state: "FILTERED" } }),
		).resolves.toEqual({
			success: true,
			state: "FILTERED",
		});

		vi.mocked(setCommentPinnedState).mockResolvedValueOnce(false);
		await expect(
			pinCommentFn({ data: { id: 6, pinned: true } }),
		).resolves.toEqual({
			success: false,
			error: "Comment not found",
		});
	});

	it("retains legacy remove wrappers", async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(moderator);
		vi.mocked(setSubmissionRemovedState).mockResolvedValueOnce(true);
		vi.mocked(setCommentRemovedState).mockResolvedValueOnce(true);

		await expect(
			removeSubmissionFn({ data: { id: 1, removed: true } }),
		).resolves.toEqual({
			success: true,
		});
		await expect(
			removeCommentFn({ data: { id: 5, removed: false } }),
		).resolves.toEqual({
			success: true,
		});
	});

	it("edits submission title/flair and logs both actions", async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(moderator);
		const updateChain = {
			set: vi.fn().mockReturnValue({
				where: vi.fn().mockReturnValue({
					returning: vi.fn().mockResolvedValue([
						{
							id: 1,
							title: "Updated title",
							titleHtml: "<p>Updated title</p>",
							flair: "news",
						},
					]),
				}),
			}),
		};
		const firstInsert = createInsertChain();
		const secondInsert = createInsertChain();
		dbMock.update.mockReturnValueOnce(updateChain);
		dbMock.insert
			.mockReturnValueOnce(firstInsert)
			.mockReturnValueOnce(secondInsert);

		await expect(
			updateSubmissionModerationDetailsFn({
				data: { id: 1, title: "Updated title", flair: "news" },
			}),
		).resolves.toEqual({
			success: true,
			title: "Updated title",
			titleHtml: "<p>Updated title</p>",
			flair: "news",
		});

		expect(firstInsert.values).toHaveBeenCalledWith({
			userId: 2,
			targetSubmissionId: 1,
			kind: "edit_post_title",
			note: '"Updated title"',
		});
		expect(secondInsert.values).toHaveBeenCalledWith({
			userId: 2,
			targetSubmissionId: 1,
			kind: "flair_post",
			note: '"news"',
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
		await expect(unshadowbanUserFn({ data: { userId: 9 } })).resolves.toEqual({
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

	it("updates user presentation fields and logs verification/custom title actions", async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(moderator);
		const updateChain = {
			set: vi.fn().mockReturnValue({
				where: vi.fn().mockReturnValue({
					returning: vi.fn().mockResolvedValue([
						{
							id: 9,
							verified: "Staff",
							verifiedColor: "00ff00",
							customTitlePlain: "Trusted voice",
							customTitle: "<p>Trusted voice</p>",
						},
					]),
				}),
			}),
		};
		const firstInsert = createInsertChain();
		const secondInsert = createInsertChain();
		dbMock.update.mockReturnValueOnce(updateChain);
		dbMock.insert
			.mockReturnValueOnce(firstInsert)
			.mockReturnValueOnce(secondInsert);

		await expect(
			updateUserModerationProfileFn({
				data: {
					userId: 9,
					verified: "Staff",
					verifiedColor: "#00ff00",
					customTitlePlain: "Trusted voice",
				},
			}),
		).resolves.toEqual({
			success: true,
			verified: "Staff",
			verifiedColor: "00ff00",
			customTitlePlain: "Trusted voice",
			customTitle: "<p>Trusted voice</p>",
		});

		expect(firstInsert.values).toHaveBeenCalledWith({
			userId: 2,
			targetUserId: 9,
			kind: "verify_user",
			note: '"Staff" (00ff00)',
		});
		expect(secondInsert.values).toHaveBeenCalledWith({
			userId: 2,
			targetUserId: 9,
			kind: "set_custom_title",
			note: '"Trusted voice"',
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

	it("rejects remove/sticky/pin/ban/distinguish from regular users", async () => {
		const regular: SafeUser = {
			...moderator,
			id: 5,
			username: "pleb",
			adminLevel: 0,
		};
		vi.mocked(getCurrentUser).mockResolvedValue(regular);

		await expect(
			removeSubmissionFn({ data: { id: 1, removed: true } }),
		).resolves.toEqual({ success: false, error: "Unauthorized" });
		await expect(
			stickySubmissionFn({ data: { id: 1, stickied: true } }),
		).resolves.toEqual({ success: false, error: "Unauthorized" });
		await expect(
			setSubmissionModerationStateFn({ data: { id: 1, state: "REMOVED" } }),
		).resolves.toEqual({ success: false, error: "Unauthorized" });
		await expect(
			removeCommentFn({ data: { id: 5, removed: true } }),
		).resolves.toEqual({ success: false, error: "Unauthorized" });
		await expect(
			pinCommentFn({ data: { id: 6, pinned: true } }),
		).resolves.toEqual({ success: false, error: "Unauthorized" });
		await expect(
			banUserFn({ data: { userId: 9, reason: "grudge" } }),
		).resolves.toEqual({ success: false, error: "Unauthorized" });
		await expect(
			distinguishSubmissionFn({ data: { id: 40 } }),
		).resolves.toEqual({ success: false, error: "Unauthorized" });
		await expect(distinguishCommentFn({ data: { id: 50 } })).resolves.toEqual({
			success: false,
			error: "Unauthorized",
		});

		expect(setSubmissionRemovedState).not.toHaveBeenCalled();
		expect(setSubmissionStickyState).not.toHaveBeenCalled();
		expect(setCommentRemovedState).not.toHaveBeenCalled();
		expect(setCommentPinnedState).not.toHaveBeenCalled();
		expect(dbMock.update).not.toHaveBeenCalled();
		expect(dbMock.insert).not.toHaveBeenCalled();
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

	it("rejects banned-domain management from non-admins", async () => {
		const regular: SafeUser = {
			...moderator,
			id: 5,
			username: "pleb",
			adminLevel: 0,
		};
		vi.mocked(getCurrentUser).mockResolvedValue(regular);

		await expect(
			addBannedDomainFn({ data: { domain: "spam.com", reason: "spam" } }),
		).resolves.toEqual({ success: false, error: "Unauthorized" });
		await expect(
			removeBannedDomainFn({ data: { domain: "spam.com" } }),
		).resolves.toEqual({ success: false, error: "Unauthorized" });

		expect(dbMock.insert).not.toHaveBeenCalled();
		expect(dbMock.delete).not.toHaveBeenCalled();
	});

	it("normalizes and upserts a banned domain, logging the mod action", async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(moderator);
		const upsertChain = {
			values: vi.fn().mockReturnValue({
				onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
			}),
		};
		const logChain = createInsertChain();
		dbMock.insert
			.mockReturnValueOnce(upsertChain)
			.mockReturnValueOnce(logChain);

		await expect(
			addBannedDomainFn({
				data: {
					domain: "  https://www.Spam.COM/some/path ",
					reason: " spam farm ",
				},
			}),
		).resolves.toEqual({
			success: true,
			domain: "spam.com",
			reason: "spam farm",
		});

		expect(upsertChain.values).toHaveBeenCalledWith({
			domain: "spam.com",
			reason: "spam farm",
		});
		expect(logChain.values).toHaveBeenCalledWith({
			userId: 2,
			kind: "ban_domain",
			note: "spam.com: spam farm",
		});
	});

	it("rejects invalid domain and missing reason inputs", async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(moderator);

		await expect(
			addBannedDomainFn({ data: { domain: "not a domain", reason: "x" } }),
		).resolves.toEqual({ success: false, error: "Invalid domain" });
		await expect(
			addBannedDomainFn({ data: { domain: "spam.com", reason: "   " } }),
		).resolves.toEqual({ success: false, error: "Reason is required" });

		expect(dbMock.insert).not.toHaveBeenCalled();
	});

	it("removes a banned domain and logs the mod action", async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(moderator);
		const deleteChain = { where: vi.fn().mockResolvedValue(undefined) };
		dbMock.delete.mockReturnValueOnce(deleteChain);
		const logChain = createInsertChain();
		dbMock.insert.mockReturnValueOnce(logChain);

		await expect(
			removeBannedDomainFn({ data: { domain: "spam.com" } }),
		).resolves.toEqual({ success: true });

		expect(dbMock.delete).toHaveBeenCalledTimes(1);
		expect(logChain.values).toHaveBeenCalledWith({
			userId: 2,
			kind: "unban_domain",
			note: "spam.com",
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

		await expect(distinguishCommentFn({ data: { id: 50 } })).resolves.toEqual({
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

	it("rejects alt linking from non-admins with no DB writes", async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(janitor);

		await expect(
			linkUserAltFn({ data: { userId: 9, username: "alice" } }),
		).resolves.toEqual({ success: false, error: "Unauthorized" });
		await expect(
			unlinkUserAltFn({ data: { userId: 9, username: "alice" } }),
		).resolves.toEqual({ success: false, error: "Unauthorized" });

		expect(dbMock.insert).not.toHaveBeenCalled();
		expect(dbMock.delete).not.toHaveBeenCalled();
	});

	it("links alts with a normalized pair, isManual set, and a mod-log entry", async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(moderator);
		vi.mocked(getUserByUsernameCanonical).mockResolvedValue({
			id: 4,
			username: "alice",
		} as never);
		const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
		const altInsert = {
			values: vi.fn().mockReturnValue({ onConflictDoUpdate }),
		};
		const logInsert = createInsertChain();
		dbMock.insert.mockReturnValueOnce(altInsert).mockReturnValueOnce(logInsert);

		await expect(
			linkUserAltFn({ data: { userId: 9, username: "alice" } }),
		).resolves.toEqual({
			success: true,
			alt: { id: 4, username: "alice", isManual: true },
		});

		expect(altInsert.values).toHaveBeenCalledWith({
			user1: 4,
			user2: 9,
			isManual: true,
		});
		expect(logInsert.values).toHaveBeenCalledWith({
			userId: 2,
			targetUserId: 9,
			kind: "link_alt",
			note: "@alice",
		});
	});

	it("rejects self-links and unknown usernames", async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(moderator);

		vi.mocked(getUserByUsernameCanonical).mockResolvedValueOnce(null);
		await expect(
			linkUserAltFn({ data: { userId: 9, username: "ghost" } }),
		).resolves.toEqual({ success: false, error: "User not found" });

		vi.mocked(getUserByUsernameCanonical).mockResolvedValueOnce({
			id: 9,
			username: "same",
		} as never);
		await expect(
			linkUserAltFn({ data: { userId: 9, username: "same" } }),
		).resolves.toEqual({
			success: false,
			error: "Cannot link a user to themselves",
		});

		expect(dbMock.insert).not.toHaveBeenCalled();
	});

	it("unlinks alts and logs the mod action", async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(moderator);
		vi.mocked(getUserByUsernameCanonical).mockResolvedValue({
			id: 12,
			username: "bob",
		} as never);
		const deleteChain = { where: vi.fn().mockResolvedValue(undefined) };
		dbMock.delete.mockReturnValueOnce(deleteChain);
		const logInsert = createInsertChain();
		dbMock.insert.mockReturnValueOnce(logInsert);

		await expect(
			unlinkUserAltFn({ data: { userId: 9, username: "bob" } }),
		).resolves.toEqual({ success: true });

		expect(deleteChain.where).toHaveBeenCalledTimes(1);
		expect(logInsert.values).toHaveBeenCalledWith({
			userId: 2,
			targetUserId: 9,
			kind: "unlink_alt",
			note: "@bob",
		});
	});
});

import {
	altLinkInputSchema,
	banUserInputSchema,
	moderationStateInputSchema,
	queueActionInputSchema,
} from "@/lib/admin-actions.server";

describe("admin-actions input schemas", () => {
	it("rejects invalid moderation inputs", () => {
		expect(
			queueActionInputSchema.safeParse({ id: 1, action: "nuke" }).success,
		).toBe(false);
		expect(
			moderationStateInputSchema.safeParse({ id: 1, state: "HIDDEN" }).success,
		).toBe(false);
		expect(
			banUserInputSchema.safeParse({ userId: 0, reason: "spam" }).success,
		).toBe(false);
		expect(
			banUserInputSchema.safeParse({
				userId: 1,
				reason: "spam",
				durationDays: -3,
			}).success,
		).toBe(false);
	});

	it("accepts valid moderation inputs", () => {
		expect(
			queueActionInputSchema.safeParse({ id: 1, action: "approve" }).success,
		).toBe(true);
		expect(
			banUserInputSchema.safeParse({ userId: 1, reason: "spam" }).success,
		).toBe(true);
	});

	it("validates alt-link inputs", () => {
		expect(
			altLinkInputSchema.safeParse({ userId: 0, username: "alice" }).success,
		).toBe(false);
		expect(
			altLinkInputSchema.safeParse({ userId: 1, username: "" }).success,
		).toBe(false);
		expect(
			altLinkInputSchema.safeParse({ userId: 1, username: "alice" }).success,
		).toBe(true);
	});
});
