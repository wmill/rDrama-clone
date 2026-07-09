import { and, desc, eq, ilike, inArray, isNotNull, isNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { db } from "@/db";
import {
	commentFlags,
	comments,
	flags,
	modActions,
	submissions,
	userNotes,
	users,
} from "@/db/schema";

export type ReportedSubmission = {
	id: number;
	title: string;
	titleHtml: string;
	authorId: number;
	authorName: string;
	createdUtc: number;
	stateReport: string;
	stateMod: string;
	flags: { userId: number; reporterName: string; reason: string | null }[];
};

export type ReportedComment = {
	id: number;
	bodyHtml: string;
	authorId: number;
	authorName: string;
	createdUtc: number;
	stateReport: string;
	stateMod: string;
	parentSubmissionId: number | null;
	parentSubmissionTitle: string | null;
	flags: { userId: number; reporterName: string; reason: string | null }[];
};

export type AdminUserSearchResult = {
	id: number;
	username: string;
	adminLevel: number;
	isBanned: number;
	shadowBanned: string | null;
};

export type UserAdminDetails = {
	user: typeof users.$inferSelect;
	notes: Array<{
		id: number;
		note: string;
		tag: string;
		authorName: string;
		createdDatetimez: Date;
		referencePost: number | null;
		referenceComment: number | null;
	}>;
};

export async function getReportedSubmissions(): Promise<ReportedSubmission[]> {
	const reportedPosts = await db
		.select({
			id: submissions.id,
			title: submissions.title,
			titleHtml: submissions.titleHtml,
			authorId: submissions.authorId,
			authorName: users.username,
			createdUtc: submissions.createdUtc,
			stateReport: submissions.stateReport,
			stateMod: submissions.stateMod,
		})
		.from(submissions)
		.innerJoin(users, eq(submissions.authorId, users.id))
		.where(
			and(
				eq(submissions.stateReport, "REPORTED"),
				isNull(submissions.stateUserDeletedUtc),
			),
		)
		.orderBy(submissions.createdUtc);

	if (reportedPosts.length === 0) return [];

	const postIds = reportedPosts.map((p) => p.id);
	const reporter = alias(users, "reporter");
	const allFlags = await db
		.select({
			postId: flags.postId,
			userId: flags.userId,
			reporterName: reporter.username,
			reason: flags.reason,
		})
		.from(flags)
		.innerJoin(reporter, eq(flags.userId, reporter.id))
		.where(inArray(flags.postId, postIds));

	const flagsByPostId: Record<number, typeof allFlags> = {};
	for (const f of allFlags) {
		if (!flagsByPostId[f.postId]) flagsByPostId[f.postId] = [];
		flagsByPostId[f.postId].push(f);
	}

	return reportedPosts.map((post) => ({
		...post,
		flags: (flagsByPostId[post.id] ?? []).map((f) => ({
			userId: f.userId,
			reporterName: f.reporterName,
			reason: f.reason,
		})),
	}));
}

export async function getReportedComments(): Promise<ReportedComment[]> {
	const author = alias(users, "author");
	const reportedComments = await db
		.select({
			id: comments.id,
			bodyHtml: comments.bodyHtml,
			authorId: comments.authorId,
			authorName: author.username,
			createdUtc: comments.createdUtc,
			stateReport: comments.stateReport,
			stateMod: comments.stateMod,
			parentSubmissionId: comments.parentSubmission,
			parentSubmissionTitle: submissions.title,
		})
		.from(comments)
		.innerJoin(author, eq(comments.authorId, author.id))
		.leftJoin(submissions, eq(comments.parentSubmission, submissions.id))
		.where(eq(comments.stateReport, "REPORTED"))
		.orderBy(comments.createdUtc);

	if (reportedComments.length === 0) return [];

	const commentIds = reportedComments.map((c) => c.id);
	const reporter = alias(users, "reporter");
	const allFlags = await db
		.select({
			commentId: commentFlags.commentId,
			userId: commentFlags.userId,
			reporterName: reporter.username,
			reason: commentFlags.reason,
		})
		.from(commentFlags)
		.innerJoin(reporter, eq(commentFlags.userId, reporter.id))
		.where(inArray(commentFlags.commentId, commentIds));

	const flagsByCommentId: Record<number, typeof allFlags> = {};
	for (const f of allFlags) {
		if (!flagsByCommentId[f.commentId]) flagsByCommentId[f.commentId] = [];
		flagsByCommentId[f.commentId].push(f);
	}

	return reportedComments.map((comment) => ({
		...comment,
		flags: (flagsByCommentId[comment.id] ?? []).map((f) => ({
			userId: f.userId,
			reporterName: f.reporterName,
			reason: f.reason,
		})),
	}));
}

export type ModQueueKind = "FILTERED" | "REMOVED" | "SHADOWBANNED";

export type ModQueueSubmission = {
	id: number;
	titleHtml: string;
	authorId: number;
	authorName: string;
	authorShadowBanned: string | null;
	createdUtc: number;
	stateMod: string;
	stateModSetBy: string | null;
};

export type ModQueueComment = {
	id: number;
	bodyHtml: string;
	authorId: number;
	authorName: string;
	authorShadowBanned: string | null;
	createdUtc: number;
	stateMod: string;
	stateModSetBy: string | null;
	parentSubmissionId: number | null;
	parentSubmissionTitle: string | null;
};

const MOD_QUEUE_LIMIT = 100;

export async function getModQueueSubmissions(
	queue: ModQueueKind,
): Promise<ModQueueSubmission[]> {
	const condition =
		queue === "SHADOWBANNED"
			? and(
					isNotNull(users.shadowBanned),
					eq(submissions.stateMod, "VISIBLE"),
					isNull(submissions.stateUserDeletedUtc),
				)
			: and(
					eq(submissions.stateMod, queue),
					isNull(submissions.stateUserDeletedUtc),
				);

	return db
		.select({
			id: submissions.id,
			titleHtml: submissions.titleHtml,
			authorId: submissions.authorId,
			authorName: users.username,
			authorShadowBanned: users.shadowBanned,
			createdUtc: submissions.createdUtc,
			stateMod: submissions.stateMod,
			stateModSetBy: submissions.stateModSetBy,
		})
		.from(submissions)
		.innerJoin(users, eq(submissions.authorId, users.id))
		.where(condition)
		.orderBy(desc(submissions.createdUtc))
		.limit(MOD_QUEUE_LIMIT);
}

export async function getModQueueComments(
	queue: ModQueueKind,
): Promise<ModQueueComment[]> {
	const author = alias(users, "author");
	const condition =
		queue === "SHADOWBANNED"
			? and(
					isNotNull(author.shadowBanned),
					eq(comments.stateMod, "VISIBLE"),
					isNull(comments.stateUserDeletedUtc),
				)
			: and(eq(comments.stateMod, queue), isNull(comments.stateUserDeletedUtc));

	return db
		.select({
			id: comments.id,
			bodyHtml: comments.bodyHtml,
			authorId: comments.authorId,
			authorName: author.username,
			authorShadowBanned: author.shadowBanned,
			createdUtc: comments.createdUtc,
			stateMod: comments.stateMod,
			stateModSetBy: comments.stateModSetBy,
			parentSubmissionId: comments.parentSubmission,
			parentSubmissionTitle: submissions.title,
		})
		.from(comments)
		.innerJoin(author, eq(comments.authorId, author.id))
		.leftJoin(submissions, eq(comments.parentSubmission, submissions.id))
		.where(condition)
		.orderBy(desc(comments.createdUtc))
		.limit(MOD_QUEUE_LIMIT);
}

export type ModLogEntry = {
	id: number;
	kind: string | null;
	note: string | null;
	createdDatetimez: Date;
	actorId: number | null;
	actorName: string | null;
	targetUserId: number | null;
	targetUserName: string | null;
	targetSubmissionId: number | null;
	targetSubmissionTitle: string | null;
	targetCommentId: number | null;
};

export type ModLogPage = {
	entries: ModLogEntry[];
	page: number;
	hasMore: boolean;
};

export const MOD_LOG_PER_PAGE = 50;

export async function getModLog(page = 1): Promise<ModLogPage> {
	const safePage = Math.max(1, Math.floor(page));
	const actor = alias(users, "actor");
	const targetUser = alias(users, "target_user");

	const rows = await db
		.select({
			id: modActions.id,
			kind: modActions.kind,
			note: modActions.note,
			createdDatetimez: modActions.createdDatetimez,
			actorId: modActions.userId,
			actorName: actor.username,
			targetUserId: modActions.targetUserId,
			targetUserName: targetUser.username,
			targetSubmissionId: modActions.targetSubmissionId,
			targetSubmissionTitle: submissions.title,
			targetCommentId: modActions.targetCommentId,
		})
		.from(modActions)
		.leftJoin(actor, eq(modActions.userId, actor.id))
		.leftJoin(targetUser, eq(modActions.targetUserId, targetUser.id))
		.leftJoin(submissions, eq(modActions.targetSubmissionId, submissions.id))
		.orderBy(desc(modActions.createdDatetimez), desc(modActions.id))
		.limit(MOD_LOG_PER_PAGE + 1)
		.offset((safePage - 1) * MOD_LOG_PER_PAGE);

	return {
		entries: rows.slice(0, MOD_LOG_PER_PAGE),
		page: safePage,
		hasMore: rows.length > MOD_LOG_PER_PAGE,
	};
}

export async function searchUsers(
	query: string,
): Promise<AdminUserSearchResult[]> {
	return db
		.select({
			id: users.id,
			username: users.username,
			adminLevel: users.adminLevel,
			isBanned: users.isBanned,
			shadowBanned: users.shadowBanned,
		})
		.from(users)
		.where(ilike(users.username, `%${query}%`))
		.limit(20);
}

export async function getUserAdminDetails(
	userId: number,
): Promise<UserAdminDetails | null> {
	const [user] = await db
		.select()
		.from(users)
		.where(eq(users.id, userId))
		.limit(1);

	if (!user) return null;

	const noteAuthor = alias(users, "note_author");
	const notes = await db
		.select({
			id: userNotes.id,
			note: userNotes.note,
			tag: userNotes.tag,
			authorName: noteAuthor.username,
			createdDatetimez: userNotes.createdDatetimez,
			referencePost: userNotes.referencePost,
			referenceComment: userNotes.referenceComment,
		})
		.from(userNotes)
		.innerJoin(noteAuthor, eq(userNotes.authorId, noteAuthor.id))
		.where(eq(userNotes.referenceUser, userId))
		.orderBy(userNotes.createdDatetimez);

	return { user, notes };
}
