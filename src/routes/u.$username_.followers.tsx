import {
	createFileRoute,
	notFound,
	redirect,
	useRouter,
} from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

import { UserRelationshipPage } from "@/components/profile/user-relationship-page";
import {
	buildProfileFollowersHref,
	parseRelationshipProfileSearch,
} from "@/lib/profile-route";
import { getCurrentUser } from "@/lib/sessions.server";
import { getFollowersPage } from "@/lib/social.server";

const getFollowersPageFn = createServerFn({ method: "GET" })
	.inputValidator((data: { username: string; page: number }) => data)
	.handler(async ({ data }) => {
		const viewer = await getCurrentUser();
		return getFollowersPage({
			username: data.username,
			page: data.page,
			viewer,
		});
	});

export const Route = createFileRoute("/u/$username_/followers")({
	component: UserFollowersPage,
	validateSearch: (search: Record<string, unknown>) =>
		parseRelationshipProfileSearch(search),
	loaderDeps: ({ search }) => ({
		page: search.page,
	}),
	loader: async ({ params, deps }) => {
		const data = await getFollowersPageFn({
			data: {
				username: params.username,
				page: deps.page,
			},
		});

		if (!data) {
			throw notFound();
		}

		if (data.profileUser.username !== params.username) {
			throw redirect({
				href: buildProfileFollowersHref(data.profileUser.username, deps),
			});
		}

		return data;
	},
});

function UserFollowersPage() {
	const router = useRouter();
	const data = Route.useLoaderData();
	const search = Route.useSearch();

	return (
		<UserRelationshipPage
			data={data}
			search={search}
			onPageChange={async (page) => {
				await router.navigate({
					to: "/u/$username/followers",
					params: { username: data.profileUser.username },
					search: { page },
				});
			}}
		/>
	);
}
