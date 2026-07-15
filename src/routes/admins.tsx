import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

import { listPublicAdmins } from "@/lib/transparency.server";
import { pageInputSchema } from "@/lib/validation";

export const getPublicAdminsFn = createServerFn({ method: "GET" })
	.inputValidator((data: { page: number }) => pageInputSchema.parse(data))
	.handler(({ data }) => listPublicAdmins(data.page));

export const Route = createFileRoute("/admins")({
	validateSearch: (search: Record<string, unknown>) => ({
		page: Math.max(1, Number(search.page) || 1),
	}),
	loaderDeps: ({ search }) => search,
	loader: ({ deps }) => getPublicAdminsFn({ data: deps }),
	component: AdminsPage,
});

function AdminsPage() {
	const data = Route.useLoaderData();
	return (
		<PublicList
			title="Administrators"
			empty="No public administrators found."
			data={data}
		/>
	);
}

function PublicList({
	title,
	empty,
	data,
}: {
	title: string;
	empty: string;
	data: Awaited<ReturnType<typeof listPublicAdmins>>;
}) {
	return (
		<section className="rounded-xl border border-slate-800 bg-slate-900/80 p-5">
			<h1 className="text-xl font-semibold text-white">{title}</h1>
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
							<span className="ml-2 text-xs text-slate-500">
								level {user.adminLevel}
							</span>
						</li>
					))}
				</ul>
			) : (
				<p className="mt-4 text-slate-400">{empty}</p>
			)}
			<Pager page={data.page} hasMore={data.hasMore} />
		</section>
	);
}

export function Pager({ page, hasMore }: { page: number; hasMore: boolean }) {
	return (
		<nav aria-label="Pagination" className="mt-6 flex justify-between text-sm">
			{page > 1 ? (
				<a className="text-cyan-400" href={`?page=${page - 1}`}>
					Previous
				</a>
			) : (
				<span />
			)}
			{hasMore ? (
				<a className="text-cyan-400" href={`?page=${page + 1}`}>
					Next
				</a>
			) : (
				<span />
			)}
		</nav>
	);
}
