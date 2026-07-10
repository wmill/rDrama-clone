import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock } = vi.hoisted(() => ({
	dbMock: {
		select: vi.fn(),
		update: vi.fn(),
		insert: vi.fn(),
		delete: vi.fn(),
	},
}));

vi.mock("@tanstack/react-start", () => ({
	createServerFn: () => {
		const chain = {
			inputValidator: () => chain,
			handler: (handler: unknown) => handler,
		};
		return chain;
	},
}));

vi.mock("@/db", () => ({
	db: dbMock,
}));

vi.mock("@/lib/sessions.server", () => ({
	getCurrentUser: vi.fn(),
}));

vi.mock("@/lib/users.server", () => ({
	getUserByUsernameCanonical: vi.fn(),
}));

import type { SafeUser } from "@/lib/auth.server";
import {
	awardContentFn,
	createBadgeDefFn,
	grantBadgeFn,
	revokeBadgeFn,
} from "@/lib/award-actions.server";
import { getCurrentUser } from "@/lib/sessions.server";
import { getUserByUsernameCanonical } from "@/lib/users.server";

function createSelectChain<T>(result: T) {
	return {
		from: vi.fn().mockReturnThis(),
		where: vi.fn().mockReturnThis(),
		limit: vi.fn().mockResolvedValue(result),
	};
}

function createInsertChain() {
	return {
		values: vi.fn().mockResolvedValue(undefined),
	};
}

function createInsertReturningChain<T>(result: T) {
	return {
		values: vi.fn().mockReturnValue({
			returning: vi.fn().mockResolvedValue(result),
		}),
	};
}

function createInsertConflictChain() {
	return {
		values: vi.fn().mockReturnValue({
			onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
		}),
	};
}

function createUpdateChain() {
	return {
		set: vi.fn().mockReturnValue({
			where: vi.fn().mockResolvedValue(undefined),
		}),
	};
}

const admin: SafeUser = {
	id: 2,
	username: "mod",
	email: "mod@example.com",
	adminLevel: 2,
	createdUtc: 0,
	isActivated: true,
	isBanned: 0,
	banReason: null,
	unbanUtc: 0,
	shadowBanned: null,
	coins: 0,
	proCoins: 0,
	profileUrl: null,
	bannerUrl: null,
	bio: null,
	customTitle: null,
};

const regular: SafeUser = {
	...admin,
	id: 5,
	username: "pleb",
	adminLevel: 0,
};

describe("award-actions.server", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("rejects badge management from non-admins and logged-out users", async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(regular);
		await expect(
			createBadgeDefFn({ data: { name: "Founder" } }),
		).resolves.toEqual({ success: false, error: "Unauthorized" });
		await expect(
			grantBadgeFn({ data: { username: "alice", badgeId: 1 } }),
		).resolves.toEqual({ success: false, error: "Unauthorized" });
		await expect(
			revokeBadgeFn({ data: { username: "alice", badgeId: 1 } }),
		).resolves.toEqual({ success: false, error: "Unauthorized" });

		vi.mocked(getCurrentUser).mockResolvedValue(null);
		await expect(
			createBadgeDefFn({ data: { name: "Founder" } }),
		).resolves.toEqual({ success: false, error: "Unauthorized" });

		expect(dbMock.insert).not.toHaveBeenCalled();
		expect(dbMock.delete).not.toHaveBeenCalled();
	});

	it("creates a badge definition and logs the mod action", async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(admin);
		const created = { id: 1, name: "Founder", description: "Was here first" };
		const defInsert = createInsertReturningChain([created]);
		const logInsert = createInsertChain();
		dbMock.insert.mockReturnValueOnce(defInsert).mockReturnValueOnce(logInsert);

		await expect(
			createBadgeDefFn({
				data: { name: " Founder ", description: " Was here first " },
			}),
		).resolves.toEqual({ success: true, badgeDef: created });

		expect(defInsert.values).toHaveBeenCalledWith({
			name: "Founder",
			description: "Was here first",
		});
		expect(logInsert.values).toHaveBeenCalledWith({
			userId: 2,
			kind: "create_badge_def",
			note: '"Founder"',
		});
	});

	it("rejects empty badge names", async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(admin);

		await expect(createBadgeDefFn({ data: { name: "   " } })).resolves.toEqual({
			success: false,
			error: "Name is required",
		});
		expect(dbMock.insert).not.toHaveBeenCalled();
	});

	it("grants a badge to a user by username and logs the mod action", async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(admin);
		vi.mocked(getUserByUsernameCanonical).mockResolvedValue({
			id: 9,
			username: "alice",
		} as never);
		dbMock.select.mockReturnValueOnce(
			createSelectChain([{ id: 1, name: "Founder", description: null }]),
		);
		const grantInsert = createInsertConflictChain();
		const logInsert = createInsertChain();
		dbMock.insert
			.mockReturnValueOnce(grantInsert)
			.mockReturnValueOnce(logInsert);

		await expect(
			grantBadgeFn({ data: { username: "alice", badgeId: 1 } }),
		).resolves.toEqual({ success: true });

		expect(grantInsert.values).toHaveBeenCalledWith({
			badgeId: 1,
			userId: 9,
			description: null,
		});
		expect(logInsert.values).toHaveBeenCalledWith({
			userId: 2,
			targetUserId: 9,
			kind: "grant_badge",
			note: '"Founder"',
		});
	});

	it("reports missing users and badges on grant", async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(admin);

		vi.mocked(getUserByUsernameCanonical).mockResolvedValueOnce(null);
		await expect(
			grantBadgeFn({ data: { username: "ghost", badgeId: 1 } }),
		).resolves.toEqual({ success: false, error: "User not found" });

		vi.mocked(getUserByUsernameCanonical).mockResolvedValueOnce({
			id: 9,
			username: "alice",
		} as never);
		dbMock.select.mockReturnValueOnce(createSelectChain([]));
		await expect(
			grantBadgeFn({ data: { username: "alice", badgeId: 999 } }),
		).resolves.toEqual({ success: false, error: "Badge not found" });

		expect(dbMock.insert).not.toHaveBeenCalled();
	});

	it("revokes a badge and logs the mod action", async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(admin);
		vi.mocked(getUserByUsernameCanonical).mockResolvedValue({
			id: 9,
			username: "alice",
		} as never);
		const deleteChain = { where: vi.fn().mockResolvedValue(undefined) };
		dbMock.delete.mockReturnValueOnce(deleteChain);
		const logInsert = createInsertChain();
		dbMock.insert.mockReturnValueOnce(logInsert);

		await expect(
			revokeBadgeFn({ data: { username: "alice", badgeId: 1 } }),
		).resolves.toEqual({ success: true });

		expect(dbMock.delete).toHaveBeenCalledTimes(1);
		expect(logInsert.values).toHaveBeenCalledWith({
			userId: 2,
			targetUserId: 9,
			kind: "revoke_badge",
			note: "badge #1",
		});
	});

	it("rejects awards from logged-out users and unknown kinds", async () => {
		vi.mocked(getCurrentUser).mockResolvedValueOnce(null);
		await expect(
			awardContentFn({ data: { submissionId: 1, kind: "gold" } }),
		).resolves.toEqual({ success: false, error: "Not logged in" });

		vi.mocked(getCurrentUser).mockResolvedValue(regular);
		await expect(
			awardContentFn({ data: { submissionId: 1, kind: "nuke" } }),
		).resolves.toEqual({ success: false, error: "Unknown award" });

		expect(dbMock.insert).not.toHaveBeenCalled();
	});

	it("requires exactly one target", async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(regular);

		await expect(awardContentFn({ data: { kind: "gold" } })).resolves.toEqual({
			success: false,
			error: "Award exactly one post or comment",
		});
		await expect(
			awardContentFn({ data: { submissionId: 1, commentId: 2, kind: "gold" } }),
		).resolves.toEqual({
			success: false,
			error: "Award exactly one post or comment",
		});
	});

	it("awards a post, recording the relationship and bumping the author's count", async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(regular);
		dbMock.select.mockReturnValueOnce(createSelectChain([{ authorId: 9 }]));
		const relInsert = createInsertChain();
		dbMock.insert.mockReturnValueOnce(relInsert);
		const counterUpdate = createUpdateChain();
		dbMock.update.mockReturnValueOnce(counterUpdate);

		await expect(
			awardContentFn({ data: { submissionId: 42, kind: "gold" } }),
		).resolves.toEqual({ success: true });

		expect(relInsert.values).toHaveBeenCalledWith({
			userId: 5,
			submissionId: 42,
			commentId: null,
			kind: "gold",
		});
		expect(counterUpdate.set).toHaveBeenCalledWith({
			receivedAwardCount: expect.anything(),
		});
	});

	it("awards a comment and reports missing content", async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(regular);

		dbMock.select.mockReturnValueOnce(createSelectChain([]));
		await expect(
			awardContentFn({ data: { commentId: 7, kind: "silver" } }),
		).resolves.toEqual({ success: false, error: "Content not found" });
		expect(dbMock.insert).not.toHaveBeenCalled();

		dbMock.select.mockReturnValueOnce(createSelectChain([{ authorId: 3 }]));
		const relInsert = createInsertChain();
		dbMock.insert.mockReturnValueOnce(relInsert);
		dbMock.update.mockReturnValueOnce(createUpdateChain());

		await expect(
			awardContentFn({ data: { commentId: 7, kind: "silver" } }),
		).resolves.toEqual({ success: true });
		expect(relInsert.values).toHaveBeenCalledWith({
			userId: 5,
			submissionId: null,
			commentId: 7,
			kind: "silver",
		});
	});
});

import {
	awardContentInputSchema,
	grantBadgeInputSchema,
} from "@/lib/award-actions.server";

describe("award-actions input schemas", () => {
	it("rejects invalid award/badge inputs", () => {
		expect(
			grantBadgeInputSchema.safeParse({ username: "", badgeId: 1 }).success,
		).toBe(false);
		expect(
			grantBadgeInputSchema.safeParse({ username: "alice", badgeId: 0 })
				.success,
		).toBe(false);
		expect(
			awardContentInputSchema.safeParse({ submissionId: 1, kind: "" }).success,
		).toBe(false);
	});

	it("accepts valid award/badge inputs", () => {
		expect(
			grantBadgeInputSchema.safeParse({ username: "alice", badgeId: 2 })
				.success,
		).toBe(true);
	});
});
