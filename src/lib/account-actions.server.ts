import { createServerFn } from "@tanstack/react-start";
import { and, eq, ne, or, sql } from "drizzle-orm";
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
import { usernameSchema } from "@/lib/validation";

export const changeUsernameInputSchema = z.object({
	username: usernameSchema,
	currentPassword: z.string().min(1, "Enter your current password"),
});

export const changeUsernameFn = createServerFn({ method: "POST" })
	.inputValidator((data: { username: string; currentPassword: string }) =>
		changeUsernameInputSchema.parse(data),
	)
	.handler(async ({ data }) => {
		const guard = await requireUser();
		if (!guard.ok) return guard.failure;
		const user = guard.user;
		const rate = await enforceRateLimit(
			"account_username_change",
			String(user.id),
		);
		if (!rate.allowed) return fail(rate.error);

		const username = data.username.trim();
		const normalized = username.toLowerCase();
		const [account] = await db
			.select({
				username: users.username,
				originalUsername: users.originalUsername,
				passhash: users.passhash,
			})
			.from(users)
			.where(eq(users.id, user.id))
			.limit(1);
		if (
			!account ||
			!(await verifyPassword(data.currentPassword, account.passhash))
		) {
			return fail("Current password is incorrect");
		}

		const changed = await db.transaction(async (tx) => {
			await tx.execute(
				sql`select pg_advisory_xact_lock(hashtext(${`username:${normalized}`}))`,
			);
			const [collision] = await tx
				.select({ id: users.id })
				.from(users)
				.where(
					and(
						ne(users.id, user.id),
						or(
							sql`lower(${users.username}) = ${normalized}`,
							sql`lower(${users.originalUsername}) = ${normalized}`,
						),
					),
				)
				.limit(1);
			if (collision) return false;

			await tx
				.update(users)
				.set({
					username,
					originalUsername: account.originalUsername ?? account.username,
				})
				.where(eq(users.id, user.id));
			return true;
		});
		if (!changed) return fail("Username is already in use");
		return { success: true as const, username };
	});

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
