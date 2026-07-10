import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock } = vi.hoisted(() => ({
	dbMock: {
		insert: vi.fn(),
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

vi.mock("@/db", () => ({ db: dbMock }));

vi.mock("@/lib/sessions.server", () => ({
	getCurrentUser: vi.fn(),
}));

vi.mock("@/lib/site-settings.server", () => ({
	getAllSiteSettings: vi.fn(),
	setSiteSetting: vi.fn(),
}));

import type { SafeUser } from "@/lib/auth.server";
import { getCurrentUser } from "@/lib/sessions.server";
import { getAllSiteSettings, setSiteSetting } from "@/lib/site-settings.server";
import {
	getSiteSettingsFn,
	updateSiteSettingFn,
} from "@/lib/site-settings-actions.server";

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

describe("site-settings-actions.server", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns all settings from the loader fn for admins", async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(admin);
		vi.mocked(getAllSiteSettings).mockResolvedValue({
			signups_enabled: true,
			read_only: false,
		});

		await expect(getSiteSettingsFn()).resolves.toEqual({
			signups_enabled: true,
			read_only: false,
		});
	});

	it("rejects the settings loader fn for non-admins and logged-out users", async () => {
		vi.mocked(getCurrentUser).mockResolvedValueOnce(null);
		await expect(getSiteSettingsFn()).rejects.toThrow("Unauthorized");

		vi.mocked(getCurrentUser).mockResolvedValueOnce({
			...admin,
			adminLevel: 0,
		});
		await expect(getSiteSettingsFn()).rejects.toThrow("Unauthorized");

		expect(getAllSiteSettings).not.toHaveBeenCalled();
	});

	it("rejects setting updates from non-admins and logged-out users", async () => {
		vi.mocked(getCurrentUser).mockResolvedValueOnce(null);
		await expect(
			updateSiteSettingFn({ data: { key: "read_only", value: true } }),
		).resolves.toEqual({ success: false, error: "Unauthorized" });

		vi.mocked(getCurrentUser).mockResolvedValueOnce({
			...admin,
			adminLevel: 0,
		});
		await expect(
			updateSiteSettingFn({ data: { key: "read_only", value: true } }),
		).resolves.toEqual({ success: false, error: "Unauthorized" });

		expect(setSiteSetting).not.toHaveBeenCalled();
	});

	it("rejects unknown setting keys", async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(admin);

		await expect(
			updateSiteSettingFn({
				data: { key: "self_destruct" as never, value: true },
			}),
		).resolves.toEqual({ success: false, error: "Unknown setting" });
		expect(setSiteSetting).not.toHaveBeenCalled();
	});

	it("writes the setting and logs a mod action", async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(admin);
		const logInsert = { values: vi.fn().mockResolvedValue(undefined) };
		dbMock.insert.mockReturnValueOnce(logInsert);

		await expect(
			updateSiteSettingFn({ data: { key: "read_only", value: true } }),
		).resolves.toEqual({ success: true, key: "read_only", value: true });

		expect(setSiteSetting).toHaveBeenCalledWith("read_only", true);
		expect(logInsert.values).toHaveBeenCalledWith({
			userId: 2,
			kind: "update_site_setting",
			note: "read_only = on",
		});
	});
});
