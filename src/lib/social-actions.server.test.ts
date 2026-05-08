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
	getCurrentUser: vi.fn(),
}));

vi.mock("@/lib/social.server", () => ({
	setBlockState: vi.fn(),
	setFollowState: vi.fn(),
}));

import type { SafeUser } from "@/lib/auth.server";
import { getCurrentUser } from "@/lib/sessions.server";
import { setBlockState, setFollowState } from "@/lib/social.server";
import { setBlockStateFn, setFollowStateFn } from "@/lib/social-actions.server";

const mockUser: SafeUser = {
	id: 5,
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

describe("social-actions.server", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("rejects anonymous social actions", async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(null);

		await expect(
			setFollowStateFn({ data: { targetUserId: 9, following: true } }),
		).resolves.toEqual({
			success: false,
			error: "Not logged in",
		});
		await expect(
			setBlockStateFn({ data: { targetUserId: 9, blocked: true } }),
		).resolves.toEqual({
			success: false,
			error: "Not logged in",
		});
	});

	it("delegates social actions for logged-in users", async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(mockUser);

		await expect(
			setFollowStateFn({ data: { targetUserId: 9, following: false } }),
		).resolves.toEqual({
			success: true,
		});
		await expect(
			setBlockStateFn({ data: { targetUserId: 9, blocked: true } }),
		).resolves.toEqual({
			success: true,
		});

		expect(setFollowState).toHaveBeenCalledWith({
			userId: 5,
			targetUserId: 9,
			following: false,
		});
		expect(setBlockState).toHaveBeenCalledWith({
			userId: 5,
			targetUserId: 9,
			blocked: true,
		});
	});

	it("returns helper errors to the caller", async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
		vi.mocked(setFollowState).mockRejectedValue(new Error("no self-follow"));
		vi.mocked(setBlockState).mockRejectedValue(new Error("no self-block"));

		await expect(
			setFollowStateFn({ data: { targetUserId: 5, following: true } }),
		).resolves.toEqual({
			success: false,
			error: "no self-follow",
		});
		await expect(
			setBlockStateFn({ data: { targetUserId: 5, blocked: true } }),
		).resolves.toEqual({
			success: false,
			error: "no self-block",
		});
	});
});
