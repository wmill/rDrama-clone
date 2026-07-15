import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
	getShadowbannedUsers,
	type ShadowbannedUsersPage,
} from "@/lib/admin.server";
import { assertAdmin } from "@/lib/auth-guards.server";

const getShadowbannedUsersFn = createServerFn({ method: "GET" })
	.inputValidator((data: { page: number }) =>
		z.object({ page: z.number().int().positive() }).parse(data),
	)
	.handler(async ({ data }): Promise<ShadowbannedUsersPage> => {
		await assertAdmin();
		return getShadowbannedUsers(data.page);
	});

export const Route = createFileRoute("/admin/bulk-moderation")({
	validateSearch: (search: Record<string, unknown>) => ({
		page: z.coerce.number().int().positive().catch(1).parse(search.page),
	}),
	loaderDeps: ({ search }) => ({ page: search.page }),
	loader: ({ deps }) => getShadowbannedUsersFn({ data: deps }),
	component: BulkModerationPage,
});

function BulkModerationPage() {
	const data = Route.useLoaderData();
	return (
		<div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl">
			<h2 className="text-lg font-semibold text-white">Shadowbanned Users</h2>
			<p className="mt-1 text-sm text-slate-400">
				Bulk nuke and restore controls are available from each investigation
				page to level-3 administrators.
			</p>
			<div className="mt-4 space-y-2">
				{data.entries.length === 0 && (
					<p className="text-sm text-slate-400">No shadowbanned users.</p>
				)}
				{data.entries.map((user) => (
					<Link
						key={user.id}
						to="/admin/users/$id"
						params={{ id: String(user.id) }}
						className="block rounded-lg border border-slate-800 bg-slate-950/50 px-4 py-3 text-cyan-400 hover:border-cyan-700"
					>
						{user.username}
					</Link>
				))}
			</div>
			<div className="mt-5 flex justify-between text-sm">
				{data.page > 1 ? (
					<Link
						to="/admin/bulk-moderation"
						search={{ page: data.page - 1 }}
						className="text-cyan-400"
					>
						Previous
					</Link>
				) : (
					<span />
				)}
				{data.hasMore && (
					<Link
						to="/admin/bulk-moderation"
						search={{ page: data.page + 1 }}
						className="text-cyan-400"
					>
						Next
					</Link>
				)}
			</div>
		</div>
	);
}
