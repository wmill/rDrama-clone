import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { ArrowLeft, Clock, ExternalLink, MessageSquare } from "lucide-react";

import { Comment } from "@/components/comments";
import { Button } from "@/components/ui/button";
import {
	getCommentWithReplies,
	type CommentWithReplies,
} from "@/lib/comments.server";
import { getCurrentUser } from "@/lib/sessions.server";
import { getSubmissionById } from "@/lib/submissions.server";
import { getCommentVotes, type VoteType } from "@/lib/votes.server";

const getCommentFn = createServerFn({ method: "GET" })
	.inputValidator((data: { id: number }) => data)
	.handler(async ({ data }: { data: { id: number } }) => {
		const comment = await getCommentWithReplies(data.id);
		if (!comment || comment.parentSubmissionId === null) return null;

		const submission = await getSubmissionById(comment.parentSubmissionId);
		if (!submission) return null;

		return { comment, submission };
	});

const getCurrentUserFn = createServerFn({ method: "GET" }).handler(async () => {
	return getCurrentUser();
});

const getUserVotesFn = createServerFn({ method: "GET" })
	.inputValidator((data: { commentIds: number[] }) => data)
	.handler(async ({ data }: { data: { commentIds: number[] } }) => {
		const user = await getCurrentUser();
		if (!user) {
			return { commentVotesArray: [] as [number, VoteType][] };
		}

		const commentVotes = await getCommentVotes(user.id, data.commentIds);
		const commentVotesArray = Array.from(commentVotes.entries());

		return { commentVotesArray };
	});

function getAllCommentIds(comment: CommentWithReplies): number[] {
	const ids: number[] = [comment.id];
	const traverse = (list: CommentWithReplies[]) => {
		for (const c of list) {
			ids.push(c.id);
			if (c.replies.length > 0) {
				traverse(c.replies);
			}
		}
	};
	traverse(comment.replies);
	return ids;
}

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

export const Route = createFileRoute("/comment/$id")({
	component: CommentPage,
	loader: async ({ params }) => {
		const id = Number.parseInt(params.id, 10);
		if (Number.isNaN(id)) {
			throw notFound();
		}

		const [result, user] = await Promise.all([
			getCommentFn({ data: { id } }),
			getCurrentUserFn(),
		]);

		if (!result) {
			throw notFound();
		}

		// Get user votes if logged in
		let commentVotesMap = new Map<number, VoteType>();

		if (user) {
			const commentIds = getAllCommentIds(result.comment);
			const votes = await getUserVotesFn({ data: { commentIds } });
			commentVotesMap = new Map(votes.commentVotesArray);
		}

		return {
			comment: result.comment,
			submission: result.submission,
			user,
			commentVotesArray: Array.from(commentVotesMap.entries()),
		};
	},
	notFoundComponent: () => (
		<div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 p-4">
			<div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900/80 p-8 text-center shadow-xl">
				<h1 className="mb-4 text-2xl font-bold text-white">
					Comment Not Found
				</h1>
				<p className="mb-6 text-slate-400">
					This comment doesn't exist or has been removed.
				</p>
				<Button asChild>
					<Link to="/" search={{ sort: "hot", t: "all" }}>Go Home</Link>
				</Button>
			</div>
		</div>
	),
});

function CommentPage() {
	const { comment, submission, user, commentVotesArray } =
		Route.useLoaderData();

	const commentVotes = new Map<number, VoteType>(commentVotesArray);

	return (
		<div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 p-4">
			<div className="mx-auto max-w-4xl">
				{/* Back navigation */}
				<div className="mb-4">
					<Link
						to={`/post/${submission.id}` as "/"}
						className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-cyan-400"
					>
						<ArrowLeft className="h-4 w-4" />
						Back to post
					</Link>
				</div>

				{/* Post context card */}
				<div className="mb-6 rounded-xl border border-slate-800 bg-slate-900/80 p-4 shadow-xl">
					<div className="flex items-center gap-2 text-sm text-slate-400">
						<span>Posted by</span>
						<span className="font-medium text-cyan-400">
							{submission.authorName}
						</span>
						<span className="flex items-center gap-1">
							<Clock className="h-3 w-3" />
							{formatRelativeTime(submission.createdUtc)}
						</span>
					</div>

					<Link
						to={`/post/${submission.id}` as "/"}
						className="mt-2 block text-xl font-bold text-white hover:text-cyan-400"
					>
						{submission.title}
					</Link>

					{submission.url && (
						<a
							href={submission.url}
							target="_blank"
							rel="noopener noreferrer"
							className="mt-2 flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300"
						>
							<ExternalLink className="h-3 w-3" />
							<span className="truncate">
								{new URL(submission.url).hostname}
							</span>
						</a>
					)}

					<div className="mt-3 flex items-center gap-4 text-sm text-slate-500">
						<span>{submission.score} points</span>
						<span className="flex items-center gap-1">
							<MessageSquare className="h-4 w-4" />
							{submission.commentCount} comments
						</span>
					</div>
				</div>

				{/* Comment with context */}
				<div className="rounded-xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl">
					<h2 className="mb-4 text-lg font-semibold text-white">
						Single Comment Thread
					</h2>

					<Comment
						comment={comment}
						submissionId={submission.id}
						currentUserId={user?.id}
						userVotes={commentVotes}
						depth={0}
						maxDepth={10}
					/>
				</div>
			</div>
		</div>
	);
}
