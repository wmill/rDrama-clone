import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

import { listPublicModActions } from "@/lib/transparency.server";
import { pageInputSchema } from "@/lib/validation";
import { Pager } from "@/routes/admins";

export const getPublicModLogFn = createServerFn({ method: "GET" })
	.inputValidator((data: { page: number }) => pageInputSchema.parse(data))
	.handler(({ data }) => listPublicModActions(data.page));
export const Route = createFileRoute("/mod-log")({
	validateSearch: (search: Record<string, unknown>) => ({
		page: Math.max(1, Number(search.page) || 1),
	}),
	loaderDeps: ({ search }) => search,
	loader: ({ deps }) => getPublicModLogFn({ data: deps }),
	component: PublicModLogPage,
});

function PublicModLogPage() {
	const data = Route.useLoaderData();
	return (
		<section className="rounded-xl border border-slate-800 bg-slate-900/80 p-5">
			<h1 className="text-xl font-semibold text-white">
				Public moderation log
			</h1>
			<p className="mt-1 text-sm text-slate-400">
				A privacy-reviewed subset of moderation actions. Moderator notes are
				never published.
			</p>
			{data.entries.length ? (
				<ul className="mt-4 space-y-2">
					{data.entries.map((entry) => (
						<li
							className="rounded border border-slate-800 p-3 text-sm"
							key={entry.id}
						>
							<time className="text-slate-500">
								{new Date(entry.createdDatetimez).toLocaleString()}
							</time>
							<span className="mx-2 text-slate-300">
								{entry.actor ? entry.actor.username : "System"}{" "}
								{entry.kind === "ban_user" ? "banned" : "unbanned"}
							</span>
							<a className="text-cyan-400" href={`/u/${entry.target.username}`}>
								{entry.target.username}
							</a>
						</li>
					))}
				</ul>
			) : (
				<p className="mt-4 text-slate-400">No public actions recorded.</p>
			)}
			<Pager page={data.page} hasMore={data.hasMore} />
		</section>
	);
}
