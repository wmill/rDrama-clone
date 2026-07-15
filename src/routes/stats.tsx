import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

import { getPublicStats } from "@/lib/transparency.server";

export const getPublicStatsFn = createServerFn({ method: "GET" }).handler(
	getPublicStats,
);
export const Route = createFileRoute("/stats")({
	loader: () => getPublicStatsFn(),
	component: StatsPage,
});

function StatsPage() {
	const stats = Route.useLoaderData();
	const rows = [
		["Registered users", stats.users],
		["Currently banned users", stats.bannedUsers],
		["Public posts", stats.publicPosts],
		["Public comments", stats.publicComments],
		["Signups in the last 24 hours", stats.newUsers24h],
	] as const;
	return (
		<section className="rounded-xl border border-slate-800 bg-slate-900/80 p-5">
			<h1 className="text-xl font-semibold text-white">Community statistics</h1>
			<dl className="mt-4 divide-y divide-slate-800">
				{rows.map(([label, value]) => (
					<div className="flex justify-between py-3" key={label}>
						<dt className="text-slate-300">{label}</dt>
						<dd className="font-mono text-white">{value.toLocaleString()}</dd>
					</div>
				))}
			</dl>
		</section>
	);
}
