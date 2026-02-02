import { createFileRoute, Link, notFound, useRouter, useRouterState } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { Clock, ExternalLink, Eye, Loader2, MessageSquare, Share2 } from "lucide-react";

import { CommentThread, VoteButtons } from "@/components/comments";
import { Button } from "@/components/ui/button";
import {
	getCommentsBySubmission,
	type CommentSortType,
	type CommentWithReplies,
} from "@/lib/comments.server";
import { getCurrentUser } from "@/lib/sessions.server";
import {
	getSubmissionById,
	incrementViews,
	type SubmissionDetail,
} from "@/lib/submissions.server";
import {
	getCommentVotes,
	getSubmissionVote,
	type VoteType,
} from "@/lib/votes.server";

const getPostFn = createServerFn({ method: "GET" })
	.inputValidator((data: { id: number; commentSort?: CommentSortType }) => data)
	.handler(
		async ({
			data,
		}: { data: { id: number; commentSort?: CommentSortType } }) => {
			const post = await getSubmissionById(data.id);
			if (!post) return null;

			await incrementViews(data.id);

			const comments = await getCommentsBySubmission(
				data.id,
				data.commentSort ?? "top",
			);

			return { post, comments };
		},
	);

const getCurrentUserFn = createServerFn({ method: "GET" }).handler(async () => {
	return getCurrentUser();
});

const getUserVotesFn = createServerFn({ method: "GET" })
	.inputValidator(
		(data: { submissionId: number; commentIds: number[] }) => data,
	)
	.handler(
		async ({
			data,
		}: { data: { submissionId: number; commentIds: number[] } }) => {
			const user = await getCurrentUser();
			if (!user) {
				return { submissionVote: 0 as VoteType, commentVotes: new Map() };
			}

			const [submissionVote, commentVotes] = await Promise.all([
				getSubmissionVote(user.id, data.submissionId),
				getCommentVotes(user.id, data.commentIds),
			]);

			// Convert Map to array for serialization
			const commentVotesArray = Array.from(commentVotes.entries());

			return { submissionVote, commentVotesArray };
		},
	);

function getAllCommentIds(comments: CommentWithReplies[]): number[] {
	const ids: number[] = [];
	const traverse = (list: CommentWithReplies[]) => {
		for (const comment of list) {
			ids.push(comment.id);
			if (comment.replies.length > 0) {
				traverse(comment.replies);
			}
		}
	};
	traverse(comments);
	return ids;
}

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

		const [result, user] = await Promise.all([
			getPostFn({ data: { id, commentSort: deps.commentSort } }),
			getCurrentUserFn(),
		]);

		if (!result) {
			throw notFound();
		}

		// Get user votes if logged in
		let submissionVote: VoteType = 0;
		let commentVotesMap = new Map<number, VoteType>();

		if (user) {
			const commentIds = getAllCommentIds(result.comments);
			const votes = await getUserVotesFn({
				data: { submissionId: id, commentIds },
			});
			submissionVote = votes.submissionVote;
			commentVotesMap = new Map(votes.commentVotesArray);
		}

		return {
			post: result.post,
			comments: result.comments,
			user,
			submissionVote,
			commentVotesArray: Array.from(commentVotesMap.entries()),
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
					<Link to="/" search={{ sort: "hot", t: "all" }}>Go Home</Link>
				</Button>
			</div>
		</div>
	),
});

function formatRelativeTime(unixTimestamp: number): string {
	const now = Date.now() / 1000;
	const diff = now - unixTimestamp;

	if (diff < 60) return "just now";
	if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
	if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
	if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
	if (diff < 2592000) return `${Math.floor(diff / 604800)}w ago`;
	if (diff < 31536000) return `${Math.floor(diff / 2592000)}mo ago`;
	return `${Math.floor(diff / 31536000)}y ago`;
}

function PostPage() {
	const router = useRouter();
	const { post, comments, user, submissionVote, commentVotesArray } =
		Route.useLoaderData();
	const { sort } = Route.useSearch();

	// Track if there's a pending navigation (loading new comments)
	const isLoading = useRouterState({
		select: (s) => s.isLoading,
	});

	const commentVotes = new Map<number, VoteType>(commentVotesArray);

	const handleSortChange = async (newSort: CommentSortType) => {
		await router.navigate({
			to: `/post/${post.id}` as "/",
			search: { sort: newSort },
		});
	};

	return (
		<div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 p-4">
			
			<div className="mx-auto max-w-4xl">
				<PostContent
					post={post}
					currentUserId={user?.id}
					userVote={submissionVote}
				/>

				<div className="mt-6 rounded-xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl">
					<CommentThread
						submissionId={post.id}
						comments={comments}
						commentCount={post.commentCount}
						currentUserId={user?.id}
						userVotes={commentVotes}
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
