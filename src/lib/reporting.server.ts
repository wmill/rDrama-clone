import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import {
	comments,
	commentFlags,
	flags,
	modActions,
	submissions,
} from "@/db/schema";
import type { SafeUser } from "@/lib/auth.server";

const REMOVED_CHARACTERS = /[\u200e\u200b\ufeff]/g;
const WHITESPACE = /\s+/g;
const MAX_REASON_LENGTH = 100;

export class ReportTargetNotFoundError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "ReportTargetNotFoundError";
	}
}

export function normalizeReportReason(reason: string): string {
	return reason
		.replace(REMOVED_CHARACTERS, "")
		.replace(WHITESPACE, " ")
		.trim()
		.slice(0, MAX_REASON_LENGTH);
}

export function isSuspendedPermanently(user: Pick<SafeUser, "isBanned" | "unbanUtc">): boolean {
	return user.isBanned > 0 && user.unbanUtc === 0;
}

export async function reportSubmission(params: {
	submissionId: number;
	user: Pick<
		SafeUser,
		"id" | "adminLevel" | "isBanned" | "unbanUtc" | "shadowBanned"
	>;
	reason: string;
}): Promise<{ message: string }> {
	const reason = normalizeReportReason(params.reason);

	await db.transaction(async (tx) => {
		const [submission] = await tx
			.select({
				id: submissions.id,
				stateReport: submissions.stateReport,
			})
			.from(submissions)
			.where(eq(submissions.id, params.submissionId))
			.limit(1);

		if (!submission) {
			throw new ReportTargetNotFoundError("Post not found");
		}

		if (reason.startsWith("!") && params.user.adminLevel >= 2) {
			const flair = reason.slice(1);
			await tx
				.update(submissions)
				.set({ flair })
				.where(eq(submissions.id, params.submissionId));

			await tx.insert(modActions).values({
				kind: "flair_post",
				userId: params.user.id,
				targetSubmissionId: params.submissionId,
				note: `"${flair}"`,
			});

			return;
		}

		await tx.insert(flags).values({
			postId: params.submissionId,
			userId: params.user.id,
			reason,
		});

		if (
			!isSuspendedPermanently(params.user) &&
			submission.stateReport !== "IGNORED"
		) {
			await tx
				.update(submissions)
				.set({ stateReport: "REPORTED" })
				.where(
					and(
						eq(submissions.id, params.submissionId),
						eq(submissions.stateReport, submission.stateReport),
					),
				);
		}
	});

	return { message: "Post reported!" };
}

export async function reportComment(params: {
	commentId: number;
	user: Pick<
		SafeUser,
		"id" | "adminLevel" | "isBanned" | "unbanUtc" | "shadowBanned"
	>;
	reason: string;
}): Promise<{ message: string }> {
	if (
		isSuspendedPermanently(params.user) ||
		Boolean(params.user.shadowBanned)
	) {
		return { message: "Comment reported!" };
	}

	const reason = normalizeReportReason(params.reason);

	await db.transaction(async (tx) => {
		const [comment] = await tx
			.select({
				id: comments.id,
				stateReport: comments.stateReport,
			})
			.from(comments)
			.where(eq(comments.id, params.commentId))
			.limit(1);

		if (!comment) {
			throw new ReportTargetNotFoundError("Comment not found");
		}

		await tx.insert(commentFlags).values({
			commentId: params.commentId,
			userId: params.user.id,
			reason,
		});

		if (comment.stateReport !== "IGNORED") {
			await tx
				.update(comments)
				.set({ stateReport: "REPORTED" })
				.where(
					and(
						eq(comments.id, params.commentId),
						eq(comments.stateReport, comment.stateReport),
					),
				);
		}
	});

	return { message: "Comment reported!" };
}
