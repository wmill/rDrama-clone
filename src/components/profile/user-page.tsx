import { Link, useRouter } from "@tanstack/react-router";
import { CalendarDays, ShieldAlert, ShieldCheck, Star } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { UserAdminDetails } from "@/lib/admin.server";
import {
	banUserFn,
	createUserNoteFn,
	shadowbanUserFn,
	unbanUserFn,
	unshadowbanUserFn,
	updateUserModerationProfileFn,
} from "@/lib/admin-actions.server";
import type {
	CommentFeedSortType,
	SortType,
	TimeFilter,
} from "@/lib/constants";
import {
	DEFAULT_COMMENTS_PROFILE_SEARCH,
	DEFAULT_POSTS_PROFILE_SEARCH,
	DEFAULT_RELATIONSHIP_PROFILE_SEARCH,
} from "@/lib/profile-route";
import { setBlockStateFn, setFollowStateFn } from "@/lib/social-actions.server";
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

const USER_TAG_OPTIONS = [
	"Quality",
	"Good",
	"Comment",
	"Warning",
	"Tempban",
	"Permban",
	"Spam",
	"Bot",
] as const;

export function UserPage({
	data,
	adminDetails,
	onSortChange,
	onTimeChange,
	onPageChange,
}: {
	data: ProfilePageData;
	adminDetails?: UserAdminDetails | null;
	onSortChange: (value: SortType | CommentFeedSortType) => Promise<void>;
	onTimeChange: (value: TimeFilter) => Promise<void>;
	onPageChange: (page: number) => Promise<void>;
}) {
	const router = useRouter();
	const user = data.profileUser;
	const avatarHref = user.highRes || user.profileUrl || undefined;
	const sortOptions =
		data.tab === "posts" || data.tab === "saved-posts"
			? postSortOptions
			: commentSortOptions;

	const isAdmin = (data.viewer?.adminLevel ?? 0) >= 2 && !data.isOwner;
	const canSeeSavedTabs = data.isOwner || (data.viewer?.adminLevel ?? 0) >= 2;
	const isSavedTab =
		data.tab === "saved-comments" || data.tab === "saved-posts";
	const [isFollowing, setIsFollowing] = useState(data.isFollowing);
	const [isBlocking, setIsBlocking] = useState(data.isBlocking);
	const [relationshipError, setRelationshipError] = useState<string | null>(
		null,
	);
	const [isFollowPending, setIsFollowPending] = useState(false);
	const [isBlockPending, setIsBlockPending] = useState(false);

	useEffect(() => {
		setIsFollowing(data.isFollowing);
		setIsBlocking(data.isBlocking);
	}, [data.isFollowing, data.isBlocking]);

	const handleToggleFollow = async () => {
		setIsFollowPending(true);
		setRelationshipError(null);

		try {
			const nextFollowing = !isFollowing;
			const result = await setFollowStateFn({
				data: {
					targetUserId: user.id,
					following: nextFollowing,
				},
			});
			if (!result.success) {
				setRelationshipError(result.error);
				return;
			}

			setIsFollowing(nextFollowing);
			await router.invalidate();
		} catch (error) {
			setRelationshipError(
				error instanceof Error
					? error.message
					: "Failed to update follow state",
			);
		} finally {
			setIsFollowPending(false);
		}
	};

	const handleToggleBlock = async () => {
		setIsBlockPending(true);
		setRelationshipError(null);

		try {
			const nextBlocking = !isBlocking;
			const result = await setBlockStateFn({
				data: {
					targetUserId: user.id,
					blocked: nextBlocking,
				},
			});
			if (!result.success) {
				setRelationshipError(result.error);
				return;
			}

			setIsBlocking(nextBlocking);
			await router.invalidate();
		} catch (error) {
			setRelationshipError(
				error instanceof Error ? error.message : "Failed to update block state",
			);
		} finally {
			setIsBlockPending(false);
		}
	};

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
												<span
													style={
														user.verifiedColor
															? { color: `#${user.verifiedColor}` }
															: undefined
													}
												>
													{user.verified}
												</span>
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
									<Link
										to="/u/$username/followers"
										params={{ username: user.username }}
										search={DEFAULT_RELATIONSHIP_PROFILE_SEARCH}
										className="hover:text-cyan-300"
									>
										<strong className="text-white">
											{user.storedSubscriberCount.toLocaleString()}
										</strong>{" "}
										followers
									</Link>
									<Link
										to="/u/$username/following"
										params={{ username: user.username }}
										search={DEFAULT_RELATIONSHIP_PROFILE_SEARCH}
										className="hover:text-cyan-300"
									>
										<strong className="text-white">
											{data.followingCount.toLocaleString()}
										</strong>{" "}
										following
									</Link>
								</div>
								{data.viewer && !data.isOwner && (
									<div className="mt-3 flex flex-wrap gap-2">
										<Button
											type="button"
											size="sm"
											disabled={isFollowPending}
											onClick={handleToggleFollow}
											className="bg-cyan-500 hover:bg-cyan-600"
										>
											{isFollowPending
												? "Updating..."
												: isFollowing
													? "Unfollow"
													: "Follow"}
										</Button>
										<Button
											type="button"
											size="sm"
											variant="outline"
											disabled={isBlockPending}
											onClick={handleToggleBlock}
											className={
												isBlocking
													? "border-emerald-600 text-emerald-300 hover:bg-emerald-950/50"
													: "border-rose-700 text-rose-300 hover:bg-rose-950/50"
											}
										>
											{isBlockPending
												? "Updating..."
												: isBlocking
													? "Unblock"
													: "Block"}
										</Button>
									</div>
								)}
							</div>
						</div>

						{relationshipError && (
							<div className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
								{relationshipError}
							</div>
						)}

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

				{isAdmin && adminDetails && (
					<AdminControls
						userId={user.id}
						initialIsBanned={user.isBanned}
						initialShadowBanned={user.shadowBanned}
						initialVerified={user.verified}
						initialVerifiedColor={user.verifiedColor}
						initialCustomTitlePlain={user.customTitlePlain}
						notes={adminDetails.notes}
					/>
				)}

				<section className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 shadow-xl">
					<div className="mb-4 flex gap-2">
						<Link
							to="/u/$username"
							params={{ username: user.username }}
							search={DEFAULT_COMMENTS_PROFILE_SEARCH}
							className={`rounded-md px-3 py-2 text-sm font-medium ${
								data.tab === "comments"
									? "bg-cyan-500 text-white"
									: "bg-slate-800 text-slate-300 hover:bg-slate-700"
							}`}
						>
							Comments ({user.commentCount.toLocaleString()})
						</Link>
						<Link
							to="/u/$username/posts"
							params={{ username: user.username }}
							search={DEFAULT_POSTS_PROFILE_SEARCH}
							className={`rounded-md px-3 py-2 text-sm font-medium ${
								data.tab === "posts"
									? "bg-cyan-500 text-white"
									: "bg-slate-800 text-slate-300 hover:bg-slate-700"
							}`}
						>
							Posts ({user.postCount.toLocaleString()})
						</Link>
						{canSeeSavedTabs && (
							<>
								<Link
									to="/u/$username/saved/comments"
									params={{ username: user.username }}
									search={DEFAULT_COMMENTS_PROFILE_SEARCH}
									className={`rounded-md px-3 py-2 text-sm font-medium ${
										data.tab === "saved-comments"
											? "bg-cyan-500 text-white"
											: "bg-slate-800 text-slate-300 hover:bg-slate-700"
									}`}
								>
									Saved Comments
								</Link>
								<Link
									to="/u/$username/saved/posts"
									params={{ username: user.username }}
									search={DEFAULT_POSTS_PROFILE_SEARCH}
									className={`rounded-md px-3 py-2 text-sm font-medium ${
										data.tab === "saved-posts"
											? "bg-cyan-500 text-white"
											: "bg-slate-800 text-slate-300 hover:bg-slate-700"
									}`}
								>
									Saved Posts
								</Link>
							</>
						)}
					</div>

					{data.isPrivateRestricted ? (
						<div className="rounded-lg border border-slate-700 bg-slate-950/50 p-6 text-center text-slate-300">
							{isSavedTab
								? "Saved content is private. Only the account owner or admins can view it."
								: "This profile is private. Only the account owner or admins can view posts and comments."}
						</div>
					) : isBlocking ? (
						<div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-6 text-center text-amber-100">
							You are blocking @{user.username}. Unblock this user to view their
							profile content.
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

							{data.tab === "posts" || data.tab === "saved-posts" ? (
								<div className="space-y-3">
									{data.posts.length === 0 ? (
										<p className="rounded-lg border border-dashed border-slate-700 p-6 text-center text-slate-400">
											{data.tab === "saved-posts"
												? "No saved posts found."
												: "No posts found."}
										</p>
									) : (
										data.posts.map((post) => (
											<article
												key={post.id}
												className="rounded-lg border border-slate-800 bg-slate-950/50 p-4"
											>
												<Link
													to="/post/$id"
													params={{ id: String(post.id) }}
													search={{ sort: "top" }}
													className="text-base font-semibold text-cyan-400 hover:text-cyan-300"
												>
													{post.title}
												</Link>
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
											{data.tab === "saved-comments"
												? "No saved comments found."
												: "No comments found."}
										</p>
									) : (
										data.comments.map((comment) => (
											<article
												key={comment.id}
												className="rounded-lg border border-slate-800 bg-slate-950/50 p-4"
											>
												<Link
													to="/post/$id"
													params={{
														id: String(comment.parentSubmissionId),
													}}
													search={{ sort: "top" }}
													className="text-sm font-medium text-cyan-400 hover:text-cyan-300"
												>
													{comment.submissionTitle}
												</Link>
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

function AdminControls({
	userId,
	initialIsBanned,
	initialShadowBanned,
	initialVerified,
	initialVerifiedColor,
	initialCustomTitlePlain,
	notes: initialNotes,
}: {
	userId: number;
	initialIsBanned: number;
	initialShadowBanned: string | null;
	initialVerified: string | null;
	initialVerifiedColor: string | null;
	initialCustomTitlePlain: string | null;
	notes: UserAdminDetails["notes"];
}) {
	const [isBanned, setIsBanned] = useState(initialIsBanned > 0);
	const [isShadowBanned, setIsShadowBanned] = useState(!!initialShadowBanned);
	const [showBanForm, setShowBanForm] = useState(false);
	const [banReason, setBanReason] = useState("");
	const [verified, setVerified] = useState(initialVerified ?? "");
	const [verifiedColor, setVerifiedColor] = useState(
		initialVerifiedColor ?? "",
	);
	const [customTitlePlain, setCustomTitlePlain] = useState(
		initialCustomTitlePlain ?? "",
	);
	const [notes, setNotes] = useState(initialNotes);
	const [noteText, setNoteText] = useState("");
	const [noteTag, setNoteTag] = useState<string>("Warning");
	const [isPending, setIsPending] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handleBanSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsPending(true);
		setError(null);
		try {
			const res = await banUserFn({
				data: { userId, reason: banReason },
			});
			if (res.success) {
				setIsBanned(true);
				setShowBanForm(false);
				setBanReason("");
			} else {
				setError(res.error);
			}
		} finally {
			setIsPending(false);
		}
	};

	const handleUnban = async () => {
		setIsPending(true);
		setError(null);
		try {
			const res = await unbanUserFn({ data: { userId } });
			if (res.success) setIsBanned(false);
			else setError(res.error);
		} finally {
			setIsPending(false);
		}
	};

	const handleShadowban = async () => {
		setIsPending(true);
		setError(null);
		try {
			const res = await shadowbanUserFn({ data: { userId } });
			if (res.success) setIsShadowBanned(true);
			else setError(res.error);
		} finally {
			setIsPending(false);
		}
	};

	const handleUnshadowban = async () => {
		setIsPending(true);
		setError(null);
		try {
			const res = await unshadowbanUserFn({ data: { userId } });
			if (res.success) setIsShadowBanned(false);
			else setError(res.error);
		} finally {
			setIsPending(false);
		}
	};

	const handleAddNote = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!noteText.trim()) return;
		setIsPending(true);
		setError(null);
		try {
			const res = await createUserNoteFn({
				data: { userId, note: noteText, tag: noteTag },
			});
			if (res.success) {
				setNotes((prev) => [
					...prev,
					{
						id: Date.now(),
						note: noteText,
						tag: noteTag,
						authorName: "you",
						createdDatetimez: new Date(),
						referencePost: null,
						referenceComment: null,
					},
				]);
				setNoteText("");
			} else {
				setError(res.error);
			}
		} finally {
			setIsPending(false);
		}
	};

	const handleSavePresentation = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsPending(true);
		setError(null);
		try {
			const res = await updateUserModerationProfileFn({
				data: {
					userId,
					verified,
					verifiedColor,
					customTitlePlain,
				},
			});
			if (!res.success) {
				setError(res.error);
				return;
			}

			setVerified(res.verified ?? "");
			setVerifiedColor(res.verifiedColor ?? "");
			setCustomTitlePlain(res.customTitlePlain ?? "");
		} finally {
			setIsPending(false);
		}
	};

	return (
		<section className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5 shadow-xl">
			<h2 className="mb-4 text-lg font-semibold text-amber-300">
				Admin Controls
			</h2>

			{error && (
				<div className="mb-3 rounded-lg border border-red-500/50 bg-red-500/10 p-2 text-sm text-red-400">
					{error}
				</div>
			)}

			<div className="mb-4 flex flex-wrap gap-3">
				<div className="flex items-center gap-2">
					<span className="text-sm text-slate-400">
						Status:{" "}
						{isBanned ? (
							<span className="text-red-400">Banned</span>
						) : isShadowBanned ? (
							<span className="text-amber-400">Shadowbanned</span>
						) : (
							<span className="text-emerald-400">Active</span>
						)}
					</span>
				</div>

				<div className="flex gap-2">
					{isBanned ? (
						<Button
							size="sm"
							variant="outline"
							disabled={isPending}
							onClick={handleUnban}
							className="border-emerald-600 text-emerald-400 hover:bg-emerald-900/30"
						>
							Unban
						</Button>
					) : (
						<Button
							size="sm"
							variant="outline"
							disabled={isPending}
							onClick={() => setShowBanForm((v) => !v)}
							className="border-red-600 text-red-400 hover:bg-red-900/30"
						>
							{showBanForm ? "Cancel" : "Ban"}
						</Button>
					)}

					{isShadowBanned ? (
						<Button
							size="sm"
							variant="outline"
							disabled={isPending}
							onClick={handleUnshadowban}
							className="border-emerald-600 text-emerald-400 hover:bg-emerald-900/30"
						>
							Unshadowban
						</Button>
					) : (
						<Button
							size="sm"
							variant="outline"
							disabled={isPending}
							onClick={handleShadowban}
							className="border-amber-600 text-amber-400 hover:bg-amber-900/30"
						>
							Shadowban
						</Button>
					)}
				</div>
			</div>

			{showBanForm && (
				<form onSubmit={handleBanSubmit} className="mb-4 flex gap-2">
					<input
						value={banReason}
						onChange={(e) => setBanReason(e.target.value)}
						placeholder="Ban reason (required)"
						required
						className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500"
					/>
					<Button
						type="submit"
						disabled={isPending || !banReason.trim()}
						className="shrink-0 bg-red-600 hover:bg-red-700"
					>
						Confirm Ban
					</Button>
				</form>
			)}

			<div className="mb-4 border-t border-slate-700/50 pt-4">
				<h3 className="mb-3 text-sm font-semibold text-slate-300">
					Presentation
				</h3>
				<form onSubmit={handleSavePresentation} className="space-y-3">
					<div className="grid gap-3 md:grid-cols-3">
						<input
							value={verified}
							onChange={(e) => setVerified(e.target.value)}
							placeholder="Verified label"
							maxLength={20}
							className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500"
						/>
						<input
							value={verifiedColor}
							onChange={(e) => setVerifiedColor(e.target.value)}
							placeholder="Verified color (hex)"
							maxLength={7}
							className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500"
						/>
						<input
							value={customTitlePlain}
							onChange={(e) => setCustomTitlePlain(e.target.value)}
							placeholder="Custom title"
							maxLength={100}
							className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500"
						/>
					</div>
					<Button
						type="submit"
						disabled={isPending}
						size="sm"
						className="bg-cyan-500 hover:bg-cyan-600"
					>
						Save Presentation
					</Button>
				</form>
			</div>

			<div className="border-t border-slate-700/50 pt-4">
				<h3 className="mb-3 text-sm font-semibold text-slate-300">Add Note</h3>
				<form onSubmit={handleAddNote} className="space-y-2">
					<Textarea
						value={noteText}
						onChange={(e) => setNoteText(e.target.value)}
						placeholder="Note about this user..."
						rows={2}
						className="border-slate-700 bg-slate-800 text-white placeholder:text-slate-500"
					/>
					<div className="flex gap-2">
						<select
							value={noteTag}
							onChange={(e) => setNoteTag(e.target.value)}
							className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-300"
						>
							{USER_TAG_OPTIONS.map((tag) => (
								<option key={tag} value={tag}>
									{tag}
								</option>
							))}
						</select>
						<Button
							type="submit"
							disabled={isPending || !noteText.trim()}
							size="sm"
							className="bg-cyan-500 hover:bg-cyan-600"
						>
							Add Note
						</Button>
					</div>
				</form>
			</div>

			{notes.length > 0 && (
				<div className="mt-4 border-t border-slate-700/50 pt-4">
					<h3 className="mb-3 text-sm font-semibold text-slate-300">
						Notes ({notes.length})
					</h3>
					<div className="space-y-2">
						{notes.map((note) => (
							<div
								key={note.id}
								className="rounded-lg border border-slate-800 bg-slate-950/50 p-3"
							>
								<div className="flex items-center gap-2 text-xs text-slate-400">
									<span className="rounded bg-slate-700 px-1.5 py-0.5 text-slate-300">
										{note.tag}
									</span>
									<span>{note.authorName}</span>
									<span>·</span>
									<span>
										{formatRelativeTime(
											Math.floor(note.createdDatetimez.getTime() / 1000),
										)}
									</span>
								</div>
								<p className="mt-1 text-sm text-slate-300">{note.note}</p>
							</div>
						))}
					</div>
				</div>
			)}
		</section>
	);
}
