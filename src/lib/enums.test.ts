import { describe, expect, it } from "vitest";

import {
	parseCommentFeedSortType,
	parseModerationState,
	parseSortType,
	parseTimeFilter,
	parseVoteType,
} from "@/lib/enums";

describe("enum parsers", () => {
	it("parses vote types and falls back to 0", () => {
		expect(parseVoteType(1)).toBe(1);
		expect(parseVoteType(-1)).toBe(-1);
		expect(parseVoteType(0)).toBe(0);
		expect(parseVoteType(null)).toBe(0);
		expect(parseVoteType(undefined)).toBe(0);
		expect(parseVoteType(2)).toBe(0);
		expect(parseVoteType("1")).toBe(0);
	});

	it("parses moderation states and falls back to VISIBLE", () => {
		expect(parseModerationState("REMOVED")).toBe("REMOVED");
		expect(parseModerationState("FILTERED")).toBe("FILTERED");
		expect(parseModerationState("VISIBLE")).toBe("VISIBLE");
		expect(parseModerationState(null)).toBe("VISIBLE");
		expect(parseModerationState("NUKED")).toBe("VISIBLE");
	});

	it("parses sort/time enums with their neutral fallbacks", () => {
		expect(parseSortType("top")).toBe("top");
		expect(parseSortType("bogus")).toBe("hot");
		expect(parseTimeFilter("week")).toBe("week");
		expect(parseTimeFilter(7)).toBe("all");
		expect(parseCommentFeedSortType("controversial")).toBe("controversial");
		expect(parseCommentFeedSortType(undefined)).toBe("new");
	});
});
