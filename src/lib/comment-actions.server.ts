import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { fail, requireUser } from "@/lib/auth-guards.server";
import {
	createComment,
	deleteComment,
	getCommentById,
	getCommentsBySubmissionSince,
	updateComment,
} from "@/lib/comments.server";
import {
	authorRestoreComment,
	setCommentSavedState,
} from "@/lib/lifecycle.server";
import { enforceRateLimit } from "@/lib/rate-limit.server";
import { indexCommentBestEffort } from "@/lib/search.server";
import { getCurrentUser } from "@/lib/sessions.server";
import { isSiteReadOnly, READ_ONLY_MESSAGE } from "@/lib/site-settings.server";
import { idInputSchema, idSchema } from "@/lib/validation";

const commentBodySchema = z.string().min(1).max(20000);
export const createCommentInputSchema = z.object({
	body: commentBodySchema,
	parentSubmissionId: idSchema,
	parentCommentId: idSchema.optional(),
});
export const updateCommentInputSchema = z.object({
	id: idSchema,
	body: commentBodySchema,
});
export const saveCommentInputSchema = z.object({
	id: idSchema,
	saved: z.boolean(),
});
export const commentsSinceInputSchema = z.object({
	submissionId: idSchema,
	since: z.number().int().min(0),
});

export const createCommentFn = createServerFn({ method: "POST" })
	.inputValidator(
		(data: {
			body: string;
			parentSubmissionId: number;
			parentCommentId?: number;
		}) => createCommentInputSchema.parse(data),
	)
	.handler(
		async ({
			data,
		}: {
			data: {
				body: string;
				parentSubmissionId: number;
				parentCommentId?: number;
			};
		}) => {
			const guard = await requireUser();
			if (!guard.ok) {
				return guard.failure;
			}
			const user = guard.user;
			if (await isSiteReadOnly()) {
				return fail(READ_ONLY_MESSAGE);
			}
			const rate = await enforceRateLimit("create_comment", String(user.id));
			if (!rate.allowed) {
				return fail(rate.error);
			}
			try {
				const id = await createComment({
					authorId: user.id,
					body: data.body,
					parentSubmissionId: data.parentSubmissionId,
					parentCommentId: data.parentCommentId,
				});
				const comment = await getCommentById(id, user.id);
				return { success: true as const, id, comment };
			} catch (err) {
				return fail(
					err instanceof Error ? err.message : "Failed to create comment",
				);
			}
		},
	);

export const updateCommentFn = createServerFn({ method: "POST" })
	.inputValidator((data: { id: number; body: string }) =>
		updateCommentInputSchema.parse(data),
	)
	.handler(async ({ data }: { data: { id: number; body: string } }) => {
		const guard = await requireUser();
		if (!guard.ok) {
			return guard.failure;
		}
		const user = guard.user;
		const result = await updateComment(data.id, user.id, data.body);
		if (!result) {
			return fail("Failed to update comment");
		}
		const comment = await getCommentById(data.id, user.id);
		return { success: true as const, comment };
	});

export const deleteCommentFn = createServerFn({ method: "POST" })
	.inputValidator((data: { id: number }) => idInputSchema.parse(data))
	.handler(async ({ data }: { data: { id: number } }) => {
		const guard = await requireUser();
		if (!guard.ok) {
			return guard.failure;
		}
		const user = guard.user;
		const result = await deleteComment(data.id, user.id);
		return { success: result };
	});

export const restoreCommentFn = createServerFn({ method: "POST" })
	.inputValidator((data: { id: number }) => idInputSchema.parse(data))
	.handler(async ({ data }: { data: { id: number } }) => {
		const guard = await requireUser();
		if (!guard.ok) return guard.failure;
		const restored = await authorRestoreComment(data.id, guard.user.id);
		if (!restored) return fail("You cannot restore this comment");
		void indexCommentBestEffort(data.id);
		return { success: true as const };
	});

export const saveCommentFn = createServerFn({ method: "POST" })
	.inputValidator((data: { id: number; saved: boolean }) =>
		saveCommentInputSchema.parse(data),
	)
	.handler(async ({ data }: { data: { id: number; saved: boolean } }) => {
		const guard = await requireUser();
		if (!guard.ok) {
			return guard.failure;
		}
		const user = guard.user;

		await setCommentSavedState({
			commentId: data.id,
			userId: user.id,
			saved: data.saved,
		});

		return { success: true as const };
	});

export const getCommentsSinceFn = createServerFn({ method: "GET" })
	.inputValidator((data: { submissionId: number; since: number }) =>
		commentsSinceInputSchema.parse(data),
	)
	.handler(
		async ({ data }: { data: { submissionId: number; since: number } }) => {
			const user = await getCurrentUser();
			const comments = await getCommentsBySubmissionSince(
				data.submissionId,
				data.since,
				user?.id,
			);
			const lastFetchedAt =
				comments.reduce(
					(max, comment) => Math.max(max, comment.createdUtc),
					0,
				) || Math.floor(Date.now() / 1000);
			return { success: true as const, comments, lastFetchedAt };
		},
	);
