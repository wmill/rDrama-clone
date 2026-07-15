import { useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { create } from "zustand";

import type { SafeUser } from "@/lib/auth.server";
import { getCurrentUserFn } from "@/lib/session-actions.server";

export type AuthUser = SafeUser;

type AuthState = {
	user: AuthUser | null;
	ready: boolean;
	refresh: () => Promise<void>;
};

type AuthStoreState = {
	user: AuthUser | null;
	ready: boolean;
	refresh: () => Promise<void>;
};

let refreshInFlight: Promise<void> | null = null;

const useAuthStore = create<AuthStoreState>((set) => ({
	user: null,
	ready: false,
	refresh: async () => {
		if (refreshInFlight) return refreshInFlight;

		refreshInFlight = (async () => {
			try {
				const currentUser = await getCurrentUserFn();
				set({ user: currentUser, ready: true });
			} catch {
				set({ user: null, ready: true });
			} finally {
				refreshInFlight = null;
			}
		})();

		return refreshInFlight;
	},
}));

export function useAuth(): AuthState {
	const user = useAuthStore((state) => state.user);
	const ready = useAuthStore((state) => state.ready);
	const refresh = useAuthStore((state) => state.refresh);
	const currentHref = useRouterState({
		select: (state) => state.location.href,
	});

	useEffect(() => {
		void currentHref;
		void refresh();
	}, [refresh, currentHref]);

	return {
		user,
		ready,
		refresh,
	};
}
