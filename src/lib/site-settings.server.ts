import {
	SITE_SETTINGS,
	type SiteSettingKey,
	type SiteSettingValue,
} from "@/lib/constants";
import { redis } from "@/lib/redis";

const REDIS_PREFIX = "site_setting:";

export const READ_ONLY_MESSAGE =
	"The site is currently in read-only mode. Try again later.";
export const SIGNUPS_DISABLED_MESSAGE = "Signups are currently disabled.";

function metadataFor(key: SiteSettingKey) {
	return SITE_SETTINGS.find((setting) => setting.key === key);
}

export async function getSiteSetting<K extends SiteSettingKey>(
	key: K,
): Promise<SiteSettingValue<K>> {
	const metadata = metadataFor(key);
	if (!metadata) throw new Error(`Unknown site setting: ${key}`);
	const raw = await redis.get(`${REDIS_PREFIX}${key}`);
	if (raw === null) return metadata.defaultValue as SiteSettingValue<K>;
	return (
		metadata.type === "boolean" ? raw === "1" : Number(raw)
	) as SiteSettingValue<K>;
}

export async function setSiteSetting<K extends SiteSettingKey>(
	key: K,
	value: SiteSettingValue<K>,
): Promise<void> {
	const metadata = metadataFor(key);
	if (!metadata) throw new Error(`Unknown site setting: ${key}`);
	await redis.set(
		`${REDIS_PREFIX}${key}`,
		metadata.type === "boolean" ? (value ? "1" : "0") : String(value),
	);
}

export async function getAllSiteSettings(): Promise<{
	[K in SiteSettingKey]: SiteSettingValue<K>;
}> {
	const entries = await Promise.all(
		SITE_SETTINGS.map(
			async (setting) =>
				[setting.key, await getSiteSetting(setting.key)] as const,
		),
	);
	return Object.fromEntries(entries) as unknown as {
		[K in SiteSettingKey]: SiteSettingValue<K>;
	};
}

export async function isSiteReadOnly(): Promise<boolean> {
	return getSiteSetting("read_only");
}
