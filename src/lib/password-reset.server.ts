import crypto from "node:crypto";
import { getRequest } from "@tanstack/react-start/server";
import { eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";
import { enforceRateLimit, getClientIp } from "@/lib/rate-limit.server";
import { redis } from "@/lib/redis";
import { deleteAllUserSessions } from "@/lib/sessions.server";
import {
	getUserByEmail,
	hashPassword,
	type SafeUser,
	sanitizeUser,
} from "./auth.server";
import { sendMail } from "./mail.server";

const PASSWORD_RESET_TTL_SECONDS = 60 * 60;

type PasswordResetPayload = {
	userId: number;
	loginNonce: number;
};

function passwordResetTokenKey(token: string): string {
	return `password_reset:${token}`;
}

function passwordResetUserKey(userId: number): string {
	return `password_reset_user:${userId}`;
}

function normalizeEmail(email: string): string {
	return email.trim().toLowerCase();
}

function getRequestOrigin(): string {
	try {
		const request = getRequest();
		const url = new URL(request.url);
		return `${url.protocol}//${url.host}`;
	} catch {
		const fallback = process.env.AUTH_BASE_URL?.trim();
		if (!fallback) {
			throw new Error("AUTH_BASE_URL is not set");
		}
		return fallback;
	}
}

async function storePasswordResetToken(
	userId: number,
	loginNonce: number,
): Promise<string> {
	const previousToken = await redis.get(passwordResetUserKey(userId));
	if (previousToken) {
		await redis.del(passwordResetTokenKey(previousToken));
	}

	const token = crypto.randomBytes(32).toString("hex");
	const payload: PasswordResetPayload = { userId, loginNonce };
	const pipeline = redis.pipeline();

	pipeline.set(
		passwordResetTokenKey(token),
		JSON.stringify(payload),
		"EX",
		PASSWORD_RESET_TTL_SECONDS,
	);
	pipeline.set(
		passwordResetUserKey(userId),
		token,
		"EX",
		PASSWORD_RESET_TTL_SECONDS,
	);

	await pipeline.exec();

	return token;
}

async function getPasswordResetPayload(
	token: string,
): Promise<PasswordResetPayload | null> {
	const raw = await redis.get(passwordResetTokenKey(token));
	if (!raw) {
		return null;
	}

	return JSON.parse(raw) as PasswordResetPayload;
}

async function deletePasswordResetToken(
	token: string,
	userId: number,
): Promise<void> {
	const pipeline = redis.pipeline();
	pipeline.del(passwordResetTokenKey(token));
	pipeline.del(passwordResetUserKey(userId));
	await pipeline.exec();
}

export async function requestPasswordReset(
	email: string,
): Promise<{ success: true } | { success: false; error: string }> {
	const normalizedEmail = normalizeEmail(email);

	const rate = await enforceRateLimit(
		"password_reset_request",
		getClientIp() ?? normalizedEmail,
	);
	if (!rate.allowed) {
		return { success: false, error: rate.error };
	}

	const user = await getUserByEmail(normalizedEmail);
	if (!user?.email) {
		// Deliberately indistinguishable from success (no account enumeration).
		return { success: true };
	}

	const token = await storePasswordResetToken(user.id, user.loginNonce);
	const origin = getRequestOrigin();
	const resetUrl = `${origin}/reset-password?token=${encodeURIComponent(token)}`;
	const siteName = "rDreamer";

	await sendMail({
		to: user.email,
		subject: "Password Reset Request",
		text: [
			`A password reset was requested for your ${siteName} account.`,
			"",
			`Use this link within 1 hour to set a new password:`,
			resetUrl,
			"",
			"If you did not request this, you can ignore this email.",
		].join("\n"),
		html: [
			`<p>A password reset was requested for your ${siteName} account.</p>`,
			`<p><a href="${resetUrl}">Reset your password</a></p>`,
			"<p>This link expires in 1 hour.</p>",
			"<p>If you did not request this, you can ignore this email.</p>",
		].join(""),
	});

	return { success: true };
}

export async function validatePasswordResetToken(
	token: string,
): Promise<SafeUser | null> {
	const payload = await getPasswordResetPayload(token);
	if (!payload) {
		return null;
	}

	const [user] = await db
		.select()
		.from(users)
		.where(eq(users.id, payload.userId))
		.limit(1);

	if (!user || user.loginNonce !== payload.loginNonce) {
		return null;
	}

	return sanitizeUser(user);
}

export async function resetPasswordWithToken(
	token: string,
	password: string,
): Promise<{ success: true } | { success: false; error: string }> {
	const rate = await enforceRateLimit(
		"password_reset_consume",
		getClientIp() ?? token.slice(0, 16),
	);
	if (!rate.allowed) {
		return { success: false, error: rate.error };
	}

	const payload = await getPasswordResetPayload(token);
	if (!payload) {
		return { success: false, error: "Reset link is invalid or has expired" };
	}

	const [user] = await db
		.select()
		.from(users)
		.where(eq(users.id, payload.userId))
		.limit(1);

	if (!user || user.loginNonce !== payload.loginNonce) {
		return { success: false, error: "Reset link is invalid or has expired" };
	}

	if (password.length < 8) {
		return {
			success: false,
			error: "Password must be at least 8 characters",
		};
	}

	const nextHash = await hashPassword(password);

	await db
		.update(users)
		.set({
			passhash: nextHash,
			loginNonce: sql`${users.loginNonce} + 1`,
		})
		.where(eq(users.id, user.id));

	await Promise.all([
		deletePasswordResetToken(token, user.id),
		deleteAllUserSessions(user.id),
	]);

	return { success: true };
}
