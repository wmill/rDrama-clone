import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
	getModQueueComments,
	getModQueueSubmissions,
	type ModQueueComment,
	type ModQueueKind,
	type ModQueueSubmission,
} from "@/lib/admin.server";
import {
	setCommentModerationStateFn,
	setSubmissionModerationStateFn,
} from "@/lib/admin-actions.server";
import { assertAdmin } from "@/lib/auth-guards.server";
import { formatRelativeTime } from "@/lib/utils";

export const getModQueuesFn = createServerFn({ method: "GET" }).handler(
	async () => {
		await assertAdmin();
		const [
			filteredPosts,
			filteredComments,
			removedPosts,
			removedComments,
			shadowbannedPosts,
			shadowbannedComments,
		] = await Promise.all([
			getModQueueSubmissions("FILTERED"),
			getModQueueComments("FILTERED"),
			getModQueueSubmissions("REMOVED"),
			getModQueueComments("REMOVED"),
			getModQueueSubmissions("SHADOWBANNED"),
			getModQueueComments("SHADOWBANNED"),
		]);
		return {
			FILTERED: { posts: filteredPosts, comments: filteredComments },
			REMOVED: { posts: removedPosts, comments: removedComments },
			SHADOWBANNED: {
				posts: shadowbannedPosts,
				comments: shadowbannedComments,
			},
		};
	},
);

export const Route = createFileRoute("/admin/filtered")({
	component: ContentQueuesPage,
	loader: async () => {
		return getModQueuesFn();
	},
});

const QUEUE_TABS: { kind: ModQueueKind; label: string; blurb: string }[] = [
	{
		kind: "FILTERED",
		label: "Filtered",
		blurb: "Content held in the filter awaiting review.",
	},
	{
		kind: "REMOVED",
		label: "Removed",
		blurb: "Content removed by moderators.",
	},
	{
		kind: "SHADOWBANNED",
		label: "Shadowbanned",
		blurb: "Visible content from shadowbanned users.",
	},
];

function ContentQueuesPage() {
	const queues = Route.useLoaderData();
	const router = useRouter();
	const [activeTab, setActiveTab] = useState<ModQueueKind>("FILTERED");

	const handlePostAction = async (id: number, state: "VISIBLE" | "REMOVED") => {
		const result = await setSubmissionModerationStateFn({
			data: { id, state },
		});
		if (result.success) {
			await router.invalidate();
		}
	};

	const handleCommentAction = async (
		id: number,
		state: "VISIBLE" | "REMOVED",
	) => {
		const result = await setCommentModerationStateFn({ data: { id, state } });
		if (result.success) {
			await router.invalidate();
		}
	};

	const active = queues[activeTab];
	const activeMeta = QUEUE_TABS.find((t) => t.kind === activeTab);

	return (
		<div className="space-y-4">
			<div className="flex gap-2">
				{QUEUE_TABS.map((tab) => (
					<button
						key={tab.kind}
						type="button"
						onClick={() => setActiveTab(tab.kind)}
						className={
							activeTab === tab.kind
								? "rounded-lg bg-cyan-500 px-4 py-2 text-sm font-medium text-white"
								: "rounded-lg px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800"
						}
					>
						{tab.label} (
						{queues[tab.kind].posts.length + queues[tab.kind].comments.length})
					</button>
				))}
			</div>

			{activeMeta && (
				<p className="text-sm text-slate-400">{activeMeta.blurb}</p>
			)}

			{active.posts.length === 0 && active.comments.length === 0 ? (
				<div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/80 p-12 text-center shadow-xl">
					<p className="text-slate-400">Nothing in this queue.</p>
				</div>
			) : (
				<>
					{active.posts.map((post) => (
						<QueuePostCard
							key={post.id}
							post={post}
							queue={activeTab}
							onAction={handlePostAction}
						/>
					))}
					{active.comments.map((comment) => (
						<QueueCommentCard
							key={comment.id}
							comment={comment}
							queue={activeTab}
							onAction={handleCommentAction}
						/>
					))}
				</>
			)}
		</div>
	);
}

function QueueActionButtons({
	queue,
	isPending,
	onAct,
}: {
	queue: ModQueueKind;
	isPending: boolean;
	onAct: (state: "VISIBLE" | "REMOVED") => void;
}) {
	return (
		<div className="flex shrink-0 gap-2">
			{queue !== "SHADOWBANNED" && (
				<Button
					size="sm"
					variant="outline"
					disabled={isPending}
					onClick={() => onAct("VISIBLE")}
					className="border-emerald-600 text-emerald-400 hover:bg-emerald-900/30"
				>
					Approve
				</Button>
			)}
			{queue !== "REMOVED" && (
				<Button
					size="sm"
					variant="outline"
					disabled={isPending}
					onClick={() => onAct("REMOVED")}
					className="border-red-600 text-red-400 hover:bg-red-900/30"
				>
					Remove
				</Button>
			)}
		</div>
	);
}

function AuthorByline({
	authorName,
	authorShadowBanned,
	createdUtc,
	stateModSetBy,
}: {
	authorName: string;
	authorShadowBanned: string | null;
	createdUtc: number;
	stateModSetBy: string | null;
}) {
	return (
		<div className="mt-1 text-xs text-slate-400">
			by{" "}
			<a href={`/u/${authorName}`} className="text-cyan-400 hover:underline">
				{authorName}
			</a>
			{authorShadowBanned && (
				<span className="ml-1 rounded bg-amber-500/20 px-1.5 py-0.5 text-amber-400">
					shadowbanned
				</span>
			)}{" "}
			· {formatRelativeTime(createdUtc)}
			{stateModSetBy && (
				<span className="ml-1 text-slate-500">
					· state set by {stateModSetBy}
				</span>
			)}
		</div>
	);
}

function QueuePostCard({
	post,
	queue,
	onAction,
}: {
	post: ModQueueSubmission;
	queue: ModQueueKind;
	onAction: (id: number, state: "VISIBLE" | "REMOVED") => void;
}) {
	const [isPending, setIsPending] = useState(false);

	const act = async (state: "VISIBLE" | "REMOVED") => {
		setIsPending(true);
		try {
			await onAction(post.id, state);
		} finally {
			setIsPending(false);
		}
	};

	return (
		<div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl">
			<div className="flex items-start justify-between gap-4">
				<div>
					<Link
						to="/post/$id"
						params={{ id: String(post.id) }}
						search={{ sort: "top" }}
						className="text-base font-semibold text-cyan-400 hover:text-cyan-300"
						// biome-ignore lint/security/noDangerouslySetInnerHtml: Stored HTML sanitized server-side
						dangerouslySetInnerHTML={{ __html: post.titleHtml }}
					/>
					<AuthorByline
						authorName={post.authorName}
						authorShadowBanned={post.authorShadowBanned}
						createdUtc={post.createdUtc}
						stateModSetBy={post.stateModSetBy}
					/>
				</div>
				<QueueActionButtons queue={queue} isPending={isPending} onAct={act} />
			</div>
		</div>
	);
}

function QueueCommentCard({
	comment,
	queue,
	onAction,
}: {
	comment: ModQueueComment;
	queue: ModQueueKind;
	onAction: (id: number, state: "VISIBLE" | "REMOVED") => void;
}) {
	const [isPending, setIsPending] = useState(false);

	const act = async (state: "VISIBLE" | "REMOVED") => {
		setIsPending(true);
		try {
			await onAction(comment.id, state);
		} finally {
			setIsPending(false);
		}
	};

	return (
		<div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl">
			<div className="flex items-start justify-between gap-4">
				<div className="min-w-0">
					{comment.parentSubmissionId !== null && (
						<div className="mb-1 text-xs text-slate-500">
							Comment on{" "}
							<Link
								to="/post/$id"
								params={{ id: String(comment.parentSubmissionId) }}
								search={{ sort: "top" }}
								className="text-cyan-400 hover:underline"
							>
								{comment.parentSubmissionTitle ??
									`post #${comment.parentSubmissionId}`}
							</Link>
						</div>
					)}
					<div
						className="prose prose-sm prose-invert max-w-none text-slate-200"
						// biome-ignore lint/security/noDangerouslySetInnerHtml: Stored HTML sanitized server-side
						dangerouslySetInnerHTML={{ __html: comment.bodyHtml }}
					/>
					<AuthorByline
						authorName={comment.authorName}
						authorShadowBanned={comment.authorShadowBanned}
						createdUtc={comment.createdUtc}
						stateModSetBy={comment.stateModSetBy}
					/>
				</div>
				<QueueActionButtons queue={queue} isPending={isPending} onAct={act} />
			</div>
		</div>
	);
}
