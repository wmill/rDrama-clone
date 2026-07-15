import { createServerFn } from "@tanstack/react-start";
import { and, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { users } from "@/db/schema";
import { verifyPassword } from "@/lib/auth.server";
import { fail, requireUser } from "@/lib/auth-guards.server";
import {
	consumeEmailVerificationToken,
	normalizeEmailAddress,
	sendEmailChangeVerification,
	sendSignupVerification,
} from "@/lib/email-verification.server";
import { enforceRateLimit } from "@/lib/rate-limit.server";

export const emailChangeInputSchema = z.object({
	email: z.string().trim().email("Enter a valid email address"),
	currentPassword: z.string().min(1, "Enter your current password"),
});

export const verificationTokenInputSchema = z.object({
	token: z.string().regex(/^[0-9a-f]{64}$/, "Invalid verification token"),
});

export const resendEmailVerificationFn = createServerFn({
	method: "POST",
}).handler(async () => {
	const guard = await requireUser();
	if (!guard.ok) return guard.failure;
	const user = guard.user;
	const rate = await enforceRateLimit(
		"email_verification_resend",
		String(user.id),
	);
	if (!rate.allowed) return fail(rate.error);
	if (user.isActivated || !user.email) return { success: true as const };
	await sendSignupVerification(user.id, user.email);
	return { success: true as const };
});

export const requestEmailChangeFn = createServerFn({ method: "POST" })
	.inputValidator((data: { email: string; currentPassword: string }) =>
		emailChangeInputSchema.parse(data),
	)
	.handler(async ({ data }) => {
		const guard = await requireUser();
		if (!guard.ok) return guard.failure;
		const user = guard.user;
		const rate = await enforceRateLimit(
			"email_change_request",
			String(user.id),
		);
		if (!rate.allowed) return fail(rate.error);

		const email = normalizeEmailAddress(data.email);
		const [account] = await db
			.select({ passhash: users.passhash })
			.from(users)
			.where(eq(users.id, user.id))
			.limit(1);
		if (
			!account ||
			!(await verifyPassword(data.currentPassword, account.passhash))
		) {
			return fail("Current password is incorrect");
		}
		const [collision] = await db
			.select({ id: users.id })
			.from(users)
			.where(and(sql`lower(${users.email}) = ${email}`, ne(users.id, user.id)))
			.limit(1);
		if (collision) return fail("Email address is already in use");

		await sendEmailChangeVerification(user.id, email);
		return { success: true as const };
	});

export const verifyEmailFn = createServerFn({ method: "POST" })
	.inputValidator((data: { token: string }) =>
		verificationTokenInputSchema.parse(data),
	)
	.handler(async ({ data }) => consumeEmailVerificationToken(data.token));
