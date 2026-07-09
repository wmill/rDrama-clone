import { createServerFn } from "@tanstack/react-start";
import {
	createComment,
	deleteComment,
	getCommentById,
	getCommentsBySubmissionSince,
	updateComment,
} from "@/lib/comments.server";
import { setCommentSavedState } from "@/lib/lifecycle.server";
import { getCurrentUser } from "@/lib/sessions.server";

export const createCommentFn = createServerFn({ method: "POST" })
	.inputValidator(
		(data: {
			body: string;
			parentSubmissionId: number;
			parentCommentId?: number;
		}) => data,
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
			const user = await getCurrentUser();
			if (!user) {
				return { success: false as const, error: "Not logged in" };
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
				return {
					success: false as const,
					error:
						err instanceof Error ? err.message : "Failed to create comment",
				};
			}
		},
	);

export const updateCommentFn = createServerFn({ method: "POST" })
	.inputValidator((data: { id: number; body: string }) => data)
	.handler(async ({ data }: { data: { id: number; body: string } }) => {
		const user = await getCurrentUser();
		if (!user) {
			return { success: false as const, error: "Not logged in" };
		}
		const result = await updateComment(data.id, user.id, data.body);
		if (!result) {
			return { success: false as const, error: "Failed to update comment" };
		}
		const comment = await getCommentById(data.id, user.id);
		return { success: true as const, comment };
	});

export const deleteCommentFn = createServerFn({ method: "POST" })
	.inputValidator((data: { id: number }) => data)
	.handler(async ({ data }: { data: { id: number } }) => {
		const user = await getCurrentUser();
		if (!user) {
			return { success: false as const, error: "Not logged in" };
		}
		const result = await deleteComment(data.id, user.id);
		return { success: result };
	});

export const saveCommentFn = createServerFn({ method: "POST" })
	.inputValidator((data: { id: number; saved: boolean }) => data)
	.handler(async ({ data }: { data: { id: number; saved: boolean } }) => {
		const user = await getCurrentUser();
		if (!user) {
			return { success: false as const, error: "Not logged in" };
		}

		await setCommentSavedState({
			commentId: data.id,
			userId: user.id,
			saved: data.saved,
		});

		return { success: true as const };
	});

export const getCommentsSinceFn = createServerFn({ method: "GET" })
	.inputValidator((data: { submissionId: number; since: number }) => data)
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
