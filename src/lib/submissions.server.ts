import { and, desc, eq, isNull, type SQL, sql } from "drizzle-orm";

import { db } from "@/db";
import {
	saveRelationship,
	submissions,
	subscriptions,
	userBlocks,
	users,
	votes,
} from "@/db/schema";
import {
	authorDeleteSubmission,
	DELETED_BY_AUTHOR_MESSAGE,
	FILTERED_BY_MODERATOR_MESSAGE,
	type ModerationState,
	REMOVED_BY_MODERATOR_MESSAGE,
} from "@/lib/lifecycle.server";
import { renderPostBodyMarkdown, renderPostTitleHtml } from "@/lib/markdown";
import { setSubmissionSubscriptionState } from "@/lib/notifications.server";
import { indexSubmissionBestEffort } from "@/lib/search.server";
import type { VoteType } from "@/lib/votes.server";
import type { SortType, TimeFilter } from "./constants";

export type SubmissionSummary = {
	id: number;
	title: string;
	titleHtml: string;
	createdUtc: number;
	authorId: number;
	authorName: string;
	url: string | null;
	body: string | null;
	bodyHtml: string | null;
	upvotes: number;
	downvotes: number;
	score: number;
	commentCount: number;
	thumbUrl: string | null;
	flair: string | null;
	isPinned: boolean;
	isNsfw: boolean;
	stickied: string | null;
	isStickied: boolean;
	isDeleted: boolean;
	isRemoved: boolean;
	isFiltered: boolean;
	visibilityMessage: string | null;
	isSaved: boolean;
	isBlockedAuthor: boolean;
	userVote: VoteType;
	stateMod: ModerationState;
	stateModSetBy?: string | null;
};

export type SubmissionDetail = SubmissionSummary & {
	embedUrl: string | null;
	editedUtc: number;
	views: number;
	distinguishLevel: number;
	userVote: VoteType;
	isSubscribed: boolean;
	isBlockedAuthor: boolean;
};

type SubmissionRow = {
	id: number;
	title: string;
	titleHtml: string;
	createdUtc: number;
	authorId: number;
	authorName: string;
	url: string | null;
	body: string | null;
	bodyHtml: string | null;
	upvotes: number;
	downvotes: number;
	commentCount: number;
	thumbUrl: string | null;
	flair: string | null;
	isPinned: boolean;
	isNsfw: boolean;
	stickied: string | null;
	embedUrl?: string | null;
	editedUtc?: number;
	views?: number;
	distinguishLevel?: number;
	stateUserDeletedUtc: Date | null;
	stateMod: ModerationState;
	stateModSetBy?: string | null;
	userVoteType: number | null;
	savedSubmissionId: number | null;
	subscribedSubmissionId?: number | null;
	blockedTargetId?: number | null;
};

function mapSubmissionRow<T extends SubmissionRow>(
	row: T,
	options?: {
		includeBlockedPlaceholder?: boolean;
		viewerCanModerate?: boolean;
	},
) {
	const isDeleted = row.stateUserDeletedUtc !== null;
	const isRemoved = row.stateMod === "REMOVED";
	const isFiltered = row.stateMod === "FILTERED";
	const isBlockedAuthor = row.blockedTargetId !== null;
	const isHiddenByModeration =
		isRemoved || (isFiltered && !options?.viewerCanModerate);
	const visibilityMessage = isDeleted
		? DELETED_BY_AUTHOR_MESSAGE
		: isRemoved
			? REMOVED_BY_MODERATOR_MESSAGE
			: isFiltered && !options?.viewerCanModerate
				? FILTERED_BY_MODERATOR_MESSAGE
				: options?.includeBlockedPlaceholder && isBlockedAuthor
					? `You are blocking @${row.authorName}`
					: null;
	const blockedTitle = `[blocked post by @${row.authorName}]`;

	return {
		...row,
		title:
			options?.includeBlockedPlaceholder && isBlockedAuthor
				? blockedTitle
				: row.title,
		titleHtml:
			options?.includeBlockedPlaceholder && isBlockedAuthor
				? blockedTitle
				: row.titleHtml,
		url: options?.includeBlockedPlaceholder && isBlockedAuthor ? null : row.url,
		body: isHiddenByModeration
			? `[${visibilityMessage?.toLowerCase() ?? "hidden"}]`
			: visibilityMessage
				? `[${visibilityMessage.toLowerCase()}]`
				: row.body,
		bodyHtml: isHiddenByModeration
			? `<p>[${visibilityMessage?.toLowerCase() ?? "hidden"}]</p>`
			: visibilityMessage
				? `<p>[${visibilityMessage.toLowerCase()}]</p>`
				: row.bodyHtml,
		embedUrl:
			options?.includeBlockedPlaceholder && isBlockedAuthor
				? null
				: row.embedUrl,
		score: row.upvotes - row.downvotes,
		userVote: (row.userVoteType as VoteType) ?? 0,
		isStickied: row.stickied !== null,
		isDeleted,
		isRemoved,
		isFiltered,
		visibilityMessage,
		isSaved: row.savedSubmissionId !== null,
		isSubscribed: row.subscribedSubmissionId !== null,
		isBlockedAuthor,
		stateMod: row.stateMod,
		stateModSetBy: row.stateModSetBy ?? null,
	};
}

function getTimeFilterSeconds(filter: TimeFilter): number | null {
	const now = Math.floor(Date.now() / 1000);
	switch (filter) {
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
		case "all":
			return null;
	}
}

function normalizeRequiredText(value: string): string {
	return value.trim();
}

function normalizeOptionalText(value?: string | null): string | null {
	if (value === undefined || value === null) {
		return null;
	}

	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

export async function getSubmissions(options: {
	sort?: SortType;
	time?: TimeFilter;
	limit?: number;
	offset?: number;
	authorId?: number;
	pinnedFirst?: boolean;
	userId?: number;
}): Promise<SubmissionSummary[]> {
	const {
		sort = "hot",
		time = "all",
		limit = 25,
		offset = 0,
		authorId,
		pinnedFirst = true,
		userId,
	} = options;

	const timeFilter = getTimeFilterSeconds(time);

	const conditions = [
		eq(submissions.stateMod, "VISIBLE"),
		isNull(submissions.stateUserDeletedUtc),
	];

	if (timeFilter !== null) {
		conditions.push(sql`${submissions.createdUtc} >= ${timeFilter}`);
	}

	if (authorId !== undefined) {
		conditions.push(eq(submissions.authorId, authorId));
	}

	let orderBy: SQL[];
	switch (sort) {
		case "new":
			orderBy = pinnedFirst
				? [desc(submissions.isPinned), desc(submissions.createdUtc)]
				: [desc(submissions.createdUtc)];
			break;
		case "top":
			orderBy = pinnedFirst
				? [
						desc(submissions.isPinned),
						desc(sql`${submissions.upvotes} - ${submissions.downvotes}`),
					]
				: [desc(sql`${submissions.upvotes} - ${submissions.downvotes}`)];
			break;
		case "controversial":
			orderBy = pinnedFirst
				? [
						desc(submissions.isPinned),
						desc(
							sql`CASE WHEN ${submissions.upvotes} + ${submissions.downvotes} = 0 THEN 0
                  ELSE (${submissions.upvotes} + ${submissions.downvotes}) *
                       (1 - ABS(${submissions.upvotes} - ${submissions.downvotes})::float /
                       (${submissions.upvotes} + ${submissions.downvotes})) END`,
						),
					]
				: [
						desc(
							sql`CASE WHEN ${submissions.upvotes} + ${submissions.downvotes} = 0 THEN 0
                  ELSE (${submissions.upvotes} + ${submissions.downvotes}) *
                       (1 - ABS(${submissions.upvotes} - ${submissions.downvotes})::float /
                       (${submissions.upvotes} + ${submissions.downvotes})) END`,
						),
					];
			break;
		case "comments":
			orderBy = pinnedFirst
				? [desc(submissions.isPinned), desc(submissions.commentCount)]
				: [desc(submissions.commentCount)];
			break;
		default:
			// Hot algorithm: score / (age_hours + 2)^1.8
			orderBy = pinnedFirst
				? [
						desc(submissions.isPinned),
						desc(
							sql`(${submissions.upvotes} - ${submissions.downvotes}) /
                  POWER(((EXTRACT(EPOCH FROM NOW()) - ${submissions.createdUtc}) / 3600) + 2, 1.8)`,
						),
					]
				: [
						desc(
							sql`(${submissions.upvotes} - ${submissions.downvotes}) /
                  POWER(((EXTRACT(EPOCH FROM NOW()) - ${submissions.createdUtc}) / 3600) + 2, 1.8)`,
						),
					];
			break;
	}

	const results = await db
		.select({
			id: submissions.id,
			title: submissions.title,
			titleHtml: submissions.titleHtml,
			createdUtc: submissions.createdUtc,
			authorId: submissions.authorId,
			authorName: users.username,
			url: submissions.url,
			body: submissions.body,
			bodyHtml: submissions.bodyHtml,
			upvotes: submissions.upvotes,
			downvotes: submissions.downvotes,
			commentCount: submissions.commentCount,
			thumbUrl: submissions.thumbUrl,
			flair: submissions.flair,
			isPinned: submissions.isPinned,
			isNsfw: submissions.over18,
			stickied: submissions.stickied,
			userVoteType: votes.voteType,
			stateUserDeletedUtc: submissions.stateUserDeletedUtc,
			stateMod: submissions.stateMod,
			stateModSetBy: submissions.stateModSetBy,
			savedSubmissionId: saveRelationship.submissionId,
			blockedTargetId: userBlocks.targetId,
		})
		.from(submissions)
		.innerJoin(users, eq(submissions.authorId, users.id))
		.leftJoin(
			votes,
			userId
				? and(eq(votes.submissionId, submissions.id), eq(votes.userId, userId))
				: sql`false`,
		)
		.leftJoin(
			saveRelationship,
			userId
				? and(
						eq(saveRelationship.submissionId, submissions.id),
						eq(saveRelationship.userId, userId),
					)
				: sql`false`,
		)
		.leftJoin(
			userBlocks,
			userId
				? and(
						eq(userBlocks.userId, userId),
						eq(userBlocks.targetId, submissions.authorId),
					)
				: sql`false`,
		)
		.where(and(...conditions))
		.orderBy(...orderBy)
		.limit(limit)
		.offset(offset);

	return results
		.filter((row) => row.blockedTargetId === null)
		.map((row) => mapSubmissionRow(row));
}

export async function getSubmissionById(
	id: number,
	userId?: number,
	viewerCanModerate = false,
): Promise<SubmissionDetail | null> {
	const [result] = await db
		.select({
			id: submissions.id,
			title: submissions.title,
			titleHtml: submissions.titleHtml,
			createdUtc: submissions.createdUtc,
			authorId: submissions.authorId,
			authorName: users.username,
			url: submissions.url,
			body: submissions.body,
			bodyHtml: submissions.bodyHtml,
			upvotes: submissions.upvotes,
			downvotes: submissions.downvotes,
			commentCount: submissions.commentCount,
			thumbUrl: submissions.thumbUrl,
			flair: submissions.flair,
			isPinned: submissions.isPinned,
			isNsfw: submissions.over18,
			stickied: submissions.stickied,
			embedUrl: submissions.embedUrl,
			editedUtc: submissions.editedUtc,
			views: submissions.views,
			distinguishLevel: submissions.distinguishLevel,
			stateUserDeletedUtc: submissions.stateUserDeletedUtc,
			stateMod: submissions.stateMod,
			stateModSetBy: submissions.stateModSetBy,
			userVoteType: votes.voteType,
			savedSubmissionId: saveRelationship.submissionId,
			subscribedSubmissionId: subscriptions.submissionId,
			blockedTargetId: userBlocks.targetId,
		})
		.from(submissions)
		.innerJoin(users, eq(submissions.authorId, users.id))
		.leftJoin(
			votes,
			userId
				? and(eq(votes.submissionId, submissions.id), eq(votes.userId, userId))
				: sql`false`,
		)
		.leftJoin(
			saveRelationship,
			userId
				? and(
						eq(saveRelationship.submissionId, submissions.id),
						eq(saveRelationship.userId, userId),
					)
				: sql`false`,
		)
		.leftJoin(
			subscriptions,
			userId
				? and(
						eq(subscriptions.submissionId, submissions.id),
						eq(subscriptions.userId, userId),
					)
				: sql`false`,
		)
		.leftJoin(
			userBlocks,
			userId
				? and(
						eq(userBlocks.userId, userId),
						eq(userBlocks.targetId, submissions.authorId),
					)
				: sql`false`,
		)
		.where(eq(submissions.id, id))
		.limit(1);

	if (!result) return null;

	const mapped = mapSubmissionRow(result, {
		includeBlockedPlaceholder: true,
		viewerCanModerate,
	});
	return mapped;
}

export async function incrementViews(id: number): Promise<void> {
	await db
		.update(submissions)
		.set({ views: sql`${submissions.views} + 1` })
		.where(eq(submissions.id, id));
}

export async function createSubmission(data: {
	authorId: number;
	title: string;
	url?: string;
	body?: string;
	isNsfw?: boolean;
}): Promise<number> {
	const createdUtc = Math.floor(Date.now() / 1000);
	const title = normalizeRequiredText(data.title);
	const url = normalizeOptionalText(data.url);
	const body = normalizeOptionalText(data.body);

	const result = await db.transaction(async (tx) => {
		const [createdSubmission] = await tx
			.insert(submissions)
			.values({
				authorId: data.authorId,
				title,
				titleHtml: renderPostTitleHtml(title),
				url,
				body,
				bodyHtml: body ? renderPostBodyMarkdown(body) : null,
				createdUtc,
				over18: data.isNsfw ?? false,
				stateMod: "VISIBLE",
				stateReport: "UNREPORTED",
			})
			.returning({ id: submissions.id });

		await tx.insert(votes).values({
			userId: data.authorId,
			submissionId: createdSubmission.id,
			voteType: 1,
			createdDatetimez: new Date(),
		});

		await setSubmissionSubscriptionState({
			userId: data.authorId,
			submissionId: createdSubmission.id,
			subscribed: true,
			tx,
		});

		await tx
			.update(users)
			.set({ postCount: sql`${users.postCount} + 1` })
			.where(eq(users.id, data.authorId));

		return createdSubmission;
	});

	void indexSubmissionBestEffort(result.id);
	return result.id;
}

export async function updateSubmission(
	id: number,
	authorId: number,
	data: {
		title: string;
		url?: string | null;
		body?: string;
		isNsfw?: boolean;
	},
): Promise<boolean> {
	const editedUtc = Math.floor(Date.now() / 1000);
	const title = normalizeRequiredText(data.title);
	const url = normalizeOptionalText(data.url);
	const body = normalizeOptionalText(data.body);

	const result = await db
		.update(submissions)
		.set({
			title,
			titleHtml: renderPostTitleHtml(title),
			url,
			body,
			bodyHtml: body ? renderPostBodyMarkdown(body) : null,
			over18: data.isNsfw,
			editedUtc,
		})
		.where(and(eq(submissions.id, id), eq(submissions.authorId, authorId)))
		.returning({ id: submissions.id });

	if (result.length > 0) {
		void indexSubmissionBestEffort(id);
	}

	return result.length > 0;
}

export async function deleteSubmission(
	id: number,
	authorId: number,
): Promise<boolean> {
	return authorDeleteSubmission(id, authorId);
}

export async function getRandomSubmissionId(): Promise<number | null> {
	const [result] = await db
		.select({ id: submissions.id })
		.from(submissions)
		.where(
			and(
				eq(submissions.stateMod, "VISIBLE"),
				isNull(submissions.stateUserDeletedUtc),
			),
		)
		.orderBy(sql`RANDOM()`)
		.limit(1);

	return result?.id ?? null;
}

// Legacy function for backwards compatibility
export async function getRecentSubmissions(
	limit = 25,
): Promise<SubmissionSummary[]> {
	return getSubmissions({ sort: "new", limit });
}
