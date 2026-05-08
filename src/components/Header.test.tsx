import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import Header from "@/components/Header";
import type { SafeUser } from "@/lib/auth.server";

vi.mock("@/components/auth-button", () => ({
	AuthButton: () => <div>auth</div>,
}));

vi.mock("@tanstack/react-router", () => ({
	Link: ({
		children,
		to,
		activeProps: _activeProps,
		...props
	}: {
		children: ReactNode;
		to: string;
		activeProps?: unknown;
	}) => (
		<a href={to} {...props}>
			{children}
		</a>
	),
}));

const mockUser: SafeUser = {
	id: 42,
	username: "walter",
	email: "walter@example.com",
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

describe("Header", () => {
	it("shows notifications badge only for logged-in users with unread items", () => {
		render(<Header user={mockUser} unreadNotificationCount={3} />);

		expect(screen.getByText("Notifications")).not.toBeNull();
		expect(screen.getByText("3")).not.toBeNull();
	});

	it("hides notifications link for anonymous users", () => {
		render(<Header user={null} unreadNotificationCount={0} />);

		expect(screen.queryByText("Notifications")).toBeNull();
	});
});
