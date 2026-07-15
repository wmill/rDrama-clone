import { and, eq, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { type AppDbExecutor, db } from "@/db";
import { follows, userBlocks, users } from "@/db/schema";
import type { SafeUser } from "@/lib/auth.server";
import { createSimpleNotification } from "@/lib/notifications.server";

const DEFAULT_PAGE_SIZE = 25;

async function getUserByUsernameCanonical(username: string) {
	const normalized = username.trim().toLowerCase();
	const [user] = await db
		.select()
		.from(users)
		.where(
			or(
				sql`lower(${users.username}) = ${normalized}`,
				sql`lower(${users.originalUsername}) = ${normalized}`,
			),
		)
		.limit(1);

	return user ?? null;
}

export type SocialViewerContext = {
	viewerId: number | null;
	blockedUserIds: Set<number>;
};

export type SocialRelationship = {
	isFollowing: boolean;
	isBlocking: boolean;
};

export type SocialListKind = "followers" | "following";

export type SocialListItem = {
	id: number;
	username: string;
	createdUtc: number;
	bio: string | null;
	bioHtml: string | null;
	customTitle: string | null;
	profileUrl: string | null;
	isFollowing: boolean;
	isBlocking: boolean;
};

export type SocialListPage = {
	profileUser: typeof users.$inferSelect;
	viewer: SafeUser | null;
	kind: SocialListKind;
	page: number;
	pageSize: number;
	isOwner: boolean;
	isPrivateRestricted: boolean;
	isBlockingProfile: boolean;
	items: SocialListItem[];
	hasNextPage: boolean;
};

export type BlockedUsersPage = {
	items: Array<{
		id: number;
		username: string | null;
		profileUrl: string | null;
		isPrivate: boolean;
	}>;
	page: number;
	pageSize: number;
	hasNextPage: boolean;
};

export async function getSocialViewerContext(
	userId?: number,
): Promise<SocialViewerContext> {
	if (!userId) {
		return {
			viewerId: null,
			blockedUserIds: new Set<number>(),
		};
	}

	const blockRows = await db
		.select({ targetId: userBlocks.targetId })
		.from(userBlocks)
		.where(eq(userBlocks.userId, userId));

	return {
		viewerId: userId,
		blockedUserIds: new Set(blockRows.map((row) => row.targetId)),
	};
}

export async function getUserRelationship(
	viewerId: number | null | undefined,
	targetUserId: number,
): Promise<SocialRelationship> {
	if (!viewerId || viewerId === targetUserId) {
		return { isFollowing: false, isBlocking: false };
	}

	const rows = await db
		.select({
			followTargetId: follows.targetId,
			blockTargetId: userBlocks.targetId,
		})
		.from(users)
		.leftJoin(
			follows,
			and(eq(follows.userId, viewerId), eq(follows.targetId, targetUserId)),
		)
		.leftJoin(
			userBlocks,
			and(
				eq(userBlocks.userId, viewerId),
				eq(userBlocks.targetId, targetUserId),
			),
		)
		.where(eq(users.id, targetUserId))
		.limit(1);

	const row = rows[0];
	return {
		isFollowing: row?.followTargetId !== null,
		isBlocking: row?.blockTargetId !== null,
	};
}

export async function setFollowState(input: {
	userId: number;
	targetUserId: number;
	following: boolean;
	tx?: AppDbExecutor;
}): Promise<void> {
	if (input.userId === input.targetUserId) {
		throw new Error("You cannot follow yourself");
	}

	const applyFollowState = async (tx: AppDbExecutor) => {
		if (input.following) {
			const inserted = await tx
				.insert(follows)
				.values({
					userId: input.userId,
					targetId: input.targetUserId,
				})
				.onConflictDoNothing()
				.returning({ targetId: follows.targetId });

			if (inserted.length === 0) {
				return;
			}

			await tx
				.update(users)
				.set({
					storedFollowingCount: sql`${users.storedFollowingCount} + 1`,
				})
				.where(eq(users.id, input.userId));
			await tx
				.update(users)
				.set({
					storedSubscriberCount: sql`${users.storedSubscriberCount} + 1`,
				})
				.where(eq(users.id, input.targetUserId));
			await createSimpleNotification({
				userId: input.targetUserId,
				actorId: input.userId,
				type: "follow",
				body: "followed you",
				tx,
			});
			return;
		}

		const deleted = await tx
			.delete(follows)
			.where(
				and(
					eq(follows.userId, input.userId),
					eq(follows.targetId, input.targetUserId),
				),
			)
			.returning({ targetId: follows.targetId });

		if (deleted.length === 0) {
			return;
		}

		await tx
			.update(users)
			.set({
				storedFollowingCount: sql`GREATEST(${users.storedFollowingCount} - 1, 0)`,
			})
			.where(eq(users.id, input.userId));
		await tx
			.update(users)
			.set({
				storedSubscriberCount: sql`GREATEST(${users.storedSubscriberCount} - 1, 0)`,
			})
			.where(eq(users.id, input.targetUserId));
	};

	if (input.tx) {
		await applyFollowState(input.tx);
		return;
	}

	await db.transaction((tx) => applyFollowState(tx));
}

export async function setBlockState(input: {
	userId: number;
	targetUserId: number;
	blocked: boolean;
	tx?: AppDbExecutor;
}): Promise<void> {
	if (input.userId === input.targetUserId) {
		throw new Error("You cannot block yourself");
	}

	const database = input.tx ?? db;
	if (input.blocked) {
		await database
			.insert(userBlocks)
			.values({
				userId: input.userId,
				targetId: input.targetUserId,
			})
			.onConflictDoNothing();
		return;
	}

	await database
		.delete(userBlocks)
		.where(
			and(
				eq(userBlocks.userId, input.userId),
				eq(userBlocks.targetId, input.targetUserId),
			),
		);
}

export async function removeFollower(input: {
	ownerId: number;
	followerId: number;
}): Promise<void> {
	await setFollowState({
		userId: input.followerId,
		targetUserId: input.ownerId,
		following: false,
	});
}

export async function getBlockedUsersPage(options: {
	userId: number;
	page: number;
	pageSize?: number;
}): Promise<BlockedUsersPage> {
	const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;
	const rows = await db
		.select({
			id: users.id,
			username: users.username,
			profileUrl: users.profileUrl,
			isPrivate: users.isPrivate,
		})
		.from(userBlocks)
		.innerJoin(users, eq(users.id, userBlocks.targetId))
		.where(eq(userBlocks.userId, options.userId))
		.limit(pageSize + 1)
		.offset((options.page - 1) * pageSize);

	return {
		items: rows
			.slice(0, pageSize)
			.map((row) =>
				row.isPrivate ? { ...row, username: null, profileUrl: null } : row,
			),
		page: options.page,
		pageSize,
		hasNextPage: rows.length > pageSize,
	};
}

async function getSocialListPage(options: {
	username: string;
	page: number;
	pageSize?: number;
	viewer: SafeUser | null;
	kind: SocialListKind;
}): Promise<SocialListPage | null> {
	const profileUser = await getUserByUsernameCanonical(options.username);
	if (!profileUser) {
		return null;
	}

	const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;
	const offset = (options.page - 1) * pageSize;
	const isOwner = options.viewer?.id === profileUser.id;
	const isAdmin = (options.viewer?.adminLevel ?? 0) >= 2;
	const isPrivateRestricted = profileUser.isPrivate && !isOwner && !isAdmin;
	const viewerContext = await getSocialViewerContext(options.viewer?.id);
	const isBlockingProfile = viewerContext.blockedUserIds.has(profileUser.id);
	const relationshipFollows = alias(follows, "relationship_follows");
	const viewerFollows = alias(follows, "viewer_follows");

	if (isPrivateRestricted || isBlockingProfile) {
		return {
			profileUser,
			viewer: options.viewer,
			kind: options.kind,
			page: options.page,
			pageSize,
			isOwner,
			isPrivateRestricted,
			isBlockingProfile,
			items: [],
			hasNextPage: false,
		};
	}

	const relationshipUserId =
		options.kind === "followers"
			? relationshipFollows.userId
			: relationshipFollows.targetId;
	const profileCondition =
		options.kind === "followers"
			? eq(relationshipFollows.targetId, profileUser.id)
			: eq(relationshipFollows.userId, profileUser.id);

	const rows = await db
		.select({
			id: users.id,
			username: users.username,
			createdUtc: users.createdUtc,
			bio: users.bio,
			bioHtml: users.bioHtml,
			customTitle: users.customTitle,
			profileUrl: users.profileUrl,
			followingTargetId: viewerFollows.targetId,
			blockedTargetId: userBlocks.targetId,
		})
		.from(relationshipFollows)
		.innerJoin(users, eq(users.id, relationshipUserId))
		.leftJoin(
			viewerFollows,
			options.viewer
				? and(
						eq(viewerFollows.userId, options.viewer.id),
						eq(viewerFollows.targetId, users.id),
					)
				: sql`false`,
		)
		.leftJoin(
			userBlocks,
			options.viewer
				? and(
						eq(userBlocks.userId, options.viewer.id),
						eq(userBlocks.targetId, users.id),
					)
				: sql`false`,
		)
		.where(profileCondition)
		.limit(pageSize + 1)
		.offset(offset);

	const visibleRows = rows
		.filter((row) => !viewerContext.blockedUserIds.has(row.id))
		.slice(0, pageSize);

	return {
		profileUser,
		viewer: options.viewer,
		kind: options.kind,
		page: options.page,
		pageSize,
		isOwner,
		isPrivateRestricted,
		isBlockingProfile,
		items: visibleRows.map((row) => ({
			id: row.id,
			username: row.username,
			createdUtc: row.createdUtc,
			bio: row.bio,
			bioHtml: row.bioHtml,
			customTitle: row.customTitle,
			profileUrl: row.profileUrl,
			isFollowing: row.followingTargetId !== null,
			isBlocking: row.blockedTargetId !== null,
		})),
		hasNextPage: rows.length > pageSize,
	};
}

export async function getFollowersPage(options: {
	username: string;
	page: number;
	pageSize?: number;
	viewer: SafeUser | null;
}) {
	return getSocialListPage({ ...options, kind: "followers" });
}

export async function getFollowingPage(options: {
	username: string;
	page: number;
	pageSize?: number;
	viewer: SafeUser | null;
}) {
	return getSocialListPage({ ...options, kind: "following" });
}
