import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { RecentSubmissions } from "@/components/recent-submissions";
import type { SubmissionSummary } from "@/lib/submissions.server";

vi.mock("@tanstack/react-router", () => ({
	Link: ({ children, to, ...props }: { children: ReactNode; to: string }) => (
		<a href={to} {...props}>
			{children}
		</a>
	),
}));

vi.mock("@/components/comments/VoteButtons", () => ({
	VoteButtons: ({
		id,
		userVote,
		disabled,
	}: {
		id: number;
		userVote: number;
		disabled: boolean;
	}) => (
		<div
			data-testid={`vote-${id}`}
			data-user-vote={String(userVote)}
			data-disabled={String(disabled)}
		/>
	),
}));

const baseSubmission: SubmissionSummary = {
	id: 123,
	title: "Test submission",
	titleHtml: "Test submission",
	createdUtc: 1700000000,
	authorId: 5,
	authorName: "poster",
	url: null,
	body: null,
	bodyHtml: null,
	upvotes: 10,
	downvotes: 2,
	score: 8,
	commentCount: 3,
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
	userVote: -1,
	stateMod: "VISIBLE",
	stateModSetBy: null,
};

describe("RecentSubmissions", () => {
	it("passes userVote to VoteButtons for each submission", () => {
		render(
			<RecentSubmissions
				submissions={[baseSubmission]}
				currentUserId={42}
				showSortControls={false}
			/>,
		);

		const voteStub = screen.getByTestId("vote-123");
		expect(voteStub.getAttribute("data-user-vote")).toBe("-1");
		expect(voteStub.getAttribute("data-disabled")).toBe("false");
	});

	it("disables voting when user is logged out", () => {
		render(
			<RecentSubmissions
				submissions={[baseSubmission]}
				currentUserId={undefined}
				showSortControls={false}
			/>,
		);

		expect(screen.getByTestId("vote-123").getAttribute("data-disabled")).toBe(
			"true",
		);
	});

	it("switches to the observable card presentation", () => {
		render(
			<RecentSubmissions
				submissions={[baseSubmission]}
				cardView
				showSortControls={false}
			/>,
		);
		expect(
			screen.getByText("Test submission").closest("li")?.dataset.view,
		).toBe("card");
	});

	it("renders award chips with counts on awarded submissions", () => {
		render(
			<RecentSubmissions
				submissions={[
					{
						...baseSubmission,
						awards: [
							{ kind: "gold", count: 2 },
							{ kind: "trophy", count: 1 },
						],
					},
				]}
				showSortControls={false}
			/>,
		);

		expect(screen.getByTitle("Gold x2")).toBeDefined();
		expect(screen.getByTitle("Gold x2").textContent).toContain("2");
		expect(screen.getByTitle("Trophy")).toBeDefined();
	});
});
