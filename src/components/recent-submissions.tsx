import { Link } from "@tanstack/react-router";
import { ExternalLink, FileText, MessageSquare } from "lucide-react";

import type { SortType, TimeFilter } from "@/lib/constants";
import type { SubmissionSummary} from "@/lib/submissions.server";
import { formatRelativeTime } from "@/lib/utils";

type RecentSubmissionsProps = {
	submissions: SubmissionSummary[];
	sort?: SortType;
	time?: TimeFilter;
	onSortChange?: (sort: SortType) => void;
	onTimeChange?: (time: TimeFilter) => void;
	showSortControls?: boolean;
};



const sortOptions: { value: SortType; label: string }[] = [
	{ value: "hot", label: "Hot" },
	{ value: "new", label: "New" },
	{ value: "top", label: "Top" },
	{ value: "controversial", label: "Controversial" },
	{ value: "comments", label: "Comments" },
];

const timeOptions: { value: TimeFilter; label: string }[] = [
	{ value: "hour", label: "Hour" },
	{ value: "day", label: "Day" },
	{ value: "week", label: "Week" },
	{ value: "month", label: "Month" },
	{ value: "year", label: "Year" },
	{ value: "all", label: "All Time" },
];

export function RecentSubmissions({
	submissions,
	sort = "hot",
	time = "all",
	onSortChange,
	onTimeChange,
	showSortControls = true,
}: RecentSubmissionsProps) {
	const showTimeFilter = sort === "top" || sort === "controversial";

	if (!submissions.length) {
		return (
			<div className="rounded-2xl border border-cyan-500/20 bg-slate-900/70 p-6 text-slate-200 shadow-xl">
				<p className="text-lg font-semibold">No submissions yet</p>
				<p className="text-sm text-slate-400">
					Be the first to post something!
				</p>
			</div>
		);
	}

	return (
		<div className="rounded-2xl border border-cyan-500/20 bg-slate-900/70 p-6 text-slate-100 shadow-xl">
			<div className="mb-6 flex flex-col gap-4">
				<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<p className="text-xs uppercase tracking-[0.2em] text-cyan-300/80">
							Community posts
						</p>
						<h2 className="text-2xl font-extrabold text-white">
							Submissions
						</h2>
					</div>
					<Link
						to="/submit"
						className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-600"
					>
						+ New Post
					</Link>
				</div>

				{showSortControls && (
					<div className="flex flex-wrap items-center gap-2">
						<div className="flex gap-1 rounded-lg bg-slate-800 p-1">
							{sortOptions.map((option) => (
								<button
									key={option.value}
									type="button"
									onClick={() => onSortChange?.(option.value)}
									className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
										sort === option.value
											? "bg-cyan-500 text-white"
											: "text-slate-400 hover:text-white"
									}`}
								>
									{option.label}
								</button>
							))}
						</div>

						{showTimeFilter && (
							<div className="flex gap-1 rounded-lg bg-slate-800 p-1">
								{timeOptions.map((option) => (
									<button
										key={option.value}
										type="button"
										onClick={() => onTimeChange?.(option.value)}
										className={`rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
											time === option.value
												? "bg-slate-600 text-white"
												: "text-slate-400 hover:text-white"
										}`}
									>
										{option.label}
									</button>
								))}
							</div>
						)}
					</div>
				)}
			</div>

			<ul className="grid gap-3">
				{submissions.map((submission) => (
					<li
						key={submission.id}
						className="group relative overflow-hidden rounded-xl border border-slate-800/80 bg-slate-900/80 transition-all duration-200 hover:-translate-y-[1px] hover:border-cyan-400/50 hover:shadow-lg hover:shadow-cyan-500/10"
					>
						<div className="flex">
							{/* Vote column */}
							<div className="flex w-12 flex-col items-center justify-center bg-slate-800/50 py-3">
								<span
									className={`text-lg font-bold ${
										submission.score > 0
											? "text-orange-500"
											: submission.score < 0
												? "text-blue-500"
												: "text-slate-400"
									}`}
								>
									{submission.score}
								</span>
							</div>

							{/* Content */}
							<div className="flex-1 p-3">
								<div className="flex items-start gap-3">
									{/* Thumbnail placeholder */}
									{submission.thumbUrl ? (
										<img
											src={submission.thumbUrl}
											alt=""
											className="h-16 w-16 rounded-lg object-cover"
										/>
									) : submission.url ? (
										<div className="flex h-16 w-16 items-center justify-center rounded-lg bg-slate-700">
											<ExternalLink className="h-6 w-6 text-slate-400" />
										</div>
									) : null}

									<div className="min-w-0 flex-1">
										{/* Title */}
										<h3 className="text-base font-medium text-white">
											<Link
												to={`/post/${submission.id}` as "/"}
												className="hover:text-cyan-400"
											>
												{submission.title}
											</Link>
											{submission.url && (
												<a
													href={submission.url}
													target="_blank"
													rel="noopener noreferrer"
													className="ml-2 text-xs text-slate-500 hover:text-cyan-400"
												>
													({new URL(submission.url).hostname})
												</a>
											)}
										</h3>

										{/* Meta line */}
										<p className="mt-1 text-sm text-slate-400">
											<span className="text-slate-500">by</span>{" "}
											<span className="font-medium text-cyan-400">
												{submission.authorName}
											</span>{" "}
											<span className="text-slate-600">&middot;</span>{" "}
											{formatRelativeTime(submission.createdUtc)}
										</p>

										{/* Tags and actions */}
										<div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
											{submission.isPinned && (
												<span className="rounded bg-green-500/20 px-2 py-0.5 font-medium text-green-400">
													Pinned
												</span>
											)}
											{submission.isNsfw && (
												<span className="rounded bg-red-500/20 px-2 py-0.5 font-medium text-red-400">
													NSFW
												</span>
											)}
											{submission.flair && (
												<span className="rounded bg-slate-700 px-2 py-0.5 text-slate-300">
													{submission.flair}
												</span>
											)}
											<Link
												to={`/post/${submission.id}` as "/"}
												className="flex items-center gap-1 text-slate-500 hover:text-cyan-400"
											>
												<MessageSquare className="h-3.5 w-3.5" />
												{submission.commentCount} comments
											</Link>
											{!submission.url && (
												<span className="flex items-center gap-1 text-slate-500">
													<FileText className="h-3.5 w-3.5" />
													Text
												</span>
											)}
										</div>
									</div>
								</div>
							</div>
						</div>
					</li>
				))}
			</ul>
		</div>
	);
}
