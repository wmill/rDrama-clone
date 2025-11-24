import fs from "node:fs/promises";

type SubmissionRecord = {
	id: number;
	author_id: number;
	created_utc: number;
	title: string;
	url?: string | null;
	upvotes?: number | null;
	downvotes?: number | null;
	comment_count?: number | null;
};

type UserRecord = {
	id: number;
	username: string;
};

export type SubmissionSummary = {
	id: number;
	title: string;
	createdUtc: number;
	authorId: number;
	authorName: string;
	url: string | null | undefined;
	upvotes: number;
	downvotes: number;
	commentCount: number;
};

const SUBMISSIONS_FIXTURE = "prototyping-data/submissions_202511121738.json";
const USERS_FIXTURE = "prototyping-data/users_202511121739.json";

async function readJsonFile<T>(path: string): Promise<T> {
	const fileContents = await fs.readFile(path, "utf-8");
	return JSON.parse(fileContents) as T;
}

export async function getRecentSubmissions(
	limit = 25,
): Promise<SubmissionSummary[]> {
	const [submissionData, userData] = await Promise.all([
		readJsonFile<{ submissions: SubmissionRecord[] }>(SUBMISSIONS_FIXTURE),
		readJsonFile<{ users: UserRecord[] }>(USERS_FIXTURE),
	]);

	const usernamesById = new Map(userData.users.map((user) => [user.id, user]));

	return submissionData.submissions
		.slice()
		.sort((a, b) => b.created_utc - a.created_utc)
		.slice(0, limit)
		.map((submission) => ({
			id: submission.id,
			title: submission.title,
			createdUtc: submission.created_utc,
			authorId: submission.author_id,
			authorName:
				usernamesById.get(submission.author_id)?.username ?? "Unknown",
			url: submission.url,
			upvotes: submission.upvotes ?? 0,
			downvotes: submission.downvotes ?? 0,
			commentCount: submission.comment_count ?? 0,
		}));
}
