import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
	clearSessionCookie,
	deleteSession,
	getCurrentUser,
	getSessionIdFromCookie,
} from "@/lib/sessions.server";

const logoutAction = createServerFn({ method: "POST" }).handler(async () => {
	const sessionId = getSessionIdFromCookie();
	if (sessionId) {
		await deleteSession(sessionId);
	}
	clearSessionCookie();
	return { success: true };
});

const getCurrentUserFn = createServerFn({ method: "GET" }).handler(async () => {
	return getCurrentUser();
});

export const Route = createFileRoute("/logout")({
	component: LogoutPage,
	loader: async () => {
		const user = await getCurrentUserFn();
		return { user };
	},
});

function LogoutPage() {
	const router = useRouter();
	const { user } = Route.useLoaderData();
	const [isLoggingOut, setIsLoggingOut] = useState(false);
	const [loggedOut, setLoggedOut] = useState(false);

	useEffect(() => {
		if (!user && !loggedOut) {
			router.navigate({ to: "/login" });
		}
	}, [user, loggedOut, router]);

	const handleLogout = async () => {
		setIsLoggingOut(true);
		try {
			await logoutAction();
			setLoggedOut(true);
			router.invalidate();
		} finally {
			setIsLoggingOut(false);
		}
	};

	if (loggedOut) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 p-4">
				<div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900/80 p-8 text-center shadow-xl">
					<h1 className="mb-4 text-2xl font-bold text-white">
						Successfully logged out
					</h1>
					<p className="mb-6 text-slate-400">
						You have been safely logged out of your account.
					</p>
					<div className="flex justify-center gap-4">
						<Button asChild>
							<Link to="/login">Sign in again</Link>
						</Button>
						<Button variant="outline" asChild>
							<Link to="/" search={{ sort: "hot", t: "all" }}>Go Home</Link>
						</Button>
					</div>
				</div>
			</div>
		);
	}

	if (!user) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 p-4">
				<div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900/80 p-8 text-center shadow-xl">
					<h1 className="mb-4 text-2xl font-bold text-white">Not logged in</h1>
					<p className="mb-6 text-slate-400">
						You are not currently logged in.
					</p>
					<Button asChild>
						<Link to="/login">Sign in</Link>
					</Button>
				</div>
			</div>
		);
	}

	return (
		<div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 p-4">
			<div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900/80 p-8 text-center shadow-xl">
				<h1 className="mb-4 text-2xl font-bold text-white">Log out</h1>
				<p className="mb-6 text-slate-400">
					Are you sure you want to log out,{" "}
					<span className="font-semibold text-cyan-400">{user.username}</span>?
				</p>
				<div className="flex justify-center gap-4">
					<Button
						onClick={handleLogout}
						disabled={isLoggingOut}
						variant="destructive"
					>
						{isLoggingOut ? "Logging out..." : "Log out"}
					</Button>
					<Button variant="outline" asChild>
						<Link to="/" search={{ sort: "hot", t: "all" }}>Cancel</Link>
					</Button>
				</div>
			</div>
		</div>
	);
}
