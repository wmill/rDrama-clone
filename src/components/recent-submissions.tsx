import type { SubmissionSummary } from "@/lib/submissions.server";

type RecentSubmissionsProps = {
	submissions: SubmissionSummary[];
};

function formatDateTime(date: Date) {
	return date.toLocaleString(undefined, {
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

export function RecentSubmissions({ submissions }: RecentSubmissionsProps) {
	if (!submissions.length) {
		return (
			<div className="rounded-2xl border border-cyan-500/20 bg-slate-900/70 p-6 text-slate-200 shadow-xl">
				<p className="text-lg font-semibold">No submissions yet</p>
				<p className="text-sm text-slate-400">
					We&rsquo;ll show the newest 25 submissions here once data is
					available.
				</p>
			</div>
		);
	}

	return (
		<div className="rounded-2xl border border-cyan-500/20 bg-slate-900/70 p-6 text-slate-100 shadow-xl">
			<div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<p className="text-xs uppercase tracking-[0.2em] text-cyan-300/80">
						Live from fixture data
					</p>
					<h2 className="text-2xl font-extrabold text-white">
						Recent submissions
					</h2>
					<p className="text-sm text-slate-400">
						Sorted by newest &middot; showing {submissions.length} entries
					</p>
				</div>
				<div className="flex items-center gap-2 rounded-full bg-cyan-500/10 px-4 py-2 text-sm text-cyan-200">
					<span className="inline-block h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_10px_theme(colors.cyan.400)]" />
					<span>Fresh drop</span>
				</div>
			</div>

			<ul className="grid gap-4 md:grid-cols-2">
				{submissions.map((submission) => {
					const score = submission.upvotes - submission.downvotes;
					const formattedDate = formatDateTime(
						new Date(submission.createdUtc * 1000),
					);

					return (
						<li
							key={submission.id}
							className="group relative overflow-hidden rounded-xl border border-slate-800/80 bg-slate-900/80 p-4 transition-all duration-200 hover:-translate-y-[2px] hover:border-cyan-400/50 hover:shadow-lg hover:shadow-cyan-500/15"
						>
							<div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
							<div className="relative flex flex-col gap-3">
								<div className="flex items-start justify-between gap-3">
									<div className="min-w-0">
										<div className="text-[11px] uppercase tracking-[0.25em] text-slate-500">
											#{submission.id.toString().padStart(3, "0")}
										</div>
										<h3 className="truncate text-lg font-semibold text-white">
											{submission.url ? (
												<a
													href={submission.url}
													className="text-cyan-200 underline decoration-cyan-500/50 underline-offset-4 transition-colors hover:text-cyan-100"
													target="_blank"
													rel="noreferrer"
												>
													{submission.title}
												</a>
											) : (
												submission.title
											)}
										</h3>
										<p className="text-sm text-slate-400">
											by{" "}
											<span className="font-semibold text-slate-200">
												{submission.authorName}
											</span>{" "}
											on {formattedDate}
										</p>
									</div>
									<div className="rounded-lg bg-slate-800 px-3 py-2 text-right">
										<div className="text-xs uppercase tracking-wider text-slate-400">
											Score
										</div>
										<div className="text-xl font-bold text-white">{score}</div>
										<div className="text-[11px] text-slate-500">
											{submission.upvotes}▲ &middot; {submission.downvotes}▼
										</div>
									</div>
								</div>

								<div className="flex flex-wrap items-center gap-3 text-sm text-slate-300">
									<span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-wide text-slate-300">
										{submission.commentCount} comments
									</span>
									{submission.url ? (
										<span className="rounded-full bg-cyan-500/15 px-3 py-1 text-xs font-semibold text-cyan-200">
											External link
										</span>
									) : (
										<span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-200">
											Text post
										</span>
									)}
								</div>
							</div>
						</li>
					);
				})}
			</ul>
		</div>
	);
}
