import crypto from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
	const selectLimit = vi.fn();
	const selectWhere = vi.fn(() => ({
		limit: selectLimit,
	}));
	const selectFrom = vi.fn(() => ({
		where: selectWhere,
	}));
	const select = vi.fn(() => ({
		from: selectFrom,
	}));

	const updateWhere = vi.fn();
	const updateSet = vi.fn(() => ({
		where: updateWhere,
	}));
	const update = vi.fn(() => ({
		set: updateSet,
	}));

	const redisGet = vi.fn();
	const redisDel = vi.fn();
	const pipelineSet = vi.fn();
	const pipelineDel = vi.fn();
	const pipelineExec = vi.fn();
	const pipeline = {
		set: pipelineSet.mockReturnThis(),
		del: pipelineDel.mockReturnThis(),
		exec: pipelineExec,
	};
	const redisPipeline = vi.fn(() => pipeline);

	return {
		db: {
			select,
			update,
		},
		redis: {
			get: redisGet,
			del: redisDel,
			pipeline: redisPipeline,
		},
		auth: {
			getUserByEmail: vi.fn(),
			hashPassword: vi.fn(),
			sanitizeUser: vi.fn((user) => ({
				id: user.id,
				username: user.username,
				email: user.email,
			})),
		},
		sendMail: vi.fn(),
		deleteAllUserSessions: vi.fn(),
		getRequest: vi.fn(() => {
			throw new Error("no request");
		}),
		selectLimit,
		updateSet,
		updateWhere,
		redisGet,
		redisDel,
		pipelineSet,
		pipelineDel,
		pipelineExec,
		redisPipeline,
	};
});

vi.mock("@/db", () => ({
	db: mocks.db,
}));

vi.mock("@/lib/redis", () => ({
	redis: mocks.redis,
}));

vi.mock("@/lib/auth.server", () => ({
	getUserByEmail: mocks.auth.getUserByEmail,
	hashPassword: mocks.auth.hashPassword,
	sanitizeUser: mocks.auth.sanitizeUser,
}));

vi.mock("@/lib/mail.server", () => ({
	sendMail: mocks.sendMail,
}));

vi.mock("@/lib/sessions.server", () => ({
	deleteAllUserSessions: mocks.deleteAllUserSessions,
}));

vi.mock("@tanstack/react-start/server", () => ({
	getRequest: mocks.getRequest,
}));

import { sendMail } from "@/lib/mail.server";
import {
	requestPasswordReset,
	resetPasswordWithToken,
	validatePasswordResetToken,
} from "@/lib/password-reset.server";
import { deleteAllUserSessions } from "@/lib/sessions.server";

describe("password reset", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		process.env.AUTH_BASE_URL = "https://rDreamer.test";
	});

	it("stores a reset token and sends a reset link for known users", async () => {
		mocks.auth.getUserByEmail.mockResolvedValue({
			id: 42,
			email: "user@example.com",
			loginNonce: 9,
		});
		mocks.redisGet.mockResolvedValueOnce("previous-token");
		vi.spyOn(crypto, "randomBytes").mockImplementation(() =>
			Buffer.alloc(32, 1),
		);

		await requestPasswordReset("  USER@example.com ");

		expect(mocks.auth.getUserByEmail).toHaveBeenCalledWith("user@example.com");
		expect(mocks.redisDel).toHaveBeenCalledWith(
			"password_reset:previous-token",
		);
		expect(mocks.pipelineSet).toHaveBeenNthCalledWith(
			1,
			"password_reset:0101010101010101010101010101010101010101010101010101010101010101",
			JSON.stringify({ userId: 42, loginNonce: 9 }),
			"EX",
			3600,
		);
		expect(mocks.pipelineSet).toHaveBeenNthCalledWith(
			2,
			"password_reset_user:42",
			"0101010101010101010101010101010101010101010101010101010101010101",
			"EX",
			3600,
		);
		expect(mocks.pipelineExec).toHaveBeenCalledTimes(1);
		expect(sendMail).toHaveBeenCalledWith(
			expect.objectContaining({
				to: "user@example.com",
				subject: "Password Reset Request",
				text: expect.stringContaining(
					"https://rDreamer.test/reset-password?token=0101010101010101010101010101010101010101010101010101010101010101",
				),
			}),
		);
	});

	it("does nothing for unknown emails", async () => {
		mocks.auth.getUserByEmail.mockResolvedValue(null);

		await requestPasswordReset("missing@example.com");

		expect(mocks.redisPipeline).not.toHaveBeenCalled();
		expect(sendMail).not.toHaveBeenCalled();
	});

	it("validates a token against the stored login nonce", async () => {
		mocks.redisGet.mockResolvedValueOnce(
			JSON.stringify({ userId: 7, loginNonce: 5 }),
		);
		mocks.selectLimit.mockResolvedValueOnce([
			{
				id: 7,
				username: "alice",
				email: "alice@example.com",
				loginNonce: 5,
			},
		]);

		const user = await validatePasswordResetToken("good-token");

		expect(user).toEqual({
			id: 7,
			username: "alice",
			email: "alice@example.com",
		});
	});

	it("rejects password resets with invalid or expired tokens", async () => {
		mocks.redisGet.mockResolvedValueOnce(null);

		await expect(
			resetPasswordWithToken("missing-token", "longenough"),
		).resolves.toEqual({
			success: false,
			error: "Reset link is invalid or has expired",
		});
	});

	it("updates the password, deletes the token, and clears sessions", async () => {
		mocks.redisGet.mockResolvedValueOnce(
			JSON.stringify({ userId: 99, loginNonce: 4 }),
		);
		mocks.selectLimit.mockResolvedValueOnce([
			{
				id: 99,
				loginNonce: 4,
			},
		]);
		mocks.auth.hashPassword.mockResolvedValue("next-hash");

		const result = await resetPasswordWithToken("reset-token", "new-password");

		expect(result).toEqual({ success: true });
		expect(mocks.auth.hashPassword).toHaveBeenCalledWith("new-password");
		expect(mocks.updateSet).toHaveBeenCalledWith(
			expect.objectContaining({
				passhash: "next-hash",
			}),
		);
		expect(mocks.updateWhere).toHaveBeenCalledTimes(1);
		expect(mocks.pipelineDel).toHaveBeenCalledWith(
			"password_reset:reset-token",
		);
		expect(mocks.pipelineDel).toHaveBeenCalledWith("password_reset_user:99");
		expect(mocks.pipelineExec).toHaveBeenCalledTimes(1);
		expect(deleteAllUserSessions).toHaveBeenCalledWith(99);
	});
});
