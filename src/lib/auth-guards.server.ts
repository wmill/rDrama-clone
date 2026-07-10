import type { SafeUser } from "@/lib/auth.server";
import { getCurrentUser } from "@/lib/sessions.server";

export const NOT_LOGGED_IN_ERROR = "Not logged in";
export const UNAUTHORIZED_ERROR = "Unauthorized";

// Shared result shape for all *-actions.server.ts server fns.
export type ActionFailure = { success: false; error: string };
export type ActionResult<T = Record<never, never>> =
	| ({ success: true } & T)
	| ActionFailure;

export function fail(error: string): ActionFailure {
	return { success: false, error };
}

export type GuardResult =
	| { ok: true; user: SafeUser }
	| { ok: false; failure: ActionFailure };

export async function requireUser(): Promise<GuardResult> {
	const user = await getCurrentUser();
	if (!user) {
		return { ok: false, failure: fail(NOT_LOGGED_IN_ERROR) };
	}

	return { ok: true, user };
}

export async function requireAdmin(minAdminLevel = 2): Promise<GuardResult> {
	const user = await getCurrentUser();
	if (!user || user.adminLevel < minAdminLevel) {
		return { ok: false, failure: fail(UNAUTHORIZED_ERROR) };
	}

	return { ok: true, user };
}

// For GET/loader server fns that return data rather than an ActionResult:
// throwing makes a direct RPC call fail instead of leaking admin data.
export async function assertAdmin(minAdminLevel = 2): Promise<SafeUser> {
	const guard = await requireAdmin(minAdminLevel);
	if (!guard.ok) {
		throw new Error(guard.failure.error);
	}

	return guard.user;
}
