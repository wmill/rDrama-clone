import {
	type CommentFeedSortType,
	CommentSortTypes,
	type SortType,
	SortTypes,
	type TimeFilter,
	TimeFilters,
} from "@/lib/constants";

export type ProfileCommentsSearch = {
	sort: CommentFeedSortType;
	t: TimeFilter;
	page: number;
};

export type ProfilePostsSearch = {
	sort: SortType;
	t: TimeFilter;
	page: number;
};

export type ProfileRelationshipSearch = {
	page: number;
};

export const DEFAULT_COMMENTS_PROFILE_SEARCH: ProfileCommentsSearch = {
	sort: "new",
	t: "all",
	page: 1,
};

export const DEFAULT_POSTS_PROFILE_SEARCH: ProfilePostsSearch = {
	sort: "hot",
	t: "all",
	page: 1,
};

export const DEFAULT_RELATIONSHIP_PROFILE_SEARCH: ProfileRelationshipSearch = {
	page: 1,
};

export function parseProfileTime(value: unknown): TimeFilter {
	if (typeof value === "string" && TimeFilters.includes(value as TimeFilter)) {
		return value as TimeFilter;
	}
	return "all";
}

export function parseCommentsProfileSort(value: unknown): CommentFeedSortType {
	if (
		typeof value === "string" &&
		CommentSortTypes.includes(value as CommentFeedSortType)
	) {
		return value as CommentFeedSortType;
	}
	return "new";
}

export function parsePostsProfileSort(value: unknown): SortType {
	if (typeof value === "string" && SortTypes.includes(value as SortType)) {
		return value as SortType;
	}
	return "hot";
}

export function parseProfilePage(value: unknown): number {
	const parsed = Number(value);
	if (Number.isFinite(parsed) && parsed > 0) {
		return Math.floor(parsed);
	}
	return 1;
}

export function parseCommentsProfileSearch(
	search: Record<string, unknown>,
): ProfileCommentsSearch {
	return {
		sort: parseCommentsProfileSort(search.sort),
		t: parseProfileTime(search.t),
		page: parseProfilePage(search.page),
	};
}

export function parsePostsProfileSearch(
	search: Record<string, unknown>,
): ProfilePostsSearch {
	return {
		sort: parsePostsProfileSort(search.sort),
		t: parseProfileTime(search.t),
		page: parseProfilePage(search.page),
	};
}

export function parseRelationshipProfileSearch(
	search: Record<string, unknown>,
): ProfileRelationshipSearch {
	return {
		page: parseProfilePage(search.page),
	};
}

function buildSearchParams(search: {
	sort: string;
	t: TimeFilter;
	page: number;
}) {
	return new URLSearchParams({
		sort: search.sort,
		t: search.t,
		page: String(search.page),
	});
}

export function buildProfileCommentsHref(
	username: string,
	search: ProfileCommentsSearch,
): string {
	return `/u/${encodeURIComponent(username)}?${buildSearchParams(search).toString()}`;
}

export function buildProfilePostsHref(
	username: string,
	search: ProfilePostsSearch,
): string {
	return `/u/${encodeURIComponent(username)}/posts?${buildSearchParams(search).toString()}`;
}

export function buildProfileSavedCommentsHref(
	username: string,
	search: ProfileCommentsSearch,
): string {
	return `/u/${encodeURIComponent(username)}/saved/comments?${buildSearchParams(search).toString()}`;
}

export function buildProfileSavedPostsHref(
	username: string,
	search: ProfilePostsSearch,
): string {
	return `/u/${encodeURIComponent(username)}/saved/posts?${buildSearchParams(search).toString()}`;
}

export function buildProfileFollowersHref(
	username: string,
	search: ProfileRelationshipSearch,
): string {
	return `/u/${encodeURIComponent(username)}/followers?page=${search.page}`;
}

export function buildProfileFollowingHref(
	username: string,
	search: ProfileRelationshipSearch,
): string {
	return `/u/${encodeURIComponent(username)}/following?page=${search.page}`;
}
