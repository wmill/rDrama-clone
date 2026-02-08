import { and, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { comments, commentVotes, submissions, votes } from "@/db/schema";

export type VoteType = 1 | -1 | 0; // 1 = upvote, -1 = downvote, 0 = remove vote

export type VoteResult = {
	success: boolean;
	newScore: number;
	userVote: VoteType;
	error?: string;
};

export async function getCommentVote(
	userId: number,
	commentId: number,
): Promise<VoteType> {
	const [vote] = await db
		.select({ voteType: commentVotes.voteType })
		.from(commentVotes)
		.where(
			and(
				eq(commentVotes.userId, userId),
				eq(commentVotes.commentId, commentId),
			),
		)
		.limit(1);

	return (vote?.voteType as VoteType) ?? 0;
}

async function getSubmissionVoteInternal(
	userId: number,
	submissionId: number,
): Promise<VoteType> {
	const [vote] = await db
		.select({ voteType: votes.voteType })
		.from(votes)
		.where(and(eq(votes.userId, userId), eq(votes.submissionId, submissionId)))
		.limit(1);

	return (vote?.voteType as VoteType) ?? 0;
}

export async function voteOnSubmission(
	userId: number,
	submissionId: number,
	voteType: VoteType,
): Promise<VoteResult> {
	try {
		// Get current vote
		const currentVote = await getSubmissionVoteInternal(userId, submissionId);

		// If same vote, remove it (toggle)
		if (currentVote === voteType) {
			voteType = 0;
		}

		// Calculate vote difference
		let upvoteDiff = 0;
		let downvoteDiff = 0;

		// Remove old vote effect
		if (currentVote === 1) upvoteDiff -= 1;
		if (currentVote === -1) downvoteDiff -= 1;

		// Add new vote effect
		if (voteType === 1) upvoteDiff += 1;
		if (voteType === -1) downvoteDiff += 1;

		// Update or insert vote
		if (voteType === 0) {
			// Remove vote
			await db
				.delete(votes)
				.where(
					and(eq(votes.userId, userId), eq(votes.submissionId, submissionId)),
				);
		} else if (currentVote === 0) {
			// Insert new vote
			await db.insert(votes).values({
				userId,
				submissionId,
				voteType,
				createdDatetimez: new Date(),
			});
		} else {
			// Update existing vote
			await db
				.update(votes)
				.set({ voteType })
				.where(
					and(eq(votes.userId, userId), eq(votes.submissionId, submissionId)),
				);
		}

		// Update submission vote counts
		if (upvoteDiff !== 0 || downvoteDiff !== 0) {
			await db
				.update(submissions)
				.set({
					upvotes: sql`${submissions.upvotes} + ${upvoteDiff}`,
					downvotes: sql`${submissions.downvotes} + ${downvoteDiff}`,
				})
				.where(eq(submissions.id, submissionId));
		}

		// Get new score
		const [submission] = await db
			.select({
				upvotes: submissions.upvotes,
				downvotes: submissions.downvotes,
			})
			.from(submissions)
			.where(eq(submissions.id, submissionId))
			.limit(1);

		const newScore = (submission?.upvotes ?? 0) - (submission?.downvotes ?? 0);

		return {
			success: true,
			newScore,
			userVote: voteType,
		};
	} catch (error) {
		return {
			success: false,
			newScore: 0,
			userVote: 0,
			error: error instanceof Error ? error.message : "Failed to vote",
		};
	}
}

export async function voteOnComment(
	userId: number,
	commentId: number,
	voteType: VoteType,
): Promise<VoteResult> {
	try {
		// Get current vote
		const currentVote = await getCommentVote(userId, commentId);

		// If same vote, remove it (toggle)
		if (currentVote === voteType) {
			voteType = 0;
		}

		// Calculate vote difference
		let upvoteDiff = 0;
		let downvoteDiff = 0;

		// Remove old vote effect
		if (currentVote === 1) upvoteDiff -= 1;
		if (currentVote === -1) downvoteDiff -= 1;

		// Add new vote effect
		if (voteType === 1) upvoteDiff += 1;
		if (voteType === -1) downvoteDiff += 1;

		// Update or insert vote
		if (voteType === 0) {
			// Remove vote
			await db
				.delete(commentVotes)
				.where(
					and(
						eq(commentVotes.userId, userId),
						eq(commentVotes.commentId, commentId),
					),
				);
		} else if (currentVote === 0) {
			// Insert new vote
			await db.insert(commentVotes).values({
				userId,
				commentId,
				voteType,
				createdDatetimez: new Date(),
			});
		} else {
			// Update existing vote
			await db
				.update(commentVotes)
				.set({ voteType })
				.where(
					and(
						eq(commentVotes.userId, userId),
						eq(commentVotes.commentId, commentId),
					),
				);
		}

		// Update comment vote counts
		if (upvoteDiff !== 0 || downvoteDiff !== 0) {
			await db
				.update(comments)
				.set({
					upvotes: sql`${comments.upvotes} + ${upvoteDiff}`,
					downvotes: sql`${comments.downvotes} + ${downvoteDiff}`,
				})
				.where(eq(comments.id, commentId));
		}

		// Get new score
		const [comment] = await db
			.select({
				upvotes: comments.upvotes,
				downvotes: comments.downvotes,
			})
			.from(comments)
			.where(eq(comments.id, commentId))
			.limit(1);

		const newScore = (comment?.upvotes ?? 0) - (comment?.downvotes ?? 0);

		return {
			success: true,
			newScore,
			userVote: voteType,
		};
	} catch (error) {
		return {
			success: false,
			newScore: 0,
			userVote: 0,
			error: error instanceof Error ? error.message : "Failed to vote",
		};
	}
}
