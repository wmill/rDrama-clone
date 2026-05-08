import { Link, useRouter } from "@tanstack/react-router";
import { CalendarDays } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
	DEFAULT_RELATIONSHIP_PROFILE_SEARCH,
	type ProfileRelationshipSearch,
} from "@/lib/profile-route";
import type { SocialListItem, SocialListPage } from "@/lib/social.server";
import { setBlockStateFn, setFollowStateFn } from "@/lib/social-actions.server";
import { formatRelativeTime } from "@/lib/utils";

function RelationshipRow({
	item,
	disabled,
}: {
	item: SocialListItem;
	disabled: boolean;
}) {
	const router = useRouter();
	const [isFollowing, setIsFollowing] = useState(item.isFollowing);
	const [isBlocking, setIsBlocking] = useState(item.isBlocking);
	const [isFollowPending, setIsFollowPending] = useState(false);
	const [isBlockPending, setIsBlockPending] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		setIsFollowing(item.isFollowing);
		setIsBlocking(item.isBlocking);
	}, [item.isFollowing, item.isBlocking]);

	const handleToggleFollow = async () => {
		setIsFollowPending(true);
		setError(null);

		try {
			const nextFollowing = !isFollowing;
			const result = await setFollowStateFn({
				data: {
					targetUserId: item.id,
					following: nextFollowing,
				},
			});
			if (!result.success) {
				setError(result.error);
				return;
			}

			setIsFollowing(nextFollowing);
			await router.invalidate();
		} catch (error) {
			setError(
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
		setError(null);

		try {
			const nextBlocking = !isBlocking;
			const result = await setBlockStateFn({
				data: {
					targetUserId: item.id,
					blocked: nextBlocking,
				},
			});
			if (!result.success) {
				setError(result.error);
				return;
			}

			setIsBlocking(nextBlocking);
			await router.invalidate();
		} catch (error) {
			setError(
				error instanceof Error ? error.message : "Failed to update block state",
			);
		} finally {
			setIsBlockPending(false);
		}
	};

	return (
		<article className="rounded-lg border border-slate-800 bg-slate-950/50 p-4">
			<div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
				<div className="min-w-0">
					<div className="flex items-center gap-3">
						{item.profileUrl ? (
							<img
								src={item.profileUrl}
								alt={item.username}
								className="h-12 w-12 rounded-full object-cover"
							/>
						) : (
							<div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-800 text-lg font-semibold text-cyan-300">
								{item.username.charAt(0).toUpperCase()}
							</div>
						)}
						<div className="min-w-0">
							<Link
								to="/u/$username"
								params={{ username: item.username }}
								search={{ sort: "new", t: "all", page: 1 }}
								className="text-base font-semibold text-cyan-400 hover:text-cyan-300"
							>
								@{item.username}
							</Link>
							<div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
								<CalendarDays className="h-3 w-3" />
								<span>
									Joined {new Date(item.createdUtc * 1000).toLocaleDateString()}
								</span>
								<span>•</span>
								<span>{formatRelativeTime(item.createdUtc)}</span>
							</div>
						</div>
					</div>
					{item.customTitle && (
						<div
							className="mt-3 text-sm text-slate-300"
							// biome-ignore lint/security/noDangerouslySetInnerHtml: Stored HTML is sanitized in legacy-compatible schema flow
							dangerouslySetInnerHTML={{ __html: item.customTitle }}
						/>
					)}
					{item.bioHtml ? (
						<div
							className="mt-3 line-clamp-3 text-sm text-slate-300"
							// biome-ignore lint/security/noDangerouslySetInnerHtml: Stored HTML is sanitized in legacy-compatible schema flow
							dangerouslySetInnerHTML={{ __html: item.bioHtml }}
						/>
					) : item.bio ? (
						<p className="mt-3 line-clamp-3 text-sm text-slate-300">
							{item.bio}
						</p>
					) : null}
					{error && (
						<div className="mt-3 rounded-md border border-red-500/40 bg-red-500/10 p-2 text-sm text-red-200">
							{error}
						</div>
					)}
				</div>

				{!disabled && (
					<div className="flex shrink-0 gap-2">
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
		</article>
	);
}

export function UserRelationshipPage({
	data,
	search,
	onPageChange,
}: {
	data: SocialListPage;
	search: ProfileRelationshipSearch;
	onPageChange: (page: number) => Promise<void>;
}) {
	const title = data.kind === "followers" ? "Followers" : "Following";
	const emptyLabel =
		data.kind === "followers"
			? "No followers found."
			: "No followed users found.";

	return (
		<div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 p-4">
			<div className="mx-auto max-w-5xl space-y-6">
				<section className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl">
					<div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
						<div>
							<p className="text-xs uppercase tracking-[0.2em] text-cyan-300/80">
								Profile relationships
							</p>
							<h1 className="mt-2 text-3xl font-bold text-white">
								@{data.profileUser.username} {title}
							</h1>
						</div>
						<div className="flex gap-2 text-sm text-slate-300">
							<Link
								to="/u/$username"
								params={{ username: data.profileUser.username }}
								search={{ sort: "new", t: "all", page: 1 }}
								className="rounded-md bg-slate-800 px-3 py-2 hover:bg-slate-700"
							>
								Back to profile
							</Link>
							<Link
								to={
									data.kind === "followers"
										? "/u/$username/following"
										: "/u/$username/followers"
								}
								params={{ username: data.profileUser.username }}
								search={DEFAULT_RELATIONSHIP_PROFILE_SEARCH}
								className="rounded-md bg-slate-800 px-3 py-2 hover:bg-slate-700"
							>
								View {data.kind === "followers" ? "following" : "followers"}
							</Link>
						</div>
					</div>
				</section>

				<section className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 shadow-xl">
					{data.isPrivateRestricted ? (
						<div className="rounded-lg border border-slate-700 bg-slate-950/50 p-6 text-center text-slate-300">
							This profile is private. Only the account owner or admins can view{" "}
							{title.toLowerCase()}.
						</div>
					) : data.isBlockingProfile ? (
						<div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-6 text-center text-amber-100">
							You are blocking @{data.profileUser.username}. Unblock this user
							to view their {title.toLowerCase()}.
						</div>
					) : data.items.length === 0 ? (
						<p className="rounded-lg border border-dashed border-slate-700 p-6 text-center text-slate-400">
							{emptyLabel}
						</p>
					) : (
						<div className="space-y-3">
							{data.items.map((item) => (
								<RelationshipRow
									key={item.id}
									item={item}
									disabled={!data.viewer || item.id === data.viewer.id}
								/>
							))}
						</div>
					)}

					<div className="mt-6 flex items-center justify-center gap-4">
						<button
							type="button"
							onClick={() => onPageChange(search.page - 1)}
							disabled={search.page <= 1}
							className="rounded-lg bg-slate-800 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
						>
							Previous
						</button>
						<span className="text-sm text-slate-400">Page {search.page}</span>
						<button
							type="button"
							onClick={() => onPageChange(search.page + 1)}
							disabled={!data.hasNextPage}
							className="rounded-lg bg-slate-800 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
						>
							Next
						</button>
					</div>
				</section>
			</div>
		</div>
	);
}
