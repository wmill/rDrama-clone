import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db", async () => ({
	db: (await import("@/test/mocks")).createMockDb(),
}));

vi.mock("@/lib/comment-visibility.server", () => ({
	getCommentViewerContext: vi.fn(),
	shouldIncludeCommentInFeed: vi.fn(() => true),
}));

vi.mock("@/lib/social.server", () => ({
	getUserRelationship: vi.fn(),
	getSocialViewerContext: vi.fn(),
}));

import { db } from "@/db";
import type { users } from "@/db/schema";
import type { SafeUser } from "@/lib/auth.server";
import { getCommentViewerContext } from "@/lib/comment-visibility.server";
import { renderCommentMarkdown, renderPostTitleHtml } from "@/lib/markdown";
import { getUserRelationship } from "@/lib/social.server";
import {
	getProfilePageData,
	getUserByUsernameCanonical,
	getUserSettingsById,
	type UpdateUserSettingsInput,
	updateUserSettings,
} from "@/lib/users.server";
import { createQueryChain, makeSafeUser } from "@/test/mocks";

function makeProfileUser(
	overrides: Record<string, unknown> = {},
): typeof users.$inferSelect {
	return {
		id: 7,
		username: "Alice",
		isPrivate: false,
		adminLevel: 0,
		...overrides,
	} as typeof users.$inferSelect;
}

function makeViewer(overrides: Partial<SafeUser> = {}): SafeUser {
	return makeSafeUser({
		id: 11,
		username: "bob",
		email: "bob@example.com",
		...overrides,
	});
}

function makeSettingsInput(
	overrides: Partial<UpdateUserSettingsInput> = {},
): UpdateUserSettingsInput {
	return {
		bio: "",
		customTitlePlain: "",
		profileUrl: "",
		bannerUrl: "",
		defaultSorting: "hot",
		defaultSortingComments: "new",
		defaultTime: "all",
		isPrivate: false,
		hideVotedOn: false,
		cardView: false,
		highlightComments: true,
		newTabExternal: false,
		newTab: false,
		nameColor: "000000",
		titleColor: "000000",
		themeColor: "000000",
		theme: "dark",
		over18: false,
		slurReplacer: true,
		...overrides,
	};
}

describe("getUserByUsernameCanonical", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("finds a user regardless of case and surrounding whitespace", async () => {
		const user = makeProfileUser();
		vi.mocked(db.select).mockReturnValueOnce(createQueryChain([user]) as never);

		await expect(getUserByUsernameCanonical("  ALICE ")).resolves.toBe(user);
	});

	it("returns an original-name match for canonical profile redirects", async () => {
		const user = makeProfileUser({
			username: "NewAlice",
			originalUsername: "Alice",
		});
		vi.mocked(db.select).mockReturnValueOnce(createQueryChain([user]) as never);
		await expect(getUserByUsernameCanonical("alice")).resolves.toBe(user);
	});

	it("returns null when no user matches", async () => {
		vi.mocked(db.select).mockReturnValueOnce(createQueryChain([]) as never);

		await expect(getUserByUsernameCanonical("ghost")).resolves.toBeNull();
	});
});

describe("getUserSettingsById", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns null for a missing user", async () => {
		vi.mocked(db.select).mockReturnValueOnce(createQueryChain([]) as never);

		await expect(getUserSettingsById(12345)).resolves.toBeNull();
	});

	it("maps nullable profile fields to empty strings", async () => {
		vi.mocked(db.select).mockReturnValueOnce(
			createQueryChain([
				{
					id: 7,
					username: "alice",
					email: null,
					createdUtc: 100,
					isBanned: 0,
					banReason: null,
					coins: 5,
					proCoins: 0,
					bio: null,
					customTitlePlain: null,
					flairChanged: 123,
					profileUrl: null,
					bannerUrl: null,
					defaultSorting: "hot",
					defaultSortingComments: "new",
					defaultTime: "all",
					isPrivate: false,
					hideVotedOn: false,
					cardView: false,
					highlightComments: true,
					newTabExternal: false,
					newTab: false,
					nameColor: "ff0000",
					titleColor: "00ff00",
					themeColor: "0000ff",
				},
			]) as never,
		);

		await expect(getUserSettingsById(7)).resolves.toMatchObject({
			id: 7,
			bio: "",
			customTitlePlain: "",
			titleLocked: true,
			profileUrl: "",
			bannerUrl: "",
			nameColor: "ff0000",
		});
	});
});

describe("updateUserSettings", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("renders bioHtml and customTitle from the trimmed inputs", async () => {
		const chain = createQueryChain();
		vi.mocked(db.update).mockReturnValueOnce(chain as never);

		await updateUserSettings(
			7,
			makeSettingsInput({
				bio: "  I like **markdown**  ",
				customTitlePlain: " Grand Poster ",
			}),
		);

		expect(chain.set).toHaveBeenCalledWith(
			expect.objectContaining({
				bio: "I like **markdown**",
				bioHtml: renderCommentMarkdown("I like **markdown**"),
				customTitlePlain: "Grand Poster",
				customTitle: renderPostTitleHtml("Grand Poster"),
			}),
		);
	});

	it("stores null for blank bio, title, and urls", async () => {
		const chain = createQueryChain();
		vi.mocked(db.update).mockReturnValueOnce(chain as never);

		await updateUserSettings(7, makeSettingsInput({ bio: "   " }));

		expect(chain.set).toHaveBeenCalledWith(
			expect.objectContaining({
				bio: null,
				bioHtml: null,
				customTitlePlain: null,
				customTitle: null,
				profileUrl: null,
				bannerUrl: null,
			}),
		);
	});

	it("persists the theme and content preferences", async () => {
		const chain = createQueryChain();
		vi.mocked(db.update).mockReturnValueOnce(chain as never);

		await updateUserSettings(
			7,
			makeSettingsInput({ theme: "light", over18: true, slurReplacer: false }),
		);

		expect(chain.set).toHaveBeenCalledWith(
			expect.objectContaining({
				theme: "light",
				over18: true,
				slurReplacer: false,
			}),
		);
	});

	it("preserves a moderator-locked custom title while saving other settings", async () => {
		const chain = createQueryChain();
		vi.mocked(db.update).mockReturnValueOnce(chain as never);

		await updateUserSettings(
			7,
			makeSettingsInput({ customTitlePlain: "Attempted replacement" }),
			{ preserveCustomTitle: true },
		);

		expect(chain.set).toHaveBeenCalledWith(
			expect.not.objectContaining({
				customTitlePlain: expect.anything(),
				customTitle: expect.anything(),
			}),
		);
	});
});

describe("getProfilePageData", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(getUserRelationship).mockResolvedValue({
			isFollowing: false,
			isBlocking: false,
		});
		vi.mocked(getCommentViewerContext).mockResolvedValue({
			viewerId: null,
			adminLevel: 0,
			canModerate: false,
			canSeeShadowbanned: false,
			blockedAuthorIds: new Set<number>(),
		});
	});

	it("returns null for an unknown username", async () => {
		vi.mocked(db.select).mockReturnValueOnce(createQueryChain([]) as never);

		await expect(
			getProfilePageData({
				username: "ghost",
				tab: "comments",
				sort: "new",
				t: "all",
				page: 1,
				viewer: null,
			}),
		).resolves.toBeNull();
	});

	it("restricts a private profile for strangers and fetches nothing", async () => {
		vi.mocked(db.select)
			.mockReturnValueOnce(
				createQueryChain([makeProfileUser({ isPrivate: true })]) as never,
			)
			.mockReturnValueOnce(createQueryChain([{ count: 3 }]) as never)
			.mockReturnValueOnce(createQueryChain([]) as never);

		await expect(
			getProfilePageData({
				username: "alice",
				tab: "comments",
				sort: "new",
				t: "all",
				page: 1,
				viewer: makeViewer(),
			}),
		).resolves.toMatchObject({
			isOwner: false,
			isPrivateRestricted: true,
			comments: [],
			posts: [],
			followingCount: 3,
		});
		// only user lookup, following count, and badges run for a restricted profile
		expect(db.select).toHaveBeenCalledTimes(3);
	});

	it("lets the owner view their own private profile comments", async () => {
		vi.mocked(db.select)
			.mockReturnValueOnce(
				createQueryChain([makeProfileUser({ isPrivate: true })]) as never,
			)
			.mockReturnValueOnce(createQueryChain([{ count: 0 }]) as never)
			.mockReturnValueOnce(
				createQueryChain([
					{
						id: 1,
						authorId: 7,
						parentSubmissionId: 42,
						submissionTitle: "A post",
						authorName: "Alice",
						authorShadowBanned: null,
						bodyHtml: "<p>mine</p>",
						createdUtc: 100,
						upvotes: 2,
						downvotes: 1,
						distinguishLevel: 0,
						stateUserDeletedUtc: null,
						stateMod: "VISIBLE",
						stateModSetBy: null,
						parentSubmissionPrivate: false,
						parentSubmissionDeletedUtc: null,
						parentSubmissionStateMod: "VISIBLE",
						userVoteType: 1,
						blockedTargetId: null,
					},
				]) as never,
			)
			.mockReturnValueOnce(createQueryChain([]) as never);

		await expect(
			getProfilePageData({
				username: "alice",
				tab: "comments",
				sort: "new",
				t: "all",
				page: 1,
				viewer: makeViewer({ id: 7, username: "Alice" }),
			}),
		).resolves.toMatchObject({
			isOwner: true,
			isPrivateRestricted: false,
			hasNextPage: false,
			comments: [
				expect.objectContaining({
					id: 1,
					parentSubmissionId: 42,
					bodyHtml: "<p>mine</p>",
					score: 1,
					userVote: 1,
				}),
			],
		});
	});

	it("returns no content when the profile owner blocks the viewer", async () => {
		vi.mocked(getUserRelationship).mockResolvedValue({
			isFollowing: false,
			isBlocking: true,
		});
		vi.mocked(db.select)
			.mockReturnValueOnce(createQueryChain([makeProfileUser()]) as never)
			.mockReturnValueOnce(createQueryChain([{ count: 0 }]) as never)
			.mockReturnValueOnce(createQueryChain([]) as never);

		await expect(
			getProfilePageData({
				username: "alice",
				tab: "posts",
				sort: "new",
				t: "all",
				page: 1,
				viewer: makeViewer(),
			}),
		).resolves.toMatchObject({
			isBlocking: true,
			comments: [],
			posts: [],
		});
		expect(db.select).toHaveBeenCalledTimes(3);
	});

	it("orders profile posts with pinned posts first", async () => {
		const postsChain = createQueryChain([
			{
				id: 1,
				title: "Pinned",
				titleHtml: "Pinned",
				bodyHtml: null,
				url: null,
				createdUtc: 100,
				upvotes: 1,
				downvotes: 0,
				commentCount: 0,
				isDraft: false,
			},
		]);
		vi.mocked(db.select)
			.mockReturnValueOnce(createQueryChain([makeProfileUser()]) as never)
			.mockReturnValueOnce(createQueryChain([{ count: 0 }]) as never)
			.mockReturnValueOnce(postsChain as never)
			.mockReturnValueOnce(createQueryChain([]) as never);

		await getProfilePageData({
			username: "alice",
			tab: "posts",
			sort: "new",
			t: "all",
			page: 1,
			viewer: null,
		});

		// The first ordering expression is isPinned; the second is the selected sort.
		expect(postsChain.orderBy).toHaveBeenCalledWith(
			expect.anything(),
			expect.anything(),
		);
	});
});
