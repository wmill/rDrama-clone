import { createServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";

import type { SafeUser } from "@/lib/auth.server";
import { getCurrentUser } from "@/lib/sessions.server";

export type AuthUser = SafeUser;

type AuthState = {
	user: AuthUser | null;
	ready: boolean;
	refresh: () => Promise<void>;
};

const getCurrentUserFn = createServerFn({ method: "GET" }).handler(async () => {
	return getCurrentUser();
});

export function useAuth(): AuthState {
	const [user, setUser] = useState<AuthUser | null>(null);
	const [ready, setReady] = useState(false);

	const refresh = useCallback(async () => {
		try {
			const currentUser = await getCurrentUserFn();
			setUser(currentUser);
		} catch {
			setUser(null);
		} finally {
			setReady(true);
		}
	}, []);

	useEffect(() => {
		refresh();
	}, [refresh]);

	return {
		user,
		ready,
		refresh,
	};
}
