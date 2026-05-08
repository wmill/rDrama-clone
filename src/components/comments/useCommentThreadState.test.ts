import { describe, expect, it } from "vitest";
import type { CommentFlat } from "@/lib/comments.server";
import {
	buildInitialCommentState,
	mergeCommentState,
} from "./useCommentThreadState";

function makeComment(overrides: Partial<CommentFlat> = {}): CommentFlat {
	return {
		id: 1,
		authorId: 10,
		authorName: "alice",
		body: "body",
		bodyHtml: "<p>body</p>",
		createdUtc: 100,
		editedUtc: 0,
		upvotes: 2,
		downvotes: 0,
		score: 2,
		level: 0,
		parentCommentId: null,
		parentSubmissionId: 99,
		descendantCount: 0,
		pinnedBy: null,
		distinguishLevel: 0,
		isDeleted: false,
		isRemoved: false,
		isPinned: false,
		isSaved: false,
		isModHidden: false,
		userVote: 0,
		...overrides,
	};
}

describe("useCommentThreadState helpers", () => {
	it("builds normalized initial state from flat comments", () => {
		const first = makeComment({ id: 1 });
		const second = makeComment({ id: 2, createdUtc: 101 });

		const state = buildInitialCommentState([first, second], 2, 101);

		expect(state.allIds).toEqual([1, 2]);
		expect(state.byId[1]).toBe(first);
		expect(state.byId[2]).toBe(second);
		expect(state.commentCount).toBe(2);
		expect(state.lastFetchedAt).toBe(101);
	});

	it("merges new comments and increases count only for unseen ids", () => {
		const initial = buildInitialCommentState([makeComment({ id: 1 })], 1, 100);
		const updated = makeComment({
			id: 1,
			body: "edited",
			bodyHtml: "<p>edited</p>",
		});
		const fresh = makeComment({ id: 2, createdUtc: 110 });

		const { nextState, newCount } = mergeCommentState(
			initial,
			[updated, fresh],
			110,
		);

		expect(newCount).toBe(1);
		expect(nextState.allIds).toEqual([1, 2]);
		expect(nextState.byId[1].body).toBe("edited");
		expect(nextState.byId[2]).toBe(fresh);
		expect(nextState.commentCount).toBe(2);
		expect(nextState.lastFetchedAt).toBe(110);
	});

	it("keeps the highest fetched timestamp when merging older results", () => {
		const initial = buildInitialCommentState([makeComment({ id: 1 })], 1, 200);

		const { nextState } = mergeCommentState(
			initial,
			[makeComment({ id: 1, body: "refreshed" })],
			150,
		);

		expect(nextState.commentCount).toBe(1);
		expect(nextState.lastFetchedAt).toBe(200);
	});
});
