import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { fail, requireUser } from "@/lib/auth-guards.server";
import {
	ReportTargetNotFoundError,
	reportComment,
	reportSubmission,
} from "@/lib/reporting.server";

const reportSchema = z.object({
	id: z.number().int().positive(),
	reason: z.string().max(1000).default(""),
});

export const reportSubmissionFn = createServerFn({ method: "POST" })
	.inputValidator((data: { id: number; reason: string }) =>
		reportSchema.parse(data),
	)
	.handler(async ({ data }: { data: { id: number; reason: string } }) => {
		const guard = await requireUser();
		if (!guard.ok) {
			return guard.failure;
		}
		const user = guard.user;

		try {
			const result = await reportSubmission({
				submissionId: data.id,
				user,
				reason: data.reason,
			});
			return { success: true as const, message: result.message };
		} catch (error) {
			if (error instanceof ReportTargetNotFoundError) {
				return fail("Post not found");
			}

			return fail(
				error instanceof Error ? error.message : "Failed to report post",
			);
		}
	});

export const reportCommentFn = createServerFn({ method: "POST" })
	.inputValidator((data: { id: number; reason: string }) =>
		reportSchema.parse(data),
	)
	.handler(async ({ data }: { data: { id: number; reason: string } }) => {
		const guard = await requireUser();
		if (!guard.ok) {
			return guard.failure;
		}
		const user = guard.user;

		try {
			const result = await reportComment({
				commentId: data.id,
				user,
				reason: data.reason,
			});
			return { success: true as const, message: result.message };
		} catch (error) {
			if (error instanceof ReportTargetNotFoundError) {
				return fail("Comment not found");
			}

			return fail(
				error instanceof Error ? error.message : "Failed to report comment",
			);
		}
	});
