import {
	createFileRoute,
	notFound,
	redirect,
	useRouter,
} from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

import { UserPage } from "@/components/profile/user-page";
import { getUserAdminDetails, type UserAdminDetails } from "@/lib/admin.server";
import type { SortType, TimeFilter } from "@/lib/constants";
import {
	buildProfileSavedPostsHref,
	parsePostsProfileSearch,
	parsePostsProfileSort,
} from "@/lib/profile-route";
import { getCurrentUser } from "@/lib/sessions.server";
import { getProfilePageData } from "@/lib/users.server";

const getSavedPostsPageFn = createServerFn({ method: "GET" })
	.inputValidator(
		(data: { username: string; sort: SortType; t: TimeFilter; page: number }) =>
			data,
	)
	.handler(async ({ data }) => {
		const viewer = await getCurrentUser();
		const profileData = await getProfilePageData({
			username: data.username,
			tab: "saved-posts",
			sort: data.sort,
			t: data.t,
			page: data.page,
			viewer,
		})

		if (!profileData) return null;

		let adminDetails: UserAdminDetails | null = null;
		if (
			viewer &&
			viewer.adminLevel >= 2 &&
			viewer.id !== profileData.profileUser.id
		) {
			adminDetails = await getUserAdminDetails(profileData.profileUser.id);
		}

		return { profileData, adminDetails };
	})

export const Route = createFileRoute("/u/$username_/saved/posts")({
	component: UserSavedPostsPage,
	validateSearch: (search: Record<string, unknown>) =>
		parsePostsProfileSearch(search),
	loaderDeps: ({ search }) => ({
		sort: search.sort,
		t: search.t,
		page: search.page,
	}),
	loader: async ({ params, deps }) => {
		const result = await getSavedPostsPageFn({
			data: {
				username: params.username,
				sort: deps.sort,
				t: deps.t,
				page: deps.page,
			},
		})

		if (!result) throw notFound();

		const { profileData, adminDetails } = result;

		if (profileData.profileUser.username !== params.username) {
			throw redirect({
				href: buildProfileSavedPostsHref(
					profileData.profileUser.username,
					deps,
				),
			})
		}

		return { data: profileData, adminDetails };
	},
});

function UserSavedPostsPage() {
	const router = useRouter();
	const { data, adminDetails } = Route.useLoaderData();

	return (
		<UserPage
			data={data}
			adminDetails={adminDetails}
			onSortChange={async (sort) => {
				await router.navigate({
					to: "/u/$username/saved/posts",
					params: { username: data.profileUser.username },
					search: {
						sort: parsePostsProfileSort(sort),
						t: data.t,
						page: 1,
					},
				})
			}}
			onTimeChange={async (t) => {
				await router.navigate({
					to: "/u/$username/saved/posts",
					params: { username: data.profileUser.username },
					search: {
						sort: parsePostsProfileSort(data.sort),
						t,
						page: 1,
					},
				})
			}}
			onPageChange={async (page) => {
				await router.navigate({
					to: "/u/$username/saved/posts",
					params: { username: data.profileUser.username },
					search: {
						sort: parsePostsProfileSort(data.sort),
						t: data.t,
						page,
					},
				})
			}}
		/>
	)
}
