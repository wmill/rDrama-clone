import {
	and,
	asc,
	desc,
	eq,
	gte,
	inArray,
	isNull,
	type SQL,
	sql,
} from "drizzle-orm";

import { db } from "@/db";
import {
	commentSaveRelationship,
	comments,
	commentVotes,
	submissions,
	userBlocks,
	users,
} from "@/db/schema";
import {
	type CommentViewerContext,
	getCommentViewerContext,
	getCommentVisibility,
	shouldIncludeCommentInFeed,
} from "@/lib/comment-visibility.server";
import { authorDeleteComment } from "@/lib/lifecycle.server";
import { renderCommentMarkdown } from "@/lib/markdown";
import { createNotificationsForComment } from "@/lib/notifications.server";
import type { VoteType } from "@/lib/votes.server";
import type { CommentFeedSortType, TimeFilter } from "./constants";
import type { ModerationState } from "./lifecycle.server";

export type CommentFeedItem = {
	id: number;
	authorId: number;
	authorName: string;
	body: string | null;
	bodyHtml: string;
	visibilityMessage?: string | null;
	createdUtc: number;
	editedUtc: number;
	upvotes: number;
	downvotes: number;
	score: number;
	level: number;
	parentSubmissionId: number | null;
	submissionTitle: string;
	distinguishLevel: number;
	isDeleted: boolean;
	isRemoved: boolean;
	isFiltered: boolean;
	isSaved: boolean;
	userVote: VoteType;
	stateMod: ModerationState;
	stateModSetBy: string | null;
};

export type CommentSummary = {
	id: number;
	authorId: number;
	authorName: string;
	body: string | null;
	bodyHtml: string;
	createdUtc: number;
	editedUtc: number;
	upvotes: number;
	downvotes: number;
	score: number;
	level: number;
	parentCommentId: number | null;
	parentSubmissionId: number | null;
	descendantCount: number;
	pinnedBy: string | null;
	distinguishLevel: number;
	isDeleted: boolean;
	isRemoved: boolean;
	isPinned: boolean;
	isSaved: boolean;
	isModHidden: boolean;
	visibilityMessage?: string | null;
	userVote: VoteType;
	stateMod: ModerationState;
	stateModSetBy: string | null;
};

export type CommentWithReplies = CommentSummary & {
	replies: CommentWithReplies[];
};
export type CommentFlat = CommentSummary;

export const CommentSortTypes = ["top", "new", "old", "controversial"] as const;
export type CommentSortType = (typeof CommentSortTypes)[number];

const MOD_HIDDEN_PLACEHOLDER = "[removed by moderator]";

export type RawCommentRow = {
	id: number;
	authorId: number;
	authorName: string;
	authorShadowBanned: string | null;
	body: string | null;
	bodyHtml: string;
	createdUtc: number;
	editedUtc: number;
	upvotes: number;
	downvotes: number;
	level: number;
	parentCommentId: number | null;
	parentSubmissionId: number | null;
	descendantCount: number;
	pinnedBy: string | null;
	distinguishLevel: number;
	stateUserDeletedUtc: Date | null;
	stateMod: string | null;
	stateModSetBy: string | null;
	userVoteType: number | null;
	savedCommentId: number | null;
	isBlocking: boolean;
	parentSubmissionPrivate?: boolean | null;
	parentSubmissionDeletedUtc?: Date | null;
	parentSubmissionStateMod?: string | null;
};

export async function getCommentsBySubmission(
	submissionId: number,
	sort: CommentSortType = "top",
	userId?: number,
): Promise<CommentWithReplies[]> {
	const flatComments = await getCommentsBySubmissionFlat(submissionId, userId);
	const commentMap = new Map<number, CommentWithReplies>();
	const rootComments: CommentWithReplies[] = [];

	for (const comment of flatComments) {
		commentMap.set(comment.id, { ...comment, replies: [] });
	}

	for (const comment of commentMap.values()) {
		if (comment.parentCommentId === null) {
			rootComments.push(comment);
			continue;
		}

		const parent = commentMap.get(comment.parentCommentId);
		if (parent) {
			parent.replies.push(comment);
		} else {
			rootComments.push(comment);
		}
	}

	const sortReplies = (commentList: CommentWithReplies[]) => {
		for (const comment of commentList) {
			if (comment.replies.length === 0) continue;

			switch (sort) {
				case "new":
					comment.replies.sort((a, b) => b.createdUtc - a.createdUtc);
					break;
				case "old":
					comment.replies.sort((a, b) => a.createdUtc - b.createdUtc);
					break;
				default:
					comment.replies.sort((a, b) => b.score - a.score);
					break;
			}

			sortReplies(comment.replies);
		}
	};

	sortReplies(rootComments);

	return rootComments;
}

function mapCommentRow(row: RawCommentRow): CommentFlat {
	return {
		id: row.id,
		authorId: row.authorId,
		authorName: row.authorName,
		body: row.body,
		bodyHtml: row.bodyHtml,
		createdUtc: row.createdUtc,
		editedUtc: row.editedUtc,
		upvotes: row.upvotes,
		downvotes: row.downvotes,
		score: row.upvotes - row.downvotes,
		level: row.level,
		parentCommentId: row.parentCommentId,
		parentSubmissionId: row.parentSubmissionId,
		descendantCount: row.descendantCount,
		pinnedBy: row.pinnedBy,
		distinguishLevel: row.distinguishLevel,
		isDeleted: row.stateUserDeletedUtc !== null,
		isRemoved: row.stateMod !== "VISIBLE",
		isFiltered: row.stateMod === "FILTERED",
		isPinned: row.pinnedBy !== null,
		isSaved: row.savedCommentId !== null,
		isModHidden: false,
		userVote: (row.userVoteType as VoteType) ?? 0,
		stateMod: (row.stateMod ?? "VISIBLE") as ModerationState,
		stateModSetBy: row.stateModSetBy,
	};
}

function mapThreadCommentRow(
	row: RawCommentRow,
	viewer: CommentViewerContext,
	includeAsPlaceholder: boolean,
): CommentFlat | null {
	const visibility = getCommentVisibility(
		{
			authorId: row.authorId,
			authorName: row.authorName,
			distinguishLevel: row.distinguishLevel,
			stateMod: row.stateMod,
			stateModSetBy: row.stateModSetBy,
			stateUserDeletedUtc: row.stateUserDeletedUtc,
			authorShadowBanned: row.authorShadowBanned,
			isBlocking: row.isBlocking,
		},
		viewer,
	);

	if (!visibility.isVisible && !includeAsPlaceholder) {
		return null;
	}

	if (!visibility.isVisible) {
		return {
			...mapCommentRow(row),
			authorName: "[deleted]",
			body: visibility.message ?? MOD_HIDDEN_PLACEHOLDER,
			bodyHtml: `<p>${visibility.message ?? MOD_HIDDEN_PLACEHOLDER}</p>`,
			isModHidden: true,
			visibilityMessage: visibility.message,
		};
	}

	return {
		...mapCommentRow(row),
		visibilityMessage: visibility.message,
	};
}

export function filterThreadComments(
	rows: RawCommentRow[],
	viewer: CommentViewerContext,
): CommentFlat[] {
	const childrenByParent = new Map<number | null, RawCommentRow[]>();
	const rowIds = new Set(rows.map((row) => row.id));
	for (const row of rows) {
		const siblings = childrenByParent.get(row.parentCommentId) ?? [];
		siblings.push(row);
		childrenByParent.set(row.parentCommentId, siblings);
	}

	const includedIds = new Set<number>();

	const visit = (row: RawCommentRow): boolean => {
		const visibility = getCommentVisibility(
			{
				authorId: row.authorId,
				authorName: row.authorName,
				distinguishLevel: row.distinguishLevel,
				stateMod: row.stateMod,
				stateModSetBy: row.stateModSetBy,
				stateUserDeletedUtc: row.stateUserDeletedUtc,
				authorShadowBanned: row.authorShadowBanned,
				isBlocking: row.isBlocking,
			},
			viewer,
		);
		const childRows = childrenByParent.get(row.id) ?? [];
		const hasIncludedChild = childRows.some((child) => visit(child));
		const shouldInclude = visibility.isVisible || hasIncludedChild;

		if (shouldInclude) {
			includedIds.add(row.id);
		}

		return shouldInclude;
	};

	for (const rootRow of rows.filter(
		(row) => row.parentCommentId === null || !rowIds.has(row.parentCommentId),
	)) {
		visit(rootRow);
	}

	return rows
		.filter((row) => includedIds.has(row.id))
		.map((row) => mapThreadCommentRow(row, viewer, true))
		.filter((row): row is CommentFlat => row !== null);
}

async function getSubmissionCommentRows(
	submissionId: number,
	userId?: number,
): Promise<RawCommentRow[]> {
	const results = await db
		.select({
			id: comments.id,
			authorId: comments.authorId,
			authorName: users.username,
			authorShadowBanned: users.shadowBanned,
			body: comments.body,
			bodyHtml: comments.bodyHtml,
			createdUtc: comments.createdUtc,
			editedUtc: comments.editedUtc,
			upvotes: comments.upvotes,
			downvotes: comments.downvotes,
			level: comments.level,
			parentCommentId: comments.parentCommentId,
			parentSubmissionId: comments.parentSubmission,
			descendantCount: comments.descendantCount,
			pinnedBy: comments.pinnedBy,
			distinguishLevel: comments.distinguishLevel,
			stateUserDeletedUtc: comments.stateUserDeletedUtc,
			stateMod: comments.stateMod,
			stateModSetBy: comments.stateModSetBy,
			userVoteType: commentVotes.voteType,
			savedCommentId: commentSaveRelationship.commentId,
			blockedTargetId: userBlocks.targetId,
		})
		.from(comments)
		.innerJoin(users, eq(comments.authorId, users.id))
		.leftJoin(
			commentVotes,
			userId
				? and(
						eq(commentVotes.commentId, comments.id),
						eq(commentVotes.userId, userId),
					)
				: sql`false`,
		)
		.leftJoin(
			commentSaveRelationship,
			userId
				? and(
						eq(commentSaveRelationship.commentId, comments.id),
						eq(commentSaveRelationship.userId, userId),
					)
				: sql`false`,
		)
		.leftJoin(
			userBlocks,
			userId
				? and(
						eq(userBlocks.userId, userId),
						eq(userBlocks.targetId, comments.authorId),
					)
				: sql`false`,
		)
		.where(eq(comments.parentSubmission, submissionId))
		.orderBy(desc(comments.createdUtc), asc(comments.id));

	return results.map((row) => ({
		...row,
		isBlocking: row.blockedTargetId !== null,
	}));
}

async function getThreadRowsSince(
	submissionId: number,
	since: number,
	userId?: number,
): Promise<CommentFlat[]> {
	const viewer = await getCommentViewerContext(userId);
	const rows = await getSubmissionCommentRows(submissionId, userId);
	const filteredRows = filterThreadComments(rows, viewer);
	const includedIds = new Set(
		filteredRows
			.filter((row) => row.createdUtc >= since)
			.flatMap((row) =>
				row.parentCommentId === null ? [row.id] : [row.id, row.parentCommentId],
			),
	);

	let changed = true;
	while (changed) {
		changed = false;
		for (const row of filteredRows) {
			if (
				includedIds.has(row.id) &&
				row.parentCommentId !== null &&
				!includedIds.has(row.parentCommentId)
			) {
				includedIds.add(row.parentCommentId);
				changed = true;
			}
		}
	}

	return filteredRows.filter(
		(row) => row.createdUtc >= since || includedIds.has(row.id),
	);
}

async function getRawCommentRowById(
	id: number,
	userId?: number,
): Promise<RawCommentRow | null> {
	const [result] = await db
		.select({
			id: comments.id,
			authorId: comments.authorId,
			authorName: users.username,
			authorShadowBanned: users.shadowBanned,
			body: comments.body,
			bodyHtml: comments.bodyHtml,
			createdUtc: comments.createdUtc,
			editedUtc: comments.editedUtc,
			upvotes: comments.upvotes,
			downvotes: comments.downvotes,
			level: comments.level,
			parentCommentId: comments.parentCommentId,
			parentSubmissionId: comments.parentSubmission,
			descendantCount: comments.descendantCount,
			pinnedBy: comments.pinnedBy,
			distinguishLevel: comments.distinguishLevel,
			stateUserDeletedUtc: comments.stateUserDeletedUtc,
			stateMod: comments.stateMod,
			stateModSetBy: comments.stateModSetBy,
			userVoteType: commentVotes.voteType,
			savedCommentId: commentSaveRelationship.commentId,
			blockedTargetId: userBlocks.targetId,
		})
		.from(comments)
		.innerJoin(users, eq(comments.authorId, users.id))
		.leftJoin(
			commentVotes,
			userId
				? and(
						eq(commentVotes.commentId, comments.id),
						eq(commentVotes.userId, userId),
					)
				: sql`false`,
		)
		.leftJoin(
			commentSaveRelationship,
			userId
				? and(
						eq(commentSaveRelationship.commentId, comments.id),
						eq(commentSaveRelationship.userId, userId),
					)
				: sql`false`,
		)
		.leftJoin(
			userBlocks,
			userId
				? and(
						eq(userBlocks.userId, userId),
						eq(userBlocks.targetId, comments.authorId),
					)
				: sql`false`,
		)
		.where(eq(comments.id, id))
		.limit(1);

	if (!result) {
		return null;
	}

	return {
		...result,
		isBlocking: result.blockedTargetId !== null,
	};
}

async function getRawCommentSubtreeRows(
	id: number,
	userId?: number,
): Promise<RawCommentRow[]> {
	const userIdParam = userId ?? null;
	const result = await db.execute(
		sql`WITH target AS (
			SELECT path FROM comments WHERE id = ${id}
		)
		SELECT
			c.id,
			c.author_id,
			u.username AS author_name,
			u.shadowbanned AS author_shadow_banned,
			c.body,
			c.body_html,
			c.created_utc,
			c.edited_utc,
			c.upvotes,
			c.downvotes,
			c.level,
			c.parent_comment_id,
			c.parent_submission,
			c.descendant_count,
			c.is_pinned,
			c.distinguish_level,
			c.state_user_deleted_utc,
			c.state_mod,
			c.state_mod_set_by,
			cv.vote_type AS user_vote_type,
			csr.comment_id AS saved_comment_id,
			ub.target_id AS blocked_target_id
		FROM comments c
		INNER JOIN target t ON c.path <@ t.path
		INNER JOIN users u ON c.author_id = u.id
		LEFT JOIN commentvotes cv
			ON cv.comment_id = c.id AND cv.user_id = ${userIdParam}
		LEFT JOIN comment_save_relationship csr
			ON csr.comment_id = c.id AND csr.user_id = ${userIdParam}
		LEFT JOIN userblocks ub
			ON ub.user_id = ${userIdParam} AND ub.target_id = c.author_id
		ORDER BY c.level ASC, c.created_utc DESC, c.id DESC`,
	);

	return (result.rows as Array<Record<string, unknown>>).map((row) => ({
		id: row.id as number,
		authorId: row.author_id as number,
		authorName: row.author_name as string,
		authorShadowBanned: row.author_shadow_banned as string | null,
		body: row.body as string | null,
		bodyHtml: row.body_html as string,
		createdUtc: row.created_utc as number,
		editedUtc: row.edited_utc as number,
		upvotes: row.upvotes as number,
		downvotes: row.downvotes as number,
		level: row.level as number,
		parentCommentId: row.parent_comment_id as number | null,
		parentSubmissionId: row.parent_submission as number | null,
		descendantCount: row.descendant_count as number,
		pinnedBy: row.is_pinned as string | null,
		distinguishLevel: row.distinguish_level as number,
		stateUserDeletedUtc: row.state_user_deleted_utc as Date | null,
		stateMod: row.state_mod as string | null,
		stateModSetBy: row.state_mod_set_by as string | null,
		userVoteType: row.user_vote_type as number | null,
		savedCommentId: row.saved_comment_id as number | null,
		isBlocking: row.blocked_target_id !== null,
	}));
}

export async function getCommentsBySubmissionFlat(
	submissionId: number,
	userId?: number,
): Promise<CommentFlat[]> {
	const viewer = await getCommentViewerContext(userId);
	const rows = await getSubmissionCommentRows(submissionId, userId);
	return filterThreadComments(rows, viewer);
}

export async function getCommentsBySubmissionSince(
	submissionId: number,
	since: number,
	userId?: number,
): Promise<CommentFlat[]> {
	return getThreadRowsSince(submissionId, since, userId);
}

export async function getCommentThreadFlat(
	id: number,
	userId?: number,
): Promise<CommentFlat[] | null> {
	const viewer = await getCommentViewerContext(userId);
	const rows = await getRawCommentSubtreeRows(id, userId);
	if (rows.length === 0) return null;

	const filtered = filterThreadComments(rows, viewer);
	if (filtered.some((row) => row.id === id)) {
		return filtered;
	}

	const target = rows.find((row) => row.id === id);
	if (!target) {
		return null;
	}

	const placeholder = mapThreadCommentRow(target, viewer, true);
	if (!placeholder) {
		return null;
	}

	return [placeholder, ...filtered];
}

export async function getCommentById(
	id: number,
	userId?: number,
): Promise<CommentSummary | null> {
	const viewer = await getCommentViewerContext(userId);
	const row = await getRawCommentRowById(id, userId);
	if (!row) return null;

	const mapped = mapThreadCommentRow(row, viewer, true);
	return mapped;
}

export async function getRecentComments(
	limit = 25,
	offset = 0,
): Promise<CommentSummary[]> {
	const results = await db
		.select({
			id: comments.id,
			authorId: comments.authorId,
			authorName: users.username,
			body: comments.body,
			bodyHtml: comments.bodyHtml,
			createdUtc: comments.createdUtc,
			editedUtc: comments.editedUtc,
			upvotes: comments.upvotes,
			downvotes: comments.downvotes,
			level: comments.level,
			parentCommentId: comments.parentCommentId,
			parentSubmissionId: comments.parentSubmission,
			descendantCount: comments.descendantCount,
			pinnedBy: comments.pinnedBy,
			distinguishLevel: comments.distinguishLevel,
			stateUserDeletedUtc: comments.stateUserDeletedUtc,
			stateMod: comments.stateMod,
			savedCommentId: sql<number | null>`null`,
		})
		.from(comments)
		.innerJoin(users, eq(comments.authorId, users.id))
		.where(
			and(
				eq(comments.stateMod, "VISIBLE"),
				isNull(comments.stateUserDeletedUtc),
			),
		)
		.orderBy(desc(comments.createdUtc))
		.limit(limit)
		.offset(offset);

	return results.map((row) => ({
		id: row.id,
		authorId: row.authorId,
		authorName: row.authorName,
		body: row.body,
		bodyHtml: row.bodyHtml,
		createdUtc: row.createdUtc,
		editedUtc: row.editedUtc,
		upvotes: row.upvotes,
		downvotes: row.downvotes,
		score: row.upvotes - row.downvotes,
		level: row.level,
		parentCommentId: row.parentCommentId,
		parentSubmissionId: row.parentSubmissionId,
		descendantCount: row.descendantCount,
		pinnedBy: row.pinnedBy,
		distinguishLevel: row.distinguishLevel,
		isDeleted: false,
		isRemoved: false,
		isPinned: row.pinnedBy !== null,
		isSaved: false,
		isModHidden: false,
		userVote: 0 as VoteType,
	}));
}

export async function getCommentsFeed(
	sort: CommentFeedSortType = "new",
	time: TimeFilter = "all",
	limit = 25,
	offset = 0,
	userId?: number,
): Promise<CommentFeedItem[]> {
	const viewer = await getCommentViewerContext(userId);
	const conditions: SQL[] = [
		eq(comments.stateMod, "VISIBLE"),
		isNull(comments.stateUserDeletedUtc),
		eq(submissions.stateMod, "VISIBLE"),
		isNull(submissions.stateUserDeletedUtc),
		eq(submissions.private, false),
	];

	// Time filter
	if (time !== "all") {
		const now = Math.floor(Date.now() / 1000);
		let cutoff: number;
		switch (time) {
			case "hour":
				cutoff = now - 3600;
				break;
			case "day":
				cutoff = now - 86400;
				break;
			case "week":
				cutoff = now - 604800;
				break;
			case "month":
				cutoff = now - 2592000;
				break;
			case "year":
				cutoff = now - 31536000;
				break;
			default:
				cutoff = 0;
		}
		conditions.push(gte(comments.createdUtc, cutoff));
	}

	let orderBy: SQL[];
	switch (sort) {
		case "top":
			orderBy = [desc(sql`${comments.upvotes} - ${comments.downvotes}`)];
			break;
		case "controversial":
			orderBy = [
				desc(
					sql`CASE WHEN ${comments.upvotes} + ${comments.downvotes} = 0 THEN 0
              ELSE (${comments.upvotes} + ${comments.downvotes}) *
                   (1 - ABS(${comments.upvotes} - ${comments.downvotes})::float /
                   (${comments.upvotes} + ${comments.downvotes})) END`,
				),
			];
			break;
		default:
			orderBy = [desc(comments.createdUtc)];
			break;
	}

	const results = await db
		.select({
			id: comments.id,
			authorId: comments.authorId,
			authorName: users.username,
			authorShadowBanned: users.shadowBanned,
			body: comments.body,
			bodyHtml: comments.bodyHtml,
			createdUtc: comments.createdUtc,
			editedUtc: comments.editedUtc,
			upvotes: comments.upvotes,
			downvotes: comments.downvotes,
			level: comments.level,
			parentSubmissionId: comments.parentSubmission,
			submissionTitle: submissions.title,
			parentSubmissionPrivate: submissions.private,
			parentSubmissionDeletedUtc: submissions.stateUserDeletedUtc,
			parentSubmissionStateMod: submissions.stateMod,
			distinguishLevel: comments.distinguishLevel,
			stateUserDeletedUtc: comments.stateUserDeletedUtc,
			stateMod: comments.stateMod,
			stateModSetBy: comments.stateModSetBy,
			userVoteType: commentVotes.voteType,
			savedCommentId: commentSaveRelationship.commentId,
			blockedTargetId: userBlocks.targetId,
		})
		.from(comments)
		.innerJoin(users, eq(comments.authorId, users.id))
		.innerJoin(submissions, eq(comments.parentSubmission, submissions.id))
		.leftJoin(
			commentVotes,
			userId
				? and(
						eq(commentVotes.commentId, comments.id),
						eq(commentVotes.userId, userId),
					)
				: sql`false`,
		)
		.leftJoin(
			commentSaveRelationship,
			userId
				? and(
						eq(commentSaveRelationship.commentId, comments.id),
						eq(commentSaveRelationship.userId, userId),
					)
				: sql`false`,
		)
		.leftJoin(
			userBlocks,
			userId
				? and(
						eq(userBlocks.userId, userId),
						eq(userBlocks.targetId, comments.authorId),
					)
				: sql`false`,
		)
		.where(and(...conditions))
		.orderBy(...orderBy)
		.limit(limit)
		.offset(offset);

	return results
		.map((row) => ({
			...row,
			isBlocking: row.blockedTargetId !== null,
		}))
		.filter((row) =>
			shouldIncludeCommentInFeed(
				{
					authorId: row.authorId,
					authorName: row.authorName,
					distinguishLevel: row.distinguishLevel,
					stateMod: row.stateMod,
					stateModSetBy: row.stateModSetBy,
					stateUserDeletedUtc: row.stateUserDeletedUtc,
					authorShadowBanned: row.authorShadowBanned,
					isBlocking: row.isBlocking,
					parentSubmissionId: row.parentSubmissionId,
					parentSubmissionPrivate: row.parentSubmissionPrivate,
					parentSubmissionDeletedUtc: row.parentSubmissionDeletedUtc,
					parentSubmissionStateMod: row.parentSubmissionStateMod,
				},
				viewer,
			),
		)
		.map((row) => ({
			id: row.id,
			authorId: row.authorId,
			authorName: row.authorName,
			body: row.body,
			bodyHtml: row.bodyHtml,
			createdUtc: row.createdUtc,
			editedUtc: row.editedUtc,
			upvotes: row.upvotes,
			downvotes: row.downvotes,
			score: row.upvotes - row.downvotes,
			level: row.level,
			parentSubmissionId: row.parentSubmissionId,
			submissionTitle: row.submissionTitle,
			distinguishLevel: row.distinguishLevel,
			isDeleted: false,
			isRemoved: false,
			isSaved: row.savedCommentId !== null,
			userVote: (row.userVoteType as VoteType) ?? 0,
		}));
}

export async function getCommentAncestors(
	id: number,
	userId?: number,
): Promise<CommentSummary[]> {
	const viewer = await getCommentViewerContext(userId);
	const rows = await db.execute(
		sql`SELECT path::text FROM comments WHERE id = ${id}`,
	);
	const row = rows.rows[0] as { path: string } | undefined;
	if (!row?.path) return [];

	const labels = row.path.split(".");
	const ancestorIds = labels.slice(0, -1).map(Number);
	const recentAncestors = ancestorIds.slice(-3);

	if (recentAncestors.length === 0) return [];

	const results = await db
		.select({
			id: comments.id,
			authorId: comments.authorId,
			authorName: users.username,
			authorShadowBanned: users.shadowBanned,
			body: comments.body,
			bodyHtml: comments.bodyHtml,
			createdUtc: comments.createdUtc,
			editedUtc: comments.editedUtc,
			upvotes: comments.upvotes,
			downvotes: comments.downvotes,
			level: comments.level,
			parentCommentId: comments.parentCommentId,
			parentSubmissionId: comments.parentSubmission,
			descendantCount: comments.descendantCount,
			pinnedBy: comments.pinnedBy,
			distinguishLevel: comments.distinguishLevel,
			stateUserDeletedUtc: comments.stateUserDeletedUtc,
			stateMod: comments.stateMod,
			stateModSetBy: comments.stateModSetBy,
			userVoteType: commentVotes.voteType,
			savedCommentId: commentSaveRelationship.commentId,
			blockedTargetId: userBlocks.targetId,
		})
		.from(comments)
		.innerJoin(users, eq(comments.authorId, users.id))
		.leftJoin(
			commentVotes,
			userId
				? and(
						eq(commentVotes.commentId, comments.id),
						eq(commentVotes.userId, userId),
					)
				: sql`false`,
		)
		.leftJoin(
			commentSaveRelationship,
			userId
				? and(
						eq(commentSaveRelationship.commentId, comments.id),
						eq(commentSaveRelationship.userId, userId),
					)
				: sql`false`,
		)
		.leftJoin(
			userBlocks,
			userId
				? and(
						eq(userBlocks.userId, userId),
						eq(userBlocks.targetId, comments.authorId),
					)
				: sql`false`,
		)
		.where(inArray(comments.id, recentAncestors));

	return recentAncestors
		.map((aid) => {
			const r = results.find((c) => c.id === aid);
			if (!r) return null;
			return mapThreadCommentRow(
				{
					...r,
					isBlocking: r.blockedTargetId !== null,
				},
				viewer,
				true,
			);
		})
		.filter((c): c is CommentSummary => c !== null);
}

export async function createComment(data: {
	authorId: number;
	body: string;
	parentSubmissionId: number;
	parentCommentId?: number;
}): Promise<number> {
	const createdUtc = Math.floor(Date.now() / 1000);

	// Determine level based on parent comment
	let level = 1;
	let topCommentId: number | null = null;

	if (data.parentCommentId) {
		const [parentComment] = await db
			.select({ level: comments.level, topCommentId: comments.topCommentId })
			.from(comments)
			.where(eq(comments.id, data.parentCommentId))
			.limit(1);

		if (parentComment) {
			level = parentComment.level + 1;
			topCommentId = parentComment.topCommentId ?? data.parentCommentId;
		}
	}

	const result = await db.transaction(async (tx) => {
		const [createdComment] = await tx
			.insert(comments)
			.values({
				authorId: data.authorId,
				body: data.body,
				bodyHtml: renderCommentMarkdown(data.body),
				parentSubmission: data.parentSubmissionId,
				parentCommentId: data.parentCommentId ?? null,
				level,
				topCommentId,
				createdUtc,
				stateMod: "VISIBLE",
				stateReport: "UNREPORTED",
				volunteerJanitorBadness: 0,
			})
			.returning({ id: comments.id });

		await tx.insert(commentVotes).values({
			userId: data.authorId,
			commentId: createdComment.id,
			voteType: 1,
			createdDatetimez: new Date(),
		});

		await tx.execute(
			sql`UPDATE comments SET path =
				CASE
					WHEN parent_comment_id IS NULL THEN ${createdComment.id.toString()}::ltree
					ELSE (SELECT path FROM comments WHERE id = ${data.parentCommentId ?? null}) || ${createdComment.id.toString()}::ltree
				END
			WHERE id = ${createdComment.id}`,
		);

		if (data.parentCommentId) {
			await tx
				.update(comments)
				.set({
					descendantCount: sql`${comments.descendantCount} + 1`,
				})
				.where(eq(comments.id, data.parentCommentId));
		}

		await tx.execute(
			sql`UPDATE submissions SET comment_count = comment_count + 1 WHERE id = ${data.parentSubmissionId}`,
		);

		await tx
			.update(users)
			.set({ commentCount: sql`${users.commentCount} + 1` })
			.where(eq(users.id, data.authorId));

		await createNotificationsForComment(createdComment.id, tx);

		return createdComment;
	});

	return result.id;
}

export async function updateComment(
	id: number,
	authorId: number,
	body: string,
): Promise<boolean> {
	const editedUtc = Math.floor(Date.now() / 1000);

	const result = await db
		.update(comments)
		.set({
			body,
			bodyHtml: renderCommentMarkdown(body),
			editedUtc,
		})
		.where(and(eq(comments.id, id), eq(comments.authorId, authorId)))
		.returning({ id: comments.id });

	return result.length > 0;
}

export async function deleteComment(
	id: number,
	authorId: number,
): Promise<boolean> {
	return authorDeleteComment(id, authorId);
}

// export async function getCommentContext(
// 	commentId: number,
// ): Promise<{ submissionId: number; submissionTitle: string } | null> {
// 	const [result]  = await db.execute(
// 		sql`SELECT s.id, s.title FROM comments c
//         JOIN submissions s ON c.parent_submission = s.id
//         WHERE c.id = ${commentId}`,
// 	);

// 	if (!result) return null;

// 	const row = result as { id: number; title: string };
// 	return {
// 		submissionId: row.id,
// 		submissionTitle: row.title,
// 	};
// }

export async function getCommentWithReplies(
	id: number,
	userId?: number,
): Promise<CommentWithReplies | null> {
	const flatComments = await getCommentThreadFlat(id, userId);
	if (!flatComments || flatComments.length === 0) return null;

	const commentMap = new Map<number, CommentWithReplies>();
	for (const comment of flatComments) {
		commentMap.set(comment.id, { ...comment, replies: [] });
	}

	for (const comment of commentMap.values()) {
		if (comment.id === id || comment.parentCommentId === null) {
			continue;
		}

		const parent = commentMap.get(comment.parentCommentId);
		if (parent) {
			parent.replies.push(comment);
		}
	}

	const targetComment = commentMap.get(id);
	if (!targetComment) {
		return null;
	}

	const sortReplies = (commentList: CommentWithReplies[]) => {
		for (const comment of commentList) {
			if (comment.replies.length === 0) continue;
			comment.replies.sort((a, b) => b.score - a.score);
			sortReplies(comment.replies);
		}
	};
	sortReplies([targetComment]);

	return targetComment;
}
