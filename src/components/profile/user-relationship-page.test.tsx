import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { SocialListPage } from "@/lib/social.server";
import { removeFollowerFn } from "@/lib/social-actions.server";
import { UserRelationshipPage } from "./user-relationship-page";

const invalidate = vi.fn();
vi.mock("@tanstack/react-router", () => ({
	Link: ({ children, to }: { children: ReactNode; to: string }) => (
		<a href={to}>{children}</a>
	),
	useRouter: () => ({ invalidate }),
}));
vi.mock("@/lib/social-actions.server", () => ({
	removeFollowerFn: vi.fn(),
	setBlockStateFn: vi.fn(),
	setFollowStateFn: vi.fn(),
}));

function makePage(overrides: Partial<SocialListPage> = {}): SocialListPage {
	return {
		profileUser: { id: 5, username: "owner" } as never,
		viewer: { id: 5, username: "owner", adminLevel: 0 } as never,
		kind: "followers",
		page: 1,
		pageSize: 25,
		isOwner: true,
		isPrivateRestricted: false,
		isBlockingProfile: false,
		items: [
			{
				id: 12,
				username: "follower",
				createdUtc: 1,
				bio: null,
				bioHtml: null,
				customTitle: null,
				profileUrl: null,
				isFollowing: false,
				isBlocking: false,
			},
		],
		hasNextPage: false,
		...overrides,
	};
}

describe("UserRelationshipPage follower management", () => {
	it("lets an owner remove a follower", async () => {
		vi.mocked(removeFollowerFn).mockResolvedValue({ success: true });
		render(
			<UserRelationshipPage
				data={makePage()}
				search={{ page: 1 }}
				onPageChange={vi.fn()}
			/>,
		);
		fireEvent.click(screen.getByRole("button", { name: "Remove follower" }));
		await waitFor(() =>
			expect(removeFollowerFn).toHaveBeenCalledWith({
				data: { followerId: 12 },
			}),
		);
		expect(invalidate).toHaveBeenCalled();
	});

	it("does not expose removal controls to other viewers", () => {
		render(
			<UserRelationshipPage
				data={makePage({ isOwner: false })}
				search={{ page: 1 }}
				onPageChange={vi.fn()}
			/>,
		);
		expect(
			screen.queryByRole("button", { name: "Remove follower" }),
		).toBeNull();
	});
});
