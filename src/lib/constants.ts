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
		label: "Signups enabled",
		description: "When off, new account registration is rejected.",
		defaultValue: true,
	},
	{
		key: "read_only",
		label: "Read-only mode",
		description:
			"When on, posting, commenting, and voting are disabled site-wide.",
		defaultValue: false,
	},
] as const;
export type SiteSettingKey = (typeof SITE_SETTINGS)[number]["key"];

export const AWARD_OPTIONS = [
	{
		kind: "gold",
		title: "Gold",
		description: "A shiny token of appreciation.",
	},
	{
		kind: "silver",
		title: "Silver",
		description: "A classic nod of approval.",
	},
	{
		kind: "trophy",
		title: "Trophy",
		description: "For an outstanding contribution.",
	},
] as const;
export type AwardKind = (typeof AWARD_OPTIONS)[number]["kind"];

// Sliding-window rate limits enforced via src/lib/rate-limit.server.ts.
export const RATE_LIMITS = {
	login: { limit: 10, windowSeconds: 5 * 60 },
	signup: { limit: 5, windowSeconds: 60 * 60 },
	password_reset_request: { limit: 3, windowSeconds: 15 * 60 },
	password_reset_consume: { limit: 10, windowSeconds: 15 * 60 },
	create_post: { limit: 6, windowSeconds: 10 * 60 },
	create_comment: { limit: 20, windowSeconds: 10 * 60 },
	vote: { limit: 60, windowSeconds: 60 },
} as const;
export type RateLimitName = keyof typeof RATE_LIMITS;
