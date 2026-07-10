import { inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import { awardRelationships } from "@/db/schema";
import { AWARD_OPTIONS } from "@/lib/constants";

export type AwardCount = {
	kind: string;
	count: number;
};

const KIND_DISPLAY_ORDER = new Map<string, number>(
	AWARD_OPTIONS.map((option, index) => [option.kind, index]),
);

function kindOrder(kind: string): number {
	return KIND_DISPLAY_ORDER.get(kind) ?? AWARD_OPTIONS.length;
}

async function getAwardCounts(
	column:
		| typeof awardRelationships.submissionId
		| typeof awardRelationships.commentId,
	ids: number[],
): Promise<Map<number, AwardCount[]>> {
	const countsByTarget = new Map<number, AwardCount[]>();
	if (ids.length === 0) {
		return countsByTarget;
	}

	const rows = await db
		.select({
			targetId: column,
			kind: awardRelationships.kind,
			count: sql<number>`count(*)::int`,
		})
		.from(awardRelationships)
		.where(inArray(column, ids))
		.groupBy(column, awardRelationships.kind);

	for (const row of rows) {
		if (row.targetId === null) continue;
		const counts = countsByTarget.get(row.targetId) ?? [];
		counts.push({ kind: row.kind, count: row.count });
		countsByTarget.set(row.targetId, counts);
	}

	for (const counts of countsByTarget.values()) {
		counts.sort((a, b) => kindOrder(a.kind) - kindOrder(b.kind));
	}

	return countsByTarget;
}

export async function getSubmissionAwardCounts(
	submissionIds: number[],
): Promise<Map<number, AwardCount[]>> {
	return getAwardCounts(awardRelationships.submissionId, submissionIds);
}

export async function getCommentAwardCounts(
	commentIds: number[],
): Promise<Map<number, AwardCount[]>> {
	return getAwardCounts(awardRelationships.commentId, commentIds);
}
