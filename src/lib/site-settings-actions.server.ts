import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { db } from "@/db";
import { modActions } from "@/db/schema";
import { assertAdmin, fail, requireAdmin } from "@/lib/auth-guards.server";
import { SITE_SETTINGS, type SiteSettingKey } from "@/lib/constants";
import { getAllSiteSettings, setSiteSetting } from "@/lib/site-settings.server";

export const updateSiteSettingInputSchema = z
	.object({
		key: z.enum(
			SITE_SETTINGS.map((setting) => setting.key) as [
				SiteSettingKey,
				...SiteSettingKey[],
			],
		),
		value: z.union([z.boolean(), z.number().int()]),
	})
	.superRefine((data, ctx) => {
		const setting = SITE_SETTINGS.find(
			(candidate) => candidate.key === data.key,
		);
		if (!setting) return;
		if (setting.type === "boolean" && typeof data.value !== "boolean") {
			ctx.addIssue({
				code: "custom",
				path: ["value"],
				message: "Expected a boolean",
			});
		}
		if (setting.type === "integer") {
			if (
				typeof data.value !== "number" ||
				data.value < setting.min ||
				data.value > setting.max
			) {
				ctx.addIssue({
					code: "custom",
					path: ["value"],
					message: `Expected an integer from ${setting.min} to ${setting.max}`,
				});
			}
		}
	});

export const getSiteSettingsFn = createServerFn({ method: "GET" }).handler(
	async () => {
		await assertAdmin();
		return getAllSiteSettings();
	},
);

export const updateSiteSettingFn = createServerFn({ method: "POST" })
	.inputValidator((data: { key: SiteSettingKey; value: boolean | number }) =>
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

		await setSiteSetting(data.key, data.value as never);

		await db.insert(modActions).values({
			userId: user.id,
			kind: "update_site_setting",
			note: `${data.key} = ${typeof data.value === "boolean" ? (data.value ? "on" : "off") : data.value}`,
		});

		return { success: true as const, key: data.key, value: data.value };
	});
