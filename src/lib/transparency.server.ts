import { and, count, desc, eq, gt, inArray, isNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { db } from "@/db";
import { comments, modActions, submissions, users } from "@/db/schema";

export const TRANSPARENCY_PAGE_SIZE = 25;

// Public means public by deliberate inclusion. New moderator actions stay private
// until their disclosure and target rules have been reviewed here.
export const PUBLIC_MOD_ACTION_KINDS = ["ban_user", "unban_user"] as const;

export type PublicUserSummary = {
	id: number;
	username: string;
	adminLevel: number;
};

export type PublicBannedUser = {
	id: number;
	username: string;
};

export type PublicModAction = {
	id: number;
	kind: (typeof PUBLIC_MOD_ACTION_KINDS)[number];
	createdDatetimez: Date;
	actor: { id: number; username: string } | null;
	target: { type: "user"; id: number; username: string };
};

export type PublicPage<T> = { entries: T[]; page: number; hasMore: boolean };

function safePage(page: number): number {
	return Math.max(1, Math.floor(page));
}

export async function listPublicAdmins(
	page = 1,
): Promise<PublicPage<PublicUserSummary>> {
	const currentPage = safePage(page);
	const rows = await db
		.select({
			id: users.id,
			username: users.username,
			adminLevel: users.adminLevel,
		})
		.from(users)
		.where(
			and(
				gt(users.adminLevel, 0),
				eq(users.isPrivate, false),
				isNull(users.shadowBanned),
			),
		)
		.orderBy(desc(users.adminLevel), users.username)
		.limit(TRANSPARENCY_PAGE_SIZE + 1)
		.offset((currentPage - 1) * TRANSPARENCY_PAGE_SIZE);
	return {
		entries: rows.slice(0, TRANSPARENCY_PAGE_SIZE),
		page: currentPage,
		hasMore: rows.length > TRANSPARENCY_PAGE_SIZE,
	};
}

export async function listPublicBannedUsers(
	page = 1,
): Promise<PublicPage<PublicBannedUser>> {
	const currentPage = safePage(page);
	const rows = await db
		.select({ id: users.id, username: users.username })
		.from(users)
		.where(
			and(
				gt(users.isBanned, 0),
				eq(users.unbanUtc, 0),
				eq(users.isPrivate, false),
				isNull(users.shadowBanned),
			),
		)
		.orderBy(users.username)
		.limit(TRANSPARENCY_PAGE_SIZE + 1)
		.offset((currentPage - 1) * TRANSPARENCY_PAGE_SIZE);
	return {
		entries: rows.slice(0, TRANSPARENCY_PAGE_SIZE),
		page: currentPage,
		hasMore: rows.length > TRANSPARENCY_PAGE_SIZE,
	};
}

export async function listPublicModActions(
	page = 1,
): Promise<PublicPage<PublicModAction>> {
	const currentPage = safePage(page);
	const actor = alias(users, "public_mod_actor");
	const target = alias(users, "public_mod_target");
	const rows = await db
		.select({
			id: modActions.id,
			kind: modActions.kind,
			createdDatetimez: modActions.createdDatetimez,
			actorId: actor.id,
			actorName: actor.username,
			targetId: target.id,
			targetName: target.username,
		})
		.from(modActions)
		.leftJoin(actor, eq(modActions.userId, actor.id))
		.innerJoin(target, eq(modActions.targetUserId, target.id))
		.where(
			and(
				inArray(modActions.kind, [...PUBLIC_MOD_ACTION_KINDS]),
				eq(target.isPrivate, false),
				isNull(target.shadowBanned),
			),
		)
		.orderBy(desc(modActions.createdDatetimez), desc(modActions.id))
		.limit(TRANSPARENCY_PAGE_SIZE + 1)
		.offset((currentPage - 1) * TRANSPARENCY_PAGE_SIZE);

	return {
		entries: rows.slice(0, TRANSPARENCY_PAGE_SIZE).map((row) => ({
			id: row.id,
			kind: row.kind as PublicModAction["kind"],
			createdDatetimez: row.createdDatetimez,
			actor:
				row.actorId && row.actorName
					? { id: row.actorId, username: row.actorName }
					: null,
			target: { type: "user", id: row.targetId, username: row.targetName },
		})),
		page: currentPage,
		hasMore: rows.length > TRANSPARENCY_PAGE_SIZE,
	};
}

export type PublicStats = {
	users: number;
	bannedUsers: number;
	publicPosts: number;
	publicComments: number;
	newUsers24h: number;
};

export async function getPublicStats(): Promise<PublicStats> {
	const dayAgo = Math.floor(Date.now() / 1000) - 86_400;
	const [userRows, bannedRows, postRows, commentRows, newUserRows] =
		await Promise.all([
			db.select({ value: count() }).from(users),
			db.select({ value: count() }).from(users).where(gt(users.isBanned, 0)),
			db
				.select({ value: count() })
				.from(submissions)
				.where(
					and(
						eq(submissions.private, false),
						isNull(submissions.stateUserDeletedUtc),
					),
				),
			db
				.select({ value: count() })
				.from(comments)
				.innerJoin(submissions, eq(comments.parentSubmission, submissions.id))
				.where(
					and(
						isNull(comments.stateUserDeletedUtc),
						eq(submissions.private, false),
						isNull(submissions.stateUserDeletedUtc),
					),
				),
			db
				.select({ value: count() })
				.from(users)
				.where(gt(users.createdUtc, dayAgo)),
		]);
	return {
		users: userRows[0]?.value ?? 0,
		bannedUsers: bannedRows[0]?.value ?? 0,
		publicPosts: postRows[0]?.value ?? 0,
		publicComments: commentRows[0]?.value ?? 0,
		newUsers24h: newUserRows[0]?.value ?? 0,
	};
}
