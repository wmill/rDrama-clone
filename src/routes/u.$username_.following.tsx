import {
	createFileRoute,
	notFound,
	redirect,
	useRouter,
} from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { UserRelationshipPage } from "@/components/profile/user-relationship-page";
import {
	buildProfileFollowingHref,
	parseRelationshipProfileSearch,
} from "@/lib/profile-route";
import { getCurrentUser } from "@/lib/sessions.server";
import { getFollowingPage } from "@/lib/social.server";
import { usernamePageInputSchema } from "@/lib/validation";

const getFollowingPageFn = createServerFn({ method: "GET" })
	.inputValidator((data: { username: string; page: number }) =>
		usernamePageInputSchema.parse(data),
	)
	.handler(async ({ data }) => {
		const viewer = await getCurrentUser();
		return getFollowingPage({
			username: data.username,
			page: data.page,
			viewer,
		});
	});

export const Route = createFileRoute("/u/$username_/following")({
	component: UserFollowingPage,
	validateSearch: (search: Record<string, unknown>) =>
		parseRelationshipProfileSearch(search),
	loaderDeps: ({ search }) => ({
		page: search.page,
	}),
	loader: async ({ params, deps }) => {
		const data = await getFollowingPageFn({
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
				href: buildProfileFollowingHref(data.profileUser.username, deps),
			});
		}

		return data;
	},
});

function UserFollowingPage() {
	const router = useRouter();
	const data = Route.useLoaderData();
	const search = Route.useSearch();

	return (
		<UserRelationshipPage
			data={data}
			search={search}
			onPageChange={async (page) => {
				await router.navigate({
					to: "/u/$username/following",
					params: { username: data.profileUser.username },
					search: { page },
				});
			}}
		/>
	);
}
