import { SITE_SETTINGS, type SiteSettingKey } from "@/lib/constants";
import { redis } from "@/lib/redis";

const REDIS_PREFIX = "site_setting:";

export const READ_ONLY_MESSAGE =
	"The site is currently in read-only mode. Try again later.";
export const SIGNUPS_DISABLED_MESSAGE = "Signups are currently disabled.";

function defaultFor(key: SiteSettingKey): boolean {
	return (
		SITE_SETTINGS.find((setting) => setting.key === key)?.defaultValue ?? false
	);
}

export async function getSiteSetting(key: SiteSettingKey): Promise<boolean> {
	const raw = await redis.get(`${REDIS_PREFIX}${key}`);
	return raw === null ? defaultFor(key) : raw === "1";
}

export async function setSiteSetting(
	key: SiteSettingKey,
	value: boolean,
): Promise<void> {
	await redis.set(`${REDIS_PREFIX}${key}`, value ? "1" : "0");
}

export async function getAllSiteSettings(): Promise<
	Record<SiteSettingKey, boolean>
> {
	const entries = await Promise.all(
		SITE_SETTINGS.map(
			async (setting) =>
				[setting.key, await getSiteSetting(setting.key)] as const,
		),
	);
	return Object.fromEntries(entries) as Record<SiteSettingKey, boolean>;
}

export async function isSiteReadOnly(): Promise<boolean> {
	return getSiteSetting("read_only");
}
