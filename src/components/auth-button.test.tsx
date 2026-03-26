import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { AuthButton } from "@/components/auth-button";
import { useAuth } from "@/hooks/use-auth";
import type { SafeUser } from "@/lib/auth.server";

vi.mock("@/hooks/use-auth", () => ({
	useAuth: vi.fn(),
}));

vi.mock("@/lib/sessions.server", () => ({
	clearSessionCookie: vi.fn(),
	deleteSession: vi.fn(),
	getSessionIdFromCookie: vi.fn(),
}));

vi.mock("@tanstack/react-start", () => ({
	createServerFn: () => ({
		handler: (handler: unknown) => handler,
	}),
}));

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

describe("AuthButton", () => {
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

	it("shows logged out state when there is no user", () => {
		vi.mocked(useAuth).mockReturnValue({
			user: null,
			ready: true,
			refresh: vi.fn(),
		});

		render(<AuthButton />);

		expect(screen.queryByText("Not logged in")).not.toBeNull();
		expect(
			screen.getByRole("link", { name: "Log in" }).getAttribute("href"),
		).toBe("/login");
	});

	it("shows username and profile link when logged in", () => {
		vi.mocked(useAuth).mockReturnValue({
			user: mockUser,
			ready: true,
			refresh: vi.fn(),
		});

		render(<AuthButton />);

		expect(screen.queryByText("walter")).not.toBeNull();
		expect(screen.queryByRole("button", { name: "Log out" })).not.toBeNull();
		expect(
			screen.getByRole("link", { name: "walter" }).getAttribute("href"),
		).toBe("/u/walter");
	});
});
