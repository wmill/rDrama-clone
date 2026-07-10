// T17: every admin GET server-fn is a directly callable RPC endpoint, so each
// one must reject non-admin callers server-side (the admin.tsx layout guard
// only protects browser navigation).
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-start", () => ({
	createServerFn: () => {
		const chain = {
			inputValidator: () => chain,
			handler: (handler: unknown) => handler,
		};
		return chain;
	},
}));

vi.mock("@tanstack/react-router", () => ({
	createFileRoute: () => (options: unknown) => options,
	Link: () => null,
	notFound: () => new Error("not found"),
	Outlet: () => null,
	redirect: () => new Error("redirect"),
}));

vi.mock("@/lib/sessions.server", () => ({
	getCurrentUser: vi.fn(),
}));

vi.mock("@/lib/admin.server", () => ({
	getModLog: vi
		.fn()
		.mockResolvedValue({ entries: [], page: 1, hasMore: false }),
	getModQueueComments: vi.fn().mockResolvedValue([]),
	getModQueueSubmissions: vi.fn().mockResolvedValue([]),
	getReportedComments: vi.fn().mockResolvedValue([]),
	getReportedSubmissions: vi.fn().mockResolvedValue([]),
	getUserAdminDetails: vi.fn().mockResolvedValue(null),
	getUserRecentActivity: vi.fn().mockResolvedValue({
		submissions: [],
		comments: [],
	}),
	getUserReportHistory: vi.fn().mockResolvedValue([]),
	listBadgeDefs: vi.fn().mockResolvedValue([]),
	listBannedDomains: vi.fn().mockResolvedValue([]),
	searchUsers: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/admin-actions.server", () => ({
	addBannedDomainFn: vi.fn(),
	banUserFn: vi.fn(),
	createUserNoteFn: vi.fn(),
	removeBannedDomainFn: vi.fn(),
	setCommentModerationStateFn: vi.fn(),
	setSubmissionModerationStateFn: vi.fn(),
	shadowbanUserFn: vi.fn(),
	unbanUserFn: vi.fn(),
	unshadowbanUserFn: vi.fn(),
	updateCommentFilterStatusFn: vi.fn(),
	updateSubmissionFilterStatusFn: vi.fn(),
}));

vi.mock("@/lib/award-actions.server", () => ({
	createBadgeDefFn: vi.fn(),
	grantBadgeFn: vi.fn(),
	revokeBadgeFn: vi.fn(),
}));

import * as adminServer from "@/lib/admin.server";
import type { SafeUser } from "@/lib/auth.server";
import { getCurrentUser } from "@/lib/sessions.server";
import { listBadgeDefsFn } from "@/routes/admin.badges";
import { listBannedDomainsFn } from "@/routes/admin.banned-domains";
import { getModQueuesFn } from "@/routes/admin.filtered";
import { getModLogFn } from "@/routes/admin.mod-log";
import { getReportedCommentsFn } from "@/routes/admin.reported-comments";
import { getReportedSubmissionsFn } from "@/routes/admin.reported-posts";
import { searchUsersFn } from "@/routes/admin.users";
import { getUserInvestigationFn } from "@/routes/admin.users_.$id";

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

const getFns: [string, () => Promise<unknown>][] = [
	[
		"getReportedSubmissionsFn",
		() => getReportedSubmissionsFn({ data: { page: 1 } }),
	],
	["getReportedCommentsFn", () => getReportedCommentsFn({ data: { page: 1 } })],
	["getModQueuesFn", () => getModQueuesFn()],
	["getModLogFn", () => getModLogFn({ data: { page: 1 } })],
	["searchUsersFn", () => searchUsersFn({ data: { query: "alice" } })],
	["listBadgeDefsFn", () => listBadgeDefsFn()],
	["listBannedDomainsFn", () => listBannedDomainsFn()],
	[
		"getUserInvestigationFn",
		() => getUserInvestigationFn({ data: { userId: 1 } }),
	],
];

function expectNoAdminQueries() {
	for (const fn of Object.values(adminServer)) {
		if (typeof fn === "function") {
			expect(fn).not.toHaveBeenCalled();
		}
	}
}

describe("admin route GET fns", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe.each(getFns)("%s", (_name, call) => {
		it("rejects logged-out callers without touching admin queries", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(null);

			await expect(call()).rejects.toThrow("Unauthorized");
			expectNoAdminQueries();
		});

		it("rejects non-admin users without touching admin queries", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);

			await expect(call()).rejects.toThrow("Unauthorized");
			expectNoAdminQueries();
		});

		it("resolves for admin users", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue({
				...mockUser,
				adminLevel: 2,
			});

			await expect(call()).resolves.not.toThrow();
		});
	});
});
