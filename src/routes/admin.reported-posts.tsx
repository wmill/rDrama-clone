import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
	getReportedSubmissions,
	type ReportedSubmission,
} from "@/lib/admin.server";
import { updateSubmissionFilterStatusFn } from "@/lib/admin-actions.server";
import { assertAdmin } from "@/lib/auth-guards.server";
import { formatRelativeTime } from "@/lib/utils";
import { pageInputSchema } from "@/lib/validation";

export const getReportedSubmissionsFn = createServerFn({ method: "GET" })
	.inputValidator((data: { page: number }) => pageInputSchema.parse(data))
	.handler(async ({ data }) => {
		await assertAdmin();
		return getReportedSubmissions(data.page);
	});

export const Route = createFileRoute("/admin/reported-posts")({
	component: ReportedPostsPage,
	validateSearch: (search: Record<string, unknown>) => ({
		page: Math.max(1, Math.floor(Number(search.page) || 1)),
	}),
	loaderDeps: ({ search }) => ({ page: search.page }),
	loader: async ({ deps }) => {
		return getReportedSubmissionsFn({ data: { page: deps.page } });
	},
});

function ReportedPostsPage() {
	const { entries: initialPosts, page, hasMore } = Route.useLoaderData();
	const [posts, setPosts] = useState<ReportedSubmission[]>(initialPosts);

	useEffect(() => {
		setPosts(initialPosts);
	}, [initialPosts]);

	const handleAction = async (
		id: number,
		action: "approve" | "filtered" | "removed" | "ignored",
	) => {
		const result = await updateSubmissionFilterStatusFn({
			data: { id, action },
		});
		if (result.success) {
			setPosts((prev) => prev.filter((p) => p.id !== id));
		}
	};

	return (
		<div className="space-y-4">
			{posts.length === 0 ? (
				<div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/80 p-12 text-center shadow-xl">
					<p className="text-slate-400">No reported posts.</p>
				</div>
			) : (
				posts.map((post) => (
					<ReportedPostCard key={post.id} post={post} onAction={handleAction} />
				))
			)}

			{(page > 1 || hasMore) && (
				<div className="flex items-center justify-between">
					{page > 1 ? (
						<Link to="/admin/reported-posts" search={{ page: page - 1 }}>
							<Button
								variant="outline"
								size="sm"
								className="border-slate-700 text-slate-300 hover:bg-slate-800"
							>
								Previous
							</Button>
						</Link>
					) : (
						<span />
					)}
					<span className="text-xs text-slate-500">Page {page}</span>
					{hasMore ? (
						<Link to="/admin/reported-posts" search={{ page: page + 1 }}>
							<Button
								variant="outline"
								size="sm"
								className="border-slate-700 text-slate-300 hover:bg-slate-800"
							>
								Next
							</Button>
						</Link>
					) : (
						<span />
					)}
				</div>
			)}
		</div>
	);
}

function ReportedPostCard({
	post,
	onAction,
}: {
	post: ReportedSubmission;
	onAction: (
		id: number,
		action: "approve" | "filtered" | "removed" | "ignored",
	) => void;
}) {
	const [isPending, setIsPending] = useState(false);

	const act = async (
		action: "approve" | "filtered" | "removed" | "ignored",
	) => {
		setIsPending(true);
		try {
			await onAction(post.id, action);
		} finally {
			setIsPending(false);
		}
	};

	return (
		<div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl">
			<div className="mb-3 flex items-start justify-between gap-4">
				<div>
					<Link
						to="/post/$id"
						params={{ id: String(post.id) }}
						search={{ sort: "top" }}
						className="text-base font-semibold text-cyan-400 hover:text-cyan-300"
						// biome-ignore lint/security/noDangerouslySetInnerHtml: Stored HTML sanitized server-side
						dangerouslySetInnerHTML={{ __html: post.titleHtml }}
					/>
					<div className="mt-1 text-xs text-slate-400">
						by{" "}
						<a
							href={`/u/${post.authorName}`}
							className="text-cyan-400 hover:underline"
						>
							{post.authorName}
						</a>{" "}
						· {formatRelativeTime(post.createdUtc)}
					</div>
				</div>
				<div className="flex shrink-0 gap-2">
					<Button
						size="sm"
						variant="outline"
						disabled={isPending}
						onClick={() => act("approve")}
						className="border-emerald-600 text-emerald-400 hover:bg-emerald-900/30"
					>
						Approve
					</Button>
					<Button
						size="sm"
						variant="outline"
						disabled={isPending}
						onClick={() => act("filtered")}
						className="border-amber-600 text-amber-300 hover:bg-amber-900/30"
					>
						Filter
					</Button>
					<Button
						size="sm"
						variant="outline"
						disabled={isPending}
						onClick={() => act("ignored")}
						className="border-slate-600 text-slate-300 hover:bg-slate-800"
					>
						Ignore
					</Button>
					<Button
						size="sm"
						variant="outline"
						disabled={isPending}
						onClick={() => act("removed")}
						className="border-red-600 text-red-400 hover:bg-red-900/30"
					>
						Remove
					</Button>
				</div>
			</div>

			{post.flags.length > 0 && (
				<div className="mt-3 space-y-1 border-t border-slate-800 pt-3">
					<p className="text-xs font-medium text-slate-500">
						Reports ({post.flags.length}):
					</p>
					{post.flags.map((f, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: stable flag order
						<div key={i} className="text-xs text-slate-400">
							<a
								href={`/u/${f.reporterName}`}
								className="text-cyan-400 hover:underline"
							>
								{f.reporterName}
							</a>
							{f.reason ? (
								<span>: {f.reason}</span>
							) : (
								<span className="text-slate-500"> (no reason)</span>
							)}
						</div>
					))}
				</div>
			)}
		</div>
	);
}
