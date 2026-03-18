import { createFileRoute, redirect } from "@tanstack/react-router";

import {
	buildProfilePostsHref,
	parsePostsProfileSearch,
} from "@/lib/profile-route";

export const Route = createFileRoute("/@$username_/posts")({
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
			href: buildProfilePostsHref(params.username, deps),
		});
	},
});
