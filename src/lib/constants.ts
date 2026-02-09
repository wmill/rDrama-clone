
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
