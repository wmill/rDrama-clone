import { createServerFn } from "@tanstack/react-start";

import { enforceRateLimit } from "@/lib/rate-limit.server";
import { getCurrentUser } from "@/lib/sessions.server";
import { isSiteReadOnly, READ_ONLY_MESSAGE } from "@/lib/site-settings.server";
import {
	commentVoteInputSchema,
	submissionVoteInputSchema,
} from "@/lib/validation";
import {
	type VoteResult,
	type VoteType,
	voteOnComment,
	voteOnSubmission,
} from "@/lib/votes.server";

const NO_VOTE: VoteType = 0;

function voteFailure(error: string): VoteResult {
	return {
		success: false,
		error,
		newScore: 0,
		userVote: NO_VOTE,
	};
}

async function authorizeVote(): Promise<
	{ ok: true; userId: number } | { ok: false; result: VoteResult }
> {
	const user = await getCurrentUser();
	if (!user) {
		return { ok: false, result: voteFailure("Not logged in") };
	}
	if (await isSiteReadOnly()) {
		return { ok: false, result: voteFailure(READ_ONLY_MESSAGE) };
	}
	const rate = await enforceRateLimit("vote", String(user.id));
	if (!rate.allowed) {
		return { ok: false, result: voteFailure(rate.error) };
	}
	return { ok: true, userId: user.id };
}

export const voteSubmissionFn = createServerFn({ method: "POST" })
	.inputValidator((data: { submissionId: number; voteType: VoteType }) =>
		submissionVoteInputSchema.parse(data),
	)
	.handler(async ({ data }) => {
		const authorization = await authorizeVote();
		if (!authorization.ok) return authorization.result;
		return voteOnSubmission(
			authorization.userId,
			data.submissionId,
			data.voteType,
		);
	});

export const voteCommentFn = createServerFn({ method: "POST" })
	.inputValidator((data: { commentId: number; voteType: VoteType }) =>
		commentVoteInputSchema.parse(data),
	)
	.handler(async ({ data }) => {
		const authorization = await authorizeVote();
		if (!authorization.ok) return authorization.result;
		return voteOnComment(authorization.userId, data.commentId, data.voteType);
	});
