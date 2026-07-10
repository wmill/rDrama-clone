import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { fail, requireUser } from "@/lib/auth-guards.server";
import { setSubmissionSavedState } from "@/lib/lifecycle.server";
import { setSubmissionSubscriptionState } from "@/lib/notifications.server";
import {
	BannedDomainError,
	deleteSubmission,
	updateSubmission,
} from "@/lib/submissions.server";
import { idInputSchema, idSchema } from "@/lib/validation";

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
		const guard = await requireUser();
		if (!guard.ok) {
			return guard.failure;
		}
		const user = guard.user;

		let updated: boolean;
		try {
			updated = await updateSubmission(data.id, user.id, {
				title: data.title,
				url: data.url || undefined,
				body: data.body || undefined,
				isNsfw: data.isNsfw,
			});
		} catch (err) {
			if (err instanceof BannedDomainError) {
				return fail(err.message);
			}
			throw err;
		}

		if (!updated) {
			return fail("You cannot edit this post");
		}

		return { success: true as const };
	});

export const saveSubmissionInputSchema = z.object({
	id: idSchema,
	saved: z.boolean(),
});
export const submissionSubscriptionInputSchema = z.object({
	id: idSchema,
	subscribed: z.boolean(),
});

export const deleteSubmissionFn = createServerFn({ method: "POST" })
	.inputValidator((data: { id: number }) => idInputSchema.parse(data))
	.handler(async ({ data }: { data: { id: number } }) => {
		const guard = await requireUser();
		if (!guard.ok) {
			return guard.failure;
		}
		const user = guard.user;

		const deleted = await deleteSubmission(data.id, user.id);
		if (!deleted) {
			return fail("You cannot delete this post");
		}

		return { success: true as const };
	});

export const saveSubmissionFn = createServerFn({ method: "POST" })
	.inputValidator((data: { id: number; saved: boolean }) =>
		saveSubmissionInputSchema.parse(data),
	)
	.handler(async ({ data }: { data: { id: number; saved: boolean } }) => {
		const guard = await requireUser();
		if (!guard.ok) {
			return guard.failure;
		}
		const user = guard.user;

		await setSubmissionSavedState({
			submissionId: data.id,
			userId: user.id,
			saved: data.saved,
		});

		return { success: true as const };
	});

export const setSubmissionSubscriptionFn = createServerFn({ method: "POST" })
	.inputValidator((data: { id: number; subscribed: boolean }) =>
		submissionSubscriptionInputSchema.parse(data),
	)
	.handler(async ({ data }) => {
		const guard = await requireUser();
		if (!guard.ok) {
			return guard.failure;
		}
		const user = guard.user;

		await setSubmissionSubscriptionState({
			userId: user.id,
			submissionId: data.id,
			subscribed: data.subscribed,
		});

		return { success: true as const };
	});
