import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-start", async () =>
	(await import("@/test/mocks")).createServerFnStub(),
);
vi.mock("@/db", async () => ({
	db: (await import("@/test/mocks")).createMockDb(),
}));
vi.mock("@/lib/sessions.server", () => ({
	getCurrentUser: vi.fn(),
	getSessionIdFromCookie: vi.fn(),
	deleteOtherUserSessions: vi.fn(),
}));
vi.mock("@/lib/auth.server", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/lib/auth.server")>()),
	verifyPassword: vi.fn(),
	hashPassword: vi.fn(),
}));
vi.mock("@/lib/password-reset.server", () => ({
	invalidatePasswordResetTokens: vi.fn(),
}));
vi.mock("@/lib/rate-limit.server", () => ({
	enforceRateLimit: vi.fn(),
}));

import { db } from "@/db";
import {
	changePasswordFn,
	changePasswordInputSchema,
} from "@/lib/account-actions.server";
import { hashPassword, verifyPassword } from "@/lib/auth.server";
import { invalidatePasswordResetTokens } from "@/lib/password-reset.server";
import { enforceRateLimit } from "@/lib/rate-limit.server";
import {
	deleteOtherUserSessions,
	getCurrentUser,
	getSessionIdFromCookie,
} from "@/lib/sessions.server";
import { createQueryChain, makeSafeUser } from "@/test/mocks";

const validInput = {
	currentPassword: "old-password",
	newPassword: "new-password",
	confirmPassword: "new-password",
};

describe("changePasswordFn", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(getCurrentUser).mockResolvedValue(makeSafeUser({ id: 7 }));
		vi.mocked(enforceRateLimit).mockResolvedValue({ allowed: true });
		vi.mocked(getSessionIdFromCookie).mockReturnValue("current-session");
	});

	it("rejects anonymous callers before reading or writing account state", async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(null);

		await expect(changePasswordFn({ data: validInput })).resolves.toEqual({
			success: false,
			error: "Not logged in",
		});
		expect(db.select).not.toHaveBeenCalled();
		expect(db.update).not.toHaveBeenCalled();
	});

	it("rate limits attempts by user id", async () => {
		vi.mocked(enforceRateLimit).mockResolvedValue({
			allowed: false,
			error: "Slow down",
		});

		await expect(changePasswordFn({ data: validInput })).resolves.toEqual({
			success: false,
			error: "Slow down",
		});
		expect(enforceRateLimit).toHaveBeenCalledWith(
			"account_password_change",
			"7",
		);
		expect(db.select).not.toHaveBeenCalled();
	});

	it("makes no account, token, or session writes for an incorrect current password", async () => {
		vi.mocked(db.select).mockReturnValueOnce(
			createQueryChain([{ passhash: "old-hash" }]) as never,
		);
		vi.mocked(verifyPassword).mockResolvedValue(false);

		await expect(changePasswordFn({ data: validInput })).resolves.toEqual({
			success: false,
			error: "Current password is incorrect",
		});
		expect(db.update).not.toHaveBeenCalled();
		expect(hashPassword).not.toHaveBeenCalled();
		expect(invalidatePasswordResetTokens).not.toHaveBeenCalled();
		expect(deleteOtherUserSessions).not.toHaveBeenCalled();
	});

	it("updates the hash, invalidates reset links, and preserves only the current session", async () => {
		vi.mocked(db.select).mockReturnValueOnce(
			createQueryChain([{ passhash: "old-hash" }]) as never,
		);
		vi.mocked(verifyPassword).mockResolvedValue(true);
		vi.mocked(hashPassword).mockResolvedValue("new-hash");
		const updateChain = createQueryChain();
		vi.mocked(db.update).mockReturnValueOnce(updateChain as never);

		await expect(changePasswordFn({ data: validInput })).resolves.toEqual({
			success: true,
		});
		expect(verifyPassword).toHaveBeenCalledWith("old-password", "old-hash");
		expect(updateChain.set).toHaveBeenCalledWith(
			expect.objectContaining({
				passhash: "new-hash",
				loginNonce: expect.anything(),
			}),
		);
		expect(invalidatePasswordResetTokens).toHaveBeenCalledWith(7);
		expect(deleteOtherUserSessions).toHaveBeenCalledWith(7, "current-session");
	});
});

describe("changePasswordInputSchema", () => {
	it("requires a valid replacement and matching confirmation", () => {
		expect(changePasswordInputSchema.safeParse(validInput).success).toBe(true);
		expect(
			changePasswordInputSchema.safeParse({
				...validInput,
				newPassword: "short",
				confirmPassword: "short",
			}).success,
		).toBe(false);
		expect(
			changePasswordInputSchema.safeParse({
				...validInput,
				confirmPassword: "different",
			}).success,
		).toBe(false);
	});
});
