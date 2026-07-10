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

// Without this mock the vote handler awaits real Redis; the test can then
// finish on the optimistic update and tear down the environment while the
// call is still in flight, crashing in the handler's finally block.
vi.mock("@/lib/site-settings.server", () => ({
	isSiteReadOnly: vi.fn().mockResolvedValue(false),
	READ_ONLY_MESSAGE:
		"The site is currently in read-only mode. Try again later.",
}));

vi.mock("@/lib/rate-limit.server", () => ({
	enforceRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
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
		// Distinct from the optimistic score (6) so the assertion only passes
		// once the server round trip has fully settled.
		vi.mocked(voteOnSubmission).mockResolvedValue({
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
		vi.mocked(getCurrentUser).mockResolvedValue(null);

		render(<VoteButtons type="submission" id={1} score={5} userVote={0} />);
		fireEvent.click(screen.getByRole("button", { name: "Upvote" }));

		await waitFor(() => {
			expect(navigateMock).toHaveBeenCalledWith({ to: "/login" });
		});
	});
});
