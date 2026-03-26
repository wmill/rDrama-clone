import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { VoteButtons } from "@/components/comments/VoteButtons";
import type { SafeUser } from "@/lib/auth.server";
import { getCurrentUser } from "@/lib/sessions.server";
import { voteOnSubmission } from "@/lib/votes.server";

const navigateMock = vi.fn();

vi.mock("@tanstack/react-router", () => ({
	useRouter: () => ({
		navigate: navigateMock,
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
	getCurrentUser: vi.fn(),
}));

vi.mock("@/lib/votes.server", () => ({
	voteOnSubmission: vi.fn(),
	voteOnComment: vi.fn(),
}));

describe("VoteButtons", () => {
	const mockUser: SafeUser = {
		id: 7,
		username: "alice",
		email: "alice@example.com",
		adminLevel: 0,
		createdUtc: 0,
		isActivated: true,
		isBanned: 0,
		banReason: null,
		unbanUtc: 0,
		shadowBanned: null,
		coins: 0,
		proCoins: 0,
		profileUrl: null,
		bannerUrl: null,
		bio: null,
		customTitle: null,
	};

	it("shows active upvote state from initial userVote", () => {
		render(<VoteButtons type="submission" id={1} score={5} userVote={1} />);

		expect(screen.getByRole("button", { name: "Upvote" }).className).toContain(
			"bg-orange-500/10",
		);
		expect(screen.queryByText("5")).not.toBeNull();
	});

	it("applies server response after upvoting", async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
		vi.mocked(voteOnSubmission).mockResolvedValue({
			success: true,
			newScore: 6,
			userVote: 1,
		});

		render(<VoteButtons type="submission" id={1} score={5} userVote={0} />);
		fireEvent.click(screen.getByRole("button", { name: "Upvote" }));

		await waitFor(() => {
			expect(screen.queryByText("6")).not.toBeNull();
		});
		expect(screen.getByRole("button", { name: "Upvote" }).className).toContain(
			"bg-orange-500/10",
		);
	});

	it("redirects to login when voting unauthenticated", async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(null);

		render(<VoteButtons type="submission" id={1} score={5} userVote={0} />);
		fireEvent.click(screen.getByRole("button", { name: "Upvote" }));

		await waitFor(() => {
			expect(navigateMock).toHaveBeenCalledWith({ to: "/login" });
		});
	});
});
