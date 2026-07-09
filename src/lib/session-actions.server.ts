import { createServerFn } from "@tanstack/react-start";
import {
	deleteOtherUserSessions,
	getCurrentUser,
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
		const user = await getCurrentUser();
		if (!user) {
			return { success: false as const, error: "Not logged in" };
		}

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
		const user = await getCurrentUser();
		if (!user) {
			return { success: false as const, error: "Not logged in" };
		}

		const currentSessionId = getSessionIdFromCookie();
		if (!currentSessionId) {
			return { success: false as const, error: "No active session" };
		}

		const removed = await deleteOtherUserSessions(user.id, currentSessionId);
		return { success: true as const, removed };
	},
);
