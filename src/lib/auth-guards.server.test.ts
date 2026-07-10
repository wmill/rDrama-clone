import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/sessions.server", () => ({
	getCurrentUser: vi.fn(),
}));

import type { SafeUser } from "@/lib/auth.server";
import {
	assertAdmin,
	NOT_LOGGED_IN_ERROR,
	requireAdmin,
	requireUser,
	UNAUTHORIZED_ERROR,
} from "@/lib/auth-guards.server";
import { getCurrentUser } from "@/lib/sessions.server";

const mockUser: SafeUser = {
	id: 7,
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

describe("auth-guards.server", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("requireUser", () => {
		it("fails when logged out", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(null);

			await expect(requireUser()).resolves.toEqual({
				ok: false,
				failure: { success: false, error: NOT_LOGGED_IN_ERROR },
			});
		});

		it("returns the user when logged in", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);

			await expect(requireUser()).resolves.toEqual({
				ok: true,
				user: mockUser,
			});
		});
	});

	describe("requireAdmin", () => {
		it("fails when logged out", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(null);

			await expect(requireAdmin()).resolves.toEqual({
				ok: false,
				failure: { success: false, error: UNAUTHORIZED_ERROR },
			});
		});

		it("fails for users below the required admin level", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue({
				...mockUser,
				adminLevel: 1,
			});

			await expect(requireAdmin()).resolves.toEqual({
				ok: false,
				failure: { success: false, error: UNAUTHORIZED_ERROR },
			});
		});

		it("returns the user at or above the required admin level", async () => {
			const admin = { ...mockUser, adminLevel: 2 };
			vi.mocked(getCurrentUser).mockResolvedValue(admin);

			await expect(requireAdmin()).resolves.toEqual({ ok: true, user: admin });
		});

		it("honors a custom minimum admin level", async () => {
			const janny = { ...mockUser, adminLevel: 1 };
			vi.mocked(getCurrentUser).mockResolvedValue(janny);

			await expect(requireAdmin(1)).resolves.toEqual({
				ok: true,
				user: janny,
			});
		});
	});

	describe("assertAdmin", () => {
		it("throws for non-admin callers", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);

			await expect(assertAdmin()).rejects.toThrow(UNAUTHORIZED_ERROR);
		});

		it("returns the user for admin callers", async () => {
			const admin = { ...mockUser, adminLevel: 2 };
			vi.mocked(getCurrentUser).mockResolvedValue(admin);

			await expect(assertAdmin()).resolves.toEqual(admin);
		});
	});
});
