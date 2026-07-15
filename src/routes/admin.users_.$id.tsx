import {
	createFileRoute,
	Link,
	notFound,
	useRouter,
} from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	getUserAdminDetails,
	getUserAlts,
	getUserRecentActivity,
	getUserReportHistory,
	type UserAdminDetails,
	type UserAlt,
	type UserRecentActivity,
	type UserReportHistoryEntry,
} from "@/lib/admin.server";
import {
	banUserFn,
	bulkModerateUserContentFn,
	createUserNoteFn,
	deleteUserNoteFn,
	linkUserAltFn,
	setUserAdminLevelFn,
	setUserFilterBehaviorFn,
	unlinkUserAltFn,
} from "@/lib/admin-actions.server";
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
	viewer: { id: number; adminLevel: number };
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
		filterBehavior: "AUTOMATIC" | "UNFILTERED" | "FILTERED";
	};
	notes: UserAdminDetails["notes"];
	activity: UserRecentActivity;
	reports: UserReportHistoryEntry[];
	alts: UserAlt[];
};

export const getUserInvestigationFn = createServerFn({ method: "GET" })
	.inputValidator((data: { userId: number }) => userIdInputSchema.parse(data))
	.handler(async ({ data }): Promise<UserInvestigation | null> => {
		const viewer = await assertAdmin();
		const details = await getUserAdminDetails(data.userId);
		if (!details) return null;

		const [activity, reports, userAlts] = await Promise.all([
			getUserRecentActivity(data.userId),
			getUserReportHistory(data.userId),
			getUserAlts(data.userId),
		]);

		const { user } = details;
		return {
			viewer: { id: viewer.id, adminLevel: viewer.adminLevel },
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
				filterBehavior: user.filterBehavior,
			},
			notes: details.notes,
			activity,
			reports,
			alts: userAlts,
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
	const { viewer, user, notes, activity, reports, alts } =
		Route.useLoaderData();

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

			<NotesSection userId={user.id} notes={notes} />

			<InvestigationControls viewer={viewer} user={user} alts={alts} />

			<AltsSection userId={user.id} alts={alts} />

			<ReportsSection reports={reports} />

			<ActivitySection activity={activity} />
		</div>
	);
}

function NotesSection({
	userId,
	notes,
}: {
	userId: number;
	notes: UserAdminDetails["notes"];
}) {
	const router = useRouter();
	const [noteText, setNoteText] = useState("");
	const [tag, setTag] = useState<(typeof NOTE_TAGS)[number]>("Comment");
	const [isPending, setIsPending] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const handleDelete = async (noteId: number) => {
		setIsPending(true);
		setError(null);
		try {
			const res = await deleteUserNoteFn({ data: { noteId, userId } });
			if (res.success) await router.invalidate();
			else setError(res.error);
		} finally {
			setIsPending(false);
		}
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		const note = noteText.trim();
		if (!note) return;
		setIsPending(true);
		setError(null);
		try {
			const res = await createUserNoteFn({ data: { userId, note, tag } });
			if (res.success) {
				setNoteText("");
				await router.invalidate();
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
							<div className="mt-1 flex items-start gap-3">
								<p className="grow text-slate-200">{note.note}</p>
								<button
									type="button"
									disabled={isPending}
									onClick={() => handleDelete(note.id)}
									className="text-xs text-slate-500 underline hover:text-red-400 disabled:opacity-50"
								>
									Delete
								</button>
							</div>
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

function InvestigationControls({
	viewer,
	user,
	alts,
}: {
	viewer: UserInvestigation["viewer"];
	user: UserInvestigation["user"];
	alts: UserAlt[];
}) {
	const router = useRouter();
	const [filterBehavior, setFilterBehavior] = useState(user.filterBehavior);
	const [adminLevel, setAdminLevel] = useState(user.adminLevel);
	const [reason, setReason] = useState("");
	const [confirmation, setConfirmation] = useState("");
	const [bulkConfirmation, setBulkConfirmation] = useState("");
	const [isPending, setIsPending] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const saveFilter = async () => {
		setIsPending(true);
		setError(null);
		try {
			const res = await setUserFilterBehaviorFn({
				data: { userId: user.id, filterBehavior },
			});
			if (res.success) await router.invalidate();
			else setError(res.error);
		} finally {
			setIsPending(false);
		}
	};

	const banAll = async (event: React.FormEvent) => {
		event.preventDefault();
		setIsPending(true);
		setError(null);
		try {
			const res = await banUserFn({
				data: {
					userId: user.id,
					reason: reason.trim(),
					banKnownAlts: true,
					confirmKnownAlts: confirmation === user.username,
				},
			});
			if (res.success) {
				setReason("");
				setConfirmation("");
				await router.invalidate();
			} else setError(res.error);
		} finally {
			setIsPending(false);
		}
	};
	const saveAdminLevel = async () => {
		setIsPending(true);
		setError(null);
		try {
			const res = await setUserAdminLevelFn({
				data: { userId: user.id, adminLevel },
			});
			if (res.success) await router.invalidate();
			else setError(res.error);
		} finally {
			setIsPending(false);
		}
	};
	const bulkModerate = async (action: "nuke" | "unnuke") => {
		setIsPending(true);
		setError(null);
		try {
			const res = await bulkModerateUserContentFn({
				data: {
					userId: user.id,
					action,
					confirmation: bulkConfirmation,
				},
			});
			if (res.success) {
				setBulkConfirmation("");
				await router.invalidate();
			} else setError(res.error);
		} finally {
			setIsPending(false);
		}
	};

	return (
		<div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl">
			<h3 className="mb-3 text-base font-semibold text-white">
				Investigation Controls
			</h3>
			<div className="flex flex-wrap items-end gap-2">
				<label className="text-sm text-slate-300">
					<span className="mb-1 block">Comment filtering</span>
					<select
						value={filterBehavior}
						onChange={(event) =>
							setFilterBehavior(event.target.value as typeof filterBehavior)
						}
						className="rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-white"
					>
						<option value="AUTOMATIC">Automatic</option>
						<option value="UNFILTERED">Unfiltered</option>
						<option value="FILTERED">Always filtered</option>
					</select>
				</label>
				<Button type="button" disabled={isPending} onClick={saveFilter}>
					Save filtering
				</Button>
			</div>
			{viewer.adminLevel >= 3 && (
				<div className="mt-4 space-y-4 border-t border-slate-800 pt-4">
					<div className="flex flex-wrap items-end gap-2">
						<label className="text-sm text-slate-300">
							<span className="mb-1 block">Administrator level</span>
							<select
								value={adminLevel}
								onChange={(event) => setAdminLevel(Number(event.target.value))}
								className="rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-white"
							>
								{[0, 1, 2, 3].map((level) => (
									<option key={level} value={level}>
										Level {level}
									</option>
								))}
							</select>
						</label>
						<Button
							type="button"
							disabled={
								isPending ||
								adminLevel === user.adminLevel ||
								(viewer.id === user.id && adminLevel < user.adminLevel)
							}
							onClick={saveAdminLevel}
						>
							Update administrator level
						</Button>
					</div>
					<div className="flex flex-wrap items-end gap-2">
						<div className="grow text-sm text-slate-300">
							<span className="mb-1 block">
								Type NUKE {user.id} or UNNUKE {user.id}
							</span>
							<Input
								value={bulkConfirmation}
								onChange={(event) => setBulkConfirmation(event.target.value)}
								placeholder={`NUKE ${user.id}`}
							/>
						</div>
						<Button
							type="button"
							variant="destructive"
							disabled={isPending || bulkConfirmation !== `NUKE ${user.id}`}
							onClick={() => bulkModerate("nuke")}
						>
							Nuke content
						</Button>
						<Button
							type="button"
							disabled={isPending || bulkConfirmation !== `UNNUKE ${user.id}`}
							onClick={() => bulkModerate("unnuke")}
						>
							Restore nuked content
						</Button>
					</div>
				</div>
			)}

			<form
				onSubmit={banAll}
				className="mt-5 space-y-2 border-t border-slate-800 pt-4"
			>
				<p className="text-sm text-slate-300">
					Ban this account and {alts.length} known alt
					{alts.length === 1 ? "" : "s"} with identical parameters.
				</p>
				<div className="flex flex-wrap gap-2">
					<Input
						value={reason}
						onChange={(event) => setReason(event.target.value)}
						placeholder="Ban reason"
					/>
					<Input
						value={confirmation}
						onChange={(event) => setConfirmation(event.target.value)}
						placeholder={`Type ${user.username} to confirm`}
					/>
					<Button
						type="submit"
						variant="destructive"
						disabled={
							isPending || !reason.trim() || confirmation !== user.username
						}
					>
						Ban known alts
					</Button>
				</div>
			</form>
			{error && <p className="mt-2 text-xs text-red-400">{error}</p>}
		</div>
	);
}

function AltsSection({ userId, alts }: { userId: number; alts: UserAlt[] }) {
	const router = useRouter();
	const [username, setUsername] = useState("");
	const [isPending, setIsPending] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handleLink = async (e: React.FormEvent) => {
		e.preventDefault();
		const name = username.trim();
		if (!name) return;
		setIsPending(true);
		setError(null);
		try {
			const res = await linkUserAltFn({ data: { userId, username: name } });
			if (res.success) {
				setUsername("");
				await router.invalidate();
			} else {
				setError(res.error);
			}
		} finally {
			setIsPending(false);
		}
	};

	const handleUnlink = async (altUsername: string) => {
		setIsPending(true);
		setError(null);
		try {
			const res = await unlinkUserAltFn({
				data: { userId, username: altUsername },
			});
			if (res.success) {
				await router.invalidate();
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
				Linked Alts ({alts.length})
			</h3>

			{alts.length === 0 ? (
				<p className="mb-4 text-sm text-slate-400">No linked alts.</p>
			) : (
				<div className="mb-4 space-y-2">
					{alts.map((alt) => (
						<div
							key={alt.id}
							className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/50 px-4 py-2 text-sm"
						>
							<Link
								to="/admin/users/$id"
								params={{ id: String(alt.id) }}
								className="font-medium text-cyan-400 hover:underline"
							>
								{alt.username}
							</Link>
							<span
								className={`rounded px-1.5 py-0.5 text-xs ${
									alt.isManual
										? "bg-violet-500/20 text-violet-300"
										: "bg-slate-800 text-slate-400"
								}`}
							>
								{alt.isManual ? "manual" : "auto"}
							</span>
							<button
								type="button"
								disabled={isPending}
								onClick={() => handleUnlink(alt.username)}
								className="ml-auto text-xs text-slate-400 underline hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-60"
							>
								Unlink
							</button>
						</div>
					))}
				</div>
			)}

			<form onSubmit={handleLink} className="flex gap-2">
				<Input
					value={username}
					onChange={(e) => setUsername(e.target.value)}
					placeholder="Link alt by username..."
					className="border-slate-700 bg-slate-800 text-white placeholder:text-slate-500"
				/>
				<Button
					type="submit"
					disabled={isPending || !username.trim()}
					className="shrink-0 bg-cyan-500 hover:bg-cyan-600"
				>
					Link Alt
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
