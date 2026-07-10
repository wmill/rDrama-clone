import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { db } from "@/db";
import { modActions } from "@/db/schema";
import { assertAdmin, fail, requireAdmin } from "@/lib/auth-guards.server";
import { SITE_SETTINGS, type SiteSettingKey } from "@/lib/constants";
import { getAllSiteSettings, setSiteSetting } from "@/lib/site-settings.server";

export const updateSiteSettingInputSchema = z.object({
	key: z.enum(
		SITE_SETTINGS.map((setting) => setting.key) as [
			SiteSettingKey,
			...SiteSettingKey[],
		],
	),
	value: z.boolean(),
});

export const getSiteSettingsFn = createServerFn({ method: "GET" }).handler(
	async () => {
		await assertAdmin();
		return getAllSiteSettings();
	},
);

export const updateSiteSettingFn = createServerFn({ method: "POST" })
	.inputValidator((data: { key: SiteSettingKey; value: boolean }) =>
		updateSiteSettingInputSchema.parse(data),
	)
	.handler(async ({ data }) => {
		const guard = await requireAdmin();
		if (!guard.ok) {
			return guard.failure;
		}
		const user = guard.user;

		if (!SITE_SETTINGS.some((setting) => setting.key === data.key)) {
			return fail("Unknown setting");
		}

		await setSiteSetting(data.key, data.value);

		await db.insert(modActions).values({
			userId: user.id,
			kind: "update_site_setting",
			note: `${data.key} = ${data.value ? "on" : "off"}`,
		});

		return { success: true as const, key: data.key, value: data.value };
	});
