import { and, desc, eq, isNull, type SQL, sql } from "drizzle-orm";

import { db } from "@/db";
import {
	bannedDomains,
	saveRelationship,
	submissions,
	subscriptions,
	userBlocks,
	users,
	votes,
} from "@/db/schema";
import { type AwardCount, getSubmissionAwardCounts } from "@/lib/awards.server";
import { deriveModerationVisibility } from "@/lib/comment-visibility.server";
import {
	replaceSlursInHtml,
	replaceSlursInText,
} from "@/lib/content-preferences";
import { parseVoteType } from "@/lib/enums";
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
	awards?: AwardCount[];
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
		viewerOver18?: boolean;
		slurReplacer?: boolean;
	},
) {
	const moderation = deriveModerationVisibility(
		{ stateMod: row.stateMod, stateUserDeletedUtc: row.stateUserDeletedUtc },
		{ canModerate: options?.viewerCanModerate ?? false },
		{
			messages: {
				deleted: DELETED_BY_AUTHOR_MESSAGE,
				removed: REMOVED_BY_MODERATOR_MESSAGE,
				filtered: FILTERED_BY_MODERATOR_MESSAGE,
			},
			hideRemovedFromModerators: true,
			hideDeletedFromModerators: true,
		},
	);
	const isBlockedAuthor = row.blockedTargetId !== null;
	const showBlockedPlaceholder =
		options?.includeBlockedPlaceholder && isBlockedAuthor;
	const visibilityMessage =
		moderation.message ??
		(showBlockedPlaceholder ? `You are blocking @${row.authorName}` : null);
	const blockedTitle = `[blocked post by @${row.authorName}]`;
	const hideNsfw = row.isNsfw && !options?.viewerOver18;
	const title = hideNsfw ? "[NSFW post hidden]" : row.title;
	const titleHtml = hideNsfw ? "[NSFW post hidden]" : row.titleHtml;
	const body = hideNsfw ? "[Enable NSFW posts in settings to view]" : row.body;
	const bodyHtml = hideNsfw
		? "<p>[Enable NSFW posts in settings to view]</p>"
		: row.bodyHtml;

	return {
		...row,
		title: showBlockedPlaceholder
			? blockedTitle
			: options?.slurReplacer
				? replaceSlursInText(title)
				: title,
		titleHtml: showBlockedPlaceholder
			? blockedTitle
			: options?.slurReplacer
				? replaceSlursInHtml(titleHtml)
				: titleHtml,
		url: showBlockedPlaceholder || hideNsfw ? null : row.url,
		body: visibilityMessage ? `[${visibilityMessage.toLowerCase()}]` : body,
		bodyHtml: visibilityMessage
			? `<p>[${visibilityMessage.toLowerCase()}]</p>`
			: bodyHtml && options?.slurReplacer
				? replaceSlursInHtml(bodyHtml)
				: bodyHtml,
		thumbUrl: hideNsfw ? null : row.thumbUrl,
		embedUrl: showBlockedPlaceholder || hideNsfw ? null : row.embedUrl,
		score: row.upvotes - row.downvotes,
		userVote: parseVoteType(row.userVoteType),
		isStickied: row.stickied !== null,
		isDeleted: moderation.isDeleted,
		isRemoved: moderation.isRemoved,
		isFiltered: moderation.isFiltered,
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

export class BannedDomainError extends Error {
	constructor(domain: string, reason: string) {
		super(`Links to ${domain} are not allowed: ${reason}`);
		this.name = "BannedDomainError";
	}
}

async function assertUrlDomainAllowed(url: string | null): Promise<void> {
	if (!url) return;

	let host: string;
	try {
		host = new URL(url).hostname.toLowerCase();
	} catch {
		// Invalid URLs are rejected by input validation, not domain policy.
		return;
	}

	const domains = await db.select().from(bannedDomains);
	const match = domains.find(({ domain }) => {
		const banned = domain.toLowerCase();
		return host === banned || host.endsWith(`.${banned}`);
	});

	if (match) {
		throw new BannedDomainError(match.domain, match.reason);
	}
}

export async function getSubmissions(options: {
	sort?: SortType;
	time?: TimeFilter;
	limit?: number;
	offset?: number;
	authorId?: number;
	pinnedFirst?: boolean;
	userId?: number;
	viewerOver18?: boolean;
	slurReplacer?: boolean;
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

	const visibleRows = results.filter((row) => row.blockedTargetId === null);
	const awardsById = await getSubmissionAwardCounts(
		visibleRows.map((row) => row.id),
	);

	return visibleRows.map((row) => ({
		...mapSubmissionRow(row, {
			viewerOver18: options.viewerOver18,
			slurReplacer: options.slurReplacer,
		}),
		awards: awardsById.get(row.id) ?? [],
	}));
}

export const HOME_FEED_PER_PAGE = 25;

export type SubmissionFeedPage = {
	submissions: SubmissionSummary[];
	page: number;
	hasMore: boolean;
};

export async function getSubmissionsPage(options: {
	sort?: SortType;
	time?: TimeFilter;
	page?: number;
	userId?: number;
	viewerOver18?: boolean;
	slurReplacer?: boolean;
}): Promise<SubmissionFeedPage> {
	const safePage = Math.max(1, Math.floor(options.page ?? 1));

	const rows = await getSubmissions({
		sort: options.sort,
		time: options.time,
		userId: options.userId,
		viewerOver18: options.viewerOver18,
		slurReplacer: options.slurReplacer,
		limit: HOME_FEED_PER_PAGE + 1,
		offset: (safePage - 1) * HOME_FEED_PER_PAGE,
	});

	return {
		submissions: rows.slice(0, HOME_FEED_PER_PAGE),
		page: safePage,
		hasMore: rows.length > HOME_FEED_PER_PAGE,
	};
}

export async function getSubmissionById(
	id: number,
	userId?: number,
	viewerCanModerate = false,
	preferences?: { over18?: boolean; slurReplacer?: boolean },
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

	const awardsById = await getSubmissionAwardCounts([result.id]);
	const mapped = mapSubmissionRow(result, {
		includeBlockedPlaceholder: true,
		viewerCanModerate,
		viewerOver18: preferences?.over18,
		slurReplacer: preferences?.slurReplacer,
	});
	return { ...mapped, awards: awardsById.get(result.id) ?? [] };
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

	await assertUrlDomainAllowed(url);

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

	await assertUrlDomainAllowed(url);

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
