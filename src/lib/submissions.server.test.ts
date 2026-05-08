import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({
	db: {
		select: vi.fn(),
		transaction: vi.fn(),
		update: vi.fn(),
	},
}));

vi.mock("@/lib/notifications.server", () => ({
	setSubmissionSubscriptionState: vi.fn(),
}));

import { db } from "@/db";
import { getSubmissionById, getSubmissions } from "@/lib/submissions.server";

function createSelectOrderChain(result: unknown) {
	const chain = {
		from: vi.fn(() => chain),
		innerJoin: vi.fn(() => chain),
		leftJoin: vi.fn(() => chain),
		where: vi.fn(() => chain),
		orderBy: vi.fn(() => chain),
		limit: vi.fn(() => chain),
		offset: vi.fn().mockResolvedValue(result),
	};
	return chain;
}

function createSelectLimitChain(result: unknown) {
	const chain = {
		from: vi.fn(() => chain),
		innerJoin: vi.fn(() => chain),
		leftJoin: vi.fn(() => chain),
		where: vi.fn(() => chain),
		limit: vi.fn().mockResolvedValue(result),
	};
	return chain;
}

describe("submissions.server", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("omits blocked authors from submission feeds", async () => {
		vi.mocked(db.select).mockReturnValueOnce(
			createSelectOrderChain([
				{
					id: 1,
					title: "Visible",
					titleHtml: "Visible",
					createdUtc: 1,
					authorId: 2,
					authorName: "visible",
					url: null,
					body: "body",
					bodyHtml: "<p>body</p>",
					upvotes: 5,
					downvotes: 1,
					commentCount: 3,
					thumbUrl: null,
					flair: null,
					isPinned: false,
					isNsfw: false,
					stickied: null,
					userVoteType: null,
					stateUserDeletedUtc: null,
					stateMod: "VISIBLE",
					stateModSetBy: null,
					savedSubmissionId: null,
					blockedTargetId: null,
				},
				{
					id: 2,
					title: "Blocked",
					titleHtml: "Blocked",
					createdUtc: 1,
					authorId: 3,
					authorName: "blocked",
					url: null,
					body: "body",
					bodyHtml: "<p>body</p>",
					upvotes: 5,
					downvotes: 1,
					commentCount: 3,
					thumbUrl: null,
					flair: null,
					isPinned: false,
					isNsfw: false,
					stickied: null,
					userVoteType: null,
					stateUserDeletedUtc: null,
					stateMod: "VISIBLE",
					stateModSetBy: null,
					savedSubmissionId: null,
					blockedTargetId: 3,
				},
			]) as never,
		);

		const results = await getSubmissions({ userId: 9 });

		expect(results).toHaveLength(1);
		expect(results[0]?.authorName).toBe("visible");
	});

	it("returns a blocked placeholder for direct post views", async () => {
		vi.mocked(db.select).mockReturnValueOnce(
			createSelectLimitChain([
				{
					id: 7,
					title: "Original title",
					titleHtml: "Original title",
					createdUtc: 1,
					authorId: 3,
					authorName: "blocked",
					url: "https://example.com",
					body: "body",
					bodyHtml: "<p>body</p>",
					upvotes: 4,
					downvotes: 0,
					commentCount: 1,
					thumbUrl: null,
					flair: null,
					isPinned: false,
					isNsfw: false,
					stickied: null,
					embedUrl: "https://example.com/embed",
					editedUtc: 0,
					views: 10,
					distinguishLevel: 0,
					stateUserDeletedUtc: null,
					stateMod: "VISIBLE",
					stateModSetBy: null,
					userVoteType: null,
					savedSubmissionId: null,
					subscribedSubmissionId: null,
					blockedTargetId: 3,
				},
			]) as never,
		);

		const result = await getSubmissionById(7, 9);

		expect(result).not.toBeNull();
		expect(result?.isBlockedAuthor).toBe(true);
		expect(result?.visibilityMessage).toBe("You are blocking @blocked");
		expect(result?.title).toContain("blocked post");
		expect(result?.url).toBeNull();
	});

	it("shows filtered placeholders to normal viewers but not moderators", async () => {
		const filteredRow = {
			id: 8,
			title: "Filtered title",
			titleHtml: "Filtered title",
			createdUtc: 1,
			authorId: 4,
			authorName: "filtered",
			url: null,
			body: "body",
			bodyHtml: "<p>body</p>",
			upvotes: 1,
			downvotes: 0,
			commentCount: 0,
			thumbUrl: null,
			flair: null,
			isPinned: false,
			isNsfw: false,
			stickied: null,
			embedUrl: null,
			editedUtc: 0,
			views: 0,
			distinguishLevel: 0,
			stateUserDeletedUtc: null,
			stateMod: "FILTERED",
			stateModSetBy: "mod",
			userVoteType: null,
			savedSubmissionId: null,
			subscribedSubmissionId: null,
			blockedTargetId: null,
		};
		vi.mocked(db.select)
			.mockReturnValueOnce(createSelectLimitChain([filteredRow]) as never)
			.mockReturnValueOnce(createSelectLimitChain([filteredRow]) as never);

		const viewerResult = await getSubmissionById(8, 9, false);
		const moderatorResult = await getSubmissionById(8, 9, true);

		expect(viewerResult?.isFiltered).toBe(true);
		expect(viewerResult?.visibilityMessage).toBe("Filtered by moderator");
		expect(viewerResult?.bodyHtml).toContain("filtered by moderator");
		expect(moderatorResult?.isFiltered).toBe(true);
		expect(moderatorResult?.visibilityMessage).toBeNull();
		expect(moderatorResult?.bodyHtml).toBe("<p>body</p>");
	});
});
