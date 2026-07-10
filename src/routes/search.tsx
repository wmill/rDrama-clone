import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { Clock, MessageSquare, Search } from "lucide-react";
import { VoteButtons } from "@/components/comments";
import { RecentSubmissions } from "@/components/recent-submissions";
import type { CommentFeedItem } from "@/lib/comments.server";
import {
	type PublicSearchResults,
	parsePublicSearchParams,
	type SearchResultType,
} from "@/lib/search";
import { getCurrentUser } from "@/lib/sessions.server";
import type { SubmissionSummary } from "@/lib/submissions.server";
import { formatRelativeTime } from "@/lib/utils";
import { searchInputSchema } from "@/lib/validation";

const loadSearchResults = createServerFn({ method: "GET" })
	.inputValidator((data: { q: string; type: SearchResultType; page: number }) =>
		searchInputSchema.parse(data),
	)
	.handler(async ({ data }) => {
		const { searchPublicContent } = await import("@/lib/search.server");
		const user = await getCurrentUser();
		const result = await searchPublicContent({
			query: data.q,
			type: data.type,
			page: data.page,
			userId: user?.id,
		});

		return {
			query: data.q.trim(),
			type: data.type,
			page: data.page,
			result,
			currentUserId: user?.id,
		};
	});

export const Route = createFileRoute("/search")({
	component: SearchPage,
	validateSearch: (search: Record<string, unknown>) =>
		parsePublicSearchParams(search),
	loaderDeps: ({ search }) => search,
	loader: async ({ deps }) =>
		loadSearchResults({
			data: {
				q: deps.q,
				type: deps.type,
				page: deps.page,
			},
		}),
});

export function SearchPageContent({
	query,
	type,
	page,
	result,
	currentUserId,
	onTypeChange,
	onPreviousPage,
	onNextPage,
}: {
	query: string;
	type: SearchResultType;
	page: number;
	result:
		| PublicSearchResults<SubmissionSummary>
		| PublicSearchResults<CommentFeedItem>;
	currentUserId?: number;
	onTypeChange: (type: SearchResultType) => void;
	onPreviousPage: () => void;
	onNextPage: () => void;
}) {
	const trimmedQuery = query.trim();
	const isBlank = trimmedQuery.length === 0;
	const isComments = type === "comments";

	return (
		<div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 p-4">
			<div className="mx-auto max-w-5xl space-y-6">
				<div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl">
					<div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
						<div>
							<p className="text-xs uppercase tracking-[0.2em] text-cyan-300/80">
								Public search
							</p>
							<h1 className="mt-2 text-3xl font-extrabold text-white">
								Search
							</h1>
							{!isBlank && (
								<p className="mt-2 text-sm text-slate-400">
									Results for{" "}
									<span className="text-slate-200">"{trimmedQuery}"</span>
								</p>
							)}
						</div>

						<div className="flex gap-2 rounded-lg bg-slate-800 p-1">
							<button
								type="button"
								onClick={() => onTypeChange("posts")}
								className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
									!isComments
										? "bg-cyan-500 text-white"
										: "text-slate-400 hover:text-white"
								}`}
							>
								Posts
							</button>
							<button
								type="button"
								onClick={() => onTypeChange("comments")}
								className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
									isComments
										? "bg-cyan-500 text-white"
										: "text-slate-400 hover:text-white"
								}`}
							>
								Comments
							</button>
						</div>
					</div>
				</div>

				{isBlank ? (
					<div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/50 p-10 text-center">
						<Search className="mx-auto h-10 w-10 text-slate-500" />
						<h2 className="mt-4 text-xl font-semibold text-white">
							Start with a search query
						</h2>
						<p className="mt-2 text-sm text-slate-400">
							Search post titles, post bodies, comment bodies, URLs, and author
							usernames.
						</p>
					</div>
				) : !result.isAvailable ? (
					<div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6 text-amber-100">
						Search is currently unavailable. Check `ELASTICSEARCH_URL` and the
						local Elasticsearch container.
					</div>
				) : isComments ? (
					<CommentSearchResults
						query={trimmedQuery}
						comments={result.results as CommentFeedItem[]}
						currentUserId={currentUserId}
					/>
				) : (
					<RecentSubmissions
						submissions={result.results as SubmissionSummary[]}
						currentUserId={currentUserId}
						title="Matching posts"
						eyebrow="Public search"
						emptyMessage={`No posts matched "${trimmedQuery}".`}
						showSubmitLink={false}
						showSortControls={false}
					/>
				)}

				{!isBlank && result.isAvailable && (
					<div className="flex items-center justify-center gap-4">
						<button
							type="button"
							onClick={onPreviousPage}
							disabled={page <= 1}
							className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
						>
							Previous
						</button>
						<span className="text-sm text-slate-400">Page {page}</span>
						<button
							type="button"
							onClick={onNextPage}
							disabled={!result.hasNextPage}
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

function SearchPage() {
	const router = useRouter();
	const { query, type, page, result, currentUserId } = Route.useLoaderData();

	return (
		<SearchPageContent
			query={query}
			type={type}
			page={page}
			result={result}
			currentUserId={currentUserId}
			onTypeChange={(nextType) =>
				void router.navigate({
					to: "/search",
					search: { q: query, type: nextType, page: 1 },
				})
			}
			onPreviousPage={() => {
				if (page <= 1) {
					return;
				}

				void router.navigate({
					to: "/search",
					search: { q: query, type, page: page - 1 },
				});
			}}
			onNextPage={() =>
				void router.navigate({
					to: "/search",
					search: { q: query, type, page: page + 1 },
				})
			}
		/>
	);
}

function CommentSearchResults({
	query,
	comments,
	currentUserId,
}: {
	query: string;
	comments: CommentFeedItem[];
	currentUserId?: number;
}) {
	if (comments.length === 0) {
		return (
			<div className="rounded-xl border border-dashed border-slate-700 p-8 text-center text-slate-400">
				No comments matched "{query}".
			</div>
		);
	}

	return (
		<div className="space-y-4">
			{comments.map((comment) => (
				<div
					key={comment.id}
					className="rounded-xl border border-slate-800 bg-slate-900/80 shadow-xl"
				>
					<div className="border-b border-slate-800 px-4 py-2">
						<Link
							to={`/post/${comment.parentSubmissionId}` as "/"}
							className="text-sm font-medium text-cyan-400 hover:text-cyan-300"
						>
							{comment.submissionTitle}
						</Link>
					</div>

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
							<div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
								<Link
									to="/u/$username"
									params={{ username: comment.authorName }}
									search={{ sort: "new", t: "all", page: 1 }}
									className="font-medium text-cyan-400 hover:underline"
								>
									{comment.authorName}
								</Link>
								<span className="flex items-center gap-1">
									<Clock className="h-3 w-3" />
									{formatRelativeTime(comment.createdUtc)}
								</span>
							</div>

							<div
								className="prose prose-invert mt-3 max-w-none text-sm"
								/* biome-ignore lint/security/noDangerouslySetInnerHtml: comment HTML is rendered from server-side markdown helpers */
								dangerouslySetInnerHTML={{ __html: comment.bodyHtml }}
							/>

							<div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-500">
								<Link
									to={`/comment/${comment.id}` as "/"}
									className="flex items-center gap-1 hover:text-cyan-400"
								>
									<MessageSquare className="h-3.5 w-3.5" />
									Permalink
								</Link>
								<Link
									to={`/post/${comment.parentSubmissionId}` as "/"}
									search={{ sort: "top" }}
									className="hover:text-cyan-400"
								>
									View thread
								</Link>
							</div>
						</div>
					</div>
				</div>
			))}
		</div>
	);
}
