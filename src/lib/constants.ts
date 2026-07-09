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
