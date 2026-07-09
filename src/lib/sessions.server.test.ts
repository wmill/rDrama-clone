import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
	const pipeline = {
		set: vi.fn(),
		sadd: vi.fn(),
		del: vi.fn(),
		srem: vi.fn(),
		exec: vi.fn(),
	};
	pipeline.set.mockReturnValue(pipeline);
	pipeline.sadd.mockReturnValue(pipeline);
	pipeline.del.mockReturnValue(pipeline);
	pipeline.srem.mockReturnValue(pipeline);

	return {
		redis: {
			get: vi.fn(),
			smembers: vi.fn(),
			expire: vi.fn(),
			pipeline: vi.fn(() => pipeline),
		},
		pipeline,
		db: {
			select: vi.fn(),
		},
		getCookie: vi.fn(),
		setCookie: vi.fn(),
		getRequest: vi.fn(() => {
			throw new Error("no request");
		}),
	};
});

vi.mock("@/db", () => ({ db: mocks.db }));
vi.mock("@/lib/redis", () => ({ redis: mocks.redis }));
vi.mock("@tanstack/react-start/server", () => ({
	getCookie: mocks.getCookie,
	setCookie: mocks.setCookie,
	getRequest: mocks.getRequest,
}));

import {
	createSession,
	deleteAllUserSessions,
	deleteSession,
	getCurrentUser,
	getSessionById,
	getUserFromSession,
} from "@/lib/sessions.server";

function sessionJson(userId: number) {
	return JSON.stringify({
		userId,
		createdAt: "2026-07-09T00:00:00.000Z",
		userAgent: "vitest",
		ipAddress: "127.0.0.1",
	});
}

function mockUserSelect(result: unknown) {
	mocks.db.select.mockReturnValueOnce({
		from: vi.fn(() => ({
			where: vi.fn(() => ({
				limit: vi.fn().mockResolvedValue(result),
			})),
		})),
	});
}

describe("sessions.server", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("creates a session keyed in Redis and tracked on the user's session set", async () => {
		const sessionId = await createSession(7, "vitest", "127.0.0.1");

		expect(sessionId).toMatch(/^[0-9a-f]{64}$/);
		expect(mocks.pipeline.set).toHaveBeenCalledWith(
			`session:${sessionId}`,
			expect.stringContaining('"userId":7'),
			"EX",
			30 * 24 * 60 * 60,
		);
		expect(mocks.pipeline.sadd).toHaveBeenCalledWith(
			"user_sessions:7",
			sessionId,
		);
		expect(mocks.pipeline.exec).toHaveBeenCalledTimes(1);
	});

	it("parses a stored session and returns null for a missing one", async () => {
		mocks.redis.get.mockResolvedValueOnce(sessionJson(7));
		await expect(getSessionById("abc")).resolves.toMatchObject({
			id: "abc",
			userId: 7,
			userAgent: "vitest",
			ipAddress: "127.0.0.1",
		});

		mocks.redis.get.mockResolvedValueOnce(null);
		await expect(getSessionById("expired")).resolves.toBeNull();
	});

	it("resolves the session's user as a sanitized user", async () => {
		mocks.redis.get.mockResolvedValueOnce(sessionJson(7));
		mockUserSelect([
			{
				id: 7,
				username: "alice",
				email: "alice@example.com",
				passhash: "secret-hash",
				adminLevel: 0,
				createdUtc: 100,
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
			},
		]);

		const user = await getUserFromSession("abc");

		expect(user).toMatchObject({ id: 7, username: "alice" });
		expect(user).not.toHaveProperty("passhash");
	});

	it("returns null when the session's user no longer exists", async () => {
		mocks.redis.get.mockResolvedValueOnce(sessionJson(7));
		mockUserSelect([]);

		await expect(getUserFromSession("abc")).resolves.toBeNull();
	});

	it("logout deletes the session key and removes it from the user's set", async () => {
		mocks.redis.get.mockResolvedValueOnce(sessionJson(7));

		await deleteSession("abc");

		expect(mocks.pipeline.del).toHaveBeenCalledWith("session:abc");
		expect(mocks.pipeline.srem).toHaveBeenCalledWith("user_sessions:7", "abc");
		expect(mocks.pipeline.exec).toHaveBeenCalledTimes(1);
	});

	it("deletes every session for a user in one sweep", async () => {
		mocks.redis.smembers.mockResolvedValueOnce(["s1", "s2"]);

		await deleteAllUserSessions(7);

		expect(mocks.pipeline.del).toHaveBeenCalledWith("session:s1");
		expect(mocks.pipeline.del).toHaveBeenCalledWith("session:s2");
		expect(mocks.pipeline.del).toHaveBeenCalledWith("user_sessions:7");
		expect(mocks.pipeline.exec).toHaveBeenCalledTimes(1);
	});

	it("skips Redis writes when the user has no sessions", async () => {
		mocks.redis.smembers.mockResolvedValueOnce([]);

		await deleteAllUserSessions(7);

		expect(mocks.redis.pipeline).not.toHaveBeenCalled();
	});

	it("getCurrentUser returns null without a session cookie", async () => {
		mocks.getCookie.mockReturnValueOnce(undefined);

		await expect(getCurrentUser()).resolves.toBeNull();
		expect(mocks.redis.get).not.toHaveBeenCalled();
	});

	it("getCurrentUser resolves the cookie's session to a user", async () => {
		mocks.getCookie.mockReturnValueOnce("abc");
		mocks.redis.get.mockResolvedValueOnce(sessionJson(7));
		mockUserSelect([
			{
				id: 7,
				username: "alice",
				email: null,
				passhash: "x",
				adminLevel: 0,
				createdUtc: 100,
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
			},
		]);

		await expect(getCurrentUser()).resolves.toMatchObject({
			id: 7,
			username: "alice",
		});
	});
});
