import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

export type AuthUser = {
	id: number
	username: string
}

type AuthState = {
	user: AuthUser | null
	ready: boolean
	login: (user: AuthUser) => void
	logout: () => void
	setReady: () => void
}

export const useAuthStore = create<AuthState>()(
	persist(
		(set) => ({
			user: null,
			ready: typeof window === "undefined",
			login: (user) => set({ user, ready: true }),
			logout: () => set({ user: null, ready: true }),
			setReady: () => set({ ready: true }),
		}),
		{
			name: "rdrama-demo-auth",
			storage: createJSONStorage(() => {
				if (typeof window === "undefined") {
					return {
						getItem: () => null,
						setItem: () => undefined,
						removeItem: () => undefined,
					}
				}
				return window.localStorage
			}),
			onRehydrateStorage: () => (state) => {
				state?.setReady()
			},
		},
	),
)

export function useAuth() {
	return useAuthStore()
}
