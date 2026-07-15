import { Link, useRouter } from "@tanstack/react-router";
import { LogIn, LogOut, UserRound } from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import { logoutFn } from "@/lib/session-actions.server";

export function AuthButton() {
	const router = useRouter();
	const { user, refresh } = useAuth();

	const handleLogout = async () => {
		await logoutFn();
		await refresh();
		router.invalidate();
	};

	return (
		<div className="flex items-center gap-3">
			{user ? (
				<a
					href={`/u/${user.username}`}
					className="flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-1.5 text-sm text-white hover:bg-slate-700 transition-colors"
				>
					<UserRound className="h-4 w-4 text-cyan-300" />
					<span className="font-semibold">{user.username}</span>
				</a>
			) : (
				<div className="text-sm text-slate-300">Not logged in</div>
			)}

			{user ? (
				<button
					type="button"
					onClick={handleLogout}
					className="flex items-center gap-2 rounded-lg bg-rose-500 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-600"
				>
					<LogOut className="h-4 w-4" />
					Log out
				</button>
			) : (
				<Link
					to="/login"
					className="flex items-center gap-2 rounded-lg bg-cyan-500 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-600 disabled:cursor-not-allowed disabled:bg-slate-600"
				>
					<LogIn className="h-4 w-4" />
					Log in
				</Link>
			)}
		</div>
	);
}
