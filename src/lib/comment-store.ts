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
	initSubmission: (
		submissionId: number,
		comments: CommentFlat[],
		commentCount: number,
		lastFetchedAt: number,
	) => void;
	mergeComments: (
		submissionId: number,
		comments: CommentFlat[],
		lastFetchedAt: number,
	) => number;
};

function normalizeComments(comments: CommentFlat[]) {
	const byId: Record<number, CommentFlat> = {};
	const allIds: number[] = [];
	for (const comment of comments) {
		byId[comment.id] = comment;
		allIds.push(comment.id);
	}
	return { byId, allIds };
}

export const useCommentStore = create<CommentStoreState>((set, get) => ({
	submissions: {},
	initSubmission: (
		submissionId,
		comments,
		commentCount,
		lastFetchedAt,
	) => {
		const normalized = normalizeComments(comments);
		set((state) => ({
			submissions: {
				...state.submissions,
				[submissionId]: {
					...normalized,
					lastFetchedAt,
					commentCount,
				},
			},
		}));
	},
	mergeComments: (submissionId, comments, lastFetchedAt) => {
		const state = get();
		const submission = state.submissions[submissionId] ?? {
			byId: {},
			allIds: [],
			lastFetchedAt: 0,
			commentCount: 0,
		};

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
