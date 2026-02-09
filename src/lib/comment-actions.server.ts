import { createServerFn } from "@tanstack/react-start";
import {
	createComment,
	deleteComment,
	updateComment,
} from "@/lib/comments.server";
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
				return { success: true as const, id };
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
		return { success: result };
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
