import { beforeEach, describe, expect, it, vi } from "vitest";

const { redisMock } = vi.hoisted(() => ({
	redisMock: {
		get: vi.fn(),
		set: vi.fn(),
	},
}));

vi.mock("@/lib/redis", () => ({ redis: redisMock }));

import {
	getAllSiteSettings,
	getSiteSetting,
	isSiteReadOnly,
	setSiteSetting,
} from "@/lib/site-settings.server";

describe("site-settings.server", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("falls back to defaults when a setting has never been written", async () => {
		redisMock.get.mockResolvedValue(null);

		await expect(getSiteSetting("signups_enabled")).resolves.toBe(true);
		await expect(getSiteSetting("read_only")).resolves.toBe(false);
	});

	it("reads stored values over defaults", async () => {
		redisMock.get.mockResolvedValueOnce("0");
		await expect(getSiteSetting("signups_enabled")).resolves.toBe(false);

		redisMock.get.mockResolvedValueOnce("1");
		await expect(getSiteSetting("read_only")).resolves.toBe(true);
	});

	it("writes settings under a namespaced key", async () => {
		await setSiteSetting("read_only", true);
		expect(redisMock.set).toHaveBeenCalledWith("site_setting:read_only", "1");

		await setSiteSetting("signups_enabled", false);
		expect(redisMock.set).toHaveBeenCalledWith(
			"site_setting:signups_enabled",
			"0",
		);
	});

	it("returns every defined setting from getAllSiteSettings", async () => {
		redisMock.get.mockResolvedValue(null);

		await expect(getAllSiteSettings()).resolves.toEqual({
			signups_enabled: true,
			read_only: false,
		});
	});

	it("exposes read-only state through isSiteReadOnly", async () => {
		redisMock.get.mockResolvedValueOnce("1");
		await expect(isSiteReadOnly()).resolves.toBe(true);

		redisMock.get.mockResolvedValueOnce(null);
		await expect(isSiteReadOnly()).resolves.toBe(false);
	});
});
