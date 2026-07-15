import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-start", async () =>
	(await import("@/test/mocks")).createServerFnStub(),
);
vi.mock("@/db", async () => ({
	db: (await import("@/test/mocks")).createMockDb(),
}));
vi.mock("@/lib/sessions.server", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/auth.server", () => ({ verifyPassword: vi.fn() }));
vi.mock("@/lib/rate-limit.server", () => ({ enforceRateLimit: vi.fn() }));
vi.mock("@/lib/email-verification.server", () => ({
	consumeEmailVerificationToken: vi.fn(),
	normalizeEmailAddress: (email: string) => email.trim().toLowerCase(),
	sendEmailChangeVerification: vi.fn(),
	sendSignupVerification: vi.fn(),
}));

import { db } from "@/db";
import { verifyPassword } from "@/lib/auth.server";
import {
	consumeEmailVerificationToken,
	sendEmailChangeVerification,
	sendSignupVerification,
} from "@/lib/email-verification.server";
import {
	requestEmailChangeFn,
	resendEmailVerificationFn,
	verifyEmailFn,
} from "@/lib/email-verification-actions.server";
import { enforceRateLimit } from "@/lib/rate-limit.server";
import { getCurrentUser } from "@/lib/sessions.server";
import { createQueryChain, makeSafeUser } from "@/test/mocks";

describe("email verification actions", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(getCurrentUser).mockResolvedValue(
			makeSafeUser({ id: 7, email: "old@example.com", isActivated: false }),
		);
		vi.mocked(enforceRateLimit).mockResolvedValue({ allowed: true });
	});

	it("resends only for the signed-in unverified account and rate limits by id", async () => {
		await expect(resendEmailVerificationFn()).resolves.toEqual({
			success: true,
		});
		expect(enforceRateLimit).toHaveBeenCalledWith(
			"email_verification_resend",
			"7",
		);
		expect(sendSignupVerification).toHaveBeenCalledWith(7, "old@example.com");
	});

	it("does not reveal or send anything for an already verified account", async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(
			makeSafeUser({ id: 7, email: "old@example.com", isActivated: true }),
		);
		await expect(resendEmailVerificationFn()).resolves.toEqual({
			success: true,
		});
		expect(sendSignupVerification).not.toHaveBeenCalled();
	});

	it("requires the current password without changing the stored email", async () => {
		vi.mocked(db.select).mockReturnValueOnce(
			createQueryChain([{ passhash: "hash" }]) as never,
		);
		vi.mocked(verifyPassword).mockResolvedValue(false);
		await expect(
			requestEmailChangeFn({
				data: { email: "new@example.com", currentPassword: "wrong" },
			}),
		).resolves.toEqual({
			success: false,
			error: "Current password is incorrect",
		});
		expect(db.update).not.toHaveBeenCalled();
		expect(sendEmailChangeVerification).not.toHaveBeenCalled();
	});

	it("rejects address collisions before issuing a change token", async () => {
		vi.mocked(db.select)
			.mockReturnValueOnce(createQueryChain([{ passhash: "hash" }]) as never)
			.mockReturnValueOnce(createQueryChain([{ id: 9 }]) as never);
		vi.mocked(verifyPassword).mockResolvedValue(true);
		await expect(
			requestEmailChangeFn({
				data: { email: "used@example.com", currentPassword: "correct" },
			}),
		).resolves.toEqual({
			success: false,
			error: "Email address is already in use",
		});
		expect(sendEmailChangeVerification).not.toHaveBeenCalled();
	});

	it("stores a pending address only in the emailed token payload", async () => {
		vi.mocked(db.select)
			.mockReturnValueOnce(createQueryChain([{ passhash: "hash" }]) as never)
			.mockReturnValueOnce(createQueryChain([]) as never);
		vi.mocked(verifyPassword).mockResolvedValue(true);
		await expect(
			requestEmailChangeFn({
				data: { email: " NEW@example.com ", currentPassword: "correct" },
			}),
		).resolves.toEqual({ success: true });
		expect(db.update).not.toHaveBeenCalled();
		expect(sendEmailChangeVerification).toHaveBeenCalledWith(
			7,
			"new@example.com",
		);
	});

	it("exposes the same generic token consumer result publicly", async () => {
		vi.mocked(consumeEmailVerificationToken).mockResolvedValue({
			success: false,
			error: "Verification link is invalid or has expired",
		});
		await expect(
			verifyEmailFn({ data: { token: "a".repeat(64) } }),
		).resolves.toEqual({
			success: false,
			error: "Verification link is invalid or has expired",
		});
	});
});
