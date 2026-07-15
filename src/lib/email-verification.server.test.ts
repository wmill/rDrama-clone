import crypto from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
	const pipeline = { del: vi.fn(), set: vi.fn(), exec: vi.fn() };
	pipeline.del.mockReturnValue(pipeline);
	pipeline.set.mockReturnValue(pipeline);
	return {
		redis: {
			get: vi.fn(),
			getdel: vi.fn(),
			del: vi.fn(),
			pipeline: vi.fn(() => pipeline),
		},
		pipeline,
		db: { transaction: vi.fn() },
		sendMail: vi.fn(),
		getRequest: vi.fn(() => {
			throw new Error("no request");
		}),
	};
});

vi.mock("@/lib/redis", () => ({ redis: mocks.redis }));
vi.mock("@/db", () => ({ db: mocks.db }));
vi.mock("@/lib/mail.server", () => ({ sendMail: mocks.sendMail }));
vi.mock("@tanstack/react-start/server", () => ({
	getRequest: mocks.getRequest,
}));

import {
	consumeEmailVerificationToken,
	sendEmailChangeVerification,
	sendSignupVerification,
} from "@/lib/email-verification.server";

function transaction(collision: boolean, updated = true) {
	const returning = vi.fn().mockResolvedValue(updated ? [{ id: 7 }] : []);
	const whereUpdate = vi.fn(() => ({ returning }));
	const set = vi.fn(() => ({ where: whereUpdate }));
	const limit = vi.fn().mockResolvedValue(collision ? [{ id: 9 }] : []);
	const tx = {
		execute: vi.fn(),
		select: vi.fn(() => ({
			from: vi.fn(() => ({ where: vi.fn(() => ({ limit })) })),
		})),
		update: vi.fn(() => ({ set })),
	};
	mocks.db.transaction.mockImplementationOnce(async (fn) => fn(tx));
	return { tx, set };
}

describe("email verification tokens", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		process.env.AUTH_BASE_URL = "https://rdreamer.test";
		vi.spyOn(crypto, "randomBytes").mockImplementation(() =>
			Buffer.alloc(32, 2),
		);
	});

	it("issues an opaque one-hour signup token and mails it", async () => {
		mocks.redis.get.mockResolvedValueOnce(null);
		await sendSignupVerification(7, " User@Example.com ");

		const token = "02".repeat(32);
		expect(mocks.pipeline.set).toHaveBeenCalledWith(
			`email_verification:${token}`,
			JSON.stringify({
				userId: 7,
				email: "user@example.com",
				purpose: "signup",
			}),
			"EX",
			3600,
		);
		expect(mocks.sendMail).toHaveBeenCalledWith(
			expect.objectContaining({
				to: "user@example.com",
				text: expect.stringContaining(
					`https://rdreamer.test/verify-email?token=${token}`,
				),
			}),
		);
	});

	it("replaces a previous token for the same user and purpose", async () => {
		mocks.redis.get.mockResolvedValueOnce("old-token");
		await sendEmailChangeVerification(7, "new@example.com");
		expect(mocks.pipeline.del).toHaveBeenCalledWith(
			"email_verification:old-token",
		);
	});

	it("rejects expired and replayed tokens without a database write", async () => {
		mocks.redis.getdel.mockResolvedValue(null);
		await expect(consumeEmailVerificationToken("missing")).resolves.toEqual({
			success: false,
			error: "Verification link is invalid or has expired",
		});
		expect(mocks.db.transaction).not.toHaveBeenCalled();
	});

	it("atomically consumes a token and activates the address", async () => {
		mocks.redis.getdel.mockResolvedValueOnce(
			JSON.stringify({
				userId: 7,
				email: "new@example.com",
				purpose: "change",
			}),
		);
		const { set } = transaction(false);

		await expect(consumeEmailVerificationToken("token")).resolves.toEqual({
			success: true,
			email: "new@example.com",
		});
		expect(mocks.redis.getdel).toHaveBeenCalledWith("email_verification:token");
		expect(set).toHaveBeenCalledWith({
			email: "new@example.com",
			isActivated: true,
		});
	});

	it("rejects a collision found under the transaction lock", async () => {
		mocks.redis.getdel.mockResolvedValueOnce(
			JSON.stringify({
				userId: 7,
				email: "used@example.com",
				purpose: "change",
			}),
		);
		transaction(true);
		await expect(consumeEmailVerificationToken("token")).resolves.toEqual({
			success: false,
			error: "Email address is already in use",
		});
	});
});
