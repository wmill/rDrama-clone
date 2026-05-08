import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { UserPage } from "@/components/profile/user-page";
import type { ProfilePageData } from "@/lib/users.server";

vi.mock("@tanstack/react-router", () => ({
	Link: ({ children, to, ...props }: { children: ReactNode; to: string }) => (
		<a href={to} {...props}>
			{children}
		</a>
	),
	useRouter: () => ({
		invalidate: vi.fn(),
	}),
}));

vi.mock("@/lib/social-actions.server", () => ({
	setBlockStateFn: vi.fn(),
	setFollowStateFn: vi.fn(),
}));

vi.mock("@/lib/admin-actions.server", () => ({
	banUserFn: vi.fn(),
	createUserNoteFn: vi.fn(),
	shadowbanUserFn: vi.fn(),
	unbanUserFn: vi.fn(),
	unshadowbanUserFn: vi.fn(),
}));

function createProfileData(
	overrides?: Partial<ProfilePageData>,
): ProfilePageData {
	return {
		profileUser: {
			id: 2,
			username: "target",
			createdUtc: 1,
			isPrivate: false,
			adminLevel: 0,
			storedSubscriberCount: 4,
			postCount: 2,
			commentCount: 3,
			highRes: null,
			profileUrl: null,
			bannerUrl: null,
			verified: null,
			patron: 0,
			originalUsername: null,
			customTitle: null,
			bioHtml: null,
			bio: null,
			isBanned: 0,
			banReason: null,
			unbanUtc: 0,
			shadowBanned: null,
		} as never,
		viewer: {
			id: 1,
			username: "viewer",
			email: "viewer@example.com",
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
		},
		followingCount: 9,
		tab: "posts",
		sort: "hot",
		t: "all",
		page: 1,
		isOwner: false,
		isPrivateRestricted: false,
		isFollowing: false,
		isBlocking: false,
		comments: [],
		posts: [],
		hasNextPage: false,
		...overrides,
	};
}

describe("UserPage", () => {
	it("renders follow and block controls for logged-in non-owners", () => {
		render(
			<UserPage
				data={createProfileData()}
				onSortChange={vi.fn()}
				onTimeChange={vi.fn()}
				onPageChange={vi.fn()}
			/>,
		);

		expect(screen.getByRole("button", { name: "Follow" })).not.toBeNull();
		expect(screen.getByRole("button", { name: "Block" })).not.toBeNull();
	});

	it("shows a blocking notice instead of profile content", () => {
		render(
			<UserPage
				data={createProfileData({ isBlocking: true })}
				onSortChange={vi.fn()}
				onTimeChange={vi.fn()}
				onPageChange={vi.fn()}
			/>,
		);

		expect(
			screen.getByText(/Unblock this user to view their profile content/i),
		).not.toBeNull();
		expect(screen.queryByText("Sort:")).toBeNull();
	});
});
