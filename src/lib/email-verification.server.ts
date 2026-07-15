import crypto from "node:crypto";
import { getRequest } from "@tanstack/react-start/server";
import { and, eq, ne, sql } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";
import { sendMail } from "@/lib/mail.server";
import { redis } from "@/lib/redis";

const EMAIL_VERIFICATION_TTL_SECONDS = 60 * 60;

type EmailVerificationPurpose = "signup" | "change";
type EmailVerificationPayload = {
	userId: number;
	email: string;
	purpose: EmailVerificationPurpose;
};

function tokenKey(token: string): string {
	return `email_verification:${token}`;
}

function userTokenKey(
	userId: number,
	purpose: EmailVerificationPurpose,
): string {
	return `email_verification_user:${userId}:${purpose}`;
}

export function normalizeEmailAddress(email: string): string {
	return email.trim().toLowerCase();
}

function requestOrigin(): string {
	try {
		const url = new URL(getRequest().url);
		return `${url.protocol}//${url.host}`;
	} catch {
		const fallback = process.env.AUTH_BASE_URL?.trim();
		if (!fallback) throw new Error("AUTH_BASE_URL is not set");
		return fallback;
	}
}

async function storeToken(payload: EmailVerificationPayload): Promise<string> {
	const mappingKey = userTokenKey(payload.userId, payload.purpose);
	const previous = await redis.get(mappingKey);
	const token = crypto.randomBytes(32).toString("hex");
	const pipeline = redis.pipeline();
	if (previous) pipeline.del(tokenKey(previous));
	pipeline.set(
		tokenKey(token),
		JSON.stringify(payload),
		"EX",
		EMAIL_VERIFICATION_TTL_SECONDS,
	);
	pipeline.set(mappingKey, token, "EX", EMAIL_VERIFICATION_TTL_SECONDS);
	await pipeline.exec();
	return token;
}

async function sendVerificationMail(
	payload: EmailVerificationPayload,
): Promise<void> {
	const token = await storeToken(payload);
	const url = `${requestOrigin()}/verify-email?token=${encodeURIComponent(token)}`;
	const changing = payload.purpose === "change";
	await sendMail({
		to: payload.email,
		subject: changing
			? "Confirm your new email address"
			: "Verify your email address",
		text: `${changing ? "Confirm your new email address" : "Verify your email address"} within 1 hour:\n\n${url}`,
		html: `<p><a href="${url}">${changing ? "Confirm new email" : "Verify email"}</a></p><p>This link expires in 1 hour.</p>`,
	});
}

export async function sendSignupVerification(
	userId: number,
	email: string,
): Promise<void> {
	return sendVerificationMail({
		userId,
		email: normalizeEmailAddress(email),
		purpose: "signup",
	});
}

export async function sendEmailChangeVerification(
	userId: number,
	email: string,
): Promise<void> {
	return sendVerificationMail({
		userId,
		email: normalizeEmailAddress(email),
		purpose: "change",
	});
}

export async function consumeEmailVerificationToken(
	token: string,
): Promise<
	{ success: true; email: string } | { success: false; error: string }
> {
	const raw = await redis.getdel(tokenKey(token));
	if (!raw)
		return {
			success: false,
			error: "Verification link is invalid or has expired",
		};
	const payload = JSON.parse(raw) as EmailVerificationPayload;
	await redis.del(userTokenKey(payload.userId, payload.purpose));

	try {
		await db.transaction(async (tx) => {
			await tx.execute(
				sql`select pg_advisory_xact_lock(hashtext(${payload.email}))`,
			);
			const [collision] = await tx
				.select({ id: users.id })
				.from(users)
				.where(
					and(
						sql`lower(${users.email}) = ${payload.email}`,
						ne(users.id, payload.userId),
					),
				)
				.limit(1);
			if (collision) throw new Error("EMAIL_COLLISION");
			const updateCondition =
				payload.purpose === "signup"
					? and(
							eq(users.id, payload.userId),
							sql`lower(${users.email}) = ${payload.email}`,
						)
					: eq(users.id, payload.userId);
			const updated = await tx
				.update(users)
				.set({ email: payload.email, isActivated: true })
				.where(updateCondition)
				.returning({ id: users.id });
			if (updated.length === 0) throw new Error("ACCOUNT_MISSING");
		});
	} catch (error) {
		if (error instanceof Error && error.message === "EMAIL_COLLISION") {
			return { success: false, error: "Email address is already in use" };
		}
		if (error instanceof Error && error.message === "ACCOUNT_MISSING") {
			return {
				success: false,
				error: "Verification link is invalid or has expired",
			};
		}
		throw error;
	}

	return { success: true, email: payload.email };
}
