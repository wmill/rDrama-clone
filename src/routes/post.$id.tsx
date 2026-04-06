import {
	createFileRoute,
	Link,
	notFound,
	useRouter,
} from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { Clock, ExternalLink, Eye, MessageSquare, Share2 } from "lucide-react";
import { useEffect, useId, useState } from "react";

import { CommentThread, VoteButtons } from "@/components/comments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { distinguishSubmissionFn } from "@/lib/admin-actions.server";
import {
	type CommentSortType,
	getCommentsBySubmissionFlat,
} from "@/lib/comments.server";
import {
	deleteSubmissionFn,
	type UpdateSubmissionInput,
	updateSubmissionFn,
} from "@/lib/post-actions.server";
import { reportSubmissionFn } from "@/lib/reporting-actions.server";
import { getCurrentUser } from "@/lib/sessions.server";
import {
	getSubmissionById,
	type SubmissionDetail,
} from "@/lib/submissions.server";
import { formatRelativeTime } from "@/lib/utils";
import type { VoteType } from "@/lib/votes.server";
import { useModalsStore } from "@/stores/modals";

const getPostFn = createServerFn({ method: "GET" })
	.inputValidator((data: { id: number }) => data)
	.handler(async ({ data }: { data: { id: number } }) => {
		const user = await getCurrentUser();
		const userId = user?.id;

		const [post, comments] = await Promise.all([
			getSubmissionById(data.id, userId),
			getCommentsBySubmissionFlat(data.id, userId),
		]);
		if (!post) return null;

		const commentsLastFetchedAt =
			comments.reduce((max, comment) => Math.max(max, comment.createdUtc), 0) ||
			Math.floor(Date.now() / 1000);

		return { post, comments, commentsLastFetchedAt, user };
	});

export const Route = createFileRoute("/post/$id")({
	component: PostPage,
	validateSearch: (search: Record<string, unknown>) => ({
		sort: (search.sort as CommentSortType) || "top",
	}),
	loader: async ({ params }) => {
		const id = Number.parseInt(params.id, 10);
		if (Number.isNaN(id)) {
			throw notFound();
		}

		const result = await getPostFn({ data: { id } });

		if (!result) {
			throw notFound();
		}

		return {
			post: result.post,
			comments: result.comments,
			commentsLastFetchedAt: result.commentsLastFetchedAt,
			user: result.user,
		};
	},
	notFoundComponent: () => (
		<div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 p-4">
			<div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900/80 p-8 text-center shadow-xl">
				<h1 className="mb-4 text-2xl font-bold text-white">Post Not Found</h1>
				<p className="mb-6 text-slate-400">
					This post doesn't exist or has been removed.
				</p>
				<Button asChild>
					<Link to="/" search={{ sort: "hot", t: "all" }}>
						Go Home
					</Link>
				</Button>
			</div>
		</div>
	),
});

function PostPage() {
	const { post, comments, commentsLastFetchedAt, user } = Route.useLoaderData();
	const { sort } = Route.useSearch();
	const [displayCommentCount, setDisplayCommentCount] = useState(
		post.commentCount,
	);

	useEffect(() => {
		setDisplayCommentCount(post.commentCount);
	}, [post.commentCount]);

	return (
		<div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 p-4">
			<div className="mx-auto max-w-7xl">
				<PostContent
					post={post}
					commentCount={displayCommentCount}
					currentUserId={user?.id}
					currentUserAdminLevel={user?.adminLevel ?? 0}
					userVote={post.userVote}
				/>

				<div className="mt-6 rounded-xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl">
					<CommentThread
						submissionId={post.id}
						comments={comments}
						commentCount={post.commentCount}
						commentsLastFetchedAt={commentsLastFetchedAt}
						currentUserId={user?.id}
						currentUserAdminLevel={user?.adminLevel ?? 0}
						initialSort={sort}
						onCommentCountChange={setDisplayCommentCount}
					/>
				</div>
			</div>
		</div>
	);
}

function PostContent({
	post,
	commentCount,
	currentUserId,
	currentUserAdminLevel = 0,
	userVote = 0,
}: {
	post: SubmissionDetail;
	commentCount: number;
	currentUserId?: number;
	currentUserAdminLevel?: number;
	userVote?: VoteType;
}) {
	const router = useRouter();
	const openReportModal = useModalsStore((s) => s.openReportModal);
	const openDeletePostModal = useModalsStore((s) => s.openDeletePostModal);
	const isAuthor = currentUserId === post.authorId;
	const [isEditing, setIsEditing] = useState(false);
	const [title, setTitle] = useState(post.title);
	const [url, setUrl] = useState(post.url ?? "");
	const [body, setBody] = useState(post.body ?? "");
	const [isNsfw, setIsNsfw] = useState(post.isNsfw);
	const [submitType, setSubmitType] = useState<"link" | "text">(
		post.url ? "link" : "text",
	);
	const [isSaving, setIsSaving] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);
	const [isReporting, setIsReporting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [reportMessage, setReportMessage] = useState<string | null>(null);
	const [distinguishLevel, setDistinguishLevel] = useState(
		post.distinguishLevel,
	);
	const [isDistinguishing, setIsDistinguishing] = useState(false);
	const titleId = useId();
	const urlId = useId();
	const bodyId = useId();
	const nsfwId = useId();

	const canDistinguish =
		currentUserAdminLevel >= 2 || (currentUserAdminLevel >= 1 && isAuthor);

	const handleSave = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);
		setIsSaving(true);

		const payload: UpdateSubmissionInput = {
			id: post.id,
			title,
			url: submitType === "link" ? url : "",
			body: submitType === "text" ? body : "",
			isNsfw,
		};

		try {
			const result = await updateSubmissionFn({ data: payload });
			if (!result.success) {
				setError(result.error);
				return;
			}

			setIsEditing(false);
			await router.invalidate();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to update post");
		} finally {
			setIsSaving(false);
		}
	};

	const handleDelete = async () => {
		try {
			await openDeletePostModal();
		} catch {
			return;
		}

		setError(null);
		setIsDeleting(true);

		try {
			const result = await deleteSubmissionFn({ data: { id: post.id } });
			if (!result.success) {
				setError(result.error);
				return;
			}

			await router.navigate({ to: "/", search: { sort: "hot", t: "all" } });
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to delete post");
		} finally {
			setIsDeleting(false);
		}
	};

	const handleReport = async () => {
		let reason: string;
		try {
			reason = await openReportModal();
		} catch {
			return;
		}

		setError(null);
		setReportMessage(null);
		setIsReporting(true);

		try {
			const result = await reportSubmissionFn({
				data: { id: post.id, reason },
			});
			if (!result.success) {
				setError(result.error);
				return;
			}

			setReportMessage(result.message);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to report post");
		} finally {
			setIsReporting(false);
		}
	};

	const handleDistinguish = async () => {
		setIsDistinguishing(true);
		try {
			const result = await distinguishSubmissionFn({ data: { id: post.id } });
			if (result.success) {
				setDistinguishLevel(result.distinguishLevel);
			}
		} finally {
			setIsDistinguishing(false);
		}
	};

	return (
		<article className="rounded-xl border border-slate-800 bg-slate-900/80 shadow-xl">
			{/* Header with metadata */}
			<div className="border-b border-slate-800 p-4">
				<div className="flex items-center gap-2 text-sm text-slate-400">
					<span>Posted by</span>
					<a
						href={`/u/${post.authorName}`}
						className="font-medium text-cyan-400 hover:underline"
					>
						{post.authorName}
					</a>
					<span className="flex items-center gap-1">
						<Clock className="h-3 w-3" />
						{formatRelativeTime(post.createdUtc)}
					</span>
					{post.editedUtc > 0 && (
						<span className="text-slate-500">
							(edited {formatRelativeTime(post.editedUtc)})
						</span>
					)}
					{post.isNsfw && (
						<span className="rounded bg-red-500/20 px-2 py-0.5 text-xs font-medium text-red-400">
							NSFW
						</span>
					)}
					{post.flair && (
						<span className="rounded bg-slate-700 px-2 py-0.5 text-xs">
							{post.flair}
						</span>
					)}
					{distinguishLevel > 0 && (
						<span className="rounded bg-green-500/20 px-2 py-0.5 text-xs font-medium text-green-400">
							MOD
						</span>
					)}
				</div>
			</div>

			{/* Main content */}
			<div className="flex">
				{/* Vote column */}
				<div className="flex w-16 flex-col items-center bg-slate-800/30 py-4">
					<VoteButtons
						type="submission"
						id={post.id}
						score={post.score}
						userVote={userVote}
						size="lg"
						disabled={!currentUserId}
					/>
				</div>

				{/* Content */}
				<div className="flex-1 p-6">
					{isEditing ? (
						<form onSubmit={handleSave} className="space-y-6">
							{error && (
								<div className="rounded-lg border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-400">
									{error}
								</div>
							)}

							<div className="space-y-2">
								<Label htmlFor={titleId} className="text-slate-300">
									Title
								</Label>
								<Input
									id={titleId}
									type="text"
									value={title}
									onChange={(e) => setTitle(e.target.value)}
									maxLength={500}
									className="border-slate-700 bg-slate-800 text-white placeholder:text-slate-500"
								/>
							</div>

							<div className="flex gap-2">
								<button
									type="button"
									onClick={() => setSubmitType("link")}
									className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
										submitType === "link"
											? "bg-cyan-500 text-white"
											: "bg-slate-800 text-slate-300 hover:bg-slate-700"
									}`}
								>
									Link
								</button>
								<button
									type="button"
									onClick={() => setSubmitType("text")}
									className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
										submitType === "text"
											? "bg-cyan-500 text-white"
											: "bg-slate-800 text-slate-300 hover:bg-slate-700"
									}`}
								>
									Text
								</button>
							</div>

							{submitType === "link" ? (
								<div className="space-y-2">
									<Label htmlFor={urlId} className="text-slate-300">
										URL
									</Label>
									<Input
										id={urlId}
										type="url"
										value={url}
										onChange={(e) => setUrl(e.target.value)}
										className="border-slate-700 bg-slate-800 text-white placeholder:text-slate-500"
									/>
								</div>
							) : (
								<div className="space-y-2">
									<Label htmlFor={bodyId} className="text-slate-300">
										Body
									</Label>
									<Textarea
										id={bodyId}
										value={body}
										onChange={(e) => setBody(e.target.value)}
										rows={8}
										maxLength={20000}
										className="border-slate-700 bg-slate-800 text-white placeholder:text-slate-500"
									/>
								</div>
							)}

							<div className="flex items-center gap-3">
								<Switch
									id={nsfwId}
									checked={isNsfw}
									onCheckedChange={setIsNsfw}
								/>
								<Label htmlFor={nsfwId} className="text-slate-300">
									Mark as NSFW (18+)
								</Label>
							</div>

							<div className="flex gap-3">
								<Button
									type="submit"
									disabled={isSaving}
									className="bg-cyan-500 hover:bg-cyan-600"
								>
									{isSaving ? "Saving..." : "Save changes"}
								</Button>
								<Button
									type="button"
									variant="outline"
									onClick={() => {
										setTitle(post.title);
										setUrl(post.url ?? "");
										setBody(post.body ?? "");
										setIsNsfw(post.isNsfw);
										setSubmitType(post.url ? "link" : "text");
										setError(null);
										setIsEditing(false);
									}}
								>
									Cancel
								</Button>
							</div>
						</form>
					) : (
						<>
							<h1
								className="mb-4 text-2xl font-bold text-white"
								// biome-ignore lint/security/noDangerouslySetInnerHtml: Stored title HTML is sanitized server-side
								dangerouslySetInnerHTML={{ __html: post.titleHtml }}
							/>

							{post.url && (
								<a
									href={post.url}
									target="_blank"
									rel="noopener noreferrer"
									className="mb-4 flex items-center gap-2 text-cyan-400 hover:text-cyan-300"
								>
									<ExternalLink className="h-4 w-4" />
									<span className="truncate">{new URL(post.url).hostname}</span>
								</a>
							)}

							{post.bodyHtml && (
								<div className="prose prose-invert max-w-none">
									<div
										className="text-slate-300"
										// biome-ignore lint/security/noDangerouslySetInnerHtml: User content is sanitized server-side
										dangerouslySetInnerHTML={{ __html: post.bodyHtml }}
									/>
								</div>
							)}

							{post.embedUrl && (
								<div className="mt-4 aspect-video">
									<iframe
										src={post.embedUrl}
										title="Embedded content"
										className="h-full w-full rounded-lg"
										allowFullScreen
									/>
								</div>
							)}
						</>
					)}
				</div>
			</div>

			{/* Actions bar */}
			<div className="flex items-center gap-4 border-t border-slate-800 p-4">
				<div className="flex items-center gap-1 text-slate-400">
					<MessageSquare className="h-5 w-5" />
					<span>{commentCount} comments</span>
				</div>

				<div className="flex items-center gap-1 text-slate-400">
					<Eye className="h-5 w-5" />
					<span>{post.views} views</span>
				</div>

				<button
					type="button"
					className="flex items-center gap-1 rounded px-2 py-1 text-slate-400 hover:bg-slate-800"
				>
					<Share2 className="h-4 w-4" />
					<span>Share</span>
				</button>

				{currentUserId && (
					<button
						type="button"
						disabled={isReporting}
						onClick={handleReport}
						className="rounded px-2 py-1 text-slate-400 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
					>
						{isReporting ? "Reporting..." : "Report"}
					</button>
				)}

				{reportMessage && (
					<span className="text-sm text-emerald-400">{reportMessage}</span>
				)}

				{canDistinguish && (
					<button
						type="button"
						disabled={isDistinguishing}
						onClick={handleDistinguish}
						className={`rounded px-2 py-1 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 ${
							distinguishLevel > 0 ? "text-green-400" : "text-slate-400"
						}`}
					>
						{distinguishLevel > 0 ? "Undistinguish" : "Distinguish"}
					</button>
				)}

				{isAuthor && (
					<div className="ml-auto flex gap-2">
						<Button
							variant="outline"
							size="sm"
							onClick={() => {
								setError(null);
								setIsEditing((value) => !value);
							}}
						>
							Edit
						</Button>
						<Button
							variant="destructive"
							size="sm"
							disabled={isDeleting}
							onClick={handleDelete}
						>
							{isDeleting ? "Deleting..." : "Delete"}
						</Button>
					</div>
				)}
			</div>
		</article>
	);
}
