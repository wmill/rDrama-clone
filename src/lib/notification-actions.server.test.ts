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

vi.mock("@/lib/notifications.server", () => ({
	clearReadNotifications: vi.fn(),
	markAllNotificationsRead: vi.fn(),
	markNotificationRead: vi.fn(),
}));

import type { SafeUser } from "@/lib/auth.server";
import {
	clearReadNotificationsFn,
	markAllNotificationsReadFn,
	markNotificationReadFn,
} from "@/lib/notification-actions.server";
import {
	clearReadNotifications,
	markAllNotificationsRead,
	markNotificationRead,
} from "@/lib/notifications.server";
import { getCurrentUser } from "@/lib/sessions.server";

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

describe("notification-actions.server", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("rejects anonymous notification actions", async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(null);

		await expect(
			markNotificationReadFn({ data: { commentId: 4 } }),
		).resolves.toEqual({
			success: false,
			error: "Not logged in",
		});
		await expect(markAllNotificationsReadFn()).resolves.toEqual({
			success: false,
			error: "Not logged in",
		});
		await expect(clearReadNotificationsFn()).resolves.toEqual({
			success: false,
			error: "Not logged in",
		});
	});

	it("delegates logged-in notification actions", async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(mockUser);

		await expect(
			markNotificationReadFn({ data: { commentId: 4 } }),
		).resolves.toEqual({
			success: true,
		});
		await expect(markAllNotificationsReadFn()).resolves.toEqual({
			success: true,
		});
		await expect(clearReadNotificationsFn()).resolves.toEqual({
			success: true,
		});

		expect(markNotificationRead).toHaveBeenCalledWith({
			userId: 11,
			commentId: 4,
		});
		expect(markAllNotificationsRead).toHaveBeenCalledWith(11);
		expect(clearReadNotifications).toHaveBeenCalledWith(11);
	});
});

import { markNotificationReadInputSchema } from "@/lib/notification-actions.server";

describe("notification-actions input schemas", () => {
	it("rejects invalid comment ids", () => {
		expect(
			markNotificationReadInputSchema.safeParse({ commentId: -5 }).success,
		).toBe(false);
		expect(markNotificationReadInputSchema.safeParse({}).success).toBe(false);
	});

	it("accepts a valid comment id", () => {
		expect(
			markNotificationReadInputSchema.safeParse({ commentId: 5 }).success,
		).toBe(true);
	});
});
