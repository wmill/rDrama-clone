import { createFileRoute, useRouter } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { z } from "zod";
import { RecentSubmissions } from "@/components/recent-submissions";
import {
	type SortType,
	SortTypes,
	type TimeFilter,
	TimeFilters,
} from "@/lib/constants";
import { resolvePreferenceDefault } from "@/lib/content-preferences";
import { getCurrentUser } from "@/lib/sessions.server";
import { getSubmissionsPage } from "@/lib/submissions.server";
import { feedInputSchema } from "@/lib/validation";

const searchSchema = z.object({
	sort: z.enum(SortTypes).optional(),
	t: z.enum(TimeFilters).optional(),
	page: z.number().int().min(1).default(1),
});

const loadSubmissions = createServerFn({ method: "GET" })
	.inputValidator(
		(data: { sort?: SortType; time?: TimeFilter; page?: number }) =>
			feedInputSchema.parse(data),
	)
	.handler(
		async ({
			data,
		}: {
			data: { sort?: SortType; time?: TimeFilter; page?: number };
		}) => {
			try {
				const user = await getCurrentUser();
				const sort = resolvePreferenceDefault(
					data.sort,
					user?.defaultSorting as SortType | undefined,
					"hot",
				);
				const time = resolvePreferenceDefault(
					data.time,
					user?.defaultTime as TimeFilter | undefined,
					"all",
				);
				const result = await getSubmissionsPage({
					sort,
					time,
					page: data.page ?? 1,
					userId: user?.id,
					viewerOver18: user?.over18,
					slurReplacer: user?.slurReplacer,
					hideVotedOn: user?.hideVotedOn,
				});
				return {
					submissions: result.submissions,
					page: result.page,
					hasMore: result.hasMore,
					currentUserId: user?.id,
					sort,
					time,
					cardView: user?.cardView ?? false,
				};
			} catch (error) {
				console.error("[loadSubmissions Error]", error);
				throw error;
			}
		},
	);

export const Route = createFileRoute("/")({
	component: HomePage,
	validateSearch: searchSchema,
	loaderDeps: ({ search }) => ({
		sort: search.sort,
		time: search.t,
		page: search.page,
	}),
	loader: async ({ deps }) => {
		return loadSubmissions({
			data: { sort: deps.sort, time: deps.time, page: deps.page },
		});
	},
});

function HomePage() {
	const router = useRouter();
	const { submissions, page, hasMore, currentUserId, sort, time, cardView } =
		Route.useLoaderData();
	const [isLoading, setIsLoading] = useState(false);

	const navigateFeed = async (search: {
		sort: SortType;
		t: TimeFilter;
		page: number;
	}) => {
		setIsLoading(true);
		await router.navigate({ to: "/", search });
		setIsLoading(false);
	};

	const handleSortChange = (newSort: SortType) =>
		navigateFeed({ sort: newSort, t: time, page: 1 });

	const handleTimeChange = (newTime: TimeFilter) =>
		navigateFeed({ sort, t: newTime, page: 1 });

	const handlePageChange = (newPage: number) =>
		navigateFeed({ sort, t: time, page: newPage });

	return (
		<div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
			<div className="mx-auto max-w-4xl px-4 py-6">
				<div className={isLoading ? "opacity-50 pointer-events-none" : ""}>
					<RecentSubmissions
						submissions={submissions}
						currentUserId={currentUserId}
						sort={sort}
						time={time}
						onSortChange={handleSortChange}
						onTimeChange={handleTimeChange}
						showSortControls={true}
						cardView={cardView}
					/>

					<div className="mt-6 flex items-center justify-center gap-4">
						<button
							type="button"
							onClick={() => handlePageChange(page - 1)}
							disabled={page <= 1}
							className="rounded-lg bg-slate-800 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
						>
							Previous
						</button>
						<span className="text-sm text-slate-400">Page {page}</span>
						<button
							type="button"
							onClick={() => handlePageChange(page + 1)}
							disabled={!hasMore}
							className="rounded-lg bg-slate-800 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
						>
							Next
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
