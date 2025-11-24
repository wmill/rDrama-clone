import { useState } from "react"
import { LogIn, LogOut, UserRound } from "lucide-react"

import { useAuth } from "@/hooks/use-auth"

export function AuthButton() {
	const { user, ready, login, logout } = useAuth()
	const [open, setOpen] = useState(false)
	const [username, setUsername] = useState(user?.username ?? "")
	const [userId, setUserId] = useState(user?.id.toString() ?? "")

	const handleLogin = () => {
		const parsedId = Number.parseInt(userId, 10)
		if (!username.trim() || Number.isNaN(parsedId)) return
		login({ id: parsedId, username: username.trim() })
		setOpen(false)
	}

	return (
		<div className="flex items-center gap-3">
			{user ? (
				<div className="flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-1.5 text-sm text-white">
					<UserRound className="h-4 w-4 text-cyan-300" />
					<span className="font-semibold">{user.username}</span>
					<span className="text-xs text-slate-400">#{user.id}</span>
				</div>
			) : (
				<div className="text-sm text-slate-300">Not logged in</div>
			)}

			{user ? (
				<button
					type="button"
					onClick={() => logout()}
					className="flex items-center gap-2 rounded-lg bg-rose-500 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-600"
				>
					<LogOut className="h-4 w-4" />
					Log out
				</button>
			) : (
				<button
					type="button"
					disabled={!ready}
					onClick={() => setOpen(true)}
					className="flex items-center gap-2 rounded-lg bg-cyan-500 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-600 disabled:cursor-not-allowed disabled:bg-slate-600"
				>
					<LogIn className="h-4 w-4" />
					Log in
				</button>
			)}

			{open && (
				<div className="absolute left-1/2 top-16 z-50 w-[320px] -translate-x-1/2 rounded-xl border border-slate-800 bg-slate-900 p-4 shadow-2xl">
					<div className="flex items-center justify-between">
						<div>
							<p className="text-xs uppercase tracking-[0.25em] text-cyan-300/80">
								Demo login
							</p>
							<h3 className="text-lg font-semibold text-white">Pick a user</h3>
						</div>
						<button
							type="button"
							onClick={() => setOpen(false)}
							className="rounded-full px-2 py-1 text-sm text-slate-400 hover:bg-slate-800 hover:text-white"
						>
							Close
						</button>
					</div>
					<div className="mt-4 space-y-3">
						<label className="block text-sm text-slate-300">
							<span className="text-xs uppercase tracking-wide text-slate-400">
								Username
							</span>
							<input
								value={username}
								onChange={(e) => setUsername(e.target.value)}
								placeholder="e.g. System"
								className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white outline-none ring-2 ring-transparent transition focus:ring-cyan-500"
							/>
						</label>
						<label className="block text-sm text-slate-300">
							<span className="text-xs uppercase tracking-wide text-slate-400">
								User ID
							</span>
							<input
								value={userId}
								onChange={(e) => setUserId(e.target.value)}
								placeholder="e.g. 1"
								className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white outline-none ring-2 ring-transparent transition focus:ring-cyan-500"
							/>
						</label>
						<p className="text-xs text-slate-400">
							This demo stores the session in localStorage only. No API calls or routes
							are protected yet.
						</p>
						<div className="flex justify-end gap-2">
							<button
								type="button"
								onClick={() => setOpen(false)}
								className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-300 transition hover:text-white"
							>
								Cancel
							</button>
							<button
								type="button"
								disabled={!username.trim() || Number.isNaN(Number.parseInt(userId, 10))}
								onClick={handleLogin}
								className="rounded-lg bg-cyan-500 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-600 disabled:cursor-not-allowed disabled:bg-slate-600"
							>
								Log in
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	)
}
