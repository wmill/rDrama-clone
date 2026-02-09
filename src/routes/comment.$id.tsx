import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { ArrowLeft, Clock, ExternalLink, MessageSquare } from "lucide-react";

import { Comment } from "@/components/comments";
import { Button } from "@/components/ui/button";
import { getCommentWithReplies } from "@/lib/comments.server";
import { getCurrentUser } from "@/lib/sessions.server";
import { getSubmissionById } from "@/lib/submissions.server";
import { formatRelativeTime } from "@/lib/utils";

const getCommentFn = createServerFn({ method: "GET" })
	.inputValidator((data: { id: number }) => data)
	.handler(async ({ data }: { data: { id: number } }) => {
		const user = await getCurrentUser();
		const userId = user?.id;

		const comment = await getCommentWithReplies(data.id, userId);
		if (!comment || comment.parentSubmissionId === null) return null;

		const submission = await getSubmissionById(comment.parentSubmissionId);
		if (!submission) return null;

		return { comment, submission, user };
	});


export const Route = createFileRoute("/comment/$id")({
	component: CommentPage,
	loader: async ({ params }) => {
		const id = Number.parseInt(params.id, 10);
		if (Number.isNaN(id)) {
			throw notFound();
		}

		const result = await getCommentFn({ data: { id } });

		if (!result) {
			throw notFound();
		}

		return {
			comment: result.comment,
			submission: result.submission,
			user: result.user,
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
					<Link to="/" search={{ sort: "hot", t: "all" }}>
						Go Home
					</Link>
				</Button>
			</div>
		</div>
	),
});

function CommentPage() {
	const { comment, submission, user } = Route.useLoaderData();

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
						depth={0}
						maxDepth={10}
					/>
				</div>
			</div>
		</div>
	);
}
