import { fireEvent, render, screen } from "@testing-library/react";
import type { SetStateAction } from "react";
import { describe, expect, it, vi } from "vitest";
import type { CommentWithReplies } from "@/lib/comments.server";
import { CommentThreadList } from "./CommentThreadList";

vi.mock("./Comment", () => ({
	Comment: ({ comment }: { comment: CommentWithReplies }) => (
		<div data-testid="comment-row">{comment.id}</div>
	),
}));

function makeCommentTree(id: number): CommentWithReplies {
	return {
		id,
		authorId: 10 + id,
		authorName: `user-${id}`,
		body: `body-${id}`,
		bodyHtml: `<p>body-${id}</p>`,
		createdUtc: 100 + id,
		editedUtc: 0,
		upvotes: 1,
		downvotes: 0,
		score: 1,
		level: 0,
		parentCommentId: null,
		parentSubmissionId: 42,
		descendantCount: 0,
		pinnedBy: null,
		distinguishLevel: 0,
		isDeleted: false,
		isModHidden: false,
		userVote: 0,
		replies: [],
	};
}

describe("CommentThreadList", () => {
	it("renders the empty state when there are no comments", () => {
		render(
			<CommentThreadList
				comments={[]}
				submissionId={42}
				onReplyAdded={() => {}}
				visibleLimit={50}
				onVisibleLimitChange={vi.fn()}
			/>,
		);

		expect(screen.getByText(/No comments yet/i)).toBeTruthy();
	});

	it("renders all visible comments and exposes load more", () => {
		const comments = Array.from({ length: 7 }, (_, index) =>
			makeCommentTree(index + 1),
		);
		let visibleLimit = 5;
		const setVisibleLimit = vi.fn((updater: SetStateAction<number>) => {
			visibleLimit =
				typeof updater === "function" ? updater(visibleLimit) : updater;
		});

		render(
			<CommentThreadList
				comments={comments}
				submissionId={42}
				onReplyAdded={() => {}}
				visibleLimit={visibleLimit}
				onVisibleLimitChange={setVisibleLimit}
			/>,
		);

		expect(screen.getAllByTestId("comment-row")).toHaveLength(5);
		expect(
			screen.getByRole("button", { name: /Load more comments/i }),
		).toBeTruthy();

		fireEvent.click(
			screen.getByRole("button", { name: /Load more comments/i }),
		);
		expect(setVisibleLimit).toHaveBeenCalled();
		expect(visibleLimit).toBeGreaterThan(5);
	});
});
