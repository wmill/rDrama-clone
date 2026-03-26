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
	buildProfilePostsHref,
	parsePostsProfileSearch,
	parsePostsProfileSort,
} from "@/lib/profile-route";
import { getCurrentUser } from "@/lib/sessions.server";
import { getProfilePageData, type ProfilePageData } from "@/lib/users.server";
import { stripHtmlToText } from "@/lib/utils";

function buildDescription(data: ProfilePageData): string {
	const joined = new Date(
		data.profileUser.createdUtc * 1000,
	).toLocaleDateString();
	if (data.isPrivateRestricted) {
		return `@${data.profileUser.username} joined on ${joined}. This profile is private.`;
	}
	const bio = stripHtmlToText(
		data.profileUser.bioHtml || data.profileUser.bio,
	).slice(0, 140);
	return `@${data.profileUser.username} • joined ${joined} • ${data.profileUser.storedSubscriberCount} followers • ${data.profileUser.postCount} posts • ${data.profileUser.commentCount} comments${bio ? ` • ${bio}` : ""}`;
}

const getUserPostsPageFn = createServerFn({ method: "GET" })
	.inputValidator(
		(data: { username: string; sort: SortType; t: TimeFilter; page: number }) =>
			data,
	)
	.handler(
		async ({
			data,
		}: {
			data: { username: string; sort: SortType; t: TimeFilter; page: number };
		}) => {
			const viewer = await getCurrentUser();
			const profileData = await getProfilePageData({
				username: data.username,
				tab: "posts",
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
		},
	);

export const Route = createFileRoute("/u/$username_/posts")({
	component: UserPostsPage,
	validateSearch: (search: Record<string, unknown>) =>
		parsePostsProfileSearch(search),
	loaderDeps: ({ search }) => ({
		sort: search.sort,
		t: search.t,
		page: search.page,
	}),
	loader: async ({ params, deps }) => {
		const result = await getUserPostsPageFn({
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
				href: buildProfilePostsHref(profileData.profileUser.username, deps),
			});
		}

		return { data: profileData, adminDetails };
	},
	head: ({ loaderData, params }) => {
		const username = loaderData?.data.profileUser.username ?? params.username;
		const description = loaderData
			? buildDescription(loaderData.data)
			: `@${username}`;
		const image =
			loaderData?.data.profileUser.bannerUrl ||
			loaderData?.data.profileUser.profileUrl ||
			"/tanstack-word-logo-white.svg";
		const url = loaderData
			? buildProfilePostsHref(username, {
					sort: parsePostsProfileSort(loaderData.data.sort),
					t: loaderData.data.t,
					page: loaderData.data.page,
				})
			: `/u/${encodeURIComponent(username)}/posts`;

		return {
			meta: [
				{ title: `@${username}` },
				{ name: "description", content: description },
				{ property: "og:title", content: `@${username}` },
				{ property: "og:description", content: description },
				{ property: "og:url", content: url },
				{ property: "og:image", content: image },
				{ name: "twitter:card", content: "summary_large_image" },
				{ name: "twitter:title", content: `@${username}` },
				{ name: "twitter:description", content: description },
				{ name: "twitter:image", content: image },
			],
		};
	},
});

function UserPostsPage() {
	const router = useRouter();
	const { data, adminDetails } = Route.useLoaderData();

	return (
		<UserPage
			data={data}
			adminDetails={adminDetails}
			onSortChange={async (sort) => {
				await router.navigate({
					to: "/u/$username/posts",
					params: { username: data.profileUser.username },
					search: {
						sort: parsePostsProfileSort(sort),
						t: data.t,
						page: 1,
					},
				});
			}}
			onTimeChange={async (t) => {
				await router.navigate({
					to: "/u/$username/posts",
					params: { username: data.profileUser.username },
					search: {
						sort: parsePostsProfileSort(data.sort),
						t,
						page: 1,
					},
				});
			}}
			onPageChange={async (page) => {
				await router.navigate({
					to: "/u/$username/posts",
					params: { username: data.profileUser.username },
					search: {
						sort: parsePostsProfileSort(data.sort),
						t: data.t,
						page,
					},
				});
			}}
		/>
	);
}
