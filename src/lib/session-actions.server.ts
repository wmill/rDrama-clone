import { createServerFn } from "@tanstack/react-start";
import { fail, requireUser } from "@/lib/auth-guards.server";
import {
	deleteOtherUserSessions,
	getSessionIdFromCookie,
	listUserSessions,
} from "@/lib/sessions.server";

export type ClientSessionInfo = {
	// truncated id prefix, safe to render; full session ids are auth tokens
	key: string;
	createdAt: string;
	userAgent: string | null;
	ipAddress: string | null;
	isCurrent: boolean;
};

export const listSessionsFn = createServerFn({ method: "GET" }).handler(
	async () => {
		const guard = await requireUser();
		if (!guard.ok) {
			return guard.failure;
		}
		const user = guard.user;

		const sessions = await listUserSessions(user.id, getSessionIdFromCookie());
		return {
			success: true as const,
			sessions: sessions.map(
				(session): ClientSessionInfo => ({
					key: session.id.slice(0, 8),
					createdAt: session.createdAt.toISOString(),
					userAgent: session.userAgent,
					ipAddress: session.ipAddress,
					isCurrent: session.isCurrent,
				}),
			),
		};
	},
);

export const logoutOtherSessionsFn = createServerFn({ method: "POST" }).handler(
	async () => {
		const guard = await requireUser();
		if (!guard.ok) {
			return guard.failure;
		}
		const user = guard.user;

		const currentSessionId = getSessionIdFromCookie();
		if (!currentSessionId) {
			return fail("No active session");
		}

		const removed = await deleteOtherUserSessions(user.id, currentSessionId);
		return { success: true as const, removed };
	},
);
