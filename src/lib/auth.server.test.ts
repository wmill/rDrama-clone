import bcrypt from "bcrypt";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({
	db: {
		select: vi.fn(),
		insert: vi.fn(),
		update: vi.fn(),
		delete: vi.fn(),
	},
}));

vi.mock("@/lib/site-settings.server", () => ({
	getSiteSetting: vi.fn().mockResolvedValue(true),
	SIGNUPS_DISABLED_MESSAGE: "Signups are currently disabled.",
}));

import { db } from "@/db";
import {
	authenticateUser,
	createUser,
	verifyPassword,
} from "@/lib/auth.server";
import { getSiteSetting } from "@/lib/site-settings.server";

const PASSWORD = "hunter22-strong";
let passhash: string;

beforeAll(async () => {
	// low cost factor keeps the suite fast; compare() accepts any cost
	passhash = await bcrypt.hash(PASSWORD, 4);
});

function createUserLookupChain(result: unknown) {
	return {
		from: vi.fn(() => ({
			where: vi.fn(() => ({
				limit: vi.fn().mockResolvedValue(result),
			})),
		})),
	};
}

function makeUserRow(overrides: Record<string, unknown> = {}) {
	return {
		id: 7,
		username: "alice",
		email: "alice@example.com",
		passhash,
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
		...overrides,
	};
}

describe("createUser", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(getSiteSetting).mockResolvedValue(true);
	});

	it("rejects signups while the signups_enabled toggle is off", async () => {
		vi.mocked(getSiteSetting).mockResolvedValue(false);

		await expect(
			createUser("newname", "new@example.com", PASSWORD),
		).resolves.toEqual({
			success: false,
			error: "Signups are currently disabled.",
		});
		expect(db.select).not.toHaveBeenCalled();
		expect(db.insert).not.toHaveBeenCalled();
	});

	function mockLookups(usernameMatch: unknown[], emailMatch: unknown[]) {
		vi.mocked(db.select)
			.mockReturnValueOnce(createUserLookupChain(usernameMatch) as never)
			.mockReturnValueOnce(createUserLookupChain(emailMatch) as never);
	}

	it("rejects a taken username", async () => {
		vi.mocked(db.select).mockReturnValueOnce(
			createUserLookupChain([makeUserRow()]) as never,
		);

		await expect(
			createUser("alice", "new@example.com", PASSWORD),
		).resolves.toEqual({
			success: false,
			error: "Username already taken",
		});
		expect(db.insert).not.toHaveBeenCalled();
	});

	it("rejects an already-registered email", async () => {
		mockLookups([], [makeUserRow()]);

		await expect(
			createUser("newname", "alice@example.com", PASSWORD),
		).resolves.toEqual({
			success: false,
			error: "Email already registered",
		});
	});

	it("rejects usernames outside 3-25 characters", async () => {
		mockLookups([], []);

		await expect(createUser("ab", "a@b.com", PASSWORD)).resolves.toEqual({
			success: false,
			error: "Username must be between 3 and 25 characters",
		});
	});

	it("rejects usernames with invalid characters", async () => {
		mockLookups([], []);

		await expect(createUser("bad name!", "a@b.com", PASSWORD)).resolves.toEqual(
			{
				success: false,
				error: "Username can only contain letters, numbers, and underscores",
			},
		);
	});

	it("rejects passwords shorter than 8 characters", async () => {
		mockLookups([], []);

		await expect(createUser("newname", "a@b.com", "short")).resolves.toEqual({
			success: false,
			error: "Password must be at least 8 characters",
		});
	});
});

describe("signup, login, and ban enforcement", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("signs up with a hashed password that then authenticates", async () => {
		let insertedValues: Record<string, unknown> = {};
		vi.mocked(db.select)
			.mockReturnValueOnce(createUserLookupChain([]) as never)
			.mockReturnValueOnce(createUserLookupChain([]) as never);
		vi.mocked(db.insert).mockReturnValueOnce({
			values: vi.fn((values: Record<string, unknown>) => {
				insertedValues = values;
				return {
					returning: vi
						.fn()
						.mockImplementation(async () => [
							makeUserRow({ id: 1, username: "newuser", ...values }),
						]),
				};
			}),
		} as never);

		const signup = await createUser(" newuser ", "NEW@Example.com", PASSWORD);

		expect(signup).toMatchObject({
			success: true,
			user: expect.objectContaining({
				username: "newuser",
				email: "new@example.com",
			}),
		});
		// stored hash must not be the raw password but must verify against it
		expect(insertedValues.passhash).not.toBe(PASSWORD);
		await expect(
			verifyPassword(PASSWORD, insertedValues.passhash as string),
		).resolves.toBe(true);

		// the same stored row now authenticates via username login
		vi.mocked(db.select).mockReturnValueOnce(
			createUserLookupChain([
				makeUserRow({ passhash: insertedValues.passhash }),
			]) as never,
		);
		await expect(authenticateUser("alice", PASSWORD)).resolves.toMatchObject({
			success: true,
			user: expect.objectContaining({ username: "alice" }),
		});
	});

	it("rejects unknown users and wrong passwords with the same error", async () => {
		vi.mocked(db.select).mockReturnValueOnce(
			createUserLookupChain([]) as never,
		);
		await expect(authenticateUser("ghost", PASSWORD)).resolves.toEqual({
			success: false,
			error: "Invalid username or password",
		});

		vi.mocked(db.select).mockReturnValueOnce(
			createUserLookupChain([makeUserRow()]) as never,
		);
		await expect(authenticateUser("alice", "wrong-password")).resolves.toEqual({
			success: false,
			error: "Invalid username or password",
		});
	});

	it("rejects permanently banned users (unbanUtc = 0)", async () => {
		vi.mocked(db.select).mockReturnValueOnce(
			createUserLookupChain([
				makeUserRow({ isBanned: 1, banReason: "spam", unbanUtc: 0 }),
			]) as never,
		);

		await expect(authenticateUser("alice", PASSWORD)).resolves.toEqual({
			success: false,
			error: "Account banned: spam",
		});
	});

	it("rejects users whose temporary ban is still active", async () => {
		const future = Math.floor(Date.now() / 1000) + 3600;
		vi.mocked(db.select).mockReturnValueOnce(
			createUserLookupChain([
				makeUserRow({ isBanned: 1, banReason: null, unbanUtc: future }),
			]) as never,
		);

		await expect(authenticateUser("alice", PASSWORD)).resolves.toEqual({
			success: false,
			error: "Account is banned",
		});
	});

	it("lets users back in after a temporary ban expires", async () => {
		const past = Math.floor(Date.now() / 1000) - 3600;
		vi.mocked(db.select).mockReturnValueOnce(
			createUserLookupChain([
				makeUserRow({ isBanned: 1, banReason: "cooled off", unbanUtc: past }),
			]) as never,
		);

		await expect(authenticateUser("alice", PASSWORD)).resolves.toMatchObject({
			success: true,
		});
	});

	it("authenticates by email when the identifier contains @", async () => {
		vi.mocked(db.select).mockReturnValueOnce(
			createUserLookupChain([makeUserRow()]) as never,
		);

		await expect(
			authenticateUser("ALICE@example.com", PASSWORD),
		).resolves.toMatchObject({ success: true });
	});
});

vi.mock("@/lib/rate-limit.server", () => ({
	enforceRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
	getClientIp: vi.fn().mockReturnValue(null),
}));

import { enforceRateLimit } from "@/lib/rate-limit.server";

describe("auth rate limiting", () => {
	beforeEach(() => {
		vi.mocked(enforceRateLimit).mockResolvedValue({ allowed: true });
	});

	it("rejects logins once the login rate limit is hit", async () => {
		vi.mocked(enforceRateLimit).mockResolvedValueOnce({
			allowed: false,
			error: "Too many attempts",
		});

		await expect(authenticateUser("alice", "hunter22")).resolves.toEqual({
			success: false,
			error: "Too many attempts",
		});
		expect(enforceRateLimit).toHaveBeenCalledWith("login", "alice");
	});

	it("rejects signups once the signup rate limit is hit", async () => {
		vi.mocked(enforceRateLimit).mockResolvedValueOnce({
			allowed: false,
			error: "Too many attempts",
		});

		await expect(
			createUser("newuser", "new@example.com", "password123"),
		).resolves.toEqual({ success: false, error: "Too many attempts" });
		expect(enforceRateLimit).toHaveBeenCalledWith("signup", "new@example.com");
	});
});
