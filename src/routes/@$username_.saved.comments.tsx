import { createFileRoute, redirect } from "@tanstack/react-router";

import {
	buildProfileSavedCommentsHref,
	parseCommentsProfileSearch,
} from "@/lib/profile-route";

export const Route = createFileRoute("/@$username_/saved/comments")({
	component: () => null,
	validateSearch: (search: Record<string, unknown>) =>
		parseCommentsProfileSearch(search),
	loaderDeps: ({ search }) => ({
		sort: search.sort,
		t: search.t,
		page: search.page,
	}),
	loader: async ({ params, deps }) => {
		throw redirect({
			href: buildProfileSavedCommentsHref(params.username, deps),
		});
	},
});
