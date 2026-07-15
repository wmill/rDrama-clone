import { describe, expect, it, vi } from "vitest";

const mockClient = {
	indices: {
		exists: vi.fn(),
		create: vi.fn(),
		delete: vi.fn(),
	},
	search: vi.fn(),
	index: vi.fn(),
	bulk: vi.fn(),
};

vi.mock("@/db", () => ({
	db: {
		select: vi.fn(),
	},
}));

vi.mock("@elastic/elasticsearch", () => ({
	Client: vi.fn(() => mockClient),
}));

vi.mock("@sentry/tanstackstart-react", () => ({
	captureException: vi.fn(),
}));

vi.mock("@/lib/comment-visibility.server", async () => {
	const actual = await vi.importActual<
		typeof import("@/lib/comment-visibility.server")
	>("@/lib/comment-visibility.server");
	return {
		...actual,
		getCommentViewerContext: vi.fn().mockResolvedValue({
			viewerId: null,
			adminLevel: 0,
			canModerate: false,
			canSeeShadowbanned: false,
			blockedAuthorIds: new Set<number>([3]),
		}),
	};
});

import * as Sentry from "@sentry/tanstackstart-react";

import { db } from "@/db";
import {
	buildContentSearchQuery,
	filterVisibleSearchCommentRows,
	filterVisibleSearchSubmissionRows,
	indexCommentBestEffort,
	indexSubmissionBestEffort,
} from "@/lib/search.server";

describe("search.server", () => {
	it("includes author usernames in both post and comment queries", () => {
		const postQuery = buildContentSearchQuery({
			query: "alice",
			documentType: "submission",
			from: 0,
			size: 25,
		});
		const commentQuery = buildContentSearchQuery({
			query: "alice",
			documentType: "comment",
			from: 0,
			size: 25,
			allowNsfw: false,
		});

		expect(postQuery.query.bool.must[0].simple_query_string.fields).toContain(
			"authorUsername^3",
		);
		expect(
			commentQuery.query.bool.must[0].simple_query_string.fields,
		).toContain("authorUsername^3");
		expect(commentQuery.query.bool.filter).toContainEqual({
			bool: { must_not: [{ term: { over18: true } }] },
		});
	});

	it("filters blocked, removed, deleted, private, and shadowbanned post hits", () => {
		const rows = [
			{
				id: 1,
				title: "Visible",
				titleHtml: "Visible",
				createdUtc: 1,
				authorId: 2,
				authorName: "visible",
				authorShadowBanned: null,
				url: null,
				body: null,
				bodyHtml: null,
				upvotes: 3,
				downvotes: 0,
				commentCount: 0,
				thumbUrl: null,
				flair: null,
				isPinned: false,
				isNsfw: false,
				stickied: null,
				stateUserDeletedUtc: null,
				stateMod: "VISIBLE",
				userVoteType: null,
				savedSubmissionId: null,
				blockedTargetId: null,
				isPrivate: false,
			},
			{
				id: 2,
				title: "Blocked",
				titleHtml: "Blocked",
				createdUtc: 1,
				authorId: 3,
				authorName: "blocked",
				authorShadowBanned: null,
				url: null,
				body: null,
				bodyHtml: null,
				upvotes: 1,
				downvotes: 0,
				commentCount: 0,
				thumbUrl: null,
				flair: null,
				isPinned: false,
				isNsfw: false,
				stickied: null,
				stateUserDeletedUtc: null,
				stateMod: "VISIBLE",
				userVoteType: null,
				savedSubmissionId: null,
				blockedTargetId: 3,
				isPrivate: false,
			},
			{
				id: 3,
				title: "Shadow",
				titleHtml: "Shadow",
				createdUtc: 1,
				authorId: 4,
				authorName: "shadow",
				authorShadowBanned: "mod",
				url: null,
				body: null,
				bodyHtml: null,
				upvotes: 1,
				downvotes: 0,
				commentCount: 0,
				thumbUrl: null,
				flair: null,
				isPinned: false,
				isNsfw: false,
				stickied: null,
				stateUserDeletedUtc: null,
				stateMod: "VISIBLE",
				userVoteType: null,
				savedSubmissionId: null,
				blockedTargetId: null,
				isPrivate: false,
			},
			{
				id: 4,
				title: "Private",
				titleHtml: "Private",
				createdUtc: 1,
				authorId: 5,
				authorName: "private",
				authorShadowBanned: null,
				url: null,
				body: null,
				bodyHtml: null,
				upvotes: 1,
				downvotes: 0,
				commentCount: 0,
				thumbUrl: null,
				flair: null,
				isPinned: false,
				isNsfw: false,
				stickied: null,
				stateUserDeletedUtc: null,
				stateMod: "VISIBLE",
				userVoteType: null,
				savedSubmissionId: null,
				blockedTargetId: null,
				isPrivate: true,
			},
		];

		const result = filterVisibleSearchSubmissionRows(rows, [1, 2, 3, 4], {
			viewerId: null,
			canSeeShadowbanned: false,
		});

		expect(result).toHaveLength(1);
		expect(result[0]?.id).toBe(1);
	});

	it("filters blocked, deleted, private-post, and shadowbanned comment hits", async () => {
		const results = await filterVisibleSearchCommentRows(
			[
				{
					id: 1,
					authorId: 2,
					authorName: "visible",
					authorShadowBanned: null,
					body: "visible",
					bodyHtml: "<p>visible</p>",
					createdUtc: 1,
					editedUtc: 0,
					upvotes: 2,
					downvotes: 0,
					level: 1,
					parentSubmissionId: 9,
					submissionTitle: "Post",
					distinguishLevel: 0,
					stateUserDeletedUtc: null,
					stateMod: "VISIBLE",
					stateModSetBy: null,
					userVoteType: null,
					savedCommentId: null,
					blockedTargetId: null,
					parentSubmissionPrivate: false,
					parentSubmissionDeletedUtc: null,
					parentSubmissionStateMod: "VISIBLE",
				},
				{
					id: 2,
					authorId: 3,
					authorName: "blocked",
					authorShadowBanned: null,
					body: "blocked",
					bodyHtml: "<p>blocked</p>",
					createdUtc: 1,
					editedUtc: 0,
					upvotes: 1,
					downvotes: 0,
					level: 1,
					parentSubmissionId: 9,
					submissionTitle: "Post",
					distinguishLevel: 0,
					stateUserDeletedUtc: null,
					stateMod: "VISIBLE",
					stateModSetBy: null,
					userVoteType: null,
					savedCommentId: null,
					blockedTargetId: 3,
					parentSubmissionPrivate: false,
					parentSubmissionDeletedUtc: null,
					parentSubmissionStateMod: "VISIBLE",
				},
				{
					id: 3,
					authorId: 4,
					authorName: "deleted",
					authorShadowBanned: null,
					body: "deleted",
					bodyHtml: "<p>deleted</p>",
					createdUtc: 1,
					editedUtc: 0,
					upvotes: 1,
					downvotes: 0,
					level: 1,
					parentSubmissionId: 9,
					submissionTitle: "Post",
					distinguishLevel: 0,
					stateUserDeletedUtc: new Date(),
					stateMod: "VISIBLE",
					stateModSetBy: null,
					userVoteType: null,
					savedCommentId: null,
					blockedTargetId: null,
					parentSubmissionPrivate: false,
					parentSubmissionDeletedUtc: null,
					parentSubmissionStateMod: "VISIBLE",
				},
				{
					id: 4,
					authorId: 5,
					authorName: "private-post",
					authorShadowBanned: null,
					body: "private",
					bodyHtml: "<p>private</p>",
					createdUtc: 1,
					editedUtc: 0,
					upvotes: 1,
					downvotes: 0,
					level: 1,
					parentSubmissionId: 9,
					submissionTitle: "Post",
					distinguishLevel: 0,
					stateUserDeletedUtc: null,
					stateMod: "VISIBLE",
					stateModSetBy: null,
					userVoteType: null,
					savedCommentId: null,
					blockedTargetId: null,
					parentSubmissionPrivate: true,
					parentSubmissionDeletedUtc: null,
					parentSubmissionStateMod: "VISIBLE",
				},
				{
					id: 5,
					authorId: 6,
					authorName: "shadow",
					authorShadowBanned: "mod",
					body: "shadow",
					bodyHtml: "<p>shadow</p>",
					createdUtc: 1,
					editedUtc: 0,
					upvotes: 1,
					downvotes: 0,
					level: 1,
					parentSubmissionId: 9,
					submissionTitle: "Post",
					distinguishLevel: 0,
					stateUserDeletedUtc: null,
					stateMod: "VISIBLE",
					stateModSetBy: null,
					userVoteType: null,
					savedCommentId: null,
					blockedTargetId: null,
					parentSubmissionPrivate: false,
					parentSubmissionDeletedUtc: null,
					parentSubmissionStateMod: "VISIBLE",
				},
			],
			[1, 2, 3, 4, 5],
		);

		expect(results).toHaveLength(1);
		expect(results[0]?.id).toBe(1);
	});

	it("retries once, then reports persistent indexing failures to Sentry without throwing", async () => {
		process.env.ELASTICSEARCH_URL = "http://127.0.0.1:9200";
		mockClient.indices.exists.mockResolvedValue({ body: true });
		mockClient.index.mockRejectedValue(new Error("es down"));
		const consoleError = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);
		vi.mocked(db.select)
			.mockReturnValueOnce({
				from: vi.fn(() => ({
					innerJoin: vi.fn(() => ({
						where: vi.fn(() => ({
							limit: vi.fn().mockResolvedValue([
								{
									id: 1,
									authorId: 2,
									authorUsername: "alice",
									title: "Post",
									url: null,
									body: "body",
									createdUtc: 1,
									editedUtc: 0,
								},
							]),
						})),
					})),
				})),
			} as never)
			.mockReturnValueOnce({
				from: vi.fn(() => ({
					innerJoin: vi.fn(() => ({
						where: vi.fn(() => ({
							limit: vi.fn().mockResolvedValue([
								{
									id: 2,
									authorId: 3,
									authorUsername: "bob",
									body: "comment",
									parentSubmissionId: 9,
									createdUtc: 1,
									editedUtc: 0,
								},
							]),
						})),
					})),
				})),
			} as never);

		await expect(indexSubmissionBestEffort(1)).resolves.toBeUndefined();
		await expect(indexCommentBestEffort(2)).resolves.toBeUndefined();

		// One retry per document: 2 documents x 2 attempts.
		expect(mockClient.index).toHaveBeenCalledTimes(4);
		expect(consoleError).toHaveBeenCalledTimes(2);
		expect(consoleError.mock.calls[0][0]).toContain("pnpm reindex-search");
		expect(Sentry.captureException).toHaveBeenCalledTimes(2);

		consoleError.mockRestore();
	});

	it("does not report when the indexing retry succeeds", async () => {
		process.env.ELASTICSEARCH_URL = "http://127.0.0.1:9200";
		vi.mocked(Sentry.captureException).mockClear();
		mockClient.index.mockReset();
		mockClient.indices.exists.mockResolvedValue({ body: true });
		mockClient.index
			.mockRejectedValueOnce(new Error("transient hiccup"))
			.mockResolvedValueOnce({ body: {} });
		const consoleError = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);
		vi.mocked(db.select).mockReturnValueOnce({
			from: vi.fn(() => ({
				innerJoin: vi.fn(() => ({
					where: vi.fn(() => ({
						limit: vi.fn().mockResolvedValue([
							{
								id: 1,
								authorId: 2,
								authorUsername: "alice",
								title: "Post",
								url: null,
								body: "body",
								createdUtc: 1,
								editedUtc: 0,
							},
						]),
					})),
				})),
			})),
		} as never);

		await expect(indexSubmissionBestEffort(1)).resolves.toBeUndefined();

		expect(mockClient.index).toHaveBeenCalledTimes(2);
		expect(consoleError).not.toHaveBeenCalled();
		expect(Sentry.captureException).not.toHaveBeenCalled();

		consoleError.mockRestore();
	});
});
