import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import {
	comments,
	modActions,
	submissions,
	userNotes,
	users,
} from "@/db/schema";
import { getCurrentUser } from "@/lib/sessions.server";

type FilterAction = "normal" | "removed" | "ignored";

export const updateSubmissionFilterStatusFn = createServerFn({
	method: "POST",
})
	.inputValidator((data: { id: number; action: FilterAction }) => data)
	.handler(async ({ data }) => {
		const user = await getCurrentUser();
		if (!user || user.adminLevel < 2) {
			return { success: false as const, error: "Unauthorized" };
		}

		if (data.action === "normal") {
			await db
				.update(submissions)
				.set({ stateMod: "VISIBLE", stateReport: "RESOLVED" })
				.where(eq(submissions.id, data.id));
			await db.insert(modActions).values({
				userId: user.id,
				targetSubmissionId: data.id,
				kind: "approve_post",
			});
		} else if (data.action === "removed") {
			await db
				.update(submissions)
				.set({ stateMod: "REMOVED", stateReport: "RESOLVED" })
				.where(eq(submissions.id, data.id));
			await db.insert(modActions).values({
				userId: user.id,
				targetSubmissionId: data.id,
				kind: "remove_post",
			});
		} else {
			await db
				.update(submissions)
				.set({ stateReport: "IGNORED" })
				.where(eq(submissions.id, data.id));
		}

		return { success: true as const };
	});

export const updateCommentFilterStatusFn = createServerFn({ method: "POST" })
	.inputValidator((data: { id: number; action: FilterAction }) => data)
	.handler(async ({ data }) => {
		const user = await getCurrentUser();
		if (!user || user.adminLevel < 2) {
			return { success: false as const, error: "Unauthorized" };
		}

		if (data.action === "normal") {
			await db
				.update(comments)
				.set({ stateMod: "VISIBLE", stateReport: "RESOLVED" })
				.where(eq(comments.id, data.id));
			await db.insert(modActions).values({
				userId: user.id,
				targetCommentId: data.id,
				kind: "approve_comment",
			});
		} else if (data.action === "removed") {
			await db
				.update(comments)
				.set({ stateMod: "REMOVED", stateReport: "RESOLVED" })
				.where(eq(comments.id, data.id));
			await db.insert(modActions).values({
				userId: user.id,
				targetCommentId: data.id,
				kind: "remove_comment",
			});
		} else {
			await db
				.update(comments)
				.set({ stateReport: "IGNORED" })
				.where(eq(comments.id, data.id));
		}

		return { success: true as const };
	});

export const banUserFn = createServerFn({ method: "POST" })
	.inputValidator(
		(data: { userId: number; reason: string; durationDays?: number }) => data,
	)
	.handler(async ({ data }) => {
		const user = await getCurrentUser();
		if (!user || user.adminLevel < 2) {
			return { success: false as const, error: "Unauthorized" };
		}

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
	.inputValidator((data: { userId: number }) => data)
	.handler(async ({ data }) => {
		const user = await getCurrentUser();
		if (!user || user.adminLevel < 2) {
			return { success: false as const, error: "Unauthorized" };
		}

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
	.inputValidator((data: { userId: number }) => data)
	.handler(async ({ data }) => {
		const user = await getCurrentUser();
		if (!user || user.adminLevel < 2) {
			return { success: false as const, error: "Unauthorized" };
		}

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
	.inputValidator((data: { userId: number }) => data)
	.handler(async ({ data }) => {
		const user = await getCurrentUser();
		if (!user || user.adminLevel < 2) {
			return { success: false as const, error: "Unauthorized" };
		}

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

export const createUserNoteFn = createServerFn({ method: "POST" })
	.inputValidator(
		(data: {
			userId: number;
			note: string;
			tag: string;
			referencePost?: number;
			referenceComment?: number;
		}) => data,
	)
	.handler(async ({ data }) => {
		const user = await getCurrentUser();
		if (!user || user.adminLevel < 2) {
			return { success: false as const, error: "Unauthorized" };
		}

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
			return { success: false as const, error: "Invalid tag" };
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

export const distinguishSubmissionFn = createServerFn({ method: "POST" })
	.inputValidator((data: { id: number }) => data)
	.handler(async ({ data }) => {
		const user = await getCurrentUser();
		if (!user || user.adminLevel < 1) {
			return { success: false as const, error: "Unauthorized" };
		}

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
			return { success: false as const, error: "Post not found" };
		}

		if (user.adminLevel < 2 && post.authorId !== user.id) {
			return { success: false as const, error: "Unauthorized" };
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
	.inputValidator((data: { id: number }) => data)
	.handler(async ({ data }) => {
		const user = await getCurrentUser();
		if (!user || user.adminLevel < 1) {
			return { success: false as const, error: "Unauthorized" };
		}

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
			return { success: false as const, error: "Comment not found" };
		}

		if (user.adminLevel < 2 && comment.authorId !== user.id) {
			return { success: false as const, error: "Unauthorized" };
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
