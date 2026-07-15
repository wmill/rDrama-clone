import { createServerFn } from "@tanstack/react-start";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import {
	alts,
	bannedDomains,
	comments,
	modActions,
	submissions,
	userNotes,
	users,
} from "@/db/schema";
import { fail, requireAdmin } from "@/lib/auth-guards.server";
import {
	type ModerationState,
	setCommentModerationState,
	setCommentNsfwState,
	setCommentPinnedState,
	setCommentRemovedState,
	setSubmissionModerationState,
	setSubmissionRemovedState,
	setSubmissionStickyState,
} from "@/lib/lifecycle.server";
import { renderPostTitleHtml } from "@/lib/markdown";
import { getUserByUsernameCanonical } from "@/lib/users.server";
import { idInputSchema, idSchema, userIdInputSchema } from "@/lib/validation";

type QueueModerationAction = "approve" | "filtered" | "removed" | "ignored";

export const queueActionInputSchema = z.object({
	id: idSchema,
	action: z.enum(["approve", "filtered", "removed", "ignored"]),
});
export const moderationStateInputSchema = z.object({
	id: idSchema,
	state: z.enum(["VISIBLE", "FILTERED", "REMOVED"]),
});
export const removedInputSchema = z.object({
	id: idSchema,
	removed: z.boolean(),
});
export const stickiedInputSchema = z.object({
	id: idSchema,
	stickied: z.boolean(),
});
export const pinnedInputSchema = z.object({
	id: idSchema,
	pinned: z.boolean(),
});
export const commentNsfwInputSchema = z.object({
	id: idSchema,
	nsfw: z.boolean(),
});
export const moderationDetailsInputSchema = z.object({
	id: idSchema,
	title: z.string().max(500),
	flair: z.string().max(100).nullish(),
});
export const banUserInputSchema = z.object({
	userId: idSchema,
	reason: z.string().max(1000),
	durationDays: z.number().int().positive().optional(),
});
export const moderationProfileInputSchema = z.object({
	userId: idSchema,
	verified: z.string().max(100).nullish(),
	verifiedColor: z.string().max(10).nullish(),
	customTitlePlain: z.string().max(200).nullish(),
	titleLocked: z.boolean(),
});
export const userNoteInputSchema = z.object({
	userId: idSchema,
	note: z.string().max(5000),
	tag: z.string().max(20),
	referencePost: idSchema.optional(),
	referenceComment: idSchema.optional(),
});
export const addBannedDomainInputSchema = z.object({
	domain: z.string().min(1).max(253),
	reason: z.string().max(1000),
});
export const removeBannedDomainInputSchema = z.object({
	domain: z.string().min(1).max(253),
});
export const altLinkInputSchema = z.object({
	userId: idSchema,
	username: z.string().min(1).max(50),
});

function normalizeOptionalModerationText(value?: string | null): string | null {
	if (value === undefined || value === null) {
		return null;
	}

	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

function normalizeVerifiedColor(value?: string | null): string | null {
	const normalized = normalizeOptionalModerationText(value);
	if (!normalized) {
		return null;
	}

	return normalized.replace(/^#/, "").toLowerCase();
}

export const updateSubmissionFilterStatusFn = createServerFn({
	method: "POST",
})
	.inputValidator((data: { id: number; action: QueueModerationAction }) =>
		queueActionInputSchema.parse(data),
	)
	.handler(async ({ data }) => {
		const guard = await requireAdmin();
		if (!guard.ok) {
			return guard.failure;
		}
		const user = guard.user;

		if (data.action === "approve") {
			await setSubmissionModerationState(
				{
					submissionId: data.id,
					moderatorId: user.id,
					moderatorName: user.username,
					state: "VISIBLE",
					actionKind: "approve_post",
				},
				db,
			);
		} else if (data.action === "filtered") {
			await setSubmissionModerationState(
				{
					submissionId: data.id,
					moderatorId: user.id,
					moderatorName: user.username,
					state: "FILTERED",
				},
				db,
			);
		} else if (data.action === "removed") {
			await setSubmissionModerationState(
				{
					submissionId: data.id,
					moderatorId: user.id,
					moderatorName: user.username,
					state: "REMOVED",
				},
				db,
			);
		} else {
			await db
				.update(submissions)
				.set({ stateReport: "IGNORED" })
				.where(eq(submissions.id, data.id));
		}

		return { success: true as const };
	});

export const updateCommentFilterStatusFn = createServerFn({ method: "POST" })
	.inputValidator((data: { id: number; action: QueueModerationAction }) =>
		queueActionInputSchema.parse(data),
	)
	.handler(async ({ data }) => {
		const guard = await requireAdmin();
		if (!guard.ok) {
			return guard.failure;
		}
		const user = guard.user;

		if (data.action === "approve") {
			await setCommentModerationState(
				{
					commentId: data.id,
					moderatorId: user.id,
					moderatorName: user.username,
					state: "VISIBLE",
					actionKind: "approve_comment",
				},
				db,
			);
		} else if (data.action === "filtered") {
			await setCommentModerationState(
				{
					commentId: data.id,
					moderatorId: user.id,
					moderatorName: user.username,
					state: "FILTERED",
				},
				db,
			);
		} else if (data.action === "removed") {
			await setCommentModerationState(
				{
					commentId: data.id,
					moderatorId: user.id,
					moderatorName: user.username,
					state: "REMOVED",
				},
				db,
			);
		} else {
			await db
				.update(comments)
				.set({ stateReport: "IGNORED" })
				.where(eq(comments.id, data.id));
		}

		return { success: true as const };
	});

export const setSubmissionModerationStateFn = createServerFn({ method: "POST" })
	.inputValidator((data: { id: number; state: ModerationState }) =>
		moderationStateInputSchema.parse(data),
	)
	.handler(async ({ data }) => {
		const guard = await requireAdmin();
		if (!guard.ok) {
			return guard.failure;
		}
		const user = guard.user;

		const success = await setSubmissionModerationState({
			submissionId: data.id,
			moderatorId: user.id,
			moderatorName: user.username,
			state: data.state,
		});

		return success
			? { success: true as const, state: data.state }
			: fail("Post not found");
	});

export const removeSubmissionFn = createServerFn({ method: "POST" })
	.inputValidator((data: { id: number; removed: boolean }) =>
		removedInputSchema.parse(data),
	)
	.handler(async ({ data }) => {
		const guard = await requireAdmin();
		if (!guard.ok) {
			return guard.failure;
		}
		const user = guard.user;

		const success = await setSubmissionRemovedState({
			submissionId: data.id,
			moderatorId: user.id,
			moderatorName: user.username,
			removed: data.removed,
		});

		return success ? { success: true as const } : fail("Post not found");
	});

export const updateSubmissionModerationDetailsFn = createServerFn({
	method: "POST",
})
	.inputValidator(
		(data: { id: number; title: string; flair?: string | null }) =>
			moderationDetailsInputSchema.parse(data),
	)
	.handler(async ({ data }) => {
		const guard = await requireAdmin();
		if (!guard.ok) {
			return guard.failure;
		}
		const user = guard.user;

		const title = data.title.trim();
		if (!title) {
			return fail("Title is required");
		}

		const flair = normalizeOptionalModerationText(data.flair);
		const updatedRows = await db
			.update(submissions)
			.set({
				title,
				titleHtml: renderPostTitleHtml(title),
				flair,
				editedUtc: Math.floor(Date.now() / 1000),
			})
			.where(eq(submissions.id, data.id))
			.returning({
				id: submissions.id,
				title: submissions.title,
				titleHtml: submissions.titleHtml,
				flair: submissions.flair,
			});

		const updated = updatedRows[0];
		if (!updated) {
			return fail("Post not found");
		}

		await db.insert(modActions).values({
			userId: user.id,
			targetSubmissionId: data.id,
			kind: "edit_post_title",
			note: `"${title}"`,
		});
		await db.insert(modActions).values({
			userId: user.id,
			targetSubmissionId: data.id,
			kind: flair ? "flair_post" : "clear_post_flair",
			note: flair ? `"${flair}"` : "(cleared)",
		});

		return {
			success: true as const,
			title: updated.title,
			titleHtml: updated.titleHtml,
			flair: updated.flair,
		};
	});

export const stickySubmissionFn = createServerFn({ method: "POST" })
	.inputValidator((data: { id: number; stickied: boolean }) =>
		stickiedInputSchema.parse(data),
	)
	.handler(async ({ data }) => {
		const guard = await requireAdmin();
		if (!guard.ok) {
			return guard.failure;
		}
		const user = guard.user;

		const success = await setSubmissionStickyState({
			submissionId: data.id,
			moderatorId: user.id,
			moderatorName: user.username,
			stickied: data.stickied,
		});

		return success ? { success: true as const } : fail("Post not found");
	});

export const setCommentModerationStateFn = createServerFn({ method: "POST" })
	.inputValidator((data: { id: number; state: ModerationState }) =>
		moderationStateInputSchema.parse(data),
	)
	.handler(async ({ data }) => {
		const guard = await requireAdmin();
		if (!guard.ok) {
			return guard.failure;
		}
		const user = guard.user;

		const success = await setCommentModerationState({
			commentId: data.id,
			moderatorId: user.id,
			moderatorName: user.username,
			state: data.state,
		});

		return success
			? { success: true as const, state: data.state }
			: fail("Comment not found");
	});

export const removeCommentFn = createServerFn({ method: "POST" })
	.inputValidator((data: { id: number; removed: boolean }) =>
		removedInputSchema.parse(data),
	)
	.handler(async ({ data }) => {
		const guard = await requireAdmin();
		if (!guard.ok) {
			return guard.failure;
		}
		const user = guard.user;

		const success = await setCommentRemovedState({
			commentId: data.id,
			moderatorId: user.id,
			moderatorName: user.username,
			removed: data.removed,
		});

		return success ? { success: true as const } : fail("Comment not found");
	});

export const pinCommentFn = createServerFn({ method: "POST" })
	.inputValidator((data: { id: number; pinned: boolean }) =>
		pinnedInputSchema.parse(data),
	)
	.handler(async ({ data }) => {
		const guard = await requireAdmin();
		if (!guard.ok) {
			return guard.failure;
		}
		const user = guard.user;

		const success = await setCommentPinnedState({
			commentId: data.id,
			moderatorId: user.id,
			moderatorName: user.username,
			pinned: data.pinned,
		});

		return success ? { success: true as const } : fail("Comment not found");
	});

export const setCommentNsfwFn = createServerFn({ method: "POST" })
	.inputValidator((data: { id: number; nsfw: boolean }) =>
		commentNsfwInputSchema.parse(data),
	)
	.handler(async ({ data }) => {
		const guard = await requireAdmin();
		if (!guard.ok) return guard.failure;
		const success = await setCommentNsfwState({
			commentId: data.id,
			actorId: guard.user.id,
			nsfw: data.nsfw,
			moderator: true,
		});
		if (success) {
			void import("@/lib/search.server").then(({ indexCommentBestEffort }) =>
				indexCommentBestEffort(data.id),
			);
		}
		return success ? { success: true as const } : fail("Comment not found");
	});

export const banUserFn = createServerFn({ method: "POST" })
	.inputValidator(
		(data: { userId: number; reason: string; durationDays?: number }) =>
			banUserInputSchema.parse(data),
	)
	.handler(async ({ data }) => {
		const guard = await requireAdmin();
		if (!guard.ok) {
			return guard.failure;
		}
		const user = guard.user;

		const unbanUtc = data.durationDays
			? Math.floor(Date.now() / 1000) + data.durationDays * 86400
			: 0;

		await db
			.update(users)
			.set({ isBanned: 1, banReason: data.reason, unbanUtc })
			.where(eq(users.id, data.userId));

		await db.insert(modActions).values({
			userId: user.id,
			targetUserId: data.userId,
			kind: "ban_user",
			note: data.reason,
		});

		return { success: true as const };
	});

export const unbanUserFn = createServerFn({ method: "POST" })
	.inputValidator((data: { userId: number }) => userIdInputSchema.parse(data))
	.handler(async ({ data }) => {
		const guard = await requireAdmin();
		if (!guard.ok) {
			return guard.failure;
		}
		const user = guard.user;

		await db
			.update(users)
			.set({ isBanned: 0, banReason: null, unbanUtc: 0 })
			.where(eq(users.id, data.userId));

		await db.insert(modActions).values({
			userId: user.id,
			targetUserId: data.userId,
			kind: "unban_user",
		});

		return { success: true as const };
	});

export const shadowbanUserFn = createServerFn({ method: "POST" })
	.inputValidator((data: { userId: number }) => userIdInputSchema.parse(data))
	.handler(async ({ data }) => {
		const guard = await requireAdmin();
		if (!guard.ok) {
			return guard.failure;
		}
		const user = guard.user;

		await db
			.update(users)
			.set({ shadowBanned: "shadowbanned" })
			.where(eq(users.id, data.userId));

		await db.insert(modActions).values({
			userId: user.id,
			targetUserId: data.userId,
			kind: "shadowban",
		});

		return { success: true as const };
	});

export const unshadowbanUserFn = createServerFn({ method: "POST" })
	.inputValidator((data: { userId: number }) => userIdInputSchema.parse(data))
	.handler(async ({ data }) => {
		const guard = await requireAdmin();
		if (!guard.ok) {
			return guard.failure;
		}
		const user = guard.user;

		await db
			.update(users)
			.set({ shadowBanned: null })
			.where(eq(users.id, data.userId));

		await db.insert(modActions).values({
			userId: user.id,
			targetUserId: data.userId,
			kind: "unshadowban",
		});

		return { success: true as const };
	});

// Alt rows are stored with user1 < user2 so a pair can only exist once.
function normalizeAltPair(a: number, b: number): [number, number] {
	return a < b ? [a, b] : [b, a];
}

export const linkUserAltFn = createServerFn({ method: "POST" })
	.inputValidator((data: { userId: number; username: string }) =>
		altLinkInputSchema.parse(data),
	)
	.handler(async ({ data }) => {
		const guard = await requireAdmin();
		if (!guard.ok) {
			return guard.failure;
		}
		const user = guard.user;

		const target = await getUserByUsernameCanonical(data.username);
		if (!target) {
			return fail("User not found");
		}
		if (target.id === data.userId) {
			return fail("Cannot link a user to themselves");
		}

		const [user1, user2] = normalizeAltPair(data.userId, target.id);
		await db
			.insert(alts)
			.values({ user1, user2, isManual: true })
			.onConflictDoUpdate({
				target: [alts.user1, alts.user2],
				set: { isManual: true },
			});

		await db.insert(modActions).values({
			userId: user.id,
			targetUserId: data.userId,
			kind: "link_alt",
			note: `@${target.username}`,
		});

		return {
			success: true as const,
			alt: {
				id: target.id,
				username: target.username,
				isManual: true,
			},
		};
	});

export const unlinkUserAltFn = createServerFn({ method: "POST" })
	.inputValidator((data: { userId: number; username: string }) =>
		altLinkInputSchema.parse(data),
	)
	.handler(async ({ data }) => {
		const guard = await requireAdmin();
		if (!guard.ok) {
			return guard.failure;
		}
		const user = guard.user;

		const target = await getUserByUsernameCanonical(data.username);
		if (!target) {
			return fail("User not found");
		}

		const [user1, user2] = normalizeAltPair(data.userId, target.id);
		await db
			.delete(alts)
			.where(and(eq(alts.user1, user1), eq(alts.user2, user2)));

		await db.insert(modActions).values({
			userId: user.id,
			targetUserId: data.userId,
			kind: "unlink_alt",
			note: `@${target.username}`,
		});

		return { success: true as const };
	});

export const updateUserModerationProfileFn = createServerFn({
	method: "POST",
})
	.inputValidator(
		(data: {
			userId: number;
			verified?: string | null;
			verifiedColor?: string | null;
			customTitlePlain?: string | null;
			titleLocked: boolean;
		}) => moderationProfileInputSchema.parse(data),
	)
	.handler(async ({ data }) => {
		const guard = await requireAdmin();
		if (!guard.ok) {
			return guard.failure;
		}
		const user = guard.user;

		const verified = normalizeOptionalModerationText(data.verified);
		const verifiedColor = normalizeVerifiedColor(data.verifiedColor);
		const customTitlePlain = normalizeOptionalModerationText(
			data.customTitlePlain,
		);
		const customTitle = customTitlePlain
			? renderPostTitleHtml(customTitlePlain)
			: null;

		const updatedRows = await db
			.update(users)
			.set({
				verified,
				verifiedColor,
				customTitlePlain,
				customTitle,
				flairChanged: data.titleLocked ? 2 ** 31 - 1 : null,
			})
			.where(eq(users.id, data.userId))
			.returning({
				id: users.id,
				verified: users.verified,
				verifiedColor: users.verifiedColor,
				customTitlePlain: users.customTitlePlain,
				customTitle: users.customTitle,
				flairChanged: users.flairChanged,
			});

		const updated = updatedRows[0];
		if (!updated) {
			return fail("User not found");
		}

		await db.insert(modActions).values({
			userId: user.id,
			targetUserId: data.userId,
			kind: verified ? "verify_user" : "unverify_user",
			note: verified
				? `"${verified}" (${verifiedColor ?? "default"})`
				: "(cleared)",
		});
		await db.insert(modActions).values({
			userId: user.id,
			targetUserId: data.userId,
			kind: data.titleLocked ? "set_flair_locked" : "set_flair_unlocked",
			note: customTitlePlain ? `"${customTitlePlain}"` : "(cleared)",
		});

		return {
			success: true as const,
			verified: updated.verified,
			verifiedColor: updated.verifiedColor,
			customTitlePlain: updated.customTitlePlain,
			customTitle: updated.customTitle,
			titleLocked: updated.flairChanged !== null,
		};
	});

export const createUserNoteFn = createServerFn({ method: "POST" })
	.inputValidator(
		(data: {
			userId: number;
			note: string;
			tag: string;
			referencePost?: number;
			referenceComment?: number;
		}) => userNoteInputSchema.parse(data),
	)
	.handler(async ({ data }) => {
		const guard = await requireAdmin();
		if (!guard.ok) {
			return guard.failure;
		}
		const user = guard.user;

		const validTags = [
			"Quality",
			"Good",
			"Comment",
			"Warning",
			"Tempban",
			"Permban",
			"Spam",
			"Bot",
		] as const;
		if (!validTags.includes(data.tag as (typeof validTags)[number])) {
			return fail("Invalid tag");
		}

		await db.insert(userNotes).values({
			authorId: user.id,
			referenceUser: data.userId,
			note: data.note,
			tag: data.tag as (typeof validTags)[number],
			referencePost: data.referencePost ?? null,
			referenceComment: data.referenceComment ?? null,
		});

		return { success: true as const };
	});

export function normalizeBannedDomainInput(value: string): string | null {
	const trimmed = value.trim().toLowerCase();
	if (!trimmed) {
		return null;
	}

	const withoutScheme = trimmed.replace(/^[a-z][a-z0-9+.-]*:\/\//, "");
	const host = withoutScheme
		.split(/[/?#]/)[0]
		.split("@")
		.pop()
		?.split(":")[0]
		?.replace(/^www\./, "");

	if (!host || !host.includes(".") || /\s/.test(host)) {
		return null;
	}

	return host;
}

export const addBannedDomainFn = createServerFn({ method: "POST" })
	.inputValidator((data: { domain: string; reason: string }) =>
		addBannedDomainInputSchema.parse(data),
	)
	.handler(async ({ data }) => {
		const guard = await requireAdmin();
		if (!guard.ok) {
			return guard.failure;
		}
		const user = guard.user;

		const domain = normalizeBannedDomainInput(data.domain);
		if (!domain) {
			return fail("Invalid domain");
		}

		const reason = data.reason.trim();
		if (!reason) {
			return fail("Reason is required");
		}

		await db
			.insert(bannedDomains)
			.values({ domain, reason })
			.onConflictDoUpdate({
				target: bannedDomains.domain,
				set: { reason },
			});

		await db.insert(modActions).values({
			userId: user.id,
			kind: "ban_domain",
			note: `${domain}: ${reason}`,
		});

		return { success: true as const, domain, reason };
	});

export const removeBannedDomainFn = createServerFn({ method: "POST" })
	.inputValidator((data: { domain: string }) =>
		removeBannedDomainInputSchema.parse(data),
	)
	.handler(async ({ data }) => {
		const guard = await requireAdmin();
		if (!guard.ok) {
			return guard.failure;
		}
		const user = guard.user;

		await db.delete(bannedDomains).where(eq(bannedDomains.domain, data.domain));

		await db.insert(modActions).values({
			userId: user.id,
			kind: "unban_domain",
			note: data.domain,
		});

		return { success: true as const };
	});

export const distinguishSubmissionFn = createServerFn({ method: "POST" })
	.inputValidator((data: { id: number }) => idInputSchema.parse(data))
	.handler(async ({ data }) => {
		const guard = await requireAdmin(1);
		if (!guard.ok) {
			return guard.failure;
		}
		const user = guard.user;

		const [post] = await db
			.select({
				id: submissions.id,
				authorId: submissions.authorId,
				distinguishLevel: submissions.distinguishLevel,
			})
			.from(submissions)
			.where(eq(submissions.id, data.id))
			.limit(1);

		if (!post) {
			return fail("Post not found");
		}

		if (user.adminLevel < 2 && post.authorId !== user.id) {
			return fail("Unauthorized");
		}

		const newLevel = post.distinguishLevel > 0 ? 0 : 1;
		await db
			.update(submissions)
			.set({ distinguishLevel: newLevel })
			.where(eq(submissions.id, data.id));

		const kind = newLevel > 0 ? "distinguish_post" : "undistinguish_post";
		await db.insert(modActions).values({
			userId: user.id,
			targetSubmissionId: data.id,
			kind,
		});

		return { success: true as const, distinguishLevel: newLevel };
	});

export const distinguishCommentFn = createServerFn({ method: "POST" })
	.inputValidator((data: { id: number }) => idInputSchema.parse(data))
	.handler(async ({ data }) => {
		const guard = await requireAdmin(1);
		if (!guard.ok) {
			return guard.failure;
		}
		const user = guard.user;

		const [comment] = await db
			.select({
				id: comments.id,
				authorId: comments.authorId,
				distinguishLevel: comments.distinguishLevel,
			})
			.from(comments)
			.where(eq(comments.id, data.id))
			.limit(1);

		if (!comment) {
			return fail("Comment not found");
		}

		if (user.adminLevel < 2 && comment.authorId !== user.id) {
			return fail("Unauthorized");
		}

		const newLevel = comment.distinguishLevel > 0 ? 0 : 1;
		await db
			.update(comments)
			.set({ distinguishLevel: newLevel })
			.where(eq(comments.id, data.id));

		const kind = newLevel > 0 ? "distinguish_comment" : "undistinguish_comment";
		await db.insert(modActions).values({
			userId: user.id,
			targetCommentId: data.id,
			kind,
		});

		return { success: true as const, distinguishLevel: newLevel };
	});
