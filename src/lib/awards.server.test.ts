import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({
	db: {
		select: vi.fn(),
	},
}));

import { db } from "@/db";
import {
	getCommentAwardCounts,
	getSubmissionAwardCounts,
} from "@/lib/awards.server";

function createGroupByChain(result: unknown) {
	const chain = {
		from: vi.fn(() => chain),
		where: vi.fn(() => chain),
		groupBy: vi.fn().mockResolvedValue(result),
	};
	return chain;
}

describe("awards.server", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns an empty map without querying when there are no ids", async () => {
		const result = await getSubmissionAwardCounts([]);

		expect(result.size).toBe(0);
		expect(db.select).not.toHaveBeenCalled();
	});

	it("groups award counts by submission id", async () => {
		vi.mocked(db.select).mockReturnValueOnce(
			createGroupByChain([
				{ targetId: 1, kind: "gold", count: 2 },
				{ targetId: 1, kind: "trophy", count: 1 },
				{ targetId: 3, kind: "silver", count: 5 },
			]) as never,
		);

		const result = await getSubmissionAwardCounts([1, 3]);

		expect(result.get(1)).toEqual([
			{ kind: "gold", count: 2 },
			{ kind: "trophy", count: 1 },
		]);
		expect(result.get(3)).toEqual([{ kind: "silver", count: 5 }]);
		expect(result.has(2)).toBe(false);
	});

	it("sorts each target's awards in AWARD_OPTIONS display order with unknown kinds last", async () => {
		vi.mocked(db.select).mockReturnValueOnce(
			createGroupByChain([
				{ targetId: 9, kind: "mystery", count: 1 },
				{ targetId: 9, kind: "trophy", count: 1 },
				{ targetId: 9, kind: "gold", count: 1 },
			]) as never,
		);

		const result = await getCommentAwardCounts([9]);

		expect(result.get(9)?.map((award) => award.kind)).toEqual([
			"gold",
			"trophy",
			"mystery",
		]);
	});

	it("ignores rows with a null target id", async () => {
		vi.mocked(db.select).mockReturnValueOnce(
			createGroupByChain([
				{ targetId: null, kind: "gold", count: 4 },
				{ targetId: 2, kind: "silver", count: 1 },
			]) as never,
		);

		const result = await getCommentAwardCounts([2]);

		expect(result.size).toBe(1);
		expect(result.get(2)).toEqual([{ kind: "silver", count: 1 }]);
	});
});
