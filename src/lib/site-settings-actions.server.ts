import { createServerFn } from "@tanstack/react-start";

import { db } from "@/db";
import { modActions } from "@/db/schema";
import { SITE_SETTINGS, type SiteSettingKey } from "@/lib/constants";
import { getCurrentUser } from "@/lib/sessions.server";
import { getAllSiteSettings, setSiteSetting } from "@/lib/site-settings.server";

export const getSiteSettingsFn = createServerFn({ method: "GET" }).handler(
	async () => {
		return getAllSiteSettings();
	},
);

export const updateSiteSettingFn = createServerFn({ method: "POST" })
	.inputValidator((data: { key: SiteSettingKey; value: boolean }) => data)
	.handler(async ({ data }) => {
		const user = await getCurrentUser();
		if (!user || user.adminLevel < 2) {
			return { success: false as const, error: "Unauthorized" };
		}

		if (!SITE_SETTINGS.some((setting) => setting.key === data.key)) {
			return { success: false as const, error: "Unknown setting" };
		}

		await setSiteSetting(data.key, data.value);

		await db.insert(modActions).values({
			userId: user.id,
			kind: "update_site_setting",
			note: `${data.key} = ${data.value ? "on" : "off"}`,
		});

		return { success: true as const, key: data.key, value: data.value };
	});
