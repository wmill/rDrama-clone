import {
	createFileRoute,
	notFound,
	redirect,
	useRouter,
} from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { UserPage } from "@/components/profile/user-page";
import { getUserAdminDetails, type UserAdminDetails } from "@/lib/admin.server";
import type { CommentFeedSortType, TimeFilter } from "@/lib/constants";
import {
	buildProfileSavedCommentsHref,
	parseCommentsProfileSearch,
	parseCommentsProfileSort,
} from "@/lib/profile-route";
import { getCurrentUser } from "@/lib/sessions.server";
import { getProfilePageData } from "@/lib/users.server";
import { profileCommentsInputSchema } from "@/lib/validation";

const getSavedCommentsPageFn = createServerFn({ method: "GET" })
	.inputValidator(
		(data: {
			username: string;
			sort: CommentFeedSortType;
			t: TimeFilter;
			page: number;
		}) => profileCommentsInputSchema.parse(data),
	)
	.handler(async ({ data }) => {
		const viewer = await getCurrentUser();
		const profileData = await getProfilePageData({
			username: data.username,
			tab: "saved-comments",
			sort: data.sort,
			t: data.t,
			page: data.page,
			viewer,
		});

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
	});

export const Route = createFileRoute("/u/$username_/saved/comments")({
	component: UserSavedCommentsPage,
	validateSearch: (search: Record<string, unknown>) =>
		parseCommentsProfileSearch(search),
	loaderDeps: ({ search }) => ({
		sort: search.sort,
		t: search.t,
		page: search.page,
	}),
	loader: async ({ params, deps }) => {
		const result = await getSavedCommentsPageFn({
			data: {
				username: params.username,
				sort: deps.sort,
				t: deps.t,
				page: deps.page,
			},
		});

		if (!result) throw notFound();

		const { profileData, adminDetails } = result;

		if (profileData.profileUser.username !== params.username) {
			throw redirect({
				href: buildProfileSavedCommentsHref(
					profileData.profileUser.username,
					deps,
				),
			});
		}

		return { data: profileData, adminDetails };
	},
});

function UserSavedCommentsPage() {
	const router = useRouter();
	const { data, adminDetails } = Route.useLoaderData();

	return (
		<UserPage
			data={data}
			adminDetails={adminDetails}
			onSortChange={async (sort) => {
				await router.navigate({
					to: "/u/$username/saved/comments",
					params: { username: data.profileUser.username },
					search: {
						sort: parseCommentsProfileSort(sort),
						t: data.t,
						page: 1,
					},
				});
			}}
			onTimeChange={async (t) => {
				await router.navigate({
					to: "/u/$username/saved/comments",
					params: { username: data.profileUser.username },
					search: {
						sort: parseCommentsProfileSort(data.sort),
						t,
						page: 1,
					},
				});
			}}
			onPageChange={async (page) => {
				await router.navigate({
					to: "/u/$username/saved/comments",
					params: { username: data.profileUser.username },
					search: {
						sort: parseCommentsProfileSort(data.sort),
						t: data.t,
						page,
					},
				});
			}}
		/>
	);
}
