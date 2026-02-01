import { createMiddleware } from "@tanstack/react-start";
import { redirect } from "@tanstack/react-router";

import type { SafeUser } from "@/lib/auth.server";
import { getCurrentUser } from "@/lib/sessions.server";

export const authMiddleware = createMiddleware().server(async ({ next }) => {
	const user = await getCurrentUser();
	return next({ context: { user } });
});

export const requireAuth = createMiddleware().server(async ({ next }) => {
	const user = await getCurrentUser();
	if (!user) {
		throw redirect({ to: "/login" });
	}
	return next({ context: { user } });
});

export const requireAdmin = (minLevel = 1) =>
	createMiddleware().server(async ({ next }) => {
		const user = await getCurrentUser();
		if (!user) {
			throw redirect({ to: "/login" });
		}
		if (user.adminLevel < minLevel) {
			throw redirect({ to: "/" });
		}
		return next({ context: { user } });
	});

export const requireGuest = createMiddleware().server(async ({ next }) => {
	const user = await getCurrentUser();
	if (user) {
		throw redirect({ to: "/" });
	}
	return next({ context: { user: null } });
});

export type AuthContext = {
	user: SafeUser | null;
};

export type RequiredAuthContext = {
	user: SafeUser;
};
