import { and, eq, isNotNull, isNull } from "drizzle-orm";

import { type AppDbExecutor, db } from "@/db";
import {
	commentSaveRelationship,
	comments,
	modActions,
	saveRelationship,
	submissions,
} from "@/db/schema";

export const DELETED_BY_AUTHOR_MESSAGE = "Deleted by author";
export const FILTERED_BY_MODERATOR_MESSAGE = "Filtered by moderator";
export const REMOVED_BY_MODERATOR_MESSAGE = "Removed by moderator";

export type ModerationState = "VISIBLE" | "FILTERED" | "REMOVED";

type DbLike = AppDbExecutor;

async function logModAction(
	tx: DbLike,
	input:
		| {
				userId: number;
				kind: string;
				note?: string;
				targetUserId?: number;
				targetSubmissionId: number;
				targetCommentId?: never;
		  }
		| {
				userId: number;
				kind: string;
				note?: string;
				targetUserId?: number;
				targetCommentId: number;
				targetSubmissionId?: never;
		  }
		| {
				userId: number;
				kind: string;
				note?: string;
				targetUserId: number;
				targetCommentId?: never;
				targetSubmissionId?: never;
		  },
) {
	await tx.insert(modActions).values(input);
}

function getSubmissionStateActionKind(
	state: ModerationState,
	previousState: ModerationState,
): string {
	if (state === "VISIBLE") {
		return previousState === "FILTERED" ? "unfilter_post" : "unremove_post";
	}

	return state === "FILTERED" ? "filter_post" : "remove_post";
}

function getCommentStateActionKind(
	state: ModerationState,
	previousState: ModerationState,
): string {
	if (state === "VISIBLE") {
		return previousState === "FILTERED"
			? "unfilter_comment"
			: "unremove_comment";
	}

	return state === "FILTERED" ? "filter_comment" : "remove_comment";
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

export async function authorRestoreSubmission(
	submissionId: number,
	authorId: number,
): Promise<boolean> {
	return db.transaction(async (tx) => {
		const result = await tx
			.update(submissions)
			.set({
				stateUserDeletedUtc: null,
				editedUtc: Math.floor(Date.now() / 1000),
			})
			.where(
				and(
					eq(submissions.id, submissionId),
					eq(submissions.authorId, authorId),
					eq(submissions.stateMod, "VISIBLE"),
					isNotNull(submissions.stateUserDeletedUtc),
				),
			)
			.returning({ id: submissions.id });
		return result.length > 0;
	});
}

export async function setSubmissionModerationState(
	input: {
		submissionId: number;
		moderatorId: number;
		moderatorName: string;
		state: ModerationState;
		actionKind?: string;
	},
	tx: DbLike = db,
): Promise<boolean> {
	const [current] = await tx
		.select({ stateMod: submissions.stateMod })
		.from(submissions)
		.where(eq(submissions.id, input.submissionId))
		.limit(1);

	if (!current) {
		return false;
	}

	const result = await tx
		.update(submissions)
		.set({
			stateMod: input.state,
			stateModSetBy: input.state === "VISIBLE" ? null : input.moderatorName,
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
			getSubmissionStateActionKind(
				input.state,
				current.stateMod as ModerationState,
			),
	});

	return true;
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
	return setSubmissionModerationState(
		{
			submissionId: input.submissionId,
			moderatorId: input.moderatorId,
			moderatorName: input.moderatorName,
			state: input.removed ? "REMOVED" : "VISIBLE",
			actionKind: input.actionKind,
		},
		tx,
	);
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

export async function setSubmissionProfilePinnedState(input: {
	submissionId: number;
	authorId: number;
	pinned: boolean;
}): Promise<boolean> {
	const result = await db
		.update(submissions)
		.set({ isPinned: input.pinned })
		.where(
			and(
				eq(submissions.id, input.submissionId),
				eq(submissions.authorId, input.authorId),
			),
		)
		.returning({ id: submissions.id });

	return result.length > 0;
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

export async function authorRestoreComment(
	commentId: number,
	authorId: number,
): Promise<boolean> {
	return db.transaction(async (tx) => {
		const result = await tx
			.update(comments)
			.set({
				stateUserDeletedUtc: null,
				editedUtc: Math.floor(Date.now() / 1000),
			})
			.where(
				and(
					eq(comments.id, commentId),
					eq(comments.authorId, authorId),
					eq(comments.stateMod, "VISIBLE"),
					isNotNull(comments.stateUserDeletedUtc),
				),
			)
			.returning({ id: comments.id });
		return result.length > 0;
	});
}

export async function setCommentModerationState(
	input: {
		commentId: number;
		moderatorId: number;
		moderatorName: string;
		state: ModerationState;
		actionKind?: string;
	},
	tx: DbLike = db,
): Promise<boolean> {
	const [current] = await tx
		.select({ stateMod: comments.stateMod })
		.from(comments)
		.where(eq(comments.id, input.commentId))
		.limit(1);

	if (!current) {
		return false;
	}

	const result = await tx
		.update(comments)
		.set({
			stateMod: input.state,
			stateModSetBy: input.state === "VISIBLE" ? null : input.moderatorName,
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
			getCommentStateActionKind(
				input.state,
				current.stateMod as ModerationState,
			),
	});

	return true;
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
	return setCommentModerationState(
		{
			commentId: input.commentId,
			moderatorId: input.moderatorId,
			moderatorName: input.moderatorName,
			state: input.removed ? "REMOVED" : "VISIBLE",
			actionKind: input.actionKind,
		},
		tx,
	);
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

export type OpCommentPinResult =
	| { ok: true; commentAuthorId: number; changed: boolean }
	| { ok: false; reason: "not_found" | "not_post_author" | "moderator_pin" };

export async function setCommentOpPinnedState(input: {
	commentId: number;
	postAuthorId: number;
	pinned: boolean;
}): Promise<OpCommentPinResult> {
	return db.transaction(async (tx) => {
		const [current] = await tx
			.select({
				commentAuthorId: comments.authorId,
				postAuthorId: submissions.authorId,
				pinnedBy: comments.pinnedBy,
			})
			.from(comments)
			.innerJoin(submissions, eq(comments.parentSubmission, submissions.id))
			.where(eq(comments.id, input.commentId))
			.limit(1);

		if (!current) return { ok: false, reason: "not_found" };
		if (current.postAuthorId !== input.postAuthorId) {
			return { ok: false, reason: "not_post_author" };
		}
		if (current.pinnedBy !== null && current.pinnedBy !== "(OP)") {
			return { ok: false, reason: "moderator_pin" };
		}

		const alreadyInState = input.pinned
			? current.pinnedBy === "(OP)"
			: current.pinnedBy === null;
		if (alreadyInState) {
			return {
				ok: true,
				commentAuthorId: current.commentAuthorId,
				changed: false,
			};
		}

		const result = await tx
			.update(comments)
			.set({
				pinnedBy: input.pinned ? "(OP)" : null,
				isPinnedUtc: input.pinned ? Math.floor(Date.now() / 1000) : null,
			})
			.where(
				and(
					eq(comments.id, input.commentId),
					input.pinned
						? current.pinnedBy === null
							? isNull(comments.pinnedBy)
							: eq(comments.pinnedBy, current.pinnedBy)
						: eq(comments.pinnedBy, "(OP)"),
				),
			)
			.returning({ id: comments.id });

		if (result.length === 0) {
			return { ok: false, reason: "moderator_pin" };
		}
		return {
			ok: true,
			commentAuthorId: current.commentAuthorId,
			changed: true,
		};
	});
}

export async function setCommentNsfwState(input: {
	commentId: number;
	actorId: number;
	nsfw: boolean;
	moderator: boolean;
}): Promise<boolean> {
	const apply = async (tx: DbLike) => {
		const result = await tx
			.update(comments)
			.set({ over18: input.nsfw })
			.where(
				input.moderator
					? eq(comments.id, input.commentId)
					: and(
							eq(comments.id, input.commentId),
							eq(comments.authorId, input.actorId),
						),
			)
			.returning({ id: comments.id });
		if (result.length === 0) return false;
		if (input.moderator) {
			await logModAction(tx, {
				userId: input.actorId,
				targetCommentId: input.commentId,
				kind: input.nsfw ? "mark_comment_nsfw" : "unmark_comment_nsfw",
			});
		}
		return true;
	};

	return input.moderator ? db.transaction(apply) : apply(db);
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
