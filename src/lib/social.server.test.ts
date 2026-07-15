import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({
	db: {
		select: vi.fn(),
		insert: vi.fn(),
		update: vi.fn(),
		delete: vi.fn(),
		transaction: vi.fn(),
	},
}));

vi.mock("@/lib/notifications.server", () => ({
	createSimpleNotification: vi.fn(),
}));

import { db } from "@/db";
import { createSimpleNotification } from "@/lib/notifications.server";
import {
	getBlockedUsersPage,
	getSocialViewerContext,
	getUserRelationship,
	setBlockState,
	setFollowState,
} from "@/lib/social.server";

function createBlockedPageChain(result: unknown) {
	return {
		from: vi.fn(() => ({
			innerJoin: vi.fn(() => ({
				where: vi.fn(() => ({
					limit: vi.fn(() => ({
						offset: vi.fn().mockResolvedValue(result),
					})),
				})),
			})),
		})),
	};
}

function createSelectLimitChain(result: unknown) {
	return {
		from: vi.fn(() => ({
			leftJoin: vi.fn(() => ({
				leftJoin: vi.fn(() => ({
					where: vi.fn(() => ({
						limit: vi.fn().mockResolvedValue(result),
					})),
				})),
			})),
			where: vi.fn(() => ({
				limit: vi.fn().mockResolvedValue(result),
			})),
		})),
	};
}

function createSelectWhereChain(result: unknown) {
	return {
		from: vi.fn(() => ({
			where: vi.fn().mockResolvedValue(result),
		})),
	};
}

function createInsertReturningChain(result: unknown) {
	const returning = vi.fn().mockResolvedValue(result);
	const onConflictDoNothing = vi.fn(() => ({
		returning,
	}));
	return {
		values: vi.fn(() => ({
			onConflictDoNothing,
		})),
		onConflictDoNothing,
		returning,
	};
}

function createUpdateChain() {
	return {
		set: vi.fn(() => ({
			where: vi.fn().mockResolvedValue(undefined),
		})),
	};
}

function createDeleteReturningChain(result: unknown) {
	const returning = vi.fn().mockResolvedValue(result);
	return {
		where: vi.fn(() => ({
			returning,
		})),
		returning,
	};
}

function createDeleteChain() {
	return {
		where: vi.fn().mockResolvedValue(undefined),
	};
}

describe("social.server", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("loads blocked ids for the viewer context", async () => {
		vi.mocked(db.select).mockReturnValueOnce(
			createSelectWhereChain([{ targetId: 3 }, { targetId: 7 }]) as never,
		);

		await expect(getSocialViewerContext(9)).resolves.toEqual({
			viewerId: 9,
			blockedUserIds: new Set([3, 7]),
		});
	});

	it("paginates the owner's public blocked-user list", async () => {
		vi.mocked(db.select).mockReturnValueOnce(
			createBlockedPageChain([
				{ id: 3, username: "three", profileUrl: null, isPrivate: false },
				{ id: 7, username: "seven", profileUrl: null, isPrivate: false },
			]) as never,
		);
		await expect(
			getBlockedUsersPage({ userId: 9, page: 2, pageSize: 1 }),
		).resolves.toEqual({
			items: [{ id: 3, username: "three", profileUrl: null, isPrivate: false }],
			page: 2,
			pageSize: 1,
			hasNextPage: true,
		});
	});

	it("keeps private blocks removable without exposing profile details", async () => {
		vi.mocked(db.select).mockReturnValueOnce(
			createBlockedPageChain([
				{
					id: 3,
					username: "secret-renamed-user",
					profileUrl: "secret.png",
					isPrivate: true,
				},
			]) as never,
		);
		await expect(
			getBlockedUsersPage({ userId: 9, page: 1 }),
		).resolves.toMatchObject({
			items: [{ id: 3, username: null, profileUrl: null, isPrivate: true }],
		});
	});

	it("returns relationship flags for the current viewer", async () => {
		vi.mocked(db.select).mockReturnValueOnce(
			createSelectLimitChain([
				{ followTargetId: 11, blockTargetId: null },
			]) as never,
		);

		await expect(getUserRelationship(4, 11)).resolves.toEqual({
			isFollowing: true,
			isBlocking: false,
		});
	});

	it("updates follow rows and stored counts idempotently", async () => {
		const insertChain = createInsertReturningChain([{ targetId: 8 }]);
		const noopInsertChain = createInsertReturningChain([]);
		const deleteChain = createDeleteReturningChain([{ targetId: 8 }]);
		const updateChainA = createUpdateChain();
		const updateChainB = createUpdateChain();
		const updateChainC = createUpdateChain();
		const updateChainD = createUpdateChain();
		const followTx = {
			insert: vi.fn(() => insertChain),
			update: vi
				.fn()
				.mockReturnValueOnce(updateChainA)
				.mockReturnValueOnce(updateChainB),
			delete: vi.fn(() => createDeleteReturningChain([])),
		};
		const noopTx = {
			insert: vi.fn(() => noopInsertChain),
			update: vi.fn(() => createUpdateChain()),
			delete: vi.fn(() => createDeleteReturningChain([])),
		};
		const unfollowTx = {
			insert: vi.fn(() => createInsertReturningChain([])),
			update: vi
				.fn()
				.mockReturnValueOnce(updateChainC)
				.mockReturnValueOnce(updateChainD),
			delete: vi.fn(() => deleteChain),
		};

		vi.mocked(db.transaction)
			.mockImplementationOnce(async (fn) => fn(followTx as never))
			.mockImplementationOnce(async (fn) => fn(noopTx as never))
			.mockImplementationOnce(async (fn) => fn(unfollowTx as never));

		await setFollowState({ userId: 2, targetUserId: 8, following: true });
		await setFollowState({ userId: 2, targetUserId: 8, following: true });
		await setFollowState({ userId: 2, targetUserId: 8, following: false });

		expect(updateChainA.set).toHaveBeenCalled();
		expect(updateChainB.set).toHaveBeenCalled();
		expect(noopTx.update).not.toHaveBeenCalled();
		expect(updateChainC.set).toHaveBeenCalled();
		expect(updateChainD.set).toHaveBeenCalled();

		// Only the first (new) follow emits a notification; the idempotent
		// re-follow and the unfollow do not.
		expect(createSimpleNotification).toHaveBeenCalledTimes(1);
		expect(createSimpleNotification).toHaveBeenCalledWith({
			userId: 8,
			actorId: 2,
			type: "follow",
			body: "followed you",
			tx: followTx,
		});
	});

	it("rejects self-follow and self-block", async () => {
		await expect(
			setFollowState({ userId: 4, targetUserId: 4, following: true }),
		).rejects.toThrow("You cannot follow yourself");
		await expect(
			setBlockState({ userId: 4, targetUserId: 4, blocked: true }),
		).rejects.toThrow("You cannot block yourself");
	});

	it("inserts and deletes block rows", async () => {
		const insertChain = {
			values: vi.fn(() => ({
				onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
			})),
		};
		const deleteChain = createDeleteChain();
		vi.mocked(db.insert).mockReturnValueOnce(insertChain as never);
		vi.mocked(db.delete).mockReturnValueOnce(deleteChain as never);

		await setBlockState({ userId: 1, targetUserId: 3, blocked: true });
		await setBlockState({ userId: 1, targetUserId: 3, blocked: false });

		expect(insertChain.values).toHaveBeenCalledWith({
			userId: 1,
			targetId: 3,
		});
		expect(deleteChain.where).toHaveBeenCalled();
	});
});
