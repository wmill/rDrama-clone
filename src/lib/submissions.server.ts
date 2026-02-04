import { type SQL, and, desc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { submissions, users } from "@/db/schema";

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
};

export type SubmissionDetail = SubmissionSummary & {
	embedUrl: string | null;
	editedUtc: number;
	views: number;
	distinguishLevel: number;
};

export const SortTypes = ["new", "hot", "top", "controversial", "comments"] as const;
export type SortType = (typeof SortTypes)[number];

export const TimeFilters = [
	"hour",
	"day",
	"week",
	"month",
	"year",
	"all",
] as const;
export type TimeFilter = (typeof TimeFilters)[number];

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

export async function getSubmissions(options: {
	sort?: SortType;
	time?: TimeFilter;
	limit?: number;
	offset?: number;
	authorId?: number;
	pinnedFirst?: boolean;
}): Promise<SubmissionSummary[]> {
	const {
		sort = "hot",
		time = "all",
		limit = 25,
		offset = 0,
		authorId,
		pinnedFirst = true,
	} = options;

	const timeFilter = getTimeFilterSeconds(time);

	const conditions = [eq(submissions.stateMod, "VISIBLE")];

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
		})
		.from(submissions)
		.innerJoin(users, eq(submissions.authorId, users.id))
		.where(and(...conditions))
		.orderBy(...orderBy)
		.limit(limit)
		.offset(offset);

	return results.map((row) => ({
		...row,
		score: row.upvotes - row.downvotes,
	}));
}

export async function getSubmissionById(
	id: number,
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
		})
		.from(submissions)
		.innerJoin(users, eq(submissions.authorId, users.id))
		.where(eq(submissions.id, id))
		.limit(1);

	if (!result) return null;

	return {
		...result,
		score: result.upvotes - result.downvotes,
	};
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

	const [result] = await db
		.insert(submissions)
		.values({
			authorId: data.authorId,
			title: data.title,
			titleHtml: data.title, // TODO: Implement HTML sanitization
			url: data.url ?? null,
			body: data.body ?? null,
			bodyHtml: data.body ?? null, // TODO: Implement markdown parsing
			createdUtc,
			over18: data.isNsfw ?? false,
			stateMod: "VISIBLE",
			stateReport: "UNREPORTED",
		})
		.returning({ id: submissions.id });

	return result.id;
}

export async function updateSubmission(
	id: number,
	authorId: number,
	data: {
		body?: string;
		isNsfw?: boolean;
	},
): Promise<boolean> {
	const editedUtc = Math.floor(Date.now() / 1000);

	const result = await db
		.update(submissions)
		.set({
			body: data.body,
			bodyHtml: data.body, // TODO: Implement markdown parsing
			over18: data.isNsfw,
			editedUtc,
		})
		.where(and(eq(submissions.id, id), eq(submissions.authorId, authorId)))
		.returning({ id: submissions.id });

	return result.length > 0;
}

export async function deleteSubmission(
	id: number,
	authorId: number,
): Promise<boolean> {
	const result = await db
		.update(submissions)
		.set({
			stateUserDeletedUtc: new Date(),
			stateMod: "REMOVED",
		})
		.where(and(eq(submissions.id, id), eq(submissions.authorId, authorId)))
		.returning({ id: submissions.id });

	return result.length > 0;
}

export async function getRandomSubmissionId(): Promise<number | null> {
	const [result] = await db
		.select({ id: submissions.id })
		.from(submissions)
		.where(eq(submissions.stateMod, "VISIBLE"))
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
