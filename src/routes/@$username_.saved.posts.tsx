import { createFileRoute, redirect } from "@tanstack/react-router";

import {
	buildProfileSavedPostsHref,
	parsePostsProfileSearch,
} from "@/lib/profile-route";

export const Route = createFileRoute("/@$username_/saved/posts")({
	component: () => null,
	validateSearch: (search: Record<string, unknown>) =>
		parsePostsProfileSearch(search),
	loaderDeps: ({ search }) => ({
		sort: search.sort,
		t: search.t,
		page: search.page,
	}),
	loader: async ({ params, deps }) => {
		throw redirect({
			href: buildProfileSavedPostsHref(params.username, deps),
		});
	},
});
