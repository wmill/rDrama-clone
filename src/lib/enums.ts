import {
	type CommentFeedSortType,
	CommentSortTypes,
	type SortType,
	SortTypes,
	type TimeFilter,
	TimeFilters,
} from "@/lib/constants";
import type { ModerationState } from "@/lib/lifecycle.server";
import type { VoteType } from "@/lib/votes.server";

// Safe parsers for enum-ish values coming from raw SQL rows, search params,
// or other untyped boundaries. Each returns its domain's neutral fallback
// instead of throwing.

export function parseEnum<T extends string>(
	values: readonly T[],
	value: unknown,
	fallback: T,
): T {
	return typeof value === "string" &&
		(values as readonly string[]).includes(value)
		? (value as T)
		: fallback;
}

export function parseVoteType(value: unknown): VoteType {
	return value === 1 || value === -1 ? value : 0;
}

export function parseModerationState(value: unknown): ModerationState {
	return value === "FILTERED" || value === "REMOVED" ? value : "VISIBLE";
}

export function parseSortType(value: unknown): SortType {
	return parseEnum(SortTypes, value, "hot");
}

export function parseTimeFilter(value: unknown): TimeFilter {
	return parseEnum(TimeFilters, value, "all");
}

export function parseCommentFeedSortType(value: unknown): CommentFeedSortType {
	return parseEnum(CommentSortTypes, value, "new");
}
