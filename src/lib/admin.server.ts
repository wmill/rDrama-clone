import { and, eq, ilike, inArray, isNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { db } from "@/db";
import {
	commentFlags,
	comments,
	flags,
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
