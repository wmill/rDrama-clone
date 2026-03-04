import {
	createFileRoute,
	notFound,
	redirect,
	useRouter,
} from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

import { UserPage } from "@/components/profile/user-page";
import {
	type CommentFeedSortType,
	CommentSortTypes,
	type TimeFilter,
	TimeFilters,
} from "@/lib/constants";
import { getCurrentUser } from "@/lib/sessions.server";
import { stripHtmlToText } from "@/lib/utils";
import {
	getProfilePageData,
	type ProfilePageData,
} from "@/lib/users.server";

function parseTime(value: unknown): TimeFilter {
	if (typeof value === "string" && TimeFilters.includes(value as TimeFilter)) {
		return value as TimeFilter;
	}
	return "all";
}

function parseSort(value: unknown): CommentFeedSortType {
	if (
		typeof value === "string" &&
		CommentSortTypes.includes(value as CommentFeedSortType)
	) {
		return value as CommentFeedSortType;
	}
	return "new";
}

function parsePage(value: unknown): number {
	const parsed = Number(value);
	if (Number.isFinite(parsed) && parsed > 0) {
		return Math.floor(parsed);
	}
	return 1;
}

function buildCommentsProfileHref(
	username: string,
	search: { sort: CommentFeedSortType; t: TimeFilter; page: number },
): string {
	const params = new URLSearchParams({
		sort: search.sort,
		t: search.t,
		page: String(search.page),
	});
	return `/@${username}?${params.toString()}`;
}

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

const getUserCommentsPageFn = createServerFn({ method: "GET" })
	.inputValidator(
		(data: {
			username: string;
			sort: CommentFeedSortType;
			t: TimeFilter;
			page: number;
		}) => data,
	)
	.handler(
		async ({
			data,
		}: {
			data: {
				username: string;
				sort: CommentFeedSortType;
				t: TimeFilter;
				page: number;
			};
		}) => {
			const viewer = await getCurrentUser();
			return getProfilePageData({
				username: data.username,
				tab: "comments",
				sort: data.sort,
				t: data.t,
				page: data.page,
				viewer,
			});
		},
	);

export const Route = createFileRoute("/@$username")({
	component: UserCommentsPage,
	validateSearch: (search: Record<string, unknown>) => ({
		sort: parseSort(search.sort),
		t: parseTime(search.t),
		page: parsePage(search.page),
	}),
	loaderDeps: ({ search }) => ({
		sort: search.sort,
		t: search.t,
		page: search.page,
	}),
	loader: async ({ params, deps }) => {
		const data = await getUserCommentsPageFn({
			data: {
				username: params.username,
				sort: deps.sort,
				t: deps.t,
				page: deps.page,
			},
		});

		if (!data) throw notFound();

		if (data.profileUser.username !== params.username) {
			throw redirect({
				href: buildCommentsProfileHref(data.profileUser.username, deps),
			});
		}

		return data;
	},
	head: ({ loaderData, params }) => {
		const username = loaderData?.profileUser.username ?? params.username;
		const description = loaderData
			? buildDescription(loaderData)
			: `@${username}`;
		const image =
			loaderData?.profileUser.bannerUrl ||
			loaderData?.profileUser.profileUrl ||
			"/tanstack-word-logo-white.svg";
		const url = loaderData
			? buildCommentsProfileHref(username, {
					sort: parseSort(loaderData.sort),
					t: loaderData.t,
					page: loaderData.page,
				})
			: `/@${username}`;

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

function UserCommentsPage() {
	const router = useRouter();
	const data = Route.useLoaderData();

	return (
		<UserPage
			data={data}
			onSortChange={async (sort) => {
				await router.navigate({
					href: buildCommentsProfileHref(data.profileUser.username, {
						sort: parseSort(sort),
						t: data.t,
						page: 1,
					}),
				});
			}}
			onTimeChange={async (t) => {
				await router.navigate({
					href: buildCommentsProfileHref(data.profileUser.username, {
						sort: parseSort(data.sort),
						t,
						page: 1,
					}),
				});
			}}
			onPageChange={async (page) => {
				await router.navigate({
					href: buildCommentsProfileHref(data.profileUser.username, {
						sort: parseSort(data.sort),
						t: data.t,
						page,
					}),
				});
			}}
		/>
	);
}
