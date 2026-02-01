import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/sessions.server";

const getCurrentUserFn = createServerFn({ method: "GET" }).handler(async () => {
	return getCurrentUser();
});

export const Route = createFileRoute("/me")({
	component: MePage,
	loader: async () => {
		const user = await getCurrentUserFn();
		return { user };
	},
});

function MePage() {
	const { user } = Route.useLoaderData();

	if (!user) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 p-4">
				<div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900/80 p-8 text-center shadow-xl">
					<h1 className="mb-4 text-2xl font-bold text-white">Not logged in</h1>
					<p className="mb-6 text-slate-400">
						You need to be logged in to view this page.
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
			<div className="w-full max-w-2xl rounded-xl border border-slate-800 bg-slate-900/80 p-8 shadow-xl">
				<div className="mb-8 flex items-center gap-4">
					{user.profileUrl ? (
						<img
							src={user.profileUrl}
							alt={user.username}
							className="h-20 w-20 rounded-full border-2 border-cyan-500"
						/>
					) : (
						<div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-cyan-500 bg-slate-800 text-3xl font-bold text-cyan-400">
							{user.username.charAt(0).toUpperCase()}
						</div>
					)}
					<div>
						<h1 className="text-3xl font-bold text-white">{user.username}</h1>
						{user.customTitle && (
							<p className="text-lg text-cyan-400">{user.customTitle}</p>
						)}
					</div>
				</div>

				<div className="grid gap-6 md:grid-cols-2">
					<div className="rounded-lg border border-slate-800 bg-slate-800/50 p-4">
						<h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-slate-400">
							Account Info
						</h2>
						<dl className="space-y-3">
							<div>
								<dt className="text-xs text-slate-500">User ID</dt>
								<dd className="text-white">{user.id}</dd>
							</div>
							<div>
								<dt className="text-xs text-slate-500">Email</dt>
								<dd className="text-white">{user.email ?? "Not set"}</dd>
							</div>
							<div>
								<dt className="text-xs text-slate-500">Joined</dt>
								<dd className="text-white">
									{new Date(user.createdUtc * 1000).toLocaleDateString()}
								</dd>
							</div>
							<div>
								<dt className="text-xs text-slate-500">Status</dt>
								<dd>
									{user.isBanned > 0 ? (
										<span className="text-red-400">
											Banned{user.banReason ? `: ${user.banReason}` : ""}
										</span>
									) : (
										<span className="text-green-400">Active</span>
									)}
								</dd>
							</div>
						</dl>
					</div>

					<div className="rounded-lg border border-slate-800 bg-slate-800/50 p-4">
						<h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-slate-400">
							Economy
						</h2>
						<dl className="space-y-3">
							<div>
								<dt className="text-xs text-slate-500">Coins</dt>
								<dd className="text-xl font-bold text-yellow-400">
									{user.coins.toLocaleString()}
								</dd>
							</div>
							<div>
								<dt className="text-xs text-slate-500">Pro Coins</dt>
								<dd className="text-xl font-bold text-purple-400">
									{user.proCoins.toLocaleString()}
								</dd>
							</div>
						</dl>
					</div>

					{user.bio && (
						<div className="rounded-lg border border-slate-800 bg-slate-800/50 p-4 md:col-span-2">
							<h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-slate-400">
								Bio
							</h2>
							<p className="text-slate-300">{user.bio}</p>
						</div>
					)}
				</div>

				<div className="mt-8 flex gap-4">
					{/* TODO: Implement user profile route in Phase 4 */}
					<Button disabled variant="outline">
						View Public Profile
					</Button>
					{/* TODO: Implement settings route in Phase 4 */}
					<Button disabled variant="outline">
						Edit Settings
					</Button>
					<Button variant="destructive" asChild>
						<Link to="/logout">Log out</Link>
					</Button>
				</div>
			</div>
		</div>
	);
}
