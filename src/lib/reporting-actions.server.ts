import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
	ReportTargetNotFoundError,
	reportComment,
	reportSubmission,
} from "@/lib/reporting.server";
import { getCurrentUser } from "@/lib/sessions.server";

const reportSchema = z.object({
	id: z.number().int().positive(),
	reason: z.string().max(1000).default(""),
});

export const reportSubmissionFn = createServerFn({ method: "POST" })
	.inputValidator((data: { id: number; reason: string }) =>
		reportSchema.parse(data),
	)
	.handler(async ({ data }: { data: { id: number; reason: string } }) => {
		const user = await getCurrentUser();
		if (!user) {
			return { success: false as const, error: "Not logged in" };
		}

		try {
			const result = await reportSubmission({
				submissionId: data.id,
				user,
				reason: data.reason,
			});
			return { success: true as const, message: result.message };
		} catch (error) {
			if (error instanceof ReportTargetNotFoundError) {
				return { success: false as const, error: "Post not found" };
			}

			return {
				success: false as const,
				error: error instanceof Error ? error.message : "Failed to report post",
			};
		}
	});

export const reportCommentFn = createServerFn({ method: "POST" })
	.inputValidator((data: { id: number; reason: string }) =>
		reportSchema.parse(data),
	)
	.handler(async ({ data }: { data: { id: number; reason: string } }) => {
		const user = await getCurrentUser();
		if (!user) {
			return { success: false as const, error: "Not logged in" };
		}

		try {
			const result = await reportComment({
				commentId: data.id,
				user,
				reason: data.reason,
			});
			return { success: true as const, message: result.message };
		} catch (error) {
			if (error instanceof ReportTargetNotFoundError) {
				return { success: false as const, error: "Comment not found" };
			}

			return {
				success: false as const,
				error:
					error instanceof Error ? error.message : "Failed to report comment",
			};
		}
	});
