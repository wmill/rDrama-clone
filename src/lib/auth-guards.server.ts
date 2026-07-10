import type { SafeUser } from "@/lib/auth.server";
import { getCurrentUser } from "@/lib/sessions.server";

export const NOT_LOGGED_IN_ERROR = "Not logged in";
export const UNAUTHORIZED_ERROR = "Unauthorized";

export type GuardResult =
	| { ok: true; user: SafeUser }
	| { ok: false; error: string };

export async function requireUser(): Promise<GuardResult> {
	const user = await getCurrentUser();
	if (!user) {
		return { ok: false, error: NOT_LOGGED_IN_ERROR };
	}

	return { ok: true, user };
}

export async function requireAdmin(minAdminLevel = 2): Promise<GuardResult> {
	const user = await getCurrentUser();
	if (!user || user.adminLevel < minAdminLevel) {
		return { ok: false, error: UNAUTHORIZED_ERROR };
	}

	return { ok: true, user };
}

// For GET/loader server fns that return data rather than an ActionResult:
// throwing makes a direct RPC call fail instead of leaking admin data.
export async function assertAdmin(minAdminLevel = 2): Promise<SafeUser> {
	const guard = await requireAdmin(minAdminLevel);
	if (!guard.ok) {
		throw new Error(guard.error);
	}

	return guard.user;
}
