import { createFileRoute } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import { desc, sql } from "drizzle-orm"

import { db } from "@/db"
import {
	commentVotes,
	comments,
	submissions,
	users,
	votes,
} from "@/db/schema"

const getSnapshot = createServerFn({ method: "GET" }).handler(async () => {
	const [submissionTotal] = await db
		.select({ count: sql<number>`COUNT(*)` })
		.from(submissions)

	const [commentTotal] = await db
		.select({ count: sql<number>`COUNT(*)` })
		.from(comments)

	const [userTotal] = await db.select({ count: sql<number>`COUNT(*)` }).from(users)

	const [voteTotal] = await db.select({ count: sql<number>`COUNT(*)` }).from(votes)

	const [commentVoteTotal] = await db
		.select({ count: sql<number>`COUNT(*)` })
		.from(commentVotes)

	const latestSubmissions = await db
		.select({
			id: submissions.id,
			title: submissions.title,
			authorId: submissions.authorId,
			createdUtc: submissions.createdUtc,
			upvotes: submissions.upvotes,
			downvotes: submissions.downvotes,
			commentCount: submissions.commentCount,
		})
		.from(submissions)
		.orderBy(desc(submissions.createdUtc))
		.limit(5)

	const latestComments = await db
		.select({
			id: comments.id,
			body: comments.body,
			authorId: comments.authorId,
			parentSubmission: comments.parentSubmission,
			createdUtc: comments.createdUtc,
			upvotes: comments.upvotes,
			downvotes: comments.downvotes,
		})
		.from(comments)
		.orderBy(desc(comments.createdUtc))
		.limit(5)

	return {
		totals: {
			submissions: submissionTotal?.count ?? 0,
			comments: commentTotal?.count ?? 0,
			users: userTotal?.count ?? 0,
			votes: voteTotal?.count ?? 0,
			commentVotes: commentVoteTotal?.count ?? 0,
		},
		latestSubmissions,
		latestComments,
	}
})

export const Route = createFileRoute("/demo/drizzle")({
	component: DemoDrizzle,
	loader: async () => await getSnapshot(),
})

function formatUtcTimestamp(timestamp: number) {
	return new Date(timestamp * 1000).toLocaleString(undefined, {
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	})
}

function DemoDrizzle() {
	const snapshot = Route.useLoaderData()

	return (
		<div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 text-white">
			<div className="w-full max-w-5xl space-y-6 rounded-2xl border border-white/10 bg-black/40 p-8 shadow-2xl backdrop-blur">
				<div className="flex items-center justify-between gap-4">
					<div>
						<p className="text-xs uppercase tracking-[0.3em] text-cyan-300/80">
							Drizzle ORM · Read only
						</p>
						<h1 className="text-3xl font-bold text-white">Database snapshot</h1>
						<p className="text-sm text-slate-300">
							Connected to your configured database; no writes performed.
						</p>
					</div>
					<div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-cyan-100">
						Live tables: users, submissions, comments, votes, commentvotes
					</div>
				</div>

				<div className="grid grid-cols-2 gap-4 md:grid-cols-5">
					{[
						{ label: "Submissions", value: snapshot.totals.submissions },
						{ label: "Comments", value: snapshot.totals.comments },
						{ label: "Users", value: snapshot.totals.users },
						{ label: "Votes", value: snapshot.totals.votes },
						{ label: "Comment votes", value: snapshot.totals.commentVotes },
					].map((item) => (
						<div
							key={item.label}
							className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 shadow"
						>
							<p className="text-xs uppercase tracking-[0.2em] text-slate-400">
								{item.label}
							</p>
							<p className="text-2xl font-bold text-white">
								{item.value.toLocaleString()}
							</p>
						</div>
					))}
				</div>

				<div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
					<div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow">
						<div className="mb-4 flex items-center justify-between">
							<div>
								<p className="text-xs uppercase tracking-[0.2em] text-cyan-300/80">
									Latest submissions
								</p>
								<h2 className="text-xl font-semibold text-white">
									Most recent 5
								</h2>
							</div>
						</div>
						<ul className="space-y-3">
							{snapshot.latestSubmissions.map((submission) => {
								const score = (submission.upvotes ?? 0) - (submission.downvotes ?? 0)
								return (
									<li
										key={submission.id}
										className="rounded-xl border border-slate-800/70 bg-slate-950/80 p-4 shadow-sm"
									>
										<div className="flex items-start justify-between gap-3">
											<div className="min-w-0">
												<p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
													#{submission.id}
												</p>
												<h3 className="truncate text-lg font-semibold text-white">
													{submission.title}
												</h3>
												<p className="text-sm text-slate-400">
													Author #{submission.authorId} ·{" "}
													{formatUtcTimestamp(submission.createdUtc)}
												</p>
											</div>
											<div className="rounded-lg bg-slate-800 px-3 py-2 text-right">
												<div className="text-xs uppercase tracking-wider text-slate-400">
													Score
												</div>
												<div className="text-xl font-bold text-white">{score}</div>
												<div className="text-[11px] text-slate-500">
													{submission.upvotes}▲ · {submission.downvotes}▼
												</div>
											</div>
										</div>
										<p className="mt-2 text-sm text-slate-300">
											{submission.commentCount} comments
										</p>
									</li>
								)
							})}
						</ul>
					</div>

					<div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow">
						<div className="mb-4 flex items-center justify-between">
							<div>
								<p className="text-xs uppercase tracking-[0.2em] text-emerald-300/80">
									Latest comments
								</p>
								<h2 className="text-xl font-semibold text-white">
									Most recent 5
								</h2>
							</div>
						</div>
						<ul className="space-y-3">
							{snapshot.latestComments.map((comment) => {
								const score = (comment.upvotes ?? 0) - (comment.downvotes ?? 0)
								return (
									<li
										key={comment.id}
										className="rounded-xl border border-slate-800/70 bg-slate-950/80 p-4 shadow-sm"
									>
										<div className="flex items-start justify-between gap-3">
											<div className="min-w-0">
												<p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
													Comment #{comment.id} · Post #{comment.parentSubmission}
												</p>
												<p className="truncate text-sm text-slate-200">
													{comment.body ?? "(no body text)"}
												</p>
												<p className="text-sm text-slate-400">
													Author #{comment.authorId} ·{" "}
													{formatUtcTimestamp(comment.createdUtc)}
												</p>
											</div>
											<div className="rounded-lg bg-slate-800 px-3 py-2 text-right">
												<div className="text-xs uppercase tracking-wider text-slate-400">
													Score
												</div>
												<div className="text-xl font-bold text-white">{score}</div>
												<div className="text-[11px] text-slate-500">
													{comment.upvotes}▲ · {comment.downvotes}▼
												</div>
											</div>
										</div>
									</li>
								)
							})}
						</ul>
					</div>
				</div>

				<div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-100">
					Read-only safety: this page performs SELECTs only. No inserts, updates, or
					migrations are triggered from the Drizzle demo.
				</div>
			</div>
		</div>
	)
}
