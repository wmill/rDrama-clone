import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

import { Button } from "@/components/ui/button";
import { getModLog, type ModLogEntry } from "@/lib/admin.server";
import { assertAdmin } from "@/lib/auth-guards.server";

export const getModLogFn = createServerFn({ method: "GET" })
	.inputValidator((data: { page: number }) => data)
	.handler(async ({ data }) => {
		await assertAdmin();
		return getModLog(data.page);
	});

export const Route = createFileRoute("/admin/mod-log")({
	component: ModLogPage,
	validateSearch: (search: Record<string, unknown>) => ({
		page: Math.max(1, Math.floor(Number(search.page) || 1)),
	}),
	loaderDeps: ({ search }) => ({ page: search.page }),
	loader: async ({ deps }) => {
		return getModLogFn({ data: { page: deps.page } });
	},
});

function formatTimestamp(value: Date | string): string {
	return new Date(value).toLocaleString();
}

function ModLogPage() {
	const { entries, page, hasMore } = Route.useLoaderData();

	return (
		<div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl">
			<h2 className="mb-4 text-lg font-semibold text-white">Mod Log</h2>

			{entries.length === 0 ? (
				<p className="text-slate-400">No mod actions recorded.</p>
			) : (
				<div className="space-y-2">
					{entries.map((entry) => (
						<ModLogRow key={entry.id} entry={entry} />
					))}
				</div>
			)}

			<div className="mt-6 flex items-center justify-between">
				{page > 1 ? (
					<Link to="/admin/mod-log" search={{ page: page - 1 }}>
						<Button
							variant="outline"
							size="sm"
							className="border-slate-700 text-slate-300 hover:bg-slate-800"
						>
							Newer
						</Button>
					</Link>
				) : (
					<span />
				)}
				<span className="text-xs text-slate-500">Page {page}</span>
				{hasMore ? (
					<Link to="/admin/mod-log" search={{ page: page + 1 }}>
						<Button
							variant="outline"
							size="sm"
							className="border-slate-700 text-slate-300 hover:bg-slate-800"
						>
							Older
						</Button>
					</Link>
				) : (
					<span />
				)}
			</div>
		</div>
	);
}

function ModLogRow({ entry }: { entry: ModLogEntry }) {
	return (
		<div className="flex flex-wrap items-baseline gap-2 rounded-lg border border-slate-800 bg-slate-950/50 px-4 py-2 text-sm">
			<span className="font-mono text-xs text-slate-500">
				{formatTimestamp(entry.createdDatetimez)}
			</span>
			{entry.actorName ? (
				<a
					href={`/u/${entry.actorName}`}
					className="font-medium text-cyan-400 hover:underline"
				>
					{entry.actorName}
				</a>
			) : (
				<span className="text-slate-500">[system]</span>
			)}
			<span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-xs text-slate-300">
				{entry.kind ?? "unknown"}
			</span>
			{entry.targetUserName && (
				<a
					href={`/u/${entry.targetUserName}`}
					className="text-amber-400 hover:underline"
				>
					@{entry.targetUserName}
				</a>
			)}
			{entry.targetSubmissionId !== null && (
				<Link
					to="/post/$id"
					params={{ id: String(entry.targetSubmissionId) }}
					search={{ sort: "top" }}
					className="truncate text-cyan-400 hover:underline"
				>
					{entry.targetSubmissionTitle ?? `post #${entry.targetSubmissionId}`}
				</Link>
			)}
			{entry.targetCommentId !== null && (
				<Link
					to="/comment/$id"
					params={{ id: String(entry.targetCommentId) }}
					className="text-cyan-400 hover:underline"
				>
					comment #{entry.targetCommentId}
				</Link>
			)}
			{entry.note && <span className="text-slate-400">{entry.note}</span>}
		</div>
	);
}
