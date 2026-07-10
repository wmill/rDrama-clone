import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { getReportedComments, type ReportedComment } from "@/lib/admin.server";
import { updateCommentFilterStatusFn } from "@/lib/admin-actions.server";
import { assertAdmin } from "@/lib/auth-guards.server";
import { formatRelativeTime } from "@/lib/utils";
import { pageInputSchema } from "@/lib/validation";

export const getReportedCommentsFn = createServerFn({ method: "GET" })
	.inputValidator((data: { page: number }) => pageInputSchema.parse(data))
	.handler(async ({ data }) => {
		await assertAdmin();
		return getReportedComments(data.page);
	});

export const Route = createFileRoute("/admin/reported-comments")({
	component: ReportedCommentsPage,
	validateSearch: (search: Record<string, unknown>) => ({
		page: Math.max(1, Math.floor(Number(search.page) || 1)),
	}),
	loaderDeps: ({ search }) => ({ page: search.page }),
	loader: async ({ deps }) => {
		return getReportedCommentsFn({ data: { page: deps.page } });
	},
});

function ReportedCommentsPage() {
	const { entries: commentsList, page, hasMore } = Route.useLoaderData();
	const router = useRouter();

	const handleAction = async (
		id: number,
		action: "approve" | "filtered" | "removed" | "ignored",
	) => {
		const result = await updateCommentFilterStatusFn({
			data: { id, action },
		});
		if (result.success) {
			await router.invalidate();
		}
	};

	return (
		<div className="space-y-4">
			{commentsList.length === 0 ? (
				<div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/80 p-12 text-center shadow-xl">
					<p className="text-slate-400">No reported comments.</p>
				</div>
			) : (
				commentsList.map((comment) => (
					<ReportedCommentCard
						key={comment.id}
						comment={comment}
						onAction={handleAction}
					/>
				))
			)}

			{(page > 1 || hasMore) && (
				<div className="flex items-center justify-between">
					{page > 1 ? (
						<Link to="/admin/reported-comments" search={{ page: page - 1 }}>
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
						<Link to="/admin/reported-comments" search={{ page: page + 1 }}>
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

function ReportedCommentCard({
	comment,
	onAction,
}: {
	comment: ReportedComment;
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
			await onAction(comment.id, action);
		} finally {
			setIsPending(false);
		}
	};

	return (
		<div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl">
			<div className="mb-3 flex items-start justify-between gap-4">
				<div className="flex-1 min-w-0">
					{comment.parentSubmissionId && (
						<div className="mb-2 text-xs text-slate-400">
							On post:{" "}
							<Link
								to="/post/$id"
								params={{ id: String(comment.parentSubmissionId) }}
								search={{ sort: "top" }}
								className="text-cyan-400 hover:underline"
							>
								{comment.parentSubmissionTitle ??
									`#${comment.parentSubmissionId}`}
							</Link>
						</div>
					)}
					<div className="mb-1 text-xs text-slate-400">
						by{" "}
						<a
							href={`/u/${comment.authorName}`}
							className="text-cyan-400 hover:underline"
						>
							{comment.authorName}
						</a>{" "}
						· {formatRelativeTime(comment.createdUtc)}
					</div>
					<div
						className="prose prose-invert prose-sm max-w-none text-slate-300 line-clamp-4"
						// biome-ignore lint/security/noDangerouslySetInnerHtml: Content sanitized server-side
						dangerouslySetInnerHTML={{ __html: comment.bodyHtml }}
					/>
				</div>
				<div className="flex shrink-0 flex-col gap-2">
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

			{comment.flags.length > 0 && (
				<div className="mt-3 space-y-1 border-t border-slate-800 pt-3">
					<p className="text-xs font-medium text-slate-500">
						Reports ({comment.flags.length}):
					</p>
					{comment.flags.map((f, i) => (
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
