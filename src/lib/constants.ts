export const SortTypes = [
	"new",
	"hot",
	"top",
	"controversial",
	"comments",
] as const;
export type SortType = (typeof SortTypes)[number];

export const TimeFilters = [
	"hour",
	"day",
	"week",
	"month",
	"year",
	"all",
] as const;
export type TimeFilter = (typeof TimeFilters)[number];

export const CommentSortTypes = ["new", "top", "controversial"] as const;
export type CommentFeedSortType = (typeof CommentSortTypes)[number];

export const SITE_SETTINGS = [
	{
		key: "signups_enabled",
		type: "boolean",
		label: "Signups enabled",
		description: "When off, new account registration is rejected.",
		defaultValue: true,
	},
	{
		key: "read_only",
		type: "boolean",
		label: "Read-only mode",
		description:
			"When on, posting, commenting, and voting are disabled site-wide.",
		defaultValue: false,
	},
	{
		key: "filter_new_posts",
		type: "boolean",
		label: "Filter new posts",
		description: "Send all new posts by non-admins to the filtered queue.",
		defaultValue: false,
	},
	{
		key: "filter_comments_min_age_days",
		type: "integer",
		label: "Minimum account age for comments",
		description: "Automatically filter comments from newer accounts (days).",
		defaultValue: 0,
		min: 0,
		max: 3650,
	},
	{
		key: "filter_comments_min_comments",
		type: "integer",
		label: "Minimum comment count",
		description: "Automatically filter comments from users below this count.",
		defaultValue: 0,
		min: 0,
		max: 1000000,
	},
	{
		key: "filter_comments_min_karma",
		type: "integer",
		label: "Minimum karma",
		description: "Automatically filter comments from users below this karma.",
		defaultValue: 0,
		min: -1000000,
		max: 1000000,
	},
] as const;
export type SiteSettingKey = (typeof SITE_SETTINGS)[number]["key"];
export type SiteSettingValue<K extends SiteSettingKey = SiteSettingKey> =
	Extract<(typeof SITE_SETTINGS)[number], { key: K }>["type"] extends "boolean"
		? boolean
		: number;

export const AWARD_OPTIONS = [
	{
		kind: "gold",
		title: "Gold",
		description: "A shiny token of appreciation.",
		icon: "🥇",
	},
	{
		kind: "silver",
		title: "Silver",
		description: "A classic nod of approval.",
		icon: "🥈",
	},
	{
		kind: "trophy",
		title: "Trophy",
		description: "For an outstanding contribution.",
		icon: "🏆",
	},
] as const;
export type AwardKind = (typeof AWARD_OPTIONS)[number]["kind"];

// Sliding-window rate limits enforced via src/lib/rate-limit.server.ts.
export const RATE_LIMITS = {
	login: { limit: 10, windowSeconds: 5 * 60 },
	signup: { limit: 5, windowSeconds: 60 * 60 },
	password_reset_request: { limit: 3, windowSeconds: 15 * 60 },
	password_reset_consume: { limit: 10, windowSeconds: 15 * 60 },
	account_password_change: { limit: 5, windowSeconds: 15 * 60 },
	account_username_change: { limit: 3, windowSeconds: 24 * 60 * 60 },
	email_verification_resend: { limit: 3, windowSeconds: 15 * 60 },
	email_change_request: { limit: 3, windowSeconds: 15 * 60 },
	create_post: { limit: 6, windowSeconds: 10 * 60 },
	create_comment: { limit: 20, windowSeconds: 10 * 60 },
	vote: { limit: 60, windowSeconds: 60 },
} as const;
export type RateLimitName = keyof typeof RATE_LIMITS;
