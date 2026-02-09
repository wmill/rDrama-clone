import { createFileRoute, useRouter } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { z } from "zod";

import { RecentSubmissions } from "@/components/recent-submissions";
import {
	SortTypes,
	TimeFilters,
	type SortType,
	type TimeFilter,
} from "@/lib/constants";

import { getSubmissions } from "@/lib/submissions.server";

const searchSchema = z.object({
	sort: z.enum(SortTypes).default("hot"),
	t: z.enum(TimeFilters).default("all"),
});
	

const loadSubmissions = createServerFn({ method: "GET" })
	.inputValidator(
		(data: { sort?: SortType; time?: TimeFilter; limit?: number }) => data,
	)
	.handler(
		async ({
			data,
		}: { data: { sort?: SortType; time?: TimeFilter; limit?: number } }) => {
			try {
				return await getSubmissions({
					sort: data.sort ?? "hot",
					time: data.time ?? "all",
					limit: data.limit ?? 25,
				});
			} catch (error) {
				console.error("[loadSubmissions Error]", error);
				throw error;
			}
		},
	);

export const Route = createFileRoute("/")({
	component: HomePage,
	validateSearch: searchSchema,
	loaderDeps: ({ search }) => ({ sort: search.sort, time: search.t }),
	loader: async ({ deps }) => {
		return loadSubmissions({ data: { sort: deps.sort, time: deps.time } });
	},
});

function HomePage() {
	const router = useRouter();
	const submissions = Route.useLoaderData();
	const { sort, t: time } = Route.useSearch();
	const [isLoading, setIsLoading] = useState(false);

	const handleSortChange = async (newSort: SortType) => {
		setIsLoading(true);
		await router.navigate({
			to: "/",
			search: { sort: newSort, t: time },
		});
		setIsLoading(false);
	};

	const handleTimeChange = async (newTime: TimeFilter) => {
		setIsLoading(true);
		await router.navigate({
			to: "/",
			search: { sort, t: newTime },
		});
		setIsLoading(false);
	};

	return (
		<div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
			<div className="mx-auto max-w-4xl px-4 py-6">
				<div className={isLoading ? "opacity-50 pointer-events-none" : ""}>
					<RecentSubmissions
						submissions={submissions}
						sort={sort}
						time={time}
						onSortChange={handleSortChange}
						onTimeChange={handleTimeChange}
						showSortControls={true}
					/>
				</div>
			</div>
		</div>
	);
}
