import { z } from "zod";

import { CommentSortTypes, SortTypes, TimeFilters } from "@/lib/constants";

// Shared zod building blocks for server-fn inputValidators. Route-local
// server fns import their whole schema from here so it stays unit-testable
// without importing route modules.

export const idSchema = z.number().int().positive();
export const pageSchema = z.number().int().min(1);
export const voteTypeSchema = z.union([
	z.literal(1),
	z.literal(-1),
	z.literal(0),
]);

export const idInputSchema = z.object({ id: idSchema });
export const userIdInputSchema = z.object({ userId: idSchema });
export const pageInputSchema = z.object({ page: pageSchema });
export const usernamePageInputSchema = z.object({
	username: z.string().min(1).max(50),
	page: pageSchema,
});
export const userSearchInputSchema = z.object({
	query: z.string().max(100),
});
export const submissionVoteInputSchema = z.object({
	submissionId: idSchema,
	voteType: voteTypeSchema,
});
export const commentVoteInputSchema = z.object({
	commentId: idSchema,
	voteType: voteTypeSchema,
});

export const sortTypeSchema = z.enum(SortTypes);
export const timeFilterSchema = z.enum(TimeFilters);
export const commentSortTypeSchema = z.enum(CommentSortTypes);
export const searchResultTypeSchema = z.enum(["posts", "comments"]);

export const feedInputSchema = z.object({
	sort: sortTypeSchema.optional(),
	time: timeFilterSchema.optional(),
	limit: z.number().int().min(1).max(100).optional(),
});
export const commentFeedInputSchema = z.object({
	sort: commentSortTypeSchema.optional(),
	t: timeFilterSchema.optional(),
	page: pageSchema.optional(),
});
export const profilePostsInputSchema = z.object({
	username: z.string().min(1).max(50),
	sort: sortTypeSchema,
	t: timeFilterSchema,
	page: pageSchema,
});
export const profileCommentsInputSchema = z.object({
	username: z.string().min(1).max(50),
	sort: commentSortTypeSchema,
	t: timeFilterSchema,
	page: pageSchema,
});
export const searchInputSchema = z.object({
	q: z.string().max(200),
	type: searchResultTypeSchema,
	page: pageSchema,
});
