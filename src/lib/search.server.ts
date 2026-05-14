import "@/lib/env.server";

import { Client } from "@elastic/elasticsearch";
import { and, asc, eq, gt, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import {
	commentSaveRelationship,
	comments,
	commentVotes,
	saveRelationship,
	submissions,
	userBlocks,
	users,
	votes,
} from "@/db/schema";
import {
	getCommentViewerContext,
	shouldIncludeCommentInFeed,
} from "@/lib/comment-visibility.server";
import type { CommentFeedItem } from "@/lib/comments.server";
import type { PublicSearchResults, SearchResultType } from "@/lib/search";
import type { SubmissionSummary } from "@/lib/submissions.server";
import type { VoteType } from "@/lib/votes.server";

export const CONTENT_SEARCH_INDEX = "public-content";
export const PUBLIC_SEARCH_PAGE_SIZE = 25;
const SEARCH_BATCH_SIZE = 100;
const REINDEX_BATCH_SIZE = 250;

export type SearchDocumentType = "submission" | "comment";

type SearchSubmissionDocument = {
	id: number;
	documentType: "submission";
	authorId: number;
	authorUsername: string;
	title: string;
	url: string | null;
	body: string | null;
	createdUtc: number;
	updatedUtc: number;
};

type SearchCommentDocument = {
	id: number;
	documentType: "comment";
	authorId: number;
	authorUsername: string;
	body: string | null;
	parentSubmissionId: number | null;
	createdUtc: number;
	updatedUtc: number;
};

type SubmissionSearchRow = {
	id: number;
	title: string;
	titleHtml: string;
	createdUtc: number;
	authorId: number;
	authorName: string;
	authorShadowBanned: string | null;
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
	stateUserDeletedUtc: Date | null;
	stateMod: string;
	userVoteType: number | null;
	savedSubmissionId: number | null;
	blockedTargetId: number | null;
	isPrivate: boolean;
};

type CommentSearchRow = {
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
	parentSubmissionId: number | null;
	submissionTitle: string;
	distinguishLevel: number;
	stateUserDeletedUtc: Date | null;
	stateMod: string;
	stateModSetBy: string | null;
	userVoteType: number | null;
	savedCommentId: number | null;
	blockedTargetId: number | null;
	parentSubmissionPrivate: boolean;
	parentSubmissionDeletedUtc: Date | null;
	parentSubmissionStateMod: string;
};

type SubmissionSearchViewerContext = {
	viewerId: number | null;
	canSeeShadowbanned: boolean;
};

let searchClient: Client | null | undefined;
let ensureIndexPromise: Promise<void> | null = null;

function getSearchClient(): Client | null {
	if (searchClient !== undefined) {
		return searchClient;
	}

	const node = process.env.ELASTICSEARCH_URL?.trim();
	searchClient = node ? new Client({ node }) : null;
	return searchClient;
}

function getSearchDocumentId(
	document: SearchSubmissionDocument | SearchCommentDocument,
) {
	return `${document.documentType}:${document.id}`;
}

export function buildContentSearchQuery(input: {
	query: string;
	documentType: SearchDocumentType;
	from: number;
	size: number;
}) {
	const fields =
		input.documentType === "submission"
			? ["title^5", "body^2", "url^2", "authorUsername^3"]
			: ["body^3", "authorUsername^3"];

	return {
		track_total_hits: false,
		from: input.from,
		size: input.size,
		_source: false,
		query: {
			bool: {
				filter: [{ term: { documentType: input.documentType } }],
				must: [
					{
						simple_query_string: {
							query: input.query,
							fields,
							default_operator: "and",
						},
					},
				],
			},
		},
	};
}

export async function ensureContentSearchIndex(): Promise<boolean> {
	const client = getSearchClient();
	if (!client) {
		return false;
	}

	if (!ensureIndexPromise) {
		ensureIndexPromise = (async () => {
			const existsResponse = await client.indices.exists({
				index: CONTENT_SEARCH_INDEX,
			});
			const exists =
				typeof existsResponse.body === "boolean"
					? existsResponse.body
					: Boolean(existsResponse.body);
			if (exists) {
				return;
			}

			await client.indices.create({
				index: CONTENT_SEARCH_INDEX,
				body: {
					mappings: {
						properties: {
							id: { type: "integer" },
							documentType: { type: "keyword" },
							authorId: { type: "integer" },
							authorUsername: {
								type: "text",
								fields: {
									keyword: { type: "keyword", ignore_above: 256 },
								},
							},
							title: { type: "text" },
							url: { type: "text" },
							body: { type: "text" },
							parentSubmissionId: { type: "integer" },
							createdUtc: { type: "date", format: "epoch_second" },
							updatedUtc: { type: "date", format: "epoch_second" },
						},
					},
				},
			});
		})().finally(() => {
			ensureIndexPromise = null;
		});
	}

	await ensureIndexPromise;
	return true;
}

async function getSubmissionSearchViewerContext(
	userId?: number,
): Promise<SubmissionSearchViewerContext> {
	if (!userId) {
		return {
			viewerId: null,
			canSeeShadowbanned: false,
		};
	}

	const [viewer] = await db
		.select({
			id: users.id,
			adminLevel: users.adminLevel,
			shadowBanned: users.shadowBanned,
		})
		.from(users)
		.where(eq(users.id, userId))
		.limit(1);

	if (!viewer) {
		return {
			viewerId: null,
			canSeeShadowbanned: false,
		};
	}

	return {
		viewerId: viewer.id,
		canSeeShadowbanned: viewer.adminLevel >= 2 || viewer.shadowBanned !== null,
	};
}

export function shouldIncludeSubmissionInPublicSearch(
	row: SubmissionSearchRow,
	viewer: SubmissionSearchViewerContext,
): boolean {
	if (row.blockedTargetId !== null) {
		return false;
	}

	if (row.isPrivate) {
		return false;
	}

	if (row.stateMod !== "VISIBLE" || row.stateUserDeletedUtc !== null) {
		return false;
	}

	if (row.authorShadowBanned !== null && !viewer.canSeeShadowbanned) {
		return false;
	}

	return true;
}

function mapVisibleSubmissionRow(row: SubmissionSearchRow): SubmissionSummary {
	return {
		id: row.id,
		title: row.title,
		titleHtml: row.titleHtml,
		createdUtc: row.createdUtc,
		authorId: row.authorId,
		authorName: row.authorName,
		url: row.url,
		body: row.body,
		bodyHtml: row.bodyHtml,
		upvotes: row.upvotes,
		downvotes: row.downvotes,
		score: row.upvotes - row.downvotes,
		commentCount: row.commentCount,
		thumbUrl: row.thumbUrl,
		flair: row.flair,
		isPinned: row.isPinned,
		isNsfw: row.isNsfw,
		stickied: row.stickied,
		isStickied: row.stickied !== null,
		isDeleted: false,
		isRemoved: false,
		isFiltered: false,
		visibilityMessage: null,
		isSaved: row.savedSubmissionId !== null,
		isBlockedAuthor: false,
		userVote: (row.userVoteType as VoteType) ?? 0,
		stateMod: "VISIBLE",
		stateModSetBy: null,
	};
}

function mapVisibleCommentRow(row: CommentSearchRow): CommentFeedItem {
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
		parentSubmissionId: row.parentSubmissionId,
		submissionTitle: row.submissionTitle,
		distinguishLevel: row.distinguishLevel,
		isDeleted: false,
		isRemoved: false,
		isFiltered: false,
		isSaved: row.savedCommentId !== null,
		userVote: (row.userVoteType as VoteType) ?? 0,
		stateMod: "VISIBLE",
		stateModSetBy: null,
	};
}

async function searchCandidateIds(input: {
	query: string;
	documentType: SearchDocumentType;
	from: number;
	size: number;
}): Promise<{ ids: number[]; isAvailable: boolean }> {
	const client = getSearchClient();
	if (!client) {
		return { ids: [], isAvailable: false };
	}

	await ensureContentSearchIndex();
	const response = await client.search({
		index: CONTENT_SEARCH_INDEX,
		body: buildContentSearchQuery(input),
	});

	const hits = (response.body.hits?.hits ?? []) as Array<{ _id?: string }>;
	return {
		ids: hits
			.map((hit) => {
				const source = hit._id ?? "";
				const [, idPart] = source.split(":");
				return Number(idPart);
			})
			.filter((id: number) => Number.isInteger(id) && id > 0),
		isAvailable: true,
	};
}

async function getSubmissionSearchRowsByIds(
	ids: number[],
	userId?: number,
): Promise<SubmissionSearchRow[]> {
	if (ids.length === 0) {
		return [];
	}

	return db
		.select({
			id: submissions.id,
			title: submissions.title,
			titleHtml: submissions.titleHtml,
			createdUtc: submissions.createdUtc,
			authorId: submissions.authorId,
			authorName: users.username,
			authorShadowBanned: users.shadowBanned,
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
			stateUserDeletedUtc: submissions.stateUserDeletedUtc,
			stateMod: submissions.stateMod,
			userVoteType: votes.voteType,
			savedSubmissionId: saveRelationship.submissionId,
			blockedTargetId: userBlocks.targetId,
			isPrivate: submissions.private,
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
		.where(inArray(submissions.id, ids));
}

async function getCommentSearchRowsByIds(
	ids: number[],
	userId?: number,
): Promise<CommentSearchRow[]> {
	if (ids.length === 0) {
		return [];
	}

	return db
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
			distinguishLevel: comments.distinguishLevel,
			stateUserDeletedUtc: comments.stateUserDeletedUtc,
			stateMod: comments.stateMod,
			stateModSetBy: comments.stateModSetBy,
			userVoteType: commentVotes.voteType,
			savedCommentId: commentSaveRelationship.commentId,
			blockedTargetId: userBlocks.targetId,
			parentSubmissionPrivate: submissions.private,
			parentSubmissionDeletedUtc: submissions.stateUserDeletedUtc,
			parentSubmissionStateMod: submissions.stateMod,
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
		.where(inArray(comments.id, ids));
}

export function filterVisibleSearchSubmissionRows(
	rows: SubmissionSearchRow[],
	orderedIds: number[],
	viewer: SubmissionSearchViewerContext,
): SubmissionSummary[] {
	const rowsById = new Map(rows.map((row) => [row.id, row]));
	return orderedIds
		.map((id) => rowsById.get(id))
		.filter((row): row is SubmissionSearchRow => row !== undefined)
		.filter((row) => shouldIncludeSubmissionInPublicSearch(row, viewer))
		.map((row) => mapVisibleSubmissionRow(row));
}

export async function filterVisibleSearchCommentRows(
	rows: CommentSearchRow[],
	orderedIds: number[],
	userId?: number,
): Promise<CommentFeedItem[]> {
	const viewer = await getCommentViewerContext(userId);
	const rowsById = new Map(rows.map((row) => [row.id, row]));
	return orderedIds
		.map((id) => rowsById.get(id))
		.filter((row): row is CommentSearchRow => row !== undefined)
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
					isBlocking: row.blockedTargetId !== null,
					parentSubmissionId: row.parentSubmissionId,
					parentSubmissionPrivate: row.parentSubmissionPrivate,
					parentSubmissionDeletedUtc: row.parentSubmissionDeletedUtc,
					parentSubmissionStateMod: row.parentSubmissionStateMod,
				},
				viewer,
			),
		)
		.map((row) => mapVisibleCommentRow(row));
}

export async function searchPublicSubmissions(input: {
	query: string;
	page: number;
	userId?: number;
}): Promise<PublicSearchResults<SubmissionSummary>> {
	const viewer = await getSubmissionSearchViewerContext(input.userId);
	const start = (input.page - 1) * PUBLIC_SEARCH_PAGE_SIZE;
	const requiredVisibleCount = start + PUBLIC_SEARCH_PAGE_SIZE + 1;
	const visibleResults: SubmissionSummary[] = [];
	const seenIds = new Set<number>();
	let isAvailable = true;

	for (
		let from = 0;
		visibleResults.length < requiredVisibleCount;
		from += SEARCH_BATCH_SIZE
	) {
		const batch = await searchCandidateIds({
			query: input.query,
			documentType: "submission",
			from,
			size: SEARCH_BATCH_SIZE,
		});
		isAvailable = batch.isAvailable;
		if (!batch.isAvailable || batch.ids.length === 0) {
			break;
		}

		const rows = await getSubmissionSearchRowsByIds(batch.ids, input.userId);
		const visibleBatch = filterVisibleSearchSubmissionRows(
			rows,
			batch.ids,
			viewer,
		);
		for (const row of visibleBatch) {
			if (seenIds.has(row.id)) {
				continue;
			}

			seenIds.add(row.id);
			visibleResults.push(row);
		}

		if (batch.ids.length < SEARCH_BATCH_SIZE) {
			break;
		}
	}

	return {
		results: visibleResults.slice(start, start + PUBLIC_SEARCH_PAGE_SIZE),
		hasNextPage: visibleResults.length > start + PUBLIC_SEARCH_PAGE_SIZE,
		isAvailable,
	};
}

export async function searchPublicComments(input: {
	query: string;
	page: number;
	userId?: number;
}): Promise<PublicSearchResults<CommentFeedItem>> {
	const start = (input.page - 1) * PUBLIC_SEARCH_PAGE_SIZE;
	const requiredVisibleCount = start + PUBLIC_SEARCH_PAGE_SIZE + 1;
	const visibleResults: CommentFeedItem[] = [];
	const seenIds = new Set<number>();
	let isAvailable = true;

	for (
		let from = 0;
		visibleResults.length < requiredVisibleCount;
		from += SEARCH_BATCH_SIZE
	) {
		const batch = await searchCandidateIds({
			query: input.query,
			documentType: "comment",
			from,
			size: SEARCH_BATCH_SIZE,
		});
		isAvailable = batch.isAvailable;
		if (!batch.isAvailable || batch.ids.length === 0) {
			break;
		}

		const rows = await getCommentSearchRowsByIds(batch.ids, input.userId);
		const visibleBatch = await filterVisibleSearchCommentRows(
			rows,
			batch.ids,
			input.userId,
		);
		for (const row of visibleBatch) {
			if (seenIds.has(row.id)) {
				continue;
			}

			seenIds.add(row.id);
			visibleResults.push(row);
		}

		if (batch.ids.length < SEARCH_BATCH_SIZE) {
			break;
		}
	}

	return {
		results: visibleResults.slice(start, start + PUBLIC_SEARCH_PAGE_SIZE),
		hasNextPage: visibleResults.length > start + PUBLIC_SEARCH_PAGE_SIZE,
		isAvailable,
	};
}

export async function searchPublicContent(input: {
	query: string;
	type: SearchResultType;
	page: number;
	userId?: number;
}) {
	const trimmedQuery = input.query.trim();
	if (!trimmedQuery) {
		return {
			results: [],
			hasNextPage: false,
			isAvailable: true,
		};
	}

	return input.type === "posts"
		? searchPublicSubmissions({
				query: trimmedQuery,
				page: input.page,
				userId: input.userId,
			})
		: searchPublicComments({
				query: trimmedQuery,
				page: input.page,
				userId: input.userId,
			});
}

async function getSubmissionDocumentById(
	id: number,
): Promise<SearchSubmissionDocument | null> {
	const [row] = await db
		.select({
			id: submissions.id,
			authorId: submissions.authorId,
			authorUsername: users.username,
			title: submissions.title,
			url: submissions.url,
			body: submissions.body,
			createdUtc: submissions.createdUtc,
			editedUtc: submissions.editedUtc,
		})
		.from(submissions)
		.innerJoin(users, eq(submissions.authorId, users.id))
		.where(eq(submissions.id, id))
		.limit(1);

	if (!row) {
		return null;
	}

	return {
		id: row.id,
		documentType: "submission",
		authorId: row.authorId,
		authorUsername: row.authorUsername,
		title: row.title,
		url: row.url,
		body: row.body,
		createdUtc: row.createdUtc,
		updatedUtc: row.editedUtc || row.createdUtc,
	};
}

async function getCommentDocumentById(
	id: number,
): Promise<SearchCommentDocument | null> {
	const [row] = await db
		.select({
			id: comments.id,
			authorId: comments.authorId,
			authorUsername: users.username,
			body: comments.body,
			parentSubmissionId: comments.parentSubmission,
			createdUtc: comments.createdUtc,
			editedUtc: comments.editedUtc,
		})
		.from(comments)
		.innerJoin(users, eq(comments.authorId, users.id))
		.where(eq(comments.id, id))
		.limit(1);

	if (!row) {
		return null;
	}

	return {
		id: row.id,
		documentType: "comment",
		authorId: row.authorId,
		authorUsername: row.authorUsername,
		body: row.body,
		parentSubmissionId: row.parentSubmissionId,
		createdUtc: row.createdUtc,
		updatedUtc: row.editedUtc || row.createdUtc,
	};
}

async function upsertSearchDocument(
	document: SearchSubmissionDocument | SearchCommentDocument,
): Promise<boolean> {
	const client = getSearchClient();
	if (!client) {
		return false;
	}

	await ensureContentSearchIndex();
	await client.index({
		index: CONTENT_SEARCH_INDEX,
		id: getSearchDocumentId(document),
		body: document,
		refresh: false,
	});
	return true;
}

export async function indexSubmissionBestEffort(id: number): Promise<void> {
	try {
		const document = await getSubmissionDocumentById(id);
		if (!document) {
			return;
		}

		await upsertSearchDocument(document);
	} catch (error) {
		console.error("[search] failed to index submission", { id, error });
	}
}

export async function indexCommentBestEffort(id: number): Promise<void> {
	try {
		const document = await getCommentDocumentById(id);
		if (!document) {
			return;
		}

		await upsertSearchDocument(document);
	} catch (error) {
		console.error("[search] failed to index comment", { id, error });
	}
}

async function getSubmissionBatch(
	afterId: number,
): Promise<SearchSubmissionDocument[]> {
	const rows = await db
		.select({
			id: submissions.id,
			authorId: submissions.authorId,
			authorUsername: users.username,
			title: submissions.title,
			url: submissions.url,
			body: submissions.body,
			createdUtc: submissions.createdUtc,
			editedUtc: submissions.editedUtc,
		})
		.from(submissions)
		.innerJoin(users, eq(submissions.authorId, users.id))
		.where(gt(submissions.id, afterId))
		.orderBy(asc(submissions.id))
		.limit(REINDEX_BATCH_SIZE);

	return rows.map((row) => ({
		id: row.id,
		documentType: "submission" as const,
		authorId: row.authorId,
		authorUsername: row.authorUsername,
		title: row.title,
		url: row.url,
		body: row.body,
		createdUtc: row.createdUtc,
		updatedUtc: row.editedUtc || row.createdUtc,
	}));
}

async function getCommentBatch(
	afterId: number,
): Promise<SearchCommentDocument[]> {
	const rows = await db
		.select({
			id: comments.id,
			authorId: comments.authorId,
			authorUsername: users.username,
			body: comments.body,
			parentSubmissionId: comments.parentSubmission,
			createdUtc: comments.createdUtc,
			editedUtc: comments.editedUtc,
		})
		.from(comments)
		.innerJoin(users, eq(comments.authorId, users.id))
		.where(gt(comments.id, afterId))
		.orderBy(asc(comments.id))
		.limit(REINDEX_BATCH_SIZE);

	return rows.map((row) => ({
		id: row.id,
		documentType: "comment" as const,
		authorId: row.authorId,
		authorUsername: row.authorUsername,
		body: row.body,
		parentSubmissionId: row.parentSubmissionId,
		createdUtc: row.createdUtc,
		updatedUtc: row.editedUtc || row.createdUtc,
	}));
}

async function bulkIndexDocuments(
	documents: Array<SearchSubmissionDocument | SearchCommentDocument>,
): Promise<void> {
	const client = getSearchClient();
	if (!client || documents.length === 0) {
		return;
	}

	const body = documents.flatMap((document) => [
		{
			index: {
				_index: CONTENT_SEARCH_INDEX,
				_id: getSearchDocumentId(document),
			},
		},
		document,
	]);

	await client.bulk({ refresh: false, body });
}

export async function reindexPublicSearch(): Promise<boolean> {
	const client = getSearchClient();
	if (!client) {
		return false;
	}

	const existsResponse = await client.indices.exists({
		index: CONTENT_SEARCH_INDEX,
	});
	const exists =
		typeof existsResponse.body === "boolean"
			? existsResponse.body
			: Boolean(existsResponse.body);
	if (exists) {
		await client.indices.delete({ index: CONTENT_SEARCH_INDEX });
	}

	await ensureContentSearchIndex();
	let afterSubmissionId = 0;
	let afterCommentId = 0;

	for (;;) {
		const batch = await getSubmissionBatch(afterSubmissionId);
		if (batch.length === 0) {
			break;
		}

		await bulkIndexDocuments(batch);
		afterSubmissionId = batch[batch.length - 1]?.id ?? afterSubmissionId;
	}

	for (;;) {
		const batch = await getCommentBatch(afterCommentId);
		if (batch.length === 0) {
			break;
		}

		await bulkIndexDocuments(batch);
		afterCommentId = batch[batch.length - 1]?.id ?? afterCommentId;
	}

	return true;
}
