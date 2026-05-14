import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { CommentFeedItem } from "@/lib/comments.server";
import {
	type PublicSearchResults,
	parsePublicSearchParams,
} from "@/lib/search";
import type { SubmissionSummary } from "@/lib/submissions.server";
import { SearchPageContent } from "@/routes/search";

vi.mock("@tanstack/react-router", () => ({
	createFileRoute: () => () => ({}),
	Link: ({ children, to, ...props }: { children: ReactNode; to: string }) => (
		<a href={to} {...props}>
			{children}
		</a>
	),
	useRouter: () => ({
		navigate: vi.fn(),
	}),
}));

vi.mock("@tanstack/react-start", () => ({
	createServerFn: () => {
		const chain = {
			inputValidator: () => chain,
			handler: (handler: unknown) => handler,
		};
		return chain;
	},
}));

vi.mock("@/lib/sessions.server", () => ({
	getCurrentUser: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/components/comments", () => ({
	VoteButtons: () => <div>votes</div>,
}));

const submissionResult: PublicSearchResults<SubmissionSummary> = {
	results: [
		{
			id: 1,
			title: "Post result",
			titleHtml: "Post result",
			createdUtc: 1,
			authorId: 2,
			authorName: "alice",
			url: null,
			body: "body",
			bodyHtml: "<p>body</p>",
			upvotes: 3,
			downvotes: 0,
			score: 3,
			commentCount: 1,
			thumbUrl: null,
			flair: null,
			isPinned: false,
			isNsfw: false,
			stickied: null,
			isStickied: false,
			isDeleted: false,
			isRemoved: false,
			isFiltered: false,
			visibilityMessage: null,
			isSaved: false,
			isBlockedAuthor: false,
			userVote: 0,
			stateMod: "VISIBLE",
			stateModSetBy: null,
		},
	],
	hasNextPage: true,
	isAvailable: true,
};

const commentResult: PublicSearchResults<CommentFeedItem> = {
	results: [
		{
			id: 2,
			authorId: 3,
			authorName: "bob",
			body: "comment body",
			bodyHtml: "<p>comment body</p>",
			createdUtc: 1,
			editedUtc: 0,
			upvotes: 4,
			downvotes: 1,
			score: 3,
			level: 1,
			parentSubmissionId: 9,
			submissionTitle: "Related post",
			distinguishLevel: 0,
			isDeleted: false,
			isRemoved: false,
			isFiltered: false,
			isSaved: false,
			userVote: 0,
			stateMod: "VISIBLE",
			stateModSetBy: null,
		},
	],
	hasNextPage: false,
	isAvailable: true,
};

describe("search page", () => {
	it("parses default params", () => {
		expect(parsePublicSearchParams({})).toEqual({
			q: "",
			type: "posts",
			page: 1,
		});
	});

	it("renders a blank-query empty state", () => {
		render(
			<SearchPageContent
				query=""
				type="posts"
				page={1}
				result={{ results: [], hasNextPage: false, isAvailable: true }}
				onTypeChange={vi.fn()}
				onPreviousPage={vi.fn()}
				onNextPage={vi.fn()}
			/>,
		);

		expect(screen.getByText(/Start with a search query/i)).not.toBeNull();
	});

	it("switches tabs while preserving the query intent", () => {
		const onTypeChange = vi.fn();
		render(
			<SearchPageContent
				query="walter"
				type="posts"
				page={1}
				result={submissionResult}
				onTypeChange={onTypeChange}
				onPreviousPage={vi.fn()}
				onNextPage={vi.fn()}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: "Comments" }));
		expect(onTypeChange).toHaveBeenCalledWith("comments");
	});

	it("renders post-mode results and pagination controls", () => {
		const onNextPage = vi.fn();
		render(
			<SearchPageContent
				query="query"
				type="posts"
				page={1}
				result={submissionResult}
				onTypeChange={vi.fn()}
				onPreviousPage={vi.fn()}
				onNextPage={onNextPage}
			/>,
		);

		expect(screen.getByText("Post result")).not.toBeNull();
		fireEvent.click(screen.getByRole("button", { name: "Next" }));
		expect(onNextPage).toHaveBeenCalled();
	});

	it("renders comment-mode results", () => {
		render(
			<SearchPageContent
				query="bob"
				type="comments"
				page={1}
				result={commentResult}
				onTypeChange={vi.fn()}
				onPreviousPage={vi.fn()}
				onNextPage={vi.fn()}
			/>,
		);

		expect(screen.getByText("Related post")).not.toBeNull();
		expect(screen.getByText("Permalink")).not.toBeNull();
	});
});
