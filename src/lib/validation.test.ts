import { describe, expect, it } from "vitest";

import {
	commentFeedInputSchema,
	commentVoteInputSchema,
	feedInputSchema,
	idInputSchema,
	pageInputSchema,
	profileCommentsInputSchema,
	profilePostsInputSchema,
	searchInputSchema,
	submissionVoteInputSchema,
	userIdInputSchema,
	usernamePageInputSchema,
	userSearchInputSchema,
} from "@/lib/validation";

describe("validation schemas", () => {
	it("accepts well-formed inputs", () => {
		expect(idInputSchema.safeParse({ id: 3 }).success).toBe(true);
		expect(userIdInputSchema.safeParse({ userId: 9 }).success).toBe(true);
		expect(pageInputSchema.safeParse({ page: 1 }).success).toBe(true);
		expect(
			usernamePageInputSchema.safeParse({ username: "alice", page: 2 }).success,
		).toBe(true);
		expect(userSearchInputSchema.safeParse({ query: "bob" }).success).toBe(
			true,
		);
		expect(
			submissionVoteInputSchema.safeParse({ submissionId: 1, voteType: -1 })
				.success,
		).toBe(true);
		expect(
			feedInputSchema.safeParse({ sort: "hot", time: "week" }).success,
		).toBe(true);
		expect(
			searchInputSchema.safeParse({ q: "drama", type: "posts", page: 1 })
				.success,
		).toBe(true);
	});

	it("rejects non-integer, zero, and negative ids", () => {
		expect(idInputSchema.safeParse({ id: 0 }).success).toBe(false);
		expect(idInputSchema.safeParse({ id: -4 }).success).toBe(false);
		expect(idInputSchema.safeParse({ id: 1.5 }).success).toBe(false);
		expect(idInputSchema.safeParse({ id: "7" }).success).toBe(false);
		expect(userIdInputSchema.safeParse({ userId: 0 }).success).toBe(false);
	});

	it("rejects out-of-range pages and empty usernames", () => {
		expect(pageInputSchema.safeParse({ page: 0 }).success).toBe(false);
		expect(pageInputSchema.safeParse({ page: 2.5 }).success).toBe(false);
		expect(
			usernamePageInputSchema.safeParse({ username: "", page: 1 }).success,
		).toBe(false);
		expect(
			usernamePageInputSchema.safeParse({ username: "a".repeat(51), page: 1 })
				.success,
		).toBe(false);
	});

	it("rejects vote types outside 1/-1/0", () => {
		expect(
			submissionVoteInputSchema.safeParse({ submissionId: 1, voteType: 2 })
				.success,
		).toBe(false);
		expect(
			commentVoteInputSchema.safeParse({ commentId: 1, voteType: "1" }).success,
		).toBe(false);
	});

	it("rejects unknown sort/time/type enum values", () => {
		expect(feedInputSchema.safeParse({ sort: "spiciest" }).success).toBe(false);
		expect(feedInputSchema.safeParse({ time: "eon" }).success).toBe(false);
		expect(feedInputSchema.safeParse({ limit: 101 }).success).toBe(false);
		expect(commentFeedInputSchema.safeParse({ sort: "hot" }).success).toBe(
			false,
		);
		expect(
			profilePostsInputSchema.safeParse({
				username: "alice",
				sort: "oldest",
				t: "all",
				page: 1,
			}).success,
		).toBe(false);
		expect(
			profileCommentsInputSchema.safeParse({
				username: "alice",
				sort: "hot",
				t: "all",
				page: 1,
			}).success,
		).toBe(false);
		expect(
			searchInputSchema.safeParse({ q: "x", type: "users", page: 1 }).success,
		).toBe(false);
	});

	it("rejects oversized search queries", () => {
		expect(
			userSearchInputSchema.safeParse({ query: "q".repeat(101) }).success,
		).toBe(false);
		expect(
			searchInputSchema.safeParse({
				q: "q".repeat(201),
				type: "posts",
				page: 1,
			}).success,
		).toBe(false);
	});
});
