import { createServerFn } from "@tanstack/react-start";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { users } from "@/db/schema";
import { hashPassword, verifyPassword } from "@/lib/auth.server";
import { fail, requireUser } from "@/lib/auth-guards.server";
import { invalidatePasswordResetTokens } from "@/lib/password-reset.server";
import { enforceRateLimit } from "@/lib/rate-limit.server";
import {
	deleteOtherUserSessions,
	getSessionIdFromCookie,
} from "@/lib/sessions.server";

export const changePasswordInputSchema = z
	.object({
		currentPassword: z.string().min(1, "Enter your current password"),
		newPassword: z
			.string()
			.min(8, "Password must be at least 8 characters")
			.max(128, "Password must be 128 characters or fewer"),
		confirmPassword: z.string(),
	})
	.refine((data) => data.newPassword === data.confirmPassword, {
		path: ["confirmPassword"],
		message: "Passwords do not match",
	});

export const changePasswordFn = createServerFn({ method: "POST" })
	.inputValidator(
		(data: {
			currentPassword: string;
			newPassword: string;
			confirmPassword: string;
		}) => changePasswordInputSchema.parse(data),
	)
	.handler(async ({ data }) => {
		const guard = await requireUser();
		if (!guard.ok) return guard.failure;
		const user = guard.user;

		const rate = await enforceRateLimit(
			"account_password_change",
			String(user.id),
		);
		if (!rate.allowed) return fail(rate.error);

		const currentSessionId = getSessionIdFromCookie();
		if (!currentSessionId) return fail("Current session is unavailable");

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

		const passhash = await hashPassword(data.newPassword);
		await db
			.update(users)
			.set({
				passhash,
				loginNonce: sql`${users.loginNonce} + 1`,
			})
			.where(eq(users.id, user.id));

		await Promise.all([
			invalidatePasswordResetTokens(user.id),
			deleteOtherUserSessions(user.id, currentSessionId),
		]);

		return { success: true as const };
	});
