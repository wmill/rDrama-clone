import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	getUserAdminDetails,
	getUserRecentActivity,
	getUserReportHistory,
	type UserAdminDetails,
	type UserRecentActivity,
	type UserReportHistoryEntry,
} from "@/lib/admin.server";
import { createUserNoteFn } from "@/lib/admin-actions.server";
import { assertAdmin } from "@/lib/auth-guards.server";
import { formatRelativeTime } from "@/lib/utils";
import { userIdInputSchema } from "@/lib/validation";

const NOTE_TAGS = [
	"Quality",
	"Good",
	"Comment",
	"Warning",
	"Tempban",
	"Permban",
	"Spam",
	"Bot",
] as const;

type UserInvestigation = {
	user: {
		id: number;
		username: string;
		createdUtc: number;
		adminLevel: number;
		isBanned: number;
		banReason: string | null;
		unbanUtc: number;
		shadowBanned: string | null;
		postCount: number;
		commentCount: number;
	};
	notes: UserAdminDetails["notes"];
	activity: UserRecentActivity;
	reports: UserReportHistoryEntry[];
};

export const getUserInvestigationFn = createServerFn({ method: "GET" })
	.inputValidator((data: { userId: number }) => userIdInputSchema.parse(data))
	.handler(async ({ data }): Promise<UserInvestigation | null> => {
		await assertAdmin();
		const details = await getUserAdminDetails(data.userId);
		if (!details) return null;

		const [activity, reports] = await Promise.all([
			getUserRecentActivity(data.userId),
			getUserReportHistory(data.userId),
		]);

		const { user } = details;
		return {
			user: {
				id: user.id,
				username: user.username,
				createdUtc: user.createdUtc,
				adminLevel: user.adminLevel,
				isBanned: user.isBanned,
				banReason: user.banReason,
				unbanUtc: user.unbanUtc,
				shadowBanned: user.shadowBanned,
				postCount: user.postCount,
				commentCount: user.commentCount,
			},
			notes: details.notes,
			activity,
			reports,
		};
	});

export const Route = createFileRoute("/admin/users_/$id")({
	component: UserInvestigationPage,
	loader: async ({ params }) => {
		const userId = Number(params.id);
		if (!Number.isInteger(userId)) throw notFound();
		const result = await getUserInvestigationFn({ data: { userId } });
		if (!result) throw notFound();
		return result;
	},
});

function UserInvestigationPage() {
	const {
		user,
		notes: initialNotes,
		activity,
		reports,
	} = Route.useLoaderData();
	const [notes, setNotes] = useState(initialNotes);

	return (
		<div className="space-y-4">
			<div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl">
				<div className="flex flex-wrap items-center gap-3">
					<Link
						to="/u/$username"
						params={{ username: user.username }}
						search={{ sort: "new", t: "all", page: 1 }}
						className="text-lg font-semibold text-cyan-400 hover:underline"
					>
						{user.username}
					</Link>
					{user.adminLevel > 0 && (
						<span className="rounded bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-400">
							Admin L{user.adminLevel}
						</span>
					)}
					{user.isBanned > 0 && (
						<span className="rounded bg-red-500/20 px-2 py-0.5 text-xs text-red-400">
							Banned{user.banReason ? `: ${user.banReason}` : ""}
							{user.unbanUtc > 0
								? ` (until ${new Date(user.unbanUtc * 1000).toLocaleDateString()})`
								: " (permanent)"}
						</span>
					)}
					{user.shadowBanned && (
						<span className="rounded bg-amber-500/20 px-2 py-0.5 text-xs text-amber-400">
							Shadowbanned
						</span>
					)}
				</div>
				<p className="mt-2 text-xs text-slate-400">
					Joined {formatRelativeTime(user.createdUtc)} · {user.postCount} posts
					· {user.commentCount} comments
				</p>
			</div>

			<NotesSection
				userId={user.id}
				notes={notes}
				onNoteAdded={(note) => setNotes((prev) => [...prev, note])}
			/>

			<ReportsSection reports={reports} />

			<ActivitySection activity={activity} />
		</div>
	);
}

function NotesSection({
	userId,
	notes,
	onNoteAdded,
}: {
	userId: number;
	notes: UserAdminDetails["notes"];
	onNoteAdded: (note: UserAdminDetails["notes"][number]) => void;
}) {
	const [noteText, setNoteText] = useState("");
	const [tag, setTag] = useState<(typeof NOTE_TAGS)[number]>("Comment");
	const [isPending, setIsPending] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		const note = noteText.trim();
		if (!note) return;
		setIsPending(true);
		setError(null);
		try {
			const res = await createUserNoteFn({ data: { userId, note, tag } });
			if (res.success) {
				onNoteAdded({
					id: Date.now(),
					note,
					tag,
					authorName: "you",
					createdDatetimez: new Date(),
					referencePost: null,
					referenceComment: null,
				});
				setNoteText("");
			} else {
				setError(res.error);
			}
		} finally {
			setIsPending(false);
		}
	};

	return (
		<div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl">
			<h3 className="mb-3 text-base font-semibold text-white">
				Mod Notes ({notes.length})
			</h3>

			{notes.length === 0 ? (
				<p className="mb-4 text-sm text-slate-400">No notes on this user.</p>
			) : (
				<div className="mb-4 space-y-2">
					{notes.map((note) => (
						<div
							key={note.id}
							className="rounded-lg border border-slate-800 bg-slate-950/50 px-4 py-2 text-sm"
						>
							<div className="flex flex-wrap items-baseline gap-2">
								<span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-xs text-slate-300">
									{note.tag}
								</span>
								<span className="text-xs text-slate-500">
									by {note.authorName} ·{" "}
									{new Date(note.createdDatetimez).toLocaleString()}
								</span>
							</div>
							<p className="mt-1 text-slate-200">{note.note}</p>
						</div>
					))}
				</div>
			)}

			<form onSubmit={handleSubmit} className="flex gap-2">
				<select
					value={tag}
					onChange={(e) => setTag(e.target.value as (typeof NOTE_TAGS)[number])}
					className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-sm text-white"
				>
					{NOTE_TAGS.map((t) => (
						<option key={t} value={t}>
							{t}
						</option>
					))}
				</select>
				<Input
					value={noteText}
					onChange={(e) => setNoteText(e.target.value)}
					placeholder="Add a note..."
					className="border-slate-700 bg-slate-800 text-white placeholder:text-slate-500"
				/>
				<Button
					type="submit"
					disabled={isPending || !noteText.trim()}
					className="shrink-0 bg-cyan-500 hover:bg-cyan-600"
				>
					Add Note
				</Button>
			</form>
			{error && <p className="mt-2 text-xs text-red-400">{error}</p>}
		</div>
	);
}

function ReportsSection({ reports }: { reports: UserReportHistoryEntry[] }) {
	return (
		<div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl">
			<h3 className="mb-3 text-base font-semibold text-white">
				Reports Against This User ({reports.length})
			</h3>
			{reports.length === 0 ? (
				<p className="text-sm text-slate-400">No reports.</p>
			) : (
				<div className="space-y-2">
					{reports.map((report, i) => (
						<div
							// biome-ignore lint/suspicious/noArrayIndexKey: stable report order
							key={i}
							className="rounded-lg border border-slate-800 bg-slate-950/50 px-4 py-2 text-sm"
						>
							<div className="flex flex-wrap items-baseline gap-2">
								<span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-xs text-slate-300">
									{report.type}
								</span>
								<a
									href={`/u/${report.reporterName}`}
									className="text-cyan-400 hover:underline"
								>
									{report.reporterName}
								</a>
								<span className="text-xs text-slate-500">
									{new Date(report.createdDatetimez).toLocaleString()}
								</span>
							</div>
							{report.reason ? (
								<p className="mt-1 text-slate-200">{report.reason}</p>
							) : (
								<p className="mt-1 text-slate-500">(no reason)</p>
							)}
							{report.type === "post" ? (
								<Link
									to="/post/$id"
									params={{ id: String(report.targetId) }}
									search={{ sort: "top" }}
									className="mt-1 block truncate text-xs text-cyan-400 hover:underline"
								>
									{report.targetLabel}
								</Link>
							) : (
								<Link
									to="/comment/$id"
									params={{ id: String(report.targetId) }}
									className="mt-1 block text-xs text-cyan-400 hover:underline"
								>
									comment #{report.targetId}
								</Link>
							)}
						</div>
					))}
				</div>
			)}
		</div>
	);
}

function ActivitySection({ activity }: { activity: UserRecentActivity }) {
	return (
		<div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl">
			<h3 className="mb-3 text-base font-semibold text-white">
				Recent Activity
			</h3>

			<h4 className="mb-2 text-sm font-medium text-slate-300">
				Posts ({activity.submissions.length})
			</h4>
			{activity.submissions.length === 0 ? (
				<p className="mb-4 text-sm text-slate-400">No posts.</p>
			) : (
				<div className="mb-4 space-y-1">
					{activity.submissions.map((post) => (
						<div
							key={post.id}
							className="flex flex-wrap items-baseline gap-2 text-sm"
						>
							<Link
								to="/post/$id"
								params={{ id: String(post.id) }}
								search={{ sort: "top" }}
								className="truncate text-cyan-400 hover:underline"
							>
								{post.title}
							</Link>
							<ContentStateBadges
								stateMod={post.stateMod}
								stateReport={post.stateReport}
								isDeleted={post.isDeleted}
							/>
							<span className="text-xs text-slate-500">
								{formatRelativeTime(post.createdUtc)}
							</span>
						</div>
					))}
				</div>
			)}

			<h4 className="mb-2 text-sm font-medium text-slate-300">
				Comments ({activity.comments.length})
			</h4>
			{activity.comments.length === 0 ? (
				<p className="text-sm text-slate-400">No comments.</p>
			) : (
				<div className="space-y-2">
					{activity.comments.map((comment) => (
						<div
							key={comment.id}
							className="rounded-lg border border-slate-800 bg-slate-950/50 px-4 py-2 text-sm"
						>
							<div className="flex flex-wrap items-baseline gap-2">
								<Link
									to="/comment/$id"
									params={{ id: String(comment.id) }}
									className="text-xs text-cyan-400 hover:underline"
								>
									comment #{comment.id}
								</Link>
								{comment.parentSubmissionTitle && (
									<span className="truncate text-xs text-slate-500">
										on {comment.parentSubmissionTitle}
									</span>
								)}
								<ContentStateBadges
									stateMod={comment.stateMod}
									stateReport={comment.stateReport}
									isDeleted={comment.isDeleted}
								/>
								<span className="text-xs text-slate-500">
									{formatRelativeTime(comment.createdUtc)}
								</span>
							</div>
							<div
								className="mt-1 line-clamp-3 text-slate-200"
								// biome-ignore lint/security/noDangerouslySetInnerHtml: Stored HTML sanitized server-side
								dangerouslySetInnerHTML={{ __html: comment.bodyHtml }}
							/>
						</div>
					))}
				</div>
			)}
		</div>
	);
}

function ContentStateBadges({
	stateMod,
	stateReport,
	isDeleted,
}: {
	stateMod: string;
	stateReport: string;
	isDeleted: boolean;
}) {
	return (
		<>
			{isDeleted && (
				<span className="rounded bg-slate-500/20 px-1.5 py-0.5 text-xs text-slate-400">
					deleted
				</span>
			)}
			{stateMod !== "VISIBLE" && (
				<span className="rounded bg-red-500/20 px-1.5 py-0.5 text-xs text-red-400">
					{stateMod.toLowerCase()}
				</span>
			)}
			{stateReport === "REPORTED" && (
				<span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-xs text-amber-400">
					reported
				</span>
			)}
		</>
	);
}
