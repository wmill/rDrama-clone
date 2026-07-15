import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { listPublicBannedUsers } from "@/lib/transparency.server";
import { pageInputSchema } from "@/lib/validation";
import { Pager } from "@/routes/admins";

export const getPublicBannedUsersFn = createServerFn({ method: "GET" })
	.inputValidator((data: { page: number }) => pageInputSchema.parse(data))
	.handler(({ data }) => listPublicBannedUsers(data.page));

export const Route = createFileRoute("/banned")({
	validateSearch: (search: Record<string, unknown>) => ({
		page: Math.max(1, Number(search.page) || 1),
	}),
	loaderDeps: ({ search }) => search,
	loader: ({ deps }) => getPublicBannedUsersFn({ data: deps }),
	component: BannedPage,
});

function BannedPage() {
	const data = Route.useLoaderData();
	return (
		<section className="rounded-xl border border-slate-800 bg-slate-900/80 p-5">
			<h1 className="text-xl font-semibold text-white">Banned users</h1>
			<p className="mt-1 text-sm text-slate-400">
				Currently permanent bans on public accounts.
			</p>
			{data.entries.length ? (
				<ul className="mt-4 divide-y divide-slate-800">
					{data.entries.map((user) => (
						<li className="py-3" key={user.id}>
							<a
								className="text-cyan-400 hover:underline"
								href={`/u/${user.username}`}
							>
								{user.username}
							</a>
						</li>
					))}
				</ul>
			) : (
				<p className="mt-4 text-slate-400">No public banned users found.</p>
			)}
			<Pager page={data.page} hasMore={data.hasMore} />
		</section>
	);
}
