import { create } from "zustand";

import type { CommentFlat } from "@/lib/comments.server";

export type SubmissionCommentState = {
	byId: Record<number, CommentFlat>;
	allIds: number[];
	lastFetchedAt: number;
	commentCount: number;
};

type CommentStoreState = {
	submissions: Record<number, SubmissionCommentState>;
	mergeComments: (
		submissionId: number,
		comments: CommentFlat[],
		lastFetchedAt: number,
		initialState?: SubmissionCommentState,
	) => number;
};

export const useCommentStore = create<CommentStoreState>((set, get) => ({
	submissions: {},
	mergeComments: (submissionId, comments, lastFetchedAt, initialState) => {
		const state = get();
		const submission = state.submissions[submissionId] ?? initialState;
		if (!submission) return 0;

		let newCount = 0;
		const byId = { ...submission.byId };
		const allIds = submission.allIds.slice();

		for (const comment of comments) {
			if (!byId[comment.id]) {
				newCount += 1;
				allIds.push(comment.id);
			}
			byId[comment.id] = comment;
		}

		set((current) => ({
			submissions: {
				...current.submissions,
				[submissionId]: {
					byId,
					allIds,
					lastFetchedAt: Math.max(submission.lastFetchedAt, lastFetchedAt),
					commentCount: submission.commentCount + newCount,
				},
			},
		}));

		return newCount;
	},
}));
