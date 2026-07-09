import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-start", () => ({
	createServerFn: () => {
		const chain = {
			inputValidator: () => chain,
			handler: (handler: unknown) => handler,
		};
		return chain;
	},
}));

vi.mock("@/lib/sessions.server", () => ({
	deleteOtherUserSessions: vi.fn(),
	getCurrentUser: vi.fn(),
	getSessionIdFromCookie: vi.fn(),
	listUserSessions: vi.fn(),
}));

import type { SafeUser } from "@/lib/auth.server";
import {
	listSessionsFn,
	logoutOtherSessionsFn,
} from "@/lib/session-actions.server";
import {
	deleteOtherUserSessions,
	getCurrentUser,
	getSessionIdFromCookie,
	listUserSessions,
} from "@/lib/sessions.server";

const mockUser: SafeUser = {
	id: 11,
	username: "alice",
	email: "alice@example.com",
	adminLevel: 0,
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

describe("listSessionsFn", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("rejects logged-out callers", async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(null);

		await expect(listSessionsFn()).resolves.toEqual({
			success: false,
			error: "Not logged in",
		});
		expect(listUserSessions).not.toHaveBeenCalled();
	});

	it("returns sessions with truncated ids, never the full token", async () => {
		const fullId = "a".repeat(64);
		vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
		vi.mocked(getSessionIdFromCookie).mockReturnValue(fullId);
		vi.mocked(listUserSessions).mockResolvedValue([
			{
				id: fullId,
				createdAt: new Date("2026-07-09T00:00:00.000Z"),
				userAgent: "phone",
				ipAddress: "10.0.0.2",
				isCurrent: true,
			},
		]);

		const result = await listSessionsFn();

		expect(listUserSessions).toHaveBeenCalledWith(11, fullId);
		expect(result).toEqual({
			success: true,
			sessions: [
				{
					key: "aaaaaaaa",
					createdAt: "2026-07-09T00:00:00.000Z",
					userAgent: "phone",
					ipAddress: "10.0.0.2",
					isCurrent: true,
				},
			],
		});
		expect(JSON.stringify(result)).not.toContain(fullId);
	});
});

describe("logoutOtherSessionsFn", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("rejects logged-out callers", async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(null);

		await expect(logoutOtherSessionsFn()).resolves.toEqual({
			success: false,
			error: "Not logged in",
		});
		expect(deleteOtherUserSessions).not.toHaveBeenCalled();
	});

	it("fails safely when no session cookie is present", async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
		vi.mocked(getSessionIdFromCookie).mockReturnValue(undefined);

		await expect(logoutOtherSessionsFn()).resolves.toEqual({
			success: false,
			error: "No active session",
		});
		expect(deleteOtherUserSessions).not.toHaveBeenCalled();
	});

	it("invalidates every session except the current one", async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
		vi.mocked(getSessionIdFromCookie).mockReturnValue("current-session");
		vi.mocked(deleteOtherUserSessions).mockResolvedValue(3);

		await expect(logoutOtherSessionsFn()).resolves.toEqual({
			success: true,
			removed: 3,
		});
		expect(deleteOtherUserSessions).toHaveBeenCalledWith(11, "current-session");
	});
});
