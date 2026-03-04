import { and, desc, eq, gte, type SQL, sql } from "drizzle-orm";

import { db } from "@/db";
import {
	comments,
	commentVotes,
	follows,
	submissions,
	users,
} from "@/db/schema";
import type {
	CommentFeedSortType,
	SortType,
	TimeFilter,
} from "@/lib/constants";
import type { SafeUser } from "./auth.server";

const PAGE_SIZE = 25;

export type ProfileTab = "comments" | "posts";

export type ProfileCommentItem = {
	id: number;
	parentSubmissionId: number;
	submissionTitle: string;
	bodyHtml: string;
	createdUtc: number;
	upvotes: number;
	downvotes: number;
	score: number;
	userVote: number;
};

export type ProfilePostItem = {
	id: number;
	title: string;
	titleHtml: string;
	bodyHtml: string | null;
	url: string | null;
	createdUtc: number;
	upvotes: number;
	downvotes: number;
	score: number;
	commentCount: number;
};

export type ProfilePageData = {
	profileUser: typeof users.$inferSelect;
	viewer: SafeUser | null;
	followingCount: number;
	tab: ProfileTab;
	sort: SortType | CommentFeedSortType;
	t: TimeFilter;
	page: number;
	isOwner: boolean;
	isPrivateRestricted: boolean;
	comments: ProfileCommentItem[];
	posts: ProfilePostItem[];
	hasNextPage: boolean;
};

function getTimeCutoff(time: TimeFilter): number | null {
	if (time === "all") return null;

	const now = Math.floor(Date.now() / 1000);
	switch (time) {
		case "hour":
			return now - 3600;
		case "day":
			return now - 86400;
		case "week":
			return now - 604800;
		case "month":
			return now - 2592000;
		case "year":
			return now - 31536000;
		default:
			return null;
	}
}

export async function getUserByUsernameCanonical(
	username: string,
): Promise<typeof users.$inferSelect | null> {
	const normalized = username.trim().toLowerCase();
	const [user] = await db
		.select()
		.from(users)
		.where(sql`lower(${users.username}) = ${normalized}`)
		.limit(1);

	return user ?? null;
}

async function getFollowingCount(userId: number): Promise<number> {
	const [result] = await db
		.select({
			count: sql<number>`count(*)::int`,
		})
		.from(follows)
		.where(eq(follows.userId, userId));

	return result?.count ?? 0;
}

function buildPostOrderBy(sort: SortType): SQL[] {
	switch (sort) {
		case "new":
			return [desc(submissions.createdUtc)];
		case "top":
			return [desc(sql`${submissions.upvotes} - ${submissions.downvotes}`)];
		case "controversial":
			return [
				desc(
					sql`CASE WHEN ${submissions.upvotes} + ${submissions.downvotes} = 0 THEN 0
					ELSE (${submissions.upvotes} + ${submissions.downvotes}) *
					(1 - ABS(${submissions.upvotes} - ${submissions.downvotes})::float /
					(${submissions.upvotes} + ${submissions.downvotes})) END`,
				),
			];
		case "comments":
			return [desc(submissions.commentCount)];
		default:
			return [
				desc(
					sql`(${submissions.upvotes} - ${submissions.downvotes}) /
					POWER(((EXTRACT(EPOCH FROM NOW()) - ${submissions.createdUtc}) / 3600) + 2, 1.8)`,
				),
			];
	}
}

function buildCommentOrderBy(sort: CommentFeedSortType): SQL[] {
	switch (sort) {
		case "top":
			return [desc(sql`${comments.upvotes} - ${comments.downvotes}`)];
		case "controversial":
			return [
				desc(
					sql`CASE WHEN ${comments.upvotes} + ${comments.downvotes} = 0 THEN 0
					ELSE (${comments.upvotes} + ${comments.downvotes}) *
					(1 - ABS(${comments.upvotes} - ${comments.downvotes})::float /
					(${comments.upvotes} + ${comments.downvotes})) END`,
				),
			];
		default:
			return [desc(comments.createdUtc)];
	}
}

async function getProfilePosts(options: {
	authorId: number;
	sort: SortType;
	t: TimeFilter;
	page: number;
}): Promise<{ rows: ProfilePostItem[]; hasNextPage: boolean }> {
	const limit = PAGE_SIZE;
	const offset = (options.page - 1) * limit;
	const timeCutoff = getTimeCutoff(options.t);

	const conditions: SQL[] = [
		eq(submissions.authorId, options.authorId),
		eq(submissions.stateMod, "VISIBLE"),
	];
	if (timeCutoff !== null) {
		conditions.push(gte(submissions.createdUtc, timeCutoff));
	}

	const results = await db
		.select({
			id: submissions.id,
			title: submissions.title,
			titleHtml: submissions.titleHtml,
			bodyHtml: submissions.bodyHtml,
			url: submissions.url,
			createdUtc: submissions.createdUtc,
			upvotes: submissions.upvotes,
			downvotes: submissions.downvotes,
			commentCount: submissions.commentCount,
		})
		.from(submissions)
		.where(and(...conditions))
		.orderBy(...buildPostOrderBy(options.sort))
		.limit(limit + 1)
		.offset(offset);

	const rows = results.slice(0, limit).map((row) => ({
		...row,
		score: row.upvotes - row.downvotes,
	}));

	return { rows, hasNextPage: results.length > limit };
}

async function getProfileComments(options: {
	authorId: number;
	sort: CommentFeedSortType;
	t: TimeFilter;
	page: number;
	viewerId?: number;
}): Promise<{ rows: ProfileCommentItem[]; hasNextPage: boolean }> {
	const limit = PAGE_SIZE;
	const offset = (options.page - 1) * limit;
	const timeCutoff = getTimeCutoff(options.t);

	const conditions: SQL[] = [
		eq(comments.authorId, options.authorId),
		eq(comments.stateMod, "VISIBLE"),
	];
	if (timeCutoff !== null) {
		conditions.push(gte(comments.createdUtc, timeCutoff));
	}

	const results = await db
		.select({
			id: comments.id,
			parentSubmissionId: comments.parentSubmission,
			submissionTitle: submissions.title,
			bodyHtml: comments.bodyHtml,
			createdUtc: comments.createdUtc,
			upvotes: comments.upvotes,
			downvotes: comments.downvotes,
			userVoteType: commentVotes.voteType,
		})
		.from(comments)
		.innerJoin(submissions, eq(comments.parentSubmission, submissions.id))
		.leftJoin(
			commentVotes,
			options.viewerId
				? and(
						eq(commentVotes.commentId, comments.id),
						eq(commentVotes.userId, options.viewerId),
					)
				: sql`false`,
		)
		.where(and(...conditions))
		.orderBy(...buildCommentOrderBy(options.sort))
		.limit(limit + 1)
		.offset(offset);

	const rows = results
		.slice(0, limit)
		.filter((row) => row.parentSubmissionId !== null)
		.map((row) => ({
			id: row.id,
			parentSubmissionId: row.parentSubmissionId as number,
			submissionTitle: row.submissionTitle,
			bodyHtml: row.bodyHtml,
			createdUtc: row.createdUtc,
			upvotes: row.upvotes,
			downvotes: row.downvotes,
			score: row.upvotes - row.downvotes,
			userVote: row.userVoteType ?? 0,
		}));

	return { rows, hasNextPage: results.length > limit };
}

export async function getProfilePageData(options: {
	username: string;
	tab: ProfileTab;
	sort: SortType | CommentFeedSortType;
	t: TimeFilter;
	page: number;
	viewer: SafeUser | null;
}): Promise<ProfilePageData | null> {
	const profileUser = await getUserByUsernameCanonical(options.username);
	if (!profileUser) return null;

	const isOwner = options.viewer?.id === profileUser.id;
	const isAdmin = (options.viewer?.adminLevel ?? 0) > 0;
	const isPrivateRestricted = profileUser.isPrivate && !isOwner && !isAdmin;
	const followingCount = await getFollowingCount(profileUser.id);

	let comments: ProfileCommentItem[] = [];
	let posts: ProfilePostItem[] = [];
	let hasNextPage = false;

	if (!isPrivateRestricted) {
		if (options.tab === "posts") {
			const result = await getProfilePosts({
				authorId: profileUser.id,
				sort: options.sort as SortType,
				t: options.t,
				page: options.page,
			});
			posts = result.rows;
			hasNextPage = result.hasNextPage;
		} else {
			const result = await getProfileComments({
				authorId: profileUser.id,
				sort: options.sort as CommentFeedSortType,
				t: options.t,
				page: options.page,
				viewerId: options.viewer?.id,
			});
			comments = result.rows;
			hasNextPage = result.hasNextPage;
		}
	}

	return {
		profileUser,
		viewer: options.viewer,
		followingCount,
		tab: options.tab,
		sort: options.sort,
		t: options.t,
		page: options.page,
		isOwner,
		isPrivateRestricted,
		comments,
		posts,
		hasNextPage,
	};
}
