import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { VoteButtons } from "@/components/comments/VoteButtons";
import { voteSubmissionFn } from "@/lib/vote-actions.server";

const navigateMock = vi.fn();

vi.mock("@tanstack/react-router", () => ({
	useRouter: () => ({
		navigate: navigateMock,
	}),
}));

vi.mock("@/lib/vote-actions.server", () => ({
	voteSubmissionFn: vi.fn(),
	voteCommentFn: vi.fn(),
}));

describe("VoteButtons", () => {
	it("shows active upvote state from initial userVote", () => {
		render(<VoteButtons type="submission" id={1} score={5} userVote={1} />);

		expect(screen.getByRole("button", { name: "Upvote" }).className).toContain(
			"bg-orange-500/10",
		);
		expect(screen.queryByText("5")).not.toBeNull();
	});

	it("applies server response after upvoting", async () => {
		// Distinct from the optimistic score (6) so the assertion only passes
		// once the server round trip has fully settled.
		vi.mocked(voteSubmissionFn).mockResolvedValue({
			success: true,
			newScore: 9,
			userVote: 1,
		});

		render(<VoteButtons type="submission" id={1} score={5} userVote={0} />);
		fireEvent.click(screen.getByRole("button", { name: "Upvote" }));

		await waitFor(() => {
			expect(screen.queryByText("9")).not.toBeNull();
		});
		expect(screen.getByRole("button", { name: "Upvote" }).className).toContain(
			"bg-orange-500/10",
		);
	});

	it("redirects to login when voting unauthenticated", async () => {
		vi.mocked(voteSubmissionFn).mockResolvedValue({
			success: false,
			error: "Not logged in",
			newScore: 0,
			userVote: 0,
		});

		render(<VoteButtons type="submission" id={1} score={5} userVote={0} />);
		fireEvent.click(screen.getByRole("button", { name: "Upvote" }));

		await waitFor(() => {
			expect(navigateMock).toHaveBeenCalledWith({ to: "/login" });
		});
	});
});
