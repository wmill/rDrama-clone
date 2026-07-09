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
