import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({
	db: {
		select: vi.fn(),
		insert: vi.fn(),
		update: vi.fn(),
		delete: vi.fn(),
	},
}));

vi.mock("@/lib/comment-visibility.server", () => ({
	getCommentViewerContext: vi.fn(),
}));

vi.mock("@/lib/user-mentions", () => ({
	extractUserMentionsFromMarkdown: vi.fn(),
}));

import { db } from "@/db";
import { getCommentViewerContext } from "@/lib/comment-visibility.server";
import {
	clearReadNotifications,
	createNotificationsForComment,
	createSimpleNotification,
	getNotificationsPage,
	getUnreadNotificationCount,
	isSubmissionSubscribed,
	markAllNotificationsRead,
	markNotificationRead,
	setSubmissionSubscriptionState,
} from "@/lib/notifications.server";
import { extractUserMentionsFromMarkdown } from "@/lib/user-mentions";

function createSelectChain(result: unknown) {
	const chain = {
		from: vi.fn(() => chain),
		innerJoin: vi.fn(() => chain),
		leftJoin: vi.fn(() => chain),
		where: vi.fn(() => chain),
		orderBy: vi.fn().mockResolvedValue(result),
		limit: vi.fn().mockResolvedValue(result),
	};

	return chain;
}

function createResolvedWhereChain(result: unknown) {
	return {
		from: vi.fn(() => ({
			where: vi.fn().mockResolvedValue(result),
		})),
	};
}

function createInsertChain() {
	const onConflictDoNothing = vi.fn().mockResolvedValue(undefined);
	return {
		values: vi.fn(() => ({
			onConflictDoNothing,
		})),
	};
}

function createUpdateChain() {
	return {
		set: vi.fn(() => ({
			where: vi.fn().mockResolvedValue(undefined),
		})),
	};
}

function createDeleteChain() {
	return {
		where: vi.fn().mockResolvedValue(undefined),
	};
}

describe("notifications.server", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("fans out notifications to reply, mention, and subscriber recipients without duplicates or self-notifies", async () => {
		const insertChain = createInsertChain();
		const tx = {
			select: vi
				.fn()
				.mockReturnValueOnce(
					createSelectChain([
						{
							id: 50,
							authorId: 1,
							body: "hello @Bob and @Carol",
							parentCommentId: 22,
							parentSubmissionId: 9,
						},
					]),
				)
				.mockReturnValueOnce(createSelectChain([{ authorId: 2 }]))
				.mockReturnValueOnce(createSelectChain([{ authorId: 3 }]))
				.mockReturnValueOnce(
					createResolvedWhereChain([
						{ userId: 2 },
						{ userId: 4 },
						{ userId: 1 },
					]),
				),
			insert: vi.fn(() => insertChain),
		};
		vi.mocked(extractUserMentionsFromMarkdown).mockReturnValue([
			"Bob",
			"Carol",
			"Unknown",
		]);
		vi.mocked(db.select).mockReturnValueOnce(
			createResolvedWhereChain([{ id: 4 }, { id: 5 }]) as never,
		);

		await createNotificationsForComment(50, tx as never);

		expect(insertChain.values).toHaveBeenCalledWith(
			expect.arrayContaining([
				{ userId: 2, commentId: 50, read: false },
				{ userId: 3, commentId: 50, read: false },
				{ userId: 4, commentId: 50, read: false },
				{ userId: 5, commentId: 50, read: false },
			]),
		);
		expect(insertChain.values).toHaveBeenCalledTimes(1);
	});

	it("counts only visible unread notifications", async () => {
		vi.mocked(getCommentViewerContext).mockResolvedValue({
			viewerId: 5,
			adminLevel: 0,
			canModerate: false,
			canSeeShadowbanned: false,
			blockedAuthorIds: new Set([9]),
		});
		vi.mocked(db.select)
			.mockReturnValueOnce(createSelectChain([{ username: "alice" }]) as never)
			.mockReturnValueOnce(
				createSelectChain([
					{
						notificationId: 101,
						commentId: 1,
						read: false,
						notificationCreatedAt: new Date("2026-05-08T00:00:00Z"),
						commentAuthorId: 2,
						commentAuthorName: "bob",
						commentAuthorShadowBanned: null,
						commentBody: "visible",
						commentBodyHtml: "<p>visible</p>",
						commentCreatedUtc: 1,
						commentStateMod: "VISIBLE",
						commentStateUserDeletedUtc: null,
						commentDistinguishLevel: 0,
						parentCommentId: null,
						parentCommentAuthorId: null,
						submissionId: 11,
						submissionTitle: "Visible",
						submissionAuthorId: 5,
						submissionPrivate: false,
						submissionStateMod: "VISIBLE",
						submissionStateUserDeletedUtc: null,
					},
					{
						notificationId: 102,
						commentId: 2,
						read: false,
						notificationCreatedAt: new Date("2026-05-08T00:00:00Z"),
						commentAuthorId: 9,
						commentAuthorName: "blocked",
						commentAuthorShadowBanned: null,
						commentBody: "blocked",
						commentBodyHtml: "<p>blocked</p>",
						commentCreatedUtc: 1,
						commentStateMod: "VISIBLE",
						commentStateUserDeletedUtc: null,
						commentDistinguishLevel: 0,
						parentCommentId: null,
						parentCommentAuthorId: null,
						submissionId: 11,
						submissionTitle: "Blocked",
						submissionAuthorId: 5,
						submissionPrivate: false,
						submissionStateMod: "VISIBLE",
						submissionStateUserDeletedUtc: null,
					},
					{
						notificationId: 103,
						commentId: 3,
						read: false,
						notificationCreatedAt: new Date("2026-05-08T00:00:00Z"),
						commentAuthorId: 10,
						commentAuthorName: "shadow",
						commentAuthorShadowBanned: "AutoJanny",
						commentBody: "hidden",
						commentBodyHtml: "<p>hidden</p>",
						commentCreatedUtc: 1,
						commentStateMod: "VISIBLE",
						commentStateUserDeletedUtc: null,
						commentDistinguishLevel: 0,
						parentCommentId: null,
						parentCommentAuthorId: null,
						submissionId: 11,
						submissionTitle: "Shadow",
						submissionAuthorId: 5,
						submissionPrivate: false,
						submissionStateMod: "VISIBLE",
						submissionStateUserDeletedUtc: null,
					},
					{
						notificationId: 104,
						commentId: 4,
						read: false,
						notificationCreatedAt: new Date("2026-05-08T00:00:00Z"),
						commentAuthorId: 4,
						commentAuthorName: "removed",
						commentAuthorShadowBanned: null,
						commentBody: "removed",
						commentBodyHtml: "<p>removed</p>",
						commentCreatedUtc: 1,
						commentStateMod: "REMOVED",
						commentStateUserDeletedUtc: null,
						commentDistinguishLevel: 0,
						parentCommentId: null,
						parentCommentAuthorId: null,
						submissionId: 11,
						submissionTitle: "Removed",
						submissionAuthorId: 5,
						submissionPrivate: false,
						submissionStateMod: "VISIBLE",
						submissionStateUserDeletedUtc: null,
					},
				]) as never,
			)
			.mockReturnValueOnce(
				createSelectChain([
					{
						notificationId: 105,
						type: "follow",
						body: "followed you",
						url: null,
						read: false,
						notificationCreatedAt: new Date("2026-05-08T00:00:00Z"),
						actorId: 6,
						actorName: "carol",
						actorShadowBanned: null,
					},
					{
						notificationId: 106,
						type: "follow",
						body: "followed you",
						url: null,
						read: false,
						notificationCreatedAt: new Date("2026-05-08T00:00:00Z"),
						actorId: 9,
						actorName: "blocked",
						actorShadowBanned: null,
					},
				]) as never,
			);

		await expect(getUnreadNotificationCount(5)).resolves.toBe(3);
	});

	it("builds notification list rows with reply precedence and deleted placeholders", async () => {
		vi.mocked(getCommentViewerContext).mockResolvedValue({
			viewerId: 5,
			adminLevel: 0,
			canModerate: false,
			canSeeShadowbanned: false,
			blockedAuthorIds: new Set<number>(),
		});
		vi.mocked(extractUserMentionsFromMarkdown).mockReturnValue(["alice"]);
		vi.mocked(db.select)
			.mockReturnValueOnce(createSelectChain([{ username: "alice" }]) as never)
			.mockReturnValueOnce(
				createSelectChain([
					{
						notificationId: 208,
						commentId: 8,
						read: false,
						notificationCreatedAt: new Date("2026-05-08T00:00:00Z"),
						commentAuthorId: 2,
						commentAuthorName: "bob",
						commentAuthorShadowBanned: null,
						commentBody: "@alice hi",
						commentBodyHtml: "<p>@alice hi</p>",
						commentCreatedUtc: 1,
						commentStateMod: "VISIBLE",
						commentStateUserDeletedUtc: new Date("2026-05-08T00:00:00Z"),
						commentDistinguishLevel: 0,
						parentCommentId: null,
						parentCommentAuthorId: null,
						submissionId: 7,
						submissionTitle: "Interesting Post",
						submissionAuthorId: 5,
						submissionPrivate: false,
						submissionStateMod: "VISIBLE",
						submissionStateUserDeletedUtc: null,
					},
				]) as never,
			)
			.mockReturnValueOnce(createSelectChain([]) as never);

		const page = await getNotificationsPage({
			userId: 5,
			page: 1,
			pageSize: 10,
		});

		expect(page.items).toEqual([
			{
				id: 208,
				type: "comment",
				commentId: 8,
				read: false,
				createdUtc: 1_778_198_400,
				actorUsername: "bob",
				label: "replied to your post",
				postTitle: "Interesting Post",
				commentSnippet: "[deleted]",
				href: "/comment/8",
			},
		]);
	});

	it("merges follow and award notifications into the page, newest first", async () => {
		vi.mocked(getCommentViewerContext).mockResolvedValue({
			viewerId: 5,
			adminLevel: 0,
			canModerate: false,
			canSeeShadowbanned: false,
			blockedAuthorIds: new Set<number>(),
		});
		vi.mocked(extractUserMentionsFromMarkdown).mockReturnValue([]);
		vi.mocked(db.select)
			.mockReturnValueOnce(createSelectChain([{ username: "alice" }]) as never)
			.mockReturnValueOnce(
				createSelectChain([
					{
						notificationId: 301,
						commentId: 8,
						read: false,
						notificationCreatedAt: new Date("2026-05-08T00:00:00Z"),
						commentAuthorId: 2,
						commentAuthorName: "bob",
						commentAuthorShadowBanned: null,
						commentBody: "hi",
						commentBodyHtml: "<p>hi</p>",
						commentCreatedUtc: 1,
						commentStateMod: "VISIBLE",
						commentStateUserDeletedUtc: null,
						parentCommentId: null,
						parentCommentAuthorId: null,
						submissionId: 7,
						submissionTitle: "Interesting Post",
						submissionAuthorId: 5,
						submissionPrivate: false,
						submissionStateMod: "VISIBLE",
						submissionStateUserDeletedUtc: null,
					},
				]) as never,
			)
			.mockReturnValueOnce(
				createSelectChain([
					{
						notificationId: 302,
						type: "award",
						body: "gave your post a Gold award",
						url: "/post/7",
						read: false,
						notificationCreatedAt: new Date("2026-05-09T00:00:00Z"),
						actorId: 6,
						actorName: "carol",
						actorShadowBanned: null,
					},
					{
						notificationId: 303,
						type: "follow",
						body: "followed you",
						url: null,
						read: true,
						notificationCreatedAt: new Date("2026-05-07T00:00:00Z"),
						actorId: 6,
						actorName: "carol",
						actorShadowBanned: null,
					},
				]) as never,
			);

		const page = await getNotificationsPage({
			userId: 5,
			page: 1,
			pageSize: 10,
		});

		expect(page.items.map((item) => item.id)).toEqual([302, 301, 303]);

		expect(page.items[0]).toMatchObject({
			type: "award",
			actorUsername: "carol",
			label: "gave your post a Gold award",
			href: "/post/7",
			commentId: null,
		});
		expect(page.items[2]).toMatchObject({
			type: "follow",
			actorUsername: "carol",
			label: "followed you",
			href: "/u/carol",
			read: true,
		});
	});

	it("inserts simple notifications but never self-notifies", async () => {
		const insertValues = vi.fn().mockResolvedValue(undefined);
		vi.mocked(db.insert).mockReturnValue({ values: insertValues } as never);

		await createSimpleNotification({
			userId: 4,
			actorId: 4,
			type: "follow",
			body: "followed you",
		});
		expect(db.insert).not.toHaveBeenCalled();

		await createSimpleNotification({
			userId: 8,
			actorId: 4,
			type: "award",
			body: "gave your post a Gold award",
			url: "/post/1",
		});
		expect(insertValues).toHaveBeenCalledWith({
			userId: 8,
			actorId: 4,
			type: "award",
			body: "gave your post a Gold award",
			url: "/post/1",
			read: false,
		});
	});

	it("marks notifications read, clears read notifications, and toggles subscriptions", async () => {
		const updateChain = createUpdateChain();
		const deleteChain = createDeleteChain();
		const insertChain = createInsertChain();
		vi.mocked(db.update).mockReturnValue(updateChain as never);
		vi.mocked(db.delete)
			.mockReturnValueOnce(deleteChain as never)
			.mockReturnValueOnce(deleteChain as never);
		vi.mocked(db.insert).mockReturnValue(insertChain as never);
		vi.mocked(db.select).mockReturnValueOnce(
			createSelectChain([{ userId: 3 }]) as never,
		);

		await markNotificationRead({ userId: 1, notificationId: 2 });
		await markAllNotificationsRead(1);
		await clearReadNotifications(1);
		await setSubmissionSubscriptionState({
			userId: 3,
			submissionId: 9,
			subscribed: true,
		});
		await setSubmissionSubscriptionState({
			userId: 3,
			submissionId: 9,
			subscribed: false,
		});
		await expect(
			isSubmissionSubscribed({ userId: 3, submissionId: 9 }),
		).resolves.toBe(true);

		expect(vi.mocked(db.update)).toHaveBeenCalledTimes(2);
		expect(deleteChain.where).toHaveBeenCalledTimes(2);
		expect(insertChain.values).toHaveBeenCalledWith({
			userId: 3,
			submissionId: 9,
		});
	});
});
