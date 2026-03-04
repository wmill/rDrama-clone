import { CalendarDays, ShieldAlert, ShieldCheck, Star } from "lucide-react";

import type {
	CommentFeedSortType,
	SortType,
	TimeFilter,
} from "@/lib/constants";
import type { ProfilePageData } from "@/lib/users.server";
import { formatRelativeTime } from "@/lib/utils";

const postSortOptions: { value: SortType; label: string }[] = [
	{ value: "hot", label: "Hot" },
	{ value: "new", label: "New" },
	{ value: "top", label: "Top" },
	{ value: "controversial", label: "Controversial" },
	{ value: "comments", label: "Comments" },
];

const commentSortOptions: { value: CommentFeedSortType; label: string }[] = [
	{ value: "new", label: "New" },
	{ value: "top", label: "Top" },
	{ value: "controversial", label: "Controversial" },
];

const timeOptions: { value: TimeFilter; label: string }[] = [
	{ value: "hour", label: "Hour" },
	{ value: "day", label: "Day" },
	{ value: "week", label: "Week" },
	{ value: "month", label: "Month" },
	{ value: "year", label: "Year" },
	{ value: "all", label: "All Time" },
];

export function UserPage({
	data,
	onSortChange,
	onTimeChange,
	onPageChange,
}: {
	data: ProfilePageData;
	onSortChange: (value: SortType | CommentFeedSortType) => Promise<void>;
	onTimeChange: (value: TimeFilter) => Promise<void>;
	onPageChange: (page: number) => Promise<void>;
}) {
	const user = data.profileUser;
	const commentsTabHref = `/@${user.username}`;
	const postsTabHref = `/@${user.username}/posts`;
	const avatarHref = user.highRes || user.profileUrl || undefined;
	const sortOptions =
		data.tab === "posts" ? postSortOptions : commentSortOptions;

	return (
		<div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 p-4">
			<div className="mx-auto max-w-5xl space-y-6">
				<section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/80 shadow-xl">
					<div
						className="h-36 bg-slate-800 bg-cover bg-center md:h-48"
						style={
							user.bannerUrl
								? { backgroundImage: `url(${user.bannerUrl})` }
								: undefined
						}
					/>
					<div className="p-5 md:p-6">
						<div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
							<div className="flex items-start gap-4">
								{avatarHref ? (
									<a
										href={avatarHref}
										className="-mt-14 inline-flex h-20 w-20 overflow-hidden rounded-full border-4 border-slate-900 bg-slate-800 md:-mt-20 md:h-24 md:w-24"
									>
										<img
											src={user.profileUrl ?? avatarHref}
											alt={user.username}
											className="h-full w-full object-cover"
										/>
									</a>
								) : (
									<div className="-mt-14 flex h-20 w-20 items-center justify-center rounded-full border-4 border-slate-900 bg-slate-800 text-2xl font-bold text-cyan-400 md:-mt-20 md:h-24 md:w-24">
										{user.username.charAt(0).toUpperCase()}
									</div>
								)}
								<div>
									<div className="flex flex-wrap items-center gap-2">
										<h1 className="text-2xl font-bold text-white md:text-3xl">
											@{user.username}
										</h1>
										{user.verified && (
											<span className="inline-flex items-center gap-1 rounded-full border border-cyan-500/40 bg-cyan-500/10 px-2 py-0.5 text-xs text-cyan-300">
												<ShieldCheck className="h-3 w-3" />
												{user.verified}
											</span>
										)}
										{user.adminLevel > 0 && (
											<span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-300">
												<Star className="h-3 w-3" />
												Admin
											</span>
										)}
										{user.patron > 0 && (
											<span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-300">
												Patron
											</span>
										)}
									</div>

									{user.originalUsername &&
										user.originalUsername !== user.username && (
											<p className="mt-1 text-xs text-slate-400">
												Renamed from @{user.originalUsername}
											</p>
										)}

									{user.customTitle && (
										<div
											className="mt-2 text-sm text-slate-300"
											// biome-ignore lint/security/noDangerouslySetInnerHtml: Stored HTML is sanitized in legacy-compatible schema flow
											dangerouslySetInnerHTML={{ __html: user.customTitle }}
										/>
									)}
								</div>
							</div>

							<div className="text-sm text-slate-300">
								<div className="flex items-center gap-2">
									<CalendarDays className="h-4 w-4 text-slate-400" />
									<span>
										Joined{" "}
										{new Date(user.createdUtc * 1000).toLocaleDateString()}
									</span>
								</div>
								<div className="mt-2 flex gap-4">
									<span>
										<strong className="text-white">
											{user.storedSubscriberCount.toLocaleString()}
										</strong>{" "}
										followers
									</span>
									<span>
										<strong className="text-white">
											{data.followingCount.toLocaleString()}
										</strong>{" "}
										following
									</span>
								</div>
							</div>
						</div>

						{user.isBanned > 0 && (
							<div className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
								<div className="flex items-center gap-2 font-semibold">
									<ShieldAlert className="h-4 w-4" />
									Suspended
								</div>
								{user.banReason && <p className="mt-1">{user.banReason}</p>}
								{user.unbanUtc > 0 && (
									<p className="mt-1 text-red-100/90">
										Unban date:{" "}
										{new Date(user.unbanUtc * 1000).toLocaleString()}
									</p>
								)}
							</div>
						)}

						<div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/50 p-4">
							{user.bioHtml ? (
								<div
									className="prose prose-invert max-w-none text-sm text-slate-200"
									// biome-ignore lint/security/noDangerouslySetInnerHtml: Stored HTML is sanitized in legacy-compatible schema flow
									dangerouslySetInnerHTML={{ __html: user.bioHtml }}
								/>
							) : (
								<p className="text-sm text-slate-400">No bio.</p>
							)}
						</div>
					</div>
				</section>

				<section className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 shadow-xl">
					<div className="mb-4 flex gap-2">
						<a
							href={commentsTabHref}
							className={`rounded-md px-3 py-2 text-sm font-medium ${
								data.tab === "comments"
									? "bg-cyan-500 text-white"
									: "bg-slate-800 text-slate-300 hover:bg-slate-700"
							}`}
						>
							Comments ({user.commentCount.toLocaleString()})
						</a>
						<a
							href={postsTabHref}
							className={`rounded-md px-3 py-2 text-sm font-medium ${
								data.tab === "posts"
									? "bg-cyan-500 text-white"
									: "bg-slate-800 text-slate-300 hover:bg-slate-700"
							}`}
						>
							Posts ({user.postCount.toLocaleString()})
						</a>
					</div>

					{data.isPrivateRestricted ? (
						<div className="rounded-lg border border-slate-700 bg-slate-950/50 p-6 text-center text-slate-300">
							This profile is private. Only the account owner or admins can view
							posts and comments.
						</div>
					) : (
						<>
							<div className="mb-4 flex flex-wrap gap-4">
								<div className="flex items-center gap-2">
									<span className="text-sm text-slate-400">Sort:</span>
									<div className="flex gap-1 rounded-lg bg-slate-800 p-1">
										{sortOptions.map((option) => (
											<button
												key={option.value}
												type="button"
												onClick={() => onSortChange(option.value)}
												className={`rounded-md px-3 py-1 text-sm ${
													data.sort === option.value
														? "bg-cyan-500 text-white"
														: "text-slate-300 hover:text-white"
												}`}
											>
												{option.label}
											</button>
										))}
									</div>
								</div>

								<div className="flex items-center gap-2">
									<span className="text-sm text-slate-400">Time:</span>
									<div className="flex gap-1 rounded-lg bg-slate-800 p-1">
										{timeOptions.map((option) => (
											<button
												key={option.value}
												type="button"
												onClick={() => onTimeChange(option.value)}
												className={`rounded-md px-2 py-1 text-sm ${
													data.t === option.value
														? "bg-cyan-500 text-white"
														: "text-slate-300 hover:text-white"
												}`}
											>
												{option.label}
											</button>
										))}
									</div>
								</div>
							</div>

							{data.tab === "posts" ? (
								<div className="space-y-3">
									{data.posts.length === 0 ? (
										<p className="rounded-lg border border-dashed border-slate-700 p-6 text-center text-slate-400">
											No posts found.
										</p>
									) : (
										data.posts.map((post) => (
											<article
												key={post.id}
												className="rounded-lg border border-slate-800 bg-slate-950/50 p-4"
											>
												<a
													href={`/post/${post.id}`}
													className="text-base font-semibold text-cyan-400 hover:text-cyan-300"
												>
													{post.title}
												</a>
												<div className="mt-1 text-xs text-slate-400">
													{formatRelativeTime(post.createdUtc)} • {post.score}{" "}
													points • {post.commentCount} comments
												</div>
												{post.bodyHtml && (
													<div
														className="mt-3 line-clamp-3 text-sm text-slate-300"
														// biome-ignore lint/security/noDangerouslySetInnerHtml: Stored HTML is sanitized in legacy-compatible schema flow
														dangerouslySetInnerHTML={{ __html: post.bodyHtml }}
													/>
												)}
											</article>
										))
									)}
								</div>
							) : (
								<div className="space-y-3">
									{data.comments.length === 0 ? (
										<p className="rounded-lg border border-dashed border-slate-700 p-6 text-center text-slate-400">
											No comments found.
										</p>
									) : (
										data.comments.map((comment) => (
											<article
												key={comment.id}
												className="rounded-lg border border-slate-800 bg-slate-950/50 p-4"
											>
												<a
													href={`/post/${comment.parentSubmissionId}`}
													className="text-sm font-medium text-cyan-400 hover:text-cyan-300"
												>
													{comment.submissionTitle}
												</a>
												<div className="mt-1 text-xs text-slate-400">
													{formatRelativeTime(comment.createdUtc)} •{" "}
													{comment.score} points
												</div>
												<div
													className="mt-2 text-sm text-slate-300"
													// biome-ignore lint/security/noDangerouslySetInnerHtml: Stored HTML is sanitized in legacy-compatible schema flow
													dangerouslySetInnerHTML={{ __html: comment.bodyHtml }}
												/>
											</article>
										))
									)}
								</div>
							)}

							<div className="mt-6 flex items-center justify-center gap-4">
								<button
									type="button"
									onClick={() => onPageChange(data.page - 1)}
									disabled={data.page <= 1}
									className="rounded-lg bg-slate-800 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
								>
									Previous
								</button>
								<span className="text-sm text-slate-400">Page {data.page}</span>
								<button
									type="button"
									onClick={() => onPageChange(data.page + 1)}
									disabled={!data.hasNextPage}
									className="rounded-lg bg-slate-800 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
								>
									Next
								</button>
							</div>
						</>
					)}
				</section>
			</div>
		</div>
	);
}
