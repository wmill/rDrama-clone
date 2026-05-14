export type SearchResultType = "posts" | "comments";

export type PublicSearchResults<T> = {
	results: T[];
	hasNextPage: boolean;
	isAvailable: boolean;
};

export function parseSearchType(value: unknown): SearchResultType {
	return value === "comments" ? "comments" : "posts";
}

export function parseSearchPage(value: unknown): number {
	const parsed = Number(value);
	if (Number.isFinite(parsed) && parsed > 0) {
		return Math.floor(parsed);
	}

	return 1;
}

export function parseSearchQuery(value: unknown): string {
	return typeof value === "string" ? value : "";
}

export function parsePublicSearchParams(search: Record<string, unknown>) {
	return {
		q: parseSearchQuery(search.q),
		type: parseSearchType(search.type),
		page: parseSearchPage(search.page),
	};
}
