import { createServerFn } from "@tanstack/react-start";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import {
	awardRelationships,
	badgeDefs,
	badges,
	comments,
	modActions,
	submissions,
	users,
} from "@/db/schema";
import { fail, requireAdmin, requireUser } from "@/lib/auth-guards.server";
import { AWARD_OPTIONS } from "@/lib/constants";
import { getUserByUsernameCanonical } from "@/lib/users.server";
import { idSchema } from "@/lib/validation";

const usernameSchema = z.string().min(1).max(50);
export const createBadgeDefInputSchema = z.object({
	name: z.string().min(1).max(100),
	description: z.string().max(500).nullish(),
});
export const grantBadgeInputSchema = z.object({
	username: usernameSchema,
	badgeId: idSchema,
	description: z.string().max(500).nullish(),
});
export const revokeBadgeInputSchema = z.object({
	username: usernameSchema,
	badgeId: idSchema,
});
export const awardContentInputSchema = z.object({
	submissionId: idSchema.optional(),
	commentId: idSchema.optional(),
	kind: z.string().min(1).max(50),
});

export const createBadgeDefFn = createServerFn({ method: "POST" })
	.inputValidator((data: { name: string; description?: string | null }) =>
		createBadgeDefInputSchema.parse(data),
	)
	.handler(async ({ data }) => {
		const guard = await requireAdmin();
		if (!guard.ok) {
			return guard.failure;
		}
		const user = guard.user;

		const name = data.name.trim();
		if (!name) {
			return fail("Name is required");
		}
		const description = data.description?.trim() || null;

		const [created] = await db
			.insert(badgeDefs)
			.values({ name, description })
			.returning();

		await db.insert(modActions).values({
			userId: user.id,
			kind: "create_badge_def",
			note: `"${name}"`,
		});

		return { success: true as const, badgeDef: created };
	});

export const grantBadgeFn = createServerFn({ method: "POST" })
	.inputValidator(
		(data: {
			username: string;
			badgeId: number;
			description?: string | null;
		}) => grantBadgeInputSchema.parse(data),
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

		const [def] = await db
			.select()
			.from(badgeDefs)
			.where(eq(badgeDefs.id, data.badgeId))
			.limit(1);
		if (!def) {
			return fail("Badge not found");
		}

		await db
			.insert(badges)
			.values({
				badgeId: def.id,
				userId: target.id,
				description: data.description?.trim() || null,
			})
			.onConflictDoNothing();

		await db.insert(modActions).values({
			userId: user.id,
			targetUserId: target.id,
			kind: "grant_badge",
			note: `"${def.name}"`,
		});

		return { success: true as const };
	});

export const revokeBadgeFn = createServerFn({ method: "POST" })
	.inputValidator((data: { username: string; badgeId: number }) =>
		revokeBadgeInputSchema.parse(data),
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

		await db
			.delete(badges)
			.where(
				and(eq(badges.userId, target.id), eq(badges.badgeId, data.badgeId)),
			);

		await db.insert(modActions).values({
			userId: user.id,
			targetUserId: target.id,
			kind: "revoke_badge",
			note: `badge #${data.badgeId}`,
		});

		return { success: true as const };
	});

export const awardContentFn = createServerFn({ method: "POST" })
	.inputValidator(
		(data: { submissionId?: number; commentId?: number; kind: string }) =>
			awardContentInputSchema.parse(data),
	)
	.handler(async ({ data }) => {
		const guard = await requireUser();
		if (!guard.ok) {
			return guard.failure;
		}
		const user = guard.user;

		if (!AWARD_OPTIONS.some((option) => option.kind === data.kind)) {
			return fail("Unknown award");
		}

		const hasSubmission = typeof data.submissionId === "number";
		const hasComment = typeof data.commentId === "number";
		if (hasSubmission === hasComment) {
			return fail("Award exactly one post or comment");
		}

		let authorId: number | undefined;
		if (hasSubmission) {
			const [post] = await db
				.select({ authorId: submissions.authorId })
				.from(submissions)
				.where(eq(submissions.id, data.submissionId as number))
				.limit(1);
			authorId = post?.authorId;
		} else {
			const [comment] = await db
				.select({ authorId: comments.authorId })
				.from(comments)
				.where(eq(comments.id, data.commentId as number))
				.limit(1);
			authorId = comment?.authorId;
		}

		if (authorId === undefined) {
			return fail("Content not found");
		}

		await db.insert(awardRelationships).values({
			userId: user.id,
			submissionId: hasSubmission ? (data.submissionId as number) : null,
			commentId: hasComment ? (data.commentId as number) : null,
			kind: data.kind,
		});

		await db
			.update(users)
			.set({ receivedAwardCount: sql`${users.receivedAwardCount} + 1` })
			.where(eq(users.id, authorId));

		return { success: true as const };
	});
