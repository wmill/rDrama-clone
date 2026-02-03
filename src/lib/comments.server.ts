import { and, asc, desc, eq, gte, sql, type SQL } from "drizzle-orm";

import { db } from "@/db";
import { comments, submissions, users } from "@/db/schema";

export type CommentFeedItem = {
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
	parentSubmissionId: number | null;
	submissionTitle: string;
	distinguishLevel: number;
	isDeleted: boolean;
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
	isPinned: string | null;
	distinguishLevel: number;
	isDeleted: boolean;
};

export type CommentWithReplies = CommentSummary & {
	replies: CommentWithReplies[];
};

export type CommentSortType = "top" | "new" | "old" | "controversial";

export async function getCommentsBySubmission(
	submissionId: number,
	sort: CommentSortType = "top",
): Promise<CommentWithReplies[]> {
	let orderBy: SQL[];
	switch (sort) {
		case "new":
			orderBy = [desc(comments.createdUtc)];
			break;
		case "old":
			orderBy = [asc(comments.createdUtc)];
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
			orderBy = [desc(sql`${comments.upvotes} - ${comments.downvotes}`)];
			break;
	}

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
			isPinned: comments.isPinned,
			distinguishLevel: comments.distinguishLevel,
			stateUserDeletedUtc: comments.stateUserDeletedUtc,
			stateMod: comments.stateMod,
		})
		.from(comments)
		.innerJoin(users, eq(comments.authorId, users.id))
		.where(
			and(
				eq(comments.parentSubmission, submissionId),
				eq(comments.stateMod, "VISIBLE"),
			),
		)
		.orderBy(...orderBy);

	const commentMap = new Map<number, CommentWithReplies>();
	const rootComments: CommentWithReplies[] = [];

	// First pass: create all comment objects
	for (const row of results) {
		const comment: CommentWithReplies = {
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
			isPinned: row.isPinned,
			distinguishLevel: row.distinguishLevel,
			isDeleted: row.stateUserDeletedUtc !== null,
			replies: [],
		};
		commentMap.set(row.id, comment);
	}

	// Second pass: build tree structure
	for (const comment of commentMap.values()) {
		if (comment.parentCommentId === null) {
			rootComments.push(comment);
		} else {
			const parent = commentMap.get(comment.parentCommentId);
			if (parent) {
				parent.replies.push(comment);
			} else {
				// Orphan comment (parent was deleted/hidden), treat as root
				rootComments.push(comment);
			}
		}
	}

	// Sort replies within each level
	const sortReplies = (commentList: CommentWithReplies[]) => {
		for (const comment of commentList) {
			if (comment.replies.length > 0) {
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
		}
	};

	sortReplies(rootComments);

	return rootComments;
}

export async function getCommentById(
	id: number,
): Promise<CommentSummary | null> {
	const [result] = await db
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
			isPinned: comments.isPinned,
			distinguishLevel: comments.distinguishLevel,
			stateUserDeletedUtc: comments.stateUserDeletedUtc,
		})
		.from(comments)
		.innerJoin(users, eq(comments.authorId, users.id))
		.where(eq(comments.id, id))
		.limit(1);

	if (!result) return null;

	return {
		id: result.id,
		authorId: result.authorId,
		authorName: result.authorName,
		body: result.body,
		bodyHtml: result.bodyHtml,
		createdUtc: result.createdUtc,
		editedUtc: result.editedUtc,
		upvotes: result.upvotes,
		downvotes: result.downvotes,
		score: result.upvotes - result.downvotes,
		level: result.level,
		parentCommentId: result.parentCommentId,
		parentSubmissionId: result.parentSubmissionId,
		descendantCount: result.descendantCount,
		isPinned: result.isPinned,
		distinguishLevel: result.distinguishLevel,
		isDeleted: result.stateUserDeletedUtc !== null,
	};
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
			isPinned: comments.isPinned,
			distinguishLevel: comments.distinguishLevel,
			stateUserDeletedUtc: comments.stateUserDeletedUtc,
		})
		.from(comments)
		.innerJoin(users, eq(comments.authorId, users.id))
		.where(eq(comments.stateMod, "VISIBLE"))
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
		isPinned: row.isPinned,
		distinguishLevel: row.distinguishLevel,
		isDeleted: row.stateUserDeletedUtc !== null,
	}));
}

export type CommentFeedSortType = "new" | "top" | "controversial";
export type TimeFilter = "hour" | "day" | "week" | "month" | "year" | "all";

export async function getCommentsFeed(
	sort: CommentFeedSortType = "new",
	time: TimeFilter = "all",
	limit = 25,
	offset = 0,
): Promise<CommentFeedItem[]> {
	const conditions: SQL[] = [
		eq(comments.stateMod, "VISIBLE"),
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
			body: comments.body,
			bodyHtml: comments.bodyHtml,
			createdUtc: comments.createdUtc,
			editedUtc: comments.editedUtc,
			upvotes: comments.upvotes,
			downvotes: comments.downvotes,
			level: comments.level,
			parentSubmissionId: comments.parentSubmission,
			submissionTitle: submissions.title,
			distinguishLevel: comments.distinguishLevel,
			stateUserDeletedUtc: comments.stateUserDeletedUtc,
		})
		.from(comments)
		.innerJoin(users, eq(comments.authorId, users.id))
		.innerJoin(submissions, eq(comments.parentSubmission, submissions.id))
		.where(and(...conditions))
		.orderBy(...orderBy)
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
		parentSubmissionId: row.parentSubmissionId,
		submissionTitle: row.submissionTitle,
		distinguishLevel: row.distinguishLevel,
		isDeleted: row.stateUserDeletedUtc !== null,
	}));
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

	const [result] = await db
		.insert(comments)
		.values({
			authorId: data.authorId,
			body: data.body,
			bodyHtml: data.body, // TODO: Implement markdown parsing
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

	// Update parent comment's descendant count
	if (data.parentCommentId) {
		await db
			.update(comments)
			.set({
				descendantCount: sql`${comments.descendantCount} + 1`,
			})
			.where(eq(comments.id, data.parentCommentId));
	}

	// Update submission comment count
	await db.execute(
		sql`UPDATE submissions SET comment_count = comment_count + 1 WHERE id = ${data.parentSubmissionId}`,
	);

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
			bodyHtml: body, // TODO: Implement markdown parsing
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
	const result = await db
		.update(comments)
		.set({
			stateUserDeletedUtc: new Date(),
			body: "[deleted]",
			bodyHtml: "[deleted]",
		})
		.where(and(eq(comments.id, id), eq(comments.authorId, authorId)))
		.returning({ id: comments.id });

	return result.length > 0;
}

export async function getCommentContext(
	commentId: number,
): Promise<{ submissionId: number; submissionTitle: string } | null> {
	const [result] = await db.execute(
		sql`SELECT s.id, s.title FROM comments c
        JOIN submissions s ON c.parent_submission = s.id
        WHERE c.id = ${commentId}`,
	);

	if (!result) return null;

	const row = result as { id: number; title: string };
	return {
		submissionId: row.id,
		submissionTitle: row.title,
	};
}

export async function getCommentWithReplies(
	id: number,
): Promise<CommentWithReplies | null> {
	// Get the target comment
	const targetComment = await getCommentById(id);
	if (!targetComment) return null;

	// Recursive query to get all descendants
	const result = await db.execute(
		sql`WITH RECURSIVE descendants AS (
			SELECT id, author_id, body, body_html, created_utc, edited_utc,
				   upvotes, downvotes, level, parent_comment_id, parent_submission,
				   descendant_count, is_pinned, distinguish_level, state_user_deleted_utc
			FROM comments
			WHERE parent_comment_id = ${id} AND state_mod = 'VISIBLE'
			UNION ALL
			SELECT c.id, c.author_id, c.body, c.body_html, c.created_utc, c.edited_utc,
				   c.upvotes, c.downvotes, c.level, c.parent_comment_id, c.parent_submission,
				   c.descendant_count, c.is_pinned, c.distinguish_level, c.state_user_deleted_utc
			FROM comments c
			INNER JOIN descendants d ON c.parent_comment_id = d.id
			WHERE c.state_mod = 'VISIBLE'
		)
		SELECT d.*, u.username as author_name
		FROM descendants d
		INNER JOIN users u ON d.author_id = u.id
		ORDER BY d.upvotes - d.downvotes DESC`,
	);
	const allDescendants = result.rows;

	const commentMap = new Map<number, CommentWithReplies>();

	// Add target comment
	const targetWithReplies: CommentWithReplies = {
		...targetComment,
		replies: [],
	};
	commentMap.set(id, targetWithReplies);

	// Add all descendants
	for (const row of allDescendants as Array<{
		id: number;
		author_id: number;
		author_name: string;
		body: string | null;
		body_html: string;
		created_utc: number;
		edited_utc: number;
		upvotes: number;
		downvotes: number;
		level: number;
		parent_comment_id: number | null;
		parent_submission: number | null;
		descendant_count: number;
		is_pinned: string | null;
		distinguish_level: number;
		state_user_deleted_utc: Date | null;
	}>) {
		const comment: CommentWithReplies = {
			id: row.id,
			authorId: row.author_id,
			authorName: row.author_name,
			body: row.body,
			bodyHtml: row.body_html,
			createdUtc: row.created_utc,
			editedUtc: row.edited_utc,
			upvotes: row.upvotes,
			downvotes: row.downvotes,
			score: row.upvotes - row.downvotes,
			level: row.level,
			parentCommentId: row.parent_comment_id,
			parentSubmissionId: row.parent_submission,
			descendantCount: row.descendant_count,
			isPinned: row.is_pinned,
			distinguishLevel: row.distinguish_level,
			isDeleted: row.state_user_deleted_utc !== null,
			replies: [],
		};
		commentMap.set(row.id, comment);
	}

	// Build tree structure
	for (const comment of commentMap.values()) {
		if (comment.id === id) continue;
		if (comment.parentCommentId === null) continue;
		const parent = commentMap.get(comment.parentCommentId);
		if (parent) {
			parent.replies.push(comment);
		}
	}

	// Sort replies by score
	const sortReplies = (commentList: CommentWithReplies[]) => {
		for (const comment of commentList) {
			if (comment.replies.length > 0) {
				comment.replies.sort((a, b) => b.score - a.score);
				sortReplies(comment.replies);
			}
		}
	};
	sortReplies([targetWithReplies]);

	return targetWithReplies;
}
