import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { Clock, MessageSquare } from "lucide-react";

import { VoteButtons } from "@/components/comments";
import {
	type CommentFeedItem,
	type CommentFeedSortType,
	getCommentsFeed,
	type TimeFilter,
} from "@/lib/comments.server";
import { getCurrentUser } from "@/lib/sessions.server";

const getCommentsFeedFn = createServerFn({ method: "GET" })
	.inputValidator(
		(data: { sort?: CommentFeedSortType; t?: TimeFilter; page?: number }) =>
			data,
	)
	.handler(
		async ({
			data,
		}: {
			data: { sort?: CommentFeedSortType; t?: TimeFilter; page?: number };
		}) => {
			const user = await getCurrentUser();
			const limit = 25;
			const offset = ((data.page ?? 1) - 1) * limit;
			const comments = await getCommentsFeed(
				data.sort ?? "new",
				data.t ?? "all",
				limit,
				offset,
				user?.id,
			);
			return { comments, user };
		},
	);

const sortOptions: { value: CommentFeedSortType; label: string }[] = [
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

export const Route = createFileRoute("/comments")({
	component: CommentsPage,
	validateSearch: (search: Record<string, unknown>) => ({
		sort: (search.sort as CommentFeedSortType) || "new",
		t: (search.t as TimeFilter) || "all",
		page: Number(search.page) || 1,
	}),
	loaderDeps: ({ search }) => ({
		sort: search.sort,
		t: search.t,
		page: search.page,
	}),
	loader: async ({ deps }) => {
		const result = await getCommentsFeedFn({
			data: { sort: deps.sort, t: deps.t, page: deps.page },
		});

		return {
			comments: result.comments,
			user: result.user,
		};
	},
});

function CommentsPage() {
	const router = useRouter();
	const { comments, user } = Route.useLoaderData();
	const { sort, t, page } = Route.useSearch();

	const handleSortChange = async (newSort: CommentFeedSortType) => {
		await router.navigate({
			to: "/comments",
			search: { sort: newSort, t, page: 1 },
		});
	};

	const handleTimeChange = async (newTime: TimeFilter) => {
		await router.navigate({
			to: "/comments",
			search: { sort, t: newTime, page: 1 },
		});
	};

	const handleNextPage = async () => {
		await router.navigate({
			to: "/comments",
			search: { sort, t, page: page + 1 },
		});
	};

	const handlePrevPage = async () => {
		if (page > 1) {
			await router.navigate({
				to: "/comments",
				search: { sort, t, page: page - 1 },
			});
		}
	};

	return (
		<div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 p-4">
			<div className="mx-auto max-w-4xl">
				<div className="mb-6 rounded-xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl">
					<div className="flex items-center justify-between">
						<h1 className="text-2xl font-bold text-white">All Comments</h1>

						<Link
							to="/"
							search={{ sort: "hot", t: "all" }}
							className="text-sm text-slate-400 hover:text-cyan-400"
						>
							View Posts
						</Link>
					</div>

					{/* Filters */}
					<div className="mt-4 flex flex-wrap gap-4">
						{/* Sort options */}
						<div className="flex items-center gap-2">
							<span className="text-sm text-slate-400">Sort:</span>
							<div className="flex gap-1 rounded-lg bg-slate-800 p-1">
								{sortOptions.map((option) => (
									<button
										key={option.value}
										type="button"
										onClick={() => handleSortChange(option.value)}
										className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
											sort === option.value
												? "bg-cyan-500 text-white"
												: "text-slate-400 hover:text-white"
										}`}
									>
										{option.label}
									</button>
								))}
							</div>
						</div>

						{/* Time filter */}
						{sort !== "new" && (
							<div className="flex items-center gap-2">
								<span className="text-sm text-slate-400">Time:</span>
								<div className="flex gap-1 rounded-lg bg-slate-800 p-1">
									{timeOptions.map((option) => (
										<button
											key={option.value}
											type="button"
											onClick={() => handleTimeChange(option.value)}
											className={`rounded-md px-2 py-1 text-sm font-medium transition-colors ${
												t === option.value
													? "bg-cyan-500 text-white"
													: "text-slate-400 hover:text-white"
											}`}
										>
											{option.label}
										</button>
									))}
								</div>
							</div>
						)}
					</div>
				</div>

				{/* Comments list */}
				<div className="space-y-4">
					{comments.length > 0 ? (
						comments.map((comment) => (
							<CommentCard
								key={comment.id}
								comment={comment}
								currentUserId={user?.id}
							/>
						))
					) : (
						<div className="rounded-xl border border-dashed border-slate-700 p-8 text-center">
							<p className="text-slate-500">No comments found.</p>
						</div>
					)}
				</div>

				{/* Pagination */}
				{comments.length > 0 && (
					<div className="mt-6 flex items-center justify-center gap-4">
						<button
							type="button"
							onClick={handlePrevPage}
							disabled={page <= 1}
							className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
						>
							Previous
						</button>
						<span className="text-sm text-slate-400">Page {page}</span>
						<button
							type="button"
							onClick={handleNextPage}
							disabled={comments.length < 25}
							className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
						>
							Next
						</button>
					</div>
				)}
			</div>
		</div>
	);
}

function CommentCard({
	comment,
	currentUserId,
}: {
	comment: CommentFeedItem;
	currentUserId?: number;
}) {
	return (
		<div className="rounded-xl border border-slate-800 bg-slate-900/80 shadow-xl">
			{/* Post context */}
			<div className="border-b border-slate-800 px-4 py-2">
				<Link
					to={`/post/${comment.parentSubmissionId}` as "/"}
					className="text-sm font-medium text-cyan-400 hover:text-cyan-300"
				>
					{comment.submissionTitle}
				</Link>
			</div>

			{/* Comment content */}
			<div className="flex gap-3 p-4">
				<div className="flex-shrink-0">
					<VoteButtons
						type="comment"
						id={comment.id}
						score={comment.score}
						userVote={comment.userVote}
						size="sm"
						disabled={!currentUserId}
					/>
				</div>

				<div className="min-w-0 flex-1">
					{/* Header */}
					<div className="flex items-center gap-2 text-xs text-slate-400">
						<span className="font-medium text-cyan-400">
							{comment.isDeleted ? "[deleted]" : comment.authorName}
						</span>
						{comment.distinguishLevel > 0 && (
							<span className="rounded bg-green-500/20 px-1.5 py-0.5 text-[10px] font-medium text-green-400">
								MOD
							</span>
						)}
						<span className="flex items-center gap-1">
							<Clock className="h-3 w-3" />
							{formatRelativeTime(comment.createdUtc)}
						</span>
						{comment.level > 1 && (
							<span className="text-slate-500">
								(reply, level {comment.level})
							</span>
						)}
					</div>

					{/* Body */}
					<div
						className="prose prose-invert prose-sm mt-1 max-w-none text-slate-300"
						// biome-ignore lint/security/noDangerouslySetInnerHtml: Content sanitized server-side
						dangerouslySetInnerHTML={{ __html: comment.bodyHtml }}
					/>

					{/* Actions */}
					<div className="mt-2 flex items-center gap-3 text-xs">
						<Link
							to={`/comment/${comment.id}` as "/"}
							className="flex items-center gap-1 text-slate-500 hover:text-cyan-400"
						>
							<MessageSquare className="h-3 w-3" />
							Permalink
						</Link>
						<Link
							to={`/post/${comment.parentSubmissionId}` as "/"}
							className="text-slate-500 hover:text-cyan-400"
						>
							View Full Thread
						</Link>
					</div>
				</div>
			</div>
		</div>
	);
}
