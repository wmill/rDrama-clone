import { config } from "dotenv";
import { and, eq, sql } from "drizzle-orm";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

const [{ db }, { comments, submissions, users }] = await Promise.all([
	import("../src/db/index.ts"),
	import("../src/db/schema.ts"),
]);

const visibleOnly = process.argv.includes("--visible-only");

type CountRow = {
	authorId: number | null;
	count: number;
};

const submissionConditions = [eq(submissions.stateMod, "VISIBLE")];
const commentConditions = [eq(comments.stateMod, "VISIBLE")];

const postCountsQuery = db
	.select({
		authorId: submissions.authorId,
		count: sql<number>`count(*)::int`,
	})
	.from(submissions)
	.where(visibleOnly ? and(...submissionConditions) : undefined)
	.groupBy(submissions.authorId);

const commentCountsQuery = db
	.select({
		authorId: comments.authorId,
		count: sql<number>`count(*)::int`,
	})
	.from(comments)
	.where(visibleOnly ? and(...commentConditions) : undefined)
	.groupBy(comments.authorId);

const [postCountsRows, commentCountsRows, userRows] = await Promise.all([
	postCountsQuery,
	commentCountsQuery,
	db
		.select({
			id: users.id,
			username: users.username,
			postCount: users.postCount,
			commentCount: users.commentCount,
		})
		.from(users),
]);

const postCounts = new Map<number, number>();
for (const row of postCountsRows as CountRow[]) {
	if (row.authorId !== null) {
		postCounts.set(row.authorId, row.count);
	}
}

const commentCounts = new Map<number, number>();
for (const row of commentCountsRows as CountRow[]) {
	if (row.authorId !== null) {
		commentCounts.set(row.authorId, row.count);
	}
}

let updated = 0;

for (const user of userRows) {
	const nextPostCount = postCounts.get(user.id) ?? 0;
	const nextCommentCount = commentCounts.get(user.id) ?? 0;

	if (
		user.postCount === nextPostCount &&
		user.commentCount === nextCommentCount
	) {
		continue;
	}

	await db
		.update(users)
		.set({
			postCount: nextPostCount,
			commentCount: nextCommentCount,
		})
		.where(eq(users.id, user.id));

	updated += 1;
	console.log(
		`updated @${user.username}: posts ${user.postCount} -> ${nextPostCount}, comments ${user.commentCount} -> ${nextCommentCount}`,
	);
}

console.log(
	`done. updated ${updated} user(s)${visibleOnly ? " using visible-only rows" : ""}.`,
);
