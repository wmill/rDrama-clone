import {
	createFileRoute,
	Link,
	Outlet,
	redirect,
} from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

import { getCurrentUser } from "@/lib/sessions.server";

const getAdminUserFn = createServerFn({ method: "GET" }).handler(async () => {
	return getCurrentUser();
});

export const Route = createFileRoute("/admin")({
	component: AdminLayout,
	loader: async () => {
		const user = await getAdminUserFn();
		if (!user || user.adminLevel < 2) {
			throw redirect({ to: "/" });
		}
		return { user };
	},
});

const ADMIN_NAV_LINKS = [
	{ to: "/admin/reported-posts", label: "Reported Posts" },
	{ to: "/admin/reported-comments", label: "Reported Comments" },
	{ to: "/admin/filtered", label: "Content Queues" },
	{ to: "/admin/mod-log", label: "Mod Log" },
	{ to: "/admin/users", label: "Users" },
	{ to: "/admin/banned-domains", label: "Banned Domains" },
	{ to: "/admin/badges", label: "Badges" },
] as const;

function AdminLayout() {
	return (
		<div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 p-4">
			<div className="mx-auto max-w-7xl">
				<div className="mb-6 rounded-xl border border-slate-800 bg-slate-900/80 p-4 shadow-xl">
					<h1 className="mb-4 text-xl font-bold text-white">Admin Panel</h1>
					<nav className="flex flex-wrap gap-3">
						{ADMIN_NAV_LINKS.map((link) => (
							<Link
								key={link.to}
								to={link.to}
								className="rounded-lg px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800"
								activeProps={{
									className:
										"rounded-lg px-4 py-2 text-sm font-medium bg-cyan-500 text-white",
								}}
							>
								{link.label}
							</Link>
						))}
					</nav>
				</div>
				<Outlet />
			</div>
		</div>
	);
}
