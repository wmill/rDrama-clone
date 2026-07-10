import { and, desc, eq, ne, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { type AppDbExecutor, db } from "@/db";
import {
	comments,
	notifications,
	submissions,
	subscriptions,
	userBlocks,
	users,
} from "@/db/schema";
import { getCommentViewerContext } from "@/lib/comment-visibility.server";
import { stripHtmlToText } from "@/lib/utils";
import { extractUserMentionsFromMarkdown } from "./user-mentions";

const COMMENT_REMOVED_PLACEHOLDER = "[removed by moderator]";
const COMMENT_DELETED_PLACEHOLDER = "[deleted]";

type NotificationQueryRow = {
	notificationId: number;
	commentId: number | null;
	read: boolean;
	notificationCreatedAt: Date;
	commentAuthorId: number;
	commentAuthorName: string;
	commentAuthorShadowBanned: string | null;
	commentBody: string | null;
	commentBodyHtml: string;
	commentCreatedUtc: number;
	commentStateMod: string | null;
	commentStateUserDeletedUtc: Date | null;
	parentCommentId: number | null;
	parentCommentAuthorId: number | null;
	submissionId: number;
	submissionTitle: string;
	submissionAuthorId: number;
	submissionPrivate: boolean;
	submissionStateMod: string;
	submissionStateUserDeletedUtc: Date | null;
};

export type NotificationType = "comment" | "follow" | "award";

export type NotificationListItem = {
	id: number;
	type: NotificationType;
	commentId: number | null;
	read: boolean;
	createdUtc: number;
	actorUsername: string;
	label: string;
	postTitle: string;
	commentSnippet: string;
	href: string;
};

export type NotificationsPage = {
	items: NotificationListItem[];
	hasNextPage: boolean;
	page: number;
	pageSize: number;
};

type NotificationTriggerContext = {
	isReply: boolean;
	isMention: boolean;
	isSubscription: boolean;
};

function getMentionedUsernameSet(body: string | null): Set<string> {
	if (!body) {
		return new Set<string>();
	}

	return new Set(
		extractUserMentionsFromMarkdown(body).map((username) =>
			username.toLowerCase(),
		),
	);
}

function deriveNotificationTrigger(
	row: NotificationQueryRow,
	userId: number,
	username: string,
): NotificationTriggerContext {
	const mentionedUsernames = getMentionedUsernameSet(row.commentBody);
	const isReply =
		row.parentCommentAuthorId === userId ||
		(row.parentCommentId === null && row.submissionAuthorId === userId);
	const isMention = mentionedUsernames.has(username.toLowerCase());
	const isSubscription = !isReply && !isMention;

	return {
		isReply,
		isMention,
		isSubscription,
	};
}

function getNotificationLabel(
	row: NotificationQueryRow,
	trigger: NotificationTriggerContext,
): string {
	if (trigger.isReply) {
		return row.parentCommentId === null
			? "replied to your post"
			: "replied to your comment";
	}

	if (trigger.isMention) {
		return "mentioned you";
	}

	if (trigger.isSubscription) {
		return "new comment on a subscribed post";
	}

	return "new activity";
}

function getNotificationSnippet(row: NotificationQueryRow): string {
	if (row.commentStateUserDeletedUtc !== null) {
		return COMMENT_DELETED_PLACEHOLDER;
	}

	if (row.commentStateMod !== "VISIBLE") {
		return COMMENT_REMOVED_PLACEHOLDER;
	}

	const snippet = stripHtmlToText(row.commentBodyHtml || row.commentBody);
	return snippet.length > 0 ? snippet : "[comment]";
}

function canSeeNotificationRow(
	row: NotificationQueryRow,
	viewer: Awaited<ReturnType<typeof getCommentViewerContext>>,
): boolean {
	if (
		row.submissionPrivate ||
		row.submissionStateUserDeletedUtc !== null ||
		row.submissionStateMod !== "VISIBLE"
	) {
		return false;
	}

	if (
		row.commentAuthorShadowBanned !== null &&
		!viewer.canSeeShadowbanned &&
		viewer.viewerId !== row.commentAuthorId
	) {
		return false;
	}

	if (viewer.blockedAuthorIds.has(row.commentAuthorId)) {
		return false;
	}

	return true;
}

async function resolveMentionRecipientIds(usernamesToResolve: string[]) {
	if (usernamesToResolve.length === 0) {
		return [];
	}

	const normalized = [
		...new Set(usernamesToResolve.map((u) => u.toLowerCase())),
	];
	const conditions = normalized.map(
		(username) => sql`lower(${users.username}) = ${username}`,
	);
	const mentionedUsers = await db
		.select({
			id: users.id,
		})
		.from(users)
		.where(or(...conditions));

	return mentionedUsers.map((user) => user.id);
}

async function loadNotificationRows(
	userId: number,
	options?: {
		onlyUnread?: boolean;
	},
): Promise<NotificationQueryRow[]> {
	const parentComment = alias(comments, "parent_comment");

	return db
		.select({
			notificationId: notifications.id,
			commentId: notifications.commentId,
			read: notifications.read,
			notificationCreatedAt: notifications.createdDatetimez,
			commentAuthorId: comments.authorId,
			commentAuthorName: users.username,
			commentAuthorShadowBanned: users.shadowBanned,
			commentBody: comments.body,
			commentBodyHtml: comments.bodyHtml,
			commentCreatedUtc: comments.createdUtc,
			commentStateMod: comments.stateMod,
			commentStateUserDeletedUtc: comments.stateUserDeletedUtc,
			parentCommentId: comments.parentCommentId,
			parentCommentAuthorId: parentComment.authorId,
			submissionId: submissions.id,
			submissionTitle: submissions.title,
			submissionAuthorId: submissions.authorId,
			submissionPrivate: submissions.private,
			submissionStateMod: submissions.stateMod,
			submissionStateUserDeletedUtc: submissions.stateUserDeletedUtc,
		})
		.from(notifications)
		.innerJoin(comments, eq(notifications.commentId, comments.id))
		.innerJoin(users, eq(comments.authorId, users.id))
		.innerJoin(submissions, eq(comments.parentSubmission, submissions.id))
		.leftJoin(parentComment, eq(comments.parentCommentId, parentComment.id))
		.leftJoin(
			userBlocks,
			and(
				eq(userBlocks.userId, userId),
				eq(userBlocks.targetId, comments.authorId),
			),
		)
		.where(
			and(
				eq(notifications.userId, userId),
				eq(notifications.type, "comment"),
				options?.onlyUnread ? eq(notifications.read, false) : undefined,
			),
		)
		.orderBy(desc(notifications.createdDatetimez));
}

type SimpleNotificationRow = {
	notificationId: number;
	type: string;
	body: string | null;
	url: string | null;
	read: boolean;
	notificationCreatedAt: Date;
	actorId: number | null;
	actorName: string | null;
	actorShadowBanned: string | null;
};

async function loadSimpleNotificationRows(
	userId: number,
	options?: {
		onlyUnread?: boolean;
	},
): Promise<SimpleNotificationRow[]> {
	return db
		.select({
			notificationId: notifications.id,
			type: notifications.type,
			body: notifications.body,
			url: notifications.url,
			read: notifications.read,
			notificationCreatedAt: notifications.createdDatetimez,
			actorId: notifications.actorId,
			actorName: users.username,
			actorShadowBanned: users.shadowBanned,
		})
		.from(notifications)
		.leftJoin(users, eq(notifications.actorId, users.id))
		.where(
			and(
				eq(notifications.userId, userId),
				ne(notifications.type, "comment"),
				options?.onlyUnread ? eq(notifications.read, false) : undefined,
			),
		)
		.orderBy(desc(notifications.createdDatetimez));
}

function canSeeSimpleNotificationRow(
	row: SimpleNotificationRow,
	viewer: Awaited<ReturnType<typeof getCommentViewerContext>>,
): boolean {
	if (row.actorId !== null && viewer.blockedAuthorIds.has(row.actorId)) {
		return false;
	}

	if (
		row.actorShadowBanned !== null &&
		!viewer.canSeeShadowbanned &&
		viewer.viewerId !== row.actorId
	) {
		return false;
	}

	return true;
}

function mapSimpleNotificationRow(
	row: SimpleNotificationRow,
): NotificationListItem {
	const actorUsername = row.actorName ?? "[deleted]";
	return {
		id: row.notificationId,
		type: row.type === "follow" || row.type === "award" ? row.type : "follow",
		commentId: null,
		read: row.read,
		createdUtc: Math.floor(row.notificationCreatedAt.getTime() / 1000),
		actorUsername,
		label: row.body ?? "new activity",
		postTitle: "",
		commentSnippet: "",
		href: row.url ?? `/u/${actorUsername}`,
	};
}

export async function createSimpleNotification(options: {
	userId: number;
	actorId: number;
	type: Exclude<NotificationType, "comment">;
	body: string;
	url?: string;
	tx?: AppDbExecutor;
}): Promise<void> {
	if (options.userId === options.actorId) {
		return;
	}

	await (options.tx ?? db).insert(notifications).values({
		userId: options.userId,
		actorId: options.actorId,
		type: options.type,
		body: options.body,
		url: options.url ?? null,
		read: false,
	});
}

export async function createNotificationsForComment(
	commentId: number,
	tx: AppDbExecutor = db,
): Promise<void> {
	const [commentRow] = await tx
		.select({
			id: comments.id,
			authorId: comments.authorId,
			body: comments.body,
			parentCommentId: comments.parentCommentId,
			parentSubmissionId: comments.parentSubmission,
		})
		.from(comments)
		.where(eq(comments.id, commentId))
		.limit(1);

	if (!commentRow) {
		return;
	}

	const recipients = new Set<number>();
	const submissionRowPromise =
		commentRow.parentSubmissionId === null
			? Promise.resolve(null)
			: tx
					.select({
						authorId: submissions.authorId,
					})
					.from(submissions)
					.where(eq(submissions.id, commentRow.parentSubmissionId))
					.limit(1)
					.then((rows) => rows[0] ?? null);
	const parentCommentRowPromise =
		commentRow.parentCommentId === null
			? Promise.resolve(null)
			: tx
					.select({
						authorId: comments.authorId,
					})
					.from(comments)
					.where(eq(comments.id, commentRow.parentCommentId))
					.limit(1)
					.then((rows) => rows[0] ?? null);
	const subscriberRowsPromise =
		commentRow.parentSubmissionId === null
			? Promise.resolve([] as Array<{ userId: number }>)
			: tx
					.select({
						userId: subscriptions.userId,
					})
					.from(subscriptions)
					.where(eq(subscriptions.submissionId, commentRow.parentSubmissionId));
	const [submissionRow, parentCommentRow, subscriberRows, mentionedUserIds] =
		await Promise.all([
			submissionRowPromise,
			parentCommentRowPromise,
			subscriberRowsPromise,
			resolveMentionRecipientIds(
				extractUserMentionsFromMarkdown(commentRow.body ?? ""),
			),
		]);

	if (parentCommentRow?.authorId) {
		recipients.add(parentCommentRow.authorId);
	}

	if (submissionRow?.authorId) {
		recipients.add(submissionRow.authorId);
	}

	for (const subscriber of subscriberRows) {
		recipients.add(subscriber.userId);
	}

	for (const mentionedUserId of mentionedUserIds) {
		recipients.add(mentionedUserId);
	}

	recipients.delete(commentRow.authorId);

	if (recipients.size === 0) {
		return;
	}

	await tx
		.insert(notifications)
		.values(
			[...recipients].map((userId) => ({
				userId,
				commentId,
				read: false,
			})),
		)
		.onConflictDoNothing();
}

export async function getUnreadNotificationCount(
	userId: number,
): Promise<number> {
	const [viewer, currentUserRows, rows, simpleRows] = await Promise.all([
		getCommentViewerContext(userId),
		db
			.select({
				username: users.username,
			})
			.from(users)
			.where(eq(users.id, userId))
			.limit(1),
		loadNotificationRows(userId, { onlyUnread: true }),
		loadSimpleNotificationRows(userId, { onlyUnread: true }),
	]);
	const currentUser = currentUserRows[0];
	if (!currentUser) {
		return 0;
	}

	return (
		rows.filter((row) => canSeeNotificationRow(row, viewer)).length +
		simpleRows.filter((row) => canSeeSimpleNotificationRow(row, viewer)).length
	);
}

export async function getNotificationsPage(options: {
	userId: number;
	page: number;
	pageSize: number;
}): Promise<NotificationsPage> {
	const page = Math.max(1, options.page);
	const pageSize = Math.max(1, options.pageSize);
	const [viewer, currentUserRows, rows, simpleRows] = await Promise.all([
		getCommentViewerContext(options.userId),
		db
			.select({
				username: users.username,
			})
			.from(users)
			.where(eq(users.id, options.userId))
			.limit(1),
		loadNotificationRows(options.userId),
		loadSimpleNotificationRows(options.userId),
	]);
	const currentUser = currentUserRows[0];
	if (!currentUser) {
		return { items: [], hasNextPage: false, page, pageSize };
	}

	const commentItems = rows
		.filter((row) => canSeeNotificationRow(row, viewer))
		.map((row): NotificationListItem => {
			const trigger = deriveNotificationTrigger(
				row,
				options.userId,
				currentUser.username,
			);

			return {
				id: row.notificationId,
				type: "comment",
				commentId: row.commentId,
				read: row.read,
				createdUtc: Math.floor(row.notificationCreatedAt.getTime() / 1000),
				actorUsername: row.commentAuthorName,
				label: getNotificationLabel(row, trigger),
				postTitle: row.submissionTitle,
				commentSnippet: getNotificationSnippet(row),
				href: `/comment/${row.commentId}`,
			};
		});
	const simpleItems = simpleRows
		.filter((row) => canSeeSimpleNotificationRow(row, viewer))
		.map(mapSimpleNotificationRow);

	const visibleItems = [...commentItems, ...simpleItems].sort(
		(a, b) => b.createdUtc - a.createdUtc,
	);
	const slicedItems = visibleItems.slice(
		(page - 1) * pageSize,
		page * pageSize,
	);

	return {
		items: slicedItems,
		hasNextPage: visibleItems.length > page * pageSize,
		page,
		pageSize,
	};
}

export async function markNotificationRead(options: {
	userId: number;
	notificationId: number;
}): Promise<void> {
	await db
		.update(notifications)
		.set({ read: true })
		.where(
			and(
				eq(notifications.userId, options.userId),
				eq(notifications.id, options.notificationId),
			),
		);
}

export async function markAllNotificationsRead(userId: number): Promise<void> {
	await db
		.update(notifications)
		.set({ read: true })
		.where(eq(notifications.userId, userId));
}

export async function clearReadNotifications(userId: number): Promise<void> {
	await db
		.delete(notifications)
		.where(and(eq(notifications.userId, userId), eq(notifications.read, true)));
}

export async function setSubmissionSubscriptionState(options: {
	userId: number;
	submissionId: number;
	subscribed: boolean;
	tx?: AppDbExecutor;
}): Promise<void> {
	const executor = options.tx ?? db;

	if (options.subscribed) {
		await executor
			.insert(subscriptions)
			.values({
				userId: options.userId,
				submissionId: options.submissionId,
			})
			.onConflictDoNothing();
		return;
	}

	await executor
		.delete(subscriptions)
		.where(
			and(
				eq(subscriptions.userId, options.userId),
				eq(subscriptions.submissionId, options.submissionId),
			),
		);
}

export async function isSubmissionSubscribed(options: {
	userId: number;
	submissionId: number;
}): Promise<boolean> {
	const rows = await db
		.select({
			userId: subscriptions.userId,
		})
		.from(subscriptions)
		.where(
			and(
				eq(subscriptions.userId, options.userId),
				eq(subscriptions.submissionId, options.submissionId),
			),
		)
		.limit(1);

	return rows.length > 0;
}
