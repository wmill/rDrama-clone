import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { setSubmissionSavedState } from "@/lib/lifecycle.server";
import { getCurrentUser } from "@/lib/sessions.server";
import { deleteSubmission, updateSubmission } from "@/lib/submissions.server";

const updateSubmissionSchema = z
	.object({
		id: z.number().int().positive(),
		title: z
			.string()
			.min(1, "Title is required")
			.max(500, "Title must be 500 characters or less"),
		url: z
			.string()
			.url("Please enter a valid URL")
			.optional()
			.or(z.literal("")),
		body: z
			.string()
			.max(20000, "Body must be 20000 characters or less")
			.optional(),
		isNsfw: z.boolean().default(false),
	})
	.refine((data) => data.url || data.body, {
		message: "Either a URL or body text is required",
		path: ["body"],
	});

export type UpdateSubmissionInput = z.infer<typeof updateSubmissionSchema>;

export const updateSubmissionFn = createServerFn({ method: "POST" })
	.inputValidator((data: UpdateSubmissionInput) =>
		updateSubmissionSchema.parse(data),
	)
	.handler(async ({ data }: { data: UpdateSubmissionInput }) => {
		const user = await getCurrentUser();
		if (!user) {
			return { success: false as const, error: "Not logged in" };
		}

		const updated = await updateSubmission(data.id, user.id, {
			title: data.title,
			url: data.url || undefined,
			body: data.body || undefined,
			isNsfw: data.isNsfw,
		});

		if (!updated) {
			return {
				success: false as const,
				error: "You cannot edit this post",
			};
		}

		return { success: true as const };
	});

export const deleteSubmissionFn = createServerFn({ method: "POST" })
	.inputValidator((data: { id: number }) => data)
	.handler(async ({ data }: { data: { id: number } }) => {
		const user = await getCurrentUser();
		if (!user) {
			return { success: false as const, error: "Not logged in" };
		}

		const deleted = await deleteSubmission(data.id, user.id);
		if (!deleted) {
			return {
				success: false as const,
				error: "You cannot delete this post",
			};
		}

		return { success: true as const };
	});

export const saveSubmissionFn = createServerFn({ method: "POST" })
	.inputValidator((data: { id: number; saved: boolean }) => data)
	.handler(async ({ data }: { data: { id: number; saved: boolean } }) => {
		const user = await getCurrentUser();
		if (!user) {
			return { success: false as const, error: "Not logged in" };
		}

		await setSubmissionSavedState({
			submissionId: data.id,
			userId: user.id,
			saved: data.saved,
		});

		return { success: true as const };
	});
