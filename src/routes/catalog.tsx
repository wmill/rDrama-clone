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
import { getCurrentUser } from "@/lib/sessions.server";
import { getSubmissionsPage } from "@/lib/submissions.server";
import { feedInputSchema } from "@/lib/validation";

const catalogSearchSchema = z.object({
	sort: z.enum(SortTypes).default("hot"),
	t: z.enum(TimeFilters).default("all"),
	page: z.number().int().min(1).default(1),
});

export const loadCatalogFn = createServerFn({ method: "GET" })
	.inputValidator((data: { sort: SortType; time: TimeFilter; page: number }) =>
		feedInputSchema.parse(data),
	)
	.handler(async ({ data }) => {
		const user = await getCurrentUser();
		const sort = data.sort ?? "hot";
		const time = data.time ?? "all";
		const result = await getSubmissionsPage({
			sort,
			time,
			page: data.page,
			userId: user?.id,
			viewerOver18: user?.over18,
			slurReplacer: user?.slurReplacer,
			hideVotedOn: user?.hideVotedOn,
		});
		return {
			...result,
			currentUserId: user?.id,
			sort,
			time,
		};
	});

export const Route = createFileRoute("/catalog")({
	validateSearch: catalogSearchSchema,
	loaderDeps: ({ search }) => search,
	loader: ({ deps }) =>
		loadCatalogFn({ data: { sort: deps.sort, time: deps.t, page: deps.page } }),
	component: CatalogPage,
});

function CatalogPage() {
	const router = useRouter();
	const data = Route.useLoaderData();
	const [pending, setPending] = useState(false);
	const navigate = async (sort: SortType, t: TimeFilter, page: number) => {
		setPending(true);
		await router.navigate({ to: "/catalog", search: { sort, t, page } });
		setPending(false);
	};
	return (
		<div className={pending ? "opacity-50 pointer-events-none" : ""}>
			<RecentSubmissions
				submissions={data.submissions}
				currentUserId={data.currentUserId}
				sort={data.sort}
				time={data.time}
				title="Catalog"
				eyebrow="Discover the archive"
				showSortControls
				cardView
				onSortChange={(sort) => navigate(sort, data.time, 1)}
				onTimeChange={(time) => navigate(data.sort, time, 1)}
			/>
			<div className="mt-6 flex justify-center gap-4">
				<button
					type="button"
					disabled={data.page <= 1}
					onClick={() => navigate(data.sort, data.time, data.page - 1)}
				>
					Previous
				</button>
				<span>Page {data.page}</span>
				<button
					type="button"
					disabled={!data.hasMore}
					onClick={() => navigate(data.sort, data.time, data.page + 1)}
				>
					Next
				</button>
			</div>
		</div>
	);
}
