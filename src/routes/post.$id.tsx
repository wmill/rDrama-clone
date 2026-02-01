import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import {
	ArrowBigDown,
	ArrowBigUp,
	Clock,
	ExternalLink,
	Eye,
	MessageSquare,
	Share2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/sessions.server";
import {
	getSubmissionById,
	incrementViews,
	type SubmissionDetail,
} from "@/lib/submissions.server";

const getPostFn = createServerFn({ method: "GET" })
	.inputValidator((id: number) => id)
	.handler(async ({ data: id }: { data: number }) => {
		const post = await getSubmissionById(id);
		if (post) {
			await incrementViews(id);
		}
		return post;
	});

const getCurrentUserFn = createServerFn({ method: "GET" }).handler(async () => {
	return getCurrentUser();
});

export const Route = createFileRoute("/post/$id")({
	component: PostPage,
	loader: async ({ params }) => {
		const id = Number.parseInt(params.id, 10);
		if (Number.isNaN(id)) {
			throw notFound();
		}
		const [post, user] = await Promise.all([
			getPostFn({ data: id }),
			getCurrentUserFn(),
		]);
		if (!post) {
			throw notFound();
		}
		return { post, user };
	},
	notFoundComponent: () => (
		<div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 p-4">
			<div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900/80 p-8 text-center shadow-xl">
				<h1 className="mb-4 text-2xl font-bold text-white">Post Not Found</h1>
				<p className="mb-6 text-slate-400">
					This post doesn't exist or has been removed.
				</p>
				<Button asChild>
					<Link to="/">Go Home</Link>
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
	const { post, user } = Route.useLoaderData();

	return (
		<div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 p-4">
			<div className="mx-auto max-w-4xl">
				<PostContent post={post} currentUserId={user?.id} />
			</div>
		</div>
	);
}

function PostContent({
	post,
	currentUserId,
}: { post: SubmissionDetail; currentUserId?: number }) {
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
			<div className="p-6">
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

			{/* Actions bar */}
			<div className="flex items-center gap-4 border-t border-slate-800 p-4">
				<div className="flex items-center gap-1">
					<button
						type="button"
						className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-orange-500"
					>
						<ArrowBigUp className="h-6 w-6" />
					</button>
					<span
						className={`min-w-[2rem] text-center font-medium ${
							post.score > 0
								? "text-orange-500"
								: post.score < 0
									? "text-blue-500"
									: "text-slate-400"
						}`}
					>
						{post.score}
					</span>
					<button
						type="button"
						className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-blue-500"
					>
						<ArrowBigDown className="h-6 w-6" />
					</button>
				</div>

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

			{/* Comments section placeholder */}
			<div className="border-t border-slate-800 p-6">
				<h2 className="mb-4 text-lg font-semibold text-white">Comments</h2>
				<div className="rounded-lg border border-dashed border-slate-700 p-8 text-center text-slate-500">
					Comments will be implemented in Phase 3
				</div>
			</div>
		</article>
	);
}
