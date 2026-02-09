import {
	createFileRoute,
	Link,
	notFound,
	useRouter,
	useRouterState,
} from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { Clock, ExternalLink, Eye, MessageSquare, Share2 } from "lucide-react";

import { CommentThread, VoteButtons } from "@/components/comments";
import { Button } from "@/components/ui/button";
import {
	type CommentSortType,
	getCommentsBySubmission,
} from "@/lib/comments.server";
import { getCurrentUser } from "@/lib/sessions.server";
import {
	getSubmissionById,
	type SubmissionDetail,
} from "@/lib/submissions.server";
import { formatRelativeTime } from "@/lib/utils";
import type { VoteType } from "@/lib/votes.server";

const getPostFn = createServerFn({ method: "GET" })
	.inputValidator((data: { id: number; commentSort?: CommentSortType }) => data)
	.handler(
		async ({
			data,
		}: {
			data: { id: number; commentSort?: CommentSortType };
		}) => {
			const user = await getCurrentUser();
			const userId = user?.id;

			const post = await getSubmissionById(data.id, userId);
			if (!post) return null;

			const comments = await getCommentsBySubmission(
				data.id,
				data.commentSort ?? "top",
				userId,
			);

			return { post, comments, user };
		},
	);

export const Route = createFileRoute("/post/$id")({
	component: PostPage,
	validateSearch: (search: Record<string, unknown>) => ({
		sort: (search.sort as CommentSortType) || "top",
	}),
	loaderDeps: ({ search }) => ({ commentSort: search.sort }),
	loader: async ({ params, deps }) => {
		const id = Number.parseInt(params.id, 10);
		if (Number.isNaN(id)) {
			throw notFound();
		}

		const result = await getPostFn({
			data: { id, commentSort: deps.commentSort },
		});

		if (!result) {
			throw notFound();
		}

		return {
			post: result.post,
			comments: result.comments,
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
	const router = useRouter();
	const { post, comments, user } = Route.useLoaderData();
	const { sort } = Route.useSearch();

	// Track if there's a pending navigation (loading new comments)
	const isLoading = useRouterState({
		select: (s) => s.isLoading,
	});

	const handleSortChange = async (newSort: CommentSortType) => {
		await router.navigate({
			to: "/post/$id",
			params: { id: String(post.id) },
			search: { sort: newSort },
		});
	};

	return (
		<div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 p-4">
			<div className="mx-auto max-w-4xl">
				<PostContent
					post={post}
					currentUserId={user?.id}
					userVote={post.userVote}
				/>

				<div className="mt-6 rounded-xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl">
					<CommentThread
						submissionId={post.id}
						comments={comments}
						commentCount={post.commentCount}
						currentUserId={user?.id}
						sort={sort}
						onSortChange={handleSortChange}
						isLoading={isLoading}
					/>
				</div>
			</div>
		</div>
	);
}

function PostContent({
	post,
	currentUserId,
	userVote = 0,
}: {
	post: SubmissionDetail;
	currentUserId?: number;
	userVote?: VoteType;
}) {
	const isAuthor = currentUserId === post.authorId;

	return (
		<article className="rounded-xl border border-slate-800 bg-slate-900/80 shadow-xl">
			{/* Header with metadata */}
			<div className="border-b border-slate-800 p-4">
				<div className="flex items-center gap-2 text-sm text-slate-400">
					<span>Posted by</span>
					<span className="font-medium text-cyan-400">{post.authorName}</span>
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
					<h1 className="mb-4 text-2xl font-bold text-white">{post.title}</h1>

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
				</div>
			</div>

			{/* Actions bar */}
			<div className="flex items-center gap-4 border-t border-slate-800 p-4">
				<div className="flex items-center gap-1 text-slate-400">
					<MessageSquare className="h-5 w-5" />
					<span>{post.commentCount} comments</span>
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

				{isAuthor && (
					<div className="ml-auto flex gap-2">
						<Button variant="outline" size="sm">
							Edit
						</Button>
						<Button variant="destructive" size="sm">
							Delete
						</Button>
					</div>
				)}
			</div>
		</article>
	);
}
