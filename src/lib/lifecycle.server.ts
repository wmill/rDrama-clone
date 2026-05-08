import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import {
	commentSaveRelationship,
	comments,
	modActions,
	saveRelationship,
	submissions,
} from "@/db/schema";

export const DELETED_BY_AUTHOR_MESSAGE = "Deleted by author";
export const REMOVED_BY_MODERATOR_MESSAGE = "Removed by moderator";

type DbLike = typeof db;

async function logModAction(
	tx: DbLike,
	input:
		| {
				userId: number;
				kind: string;
				targetSubmissionId: number;
				targetCommentId?: never;
		  }
		| {
				userId: number;
				kind: string;
				targetCommentId: number;
				targetSubmissionId?: never;
		  },
) {
	await tx.insert(modActions).values(input);
}

export async function authorDeleteSubmission(
	submissionId: number,
	authorId: number,
	tx: DbLike = db,
): Promise<boolean> {
	const result = await tx
		.update(submissions)
		.set({
			stateUserDeletedUtc: new Date(),
			editedUtc: Math.floor(Date.now() / 1000),
		})
		.where(
			and(
				eq(submissions.id, submissionId),
				eq(submissions.authorId, authorId),
				eq(submissions.stateMod, "VISIBLE"),
			),
		)
		.returning({ id: submissions.id });

	return result.length > 0;
}

export async function setSubmissionRemovedState(
	input: {
		submissionId: number;
		moderatorId: number;
		moderatorName: string;
		removed: boolean;
		actionKind?: string;
	},
	tx: DbLike = db,
): Promise<boolean> {
	const result = await tx
		.update(submissions)
		.set({
			stateMod: input.removed ? "REMOVED" : "VISIBLE",
			stateModSetBy: input.removed ? input.moderatorName : null,
			stateReport: "RESOLVED",
		})
		.where(eq(submissions.id, input.submissionId))
		.returning({ id: submissions.id });

	if (result.length === 0) {
		return false;
	}

	await logModAction(tx, {
		userId: input.moderatorId,
		targetSubmissionId: input.submissionId,
		kind:
			input.actionKind ??
			(input.removed ? "remove_post" : "unremove_post"),
	});

	return true;
}

export async function setSubmissionStickyState(
	input: {
		submissionId: number;
		moderatorId: number;
		moderatorName: string;
		stickied: boolean;
	},
	tx: DbLike = db,
): Promise<boolean> {
	const result = await tx
		.update(submissions)
		.set({
			stickied: input.stickied ? input.moderatorName : null,
			stickiedUtc: input.stickied ? Math.floor(Date.now() / 1000) : null,
		})
		.where(eq(submissions.id, input.submissionId))
		.returning({ id: submissions.id });

	if (result.length === 0) {
		return false;
	}

	await logModAction(tx, {
		userId: input.moderatorId,
		targetSubmissionId: input.submissionId,
		kind: input.stickied ? "sticky_post" : "unsticky_post",
	});

	return true;
}

export async function setSubmissionSavedState(
	input: {
		submissionId: number;
		userId: number;
		saved: boolean;
	},
	tx: DbLike = db,
): Promise<void> {
	if (input.saved) {
		await tx
			.insert(saveRelationship)
			.values({
				submissionId: input.submissionId,
				userId: input.userId,
			})
			.onConflictDoNothing();
		return;
	}

	await tx
		.delete(saveRelationship)
		.where(
			and(
				eq(saveRelationship.submissionId, input.submissionId),
				eq(saveRelationship.userId, input.userId),
			),
		);
}

export async function authorDeleteComment(
	commentId: number,
	authorId: number,
	tx: DbLike = db,
): Promise<boolean> {
	const result = await tx
		.update(comments)
		.set({
			stateUserDeletedUtc: new Date(),
			editedUtc: Math.floor(Date.now() / 1000),
		})
		.where(
			and(
				eq(comments.id, commentId),
				eq(comments.authorId, authorId),
				eq(comments.stateMod, "VISIBLE"),
			),
		)
		.returning({ id: comments.id });

	return result.length > 0;
}

export async function setCommentRemovedState(
	input: {
		commentId: number;
		moderatorId: number;
		moderatorName: string;
		removed: boolean;
		actionKind?: string;
	},
	tx: DbLike = db,
): Promise<boolean> {
	const result = await tx
		.update(comments)
		.set({
			stateMod: input.removed ? "REMOVED" : "VISIBLE",
			stateModSetBy: input.removed ? input.moderatorName : null,
			stateReport: "RESOLVED",
		})
		.where(eq(comments.id, input.commentId))
		.returning({ id: comments.id });

	if (result.length === 0) {
		return false;
	}

	await logModAction(tx, {
		userId: input.moderatorId,
		targetCommentId: input.commentId,
		kind:
			input.actionKind ??
			(input.removed ? "remove_comment" : "unremove_comment"),
	});

	return true;
}

export async function setCommentPinnedState(
	input: {
		commentId: number;
		moderatorId: number;
		moderatorName: string;
		pinned: boolean;
	},
	tx: DbLike = db,
): Promise<boolean> {
	const result = await tx
		.update(comments)
		.set({
			pinnedBy: input.pinned ? input.moderatorName : null,
			isPinnedUtc: input.pinned ? Math.floor(Date.now() / 1000) : null,
		})
		.where(eq(comments.id, input.commentId))
		.returning({ id: comments.id });

	if (result.length === 0) {
		return false;
	}

	await logModAction(tx, {
		userId: input.moderatorId,
		targetCommentId: input.commentId,
		kind: input.pinned ? "pin_comment" : "unpin_comment",
	});

	return true;
}

export async function setCommentSavedState(
	input: {
		commentId: number;
		userId: number;
		saved: boolean;
	},
	tx: DbLike = db,
): Promise<void> {
	if (input.saved) {
		await tx
			.insert(commentSaveRelationship)
			.values({
				commentId: input.commentId,
				userId: input.userId,
			})
			.onConflictDoNothing();
		return;
	}

	await tx
		.delete(commentSaveRelationship)
		.where(
			and(
				eq(commentSaveRelationship.commentId, input.commentId),
				eq(commentSaveRelationship.userId, input.userId),
			),
		);
}
