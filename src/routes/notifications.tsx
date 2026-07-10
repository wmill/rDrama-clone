import {
	createFileRoute,
	Link,
	redirect,
	useRouter,
} from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { Bell } from "lucide-react";
import { useState } from "react";
import {
	clearReadNotificationsFn,
	markAllNotificationsReadFn,
	markNotificationReadFn,
} from "@/lib/notification-actions.server";
import {
	getNotificationsPage,
	type NotificationListItem,
} from "@/lib/notifications.server";
import { getCurrentUser } from "@/lib/sessions.server";
import { formatRelativeTime } from "@/lib/utils";
import { pageInputSchema } from "@/lib/validation";

const PAGE_SIZE = 25;

const getNotificationsPageFn = createServerFn({ method: "GET" })
	.inputValidator((data: { page: number }) => pageInputSchema.parse(data))
	.handler(async ({ data }) => {
		const user = await getCurrentUser();
		if (!user) {
			return null;
		}

		const notifications = await getNotificationsPage({
			userId: user.id,
			page: data.page,
			pageSize: PAGE_SIZE,
		});

		return {
			user,
			notifications,
		};
	});

export const Route = createFileRoute("/notifications")({
	component: NotificationsPage,
	validateSearch: (search: Record<string, unknown>) => ({
		page: Number(search.page) || 1,
	}),
	loaderDeps: ({ search }) => ({
		page: search.page,
	}),
	loader: async ({ deps }) => {
		const result = await getNotificationsPageFn({
			data: { page: deps.page },
		});
		if (!result) {
			throw redirect({ to: "/login" });
		}

		return result;
	},
});

function NotificationsPage() {
	const router = useRouter();
	const { notifications } = Route.useLoaderData();
	const { page } = Route.useSearch();
	const [busyAction, setBusyAction] = useState<string | null>(null);

	const handleMarkRead = async (notificationId: number) => {
		setBusyAction(`read-${notificationId}`);
		try {
			await markNotificationReadFn({ data: { notificationId } });
			await router.invalidate();
		} finally {
			setBusyAction(null);
		}
	};

	const handleMarkAllRead = async () => {
		setBusyAction("mark-all");
		try {
			await markAllNotificationsReadFn();
			await router.invalidate();
		} finally {
			setBusyAction(null);
		}
	};

	const handleClearRead = async () => {
		setBusyAction("clear-read");
		try {
			await clearReadNotificationsFn();
			await router.invalidate();
		} finally {
			setBusyAction(null);
		}
	};

	return (
		<div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 p-4">
			<div className="mx-auto max-w-4xl">
				<div className="mb-6 rounded-xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl">
					<div className="flex flex-wrap items-center justify-between gap-4">
						<div>
							<h1 className="text-2xl font-bold text-white">Notifications</h1>
							<p className="mt-1 text-sm text-slate-400">
								Replies, mentions, follows, awards, and subscribed-thread
								activity.
							</p>
						</div>

						<div className="flex gap-2">
							<button
								type="button"
								onClick={handleMarkAllRead}
								disabled={busyAction !== null}
								className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
							>
								{busyAction === "mark-all" ? "Updating..." : "Mark all read"}
							</button>
							<button
								type="button"
								onClick={handleClearRead}
								disabled={busyAction !== null}
								className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
							>
								{busyAction === "clear-read" ? "Clearing..." : "Clear read"}
							</button>
						</div>
					</div>
				</div>

				<div className="space-y-4">
					{notifications.items.length > 0 ? (
						notifications.items.map((item) => (
							<NotificationCard
								key={item.id}
								item={item}
								onMarkRead={() => handleMarkRead(item.id)}
								isBusy={busyAction === `read-${item.id}`}
							/>
						))
					) : (
						<div className="rounded-xl border border-dashed border-slate-700 p-8 text-center">
							<div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-800 text-slate-400">
								<Bell className="h-6 w-6" />
							</div>
							<p className="text-slate-400">No notifications yet.</p>
						</div>
					)}
				</div>

				{notifications.items.length > 0 && (
					<div className="mt-6 flex items-center justify-center gap-4">
						<button
							type="button"
							onClick={() =>
								router.navigate({
									to: "/notifications",
									search: { page: page - 1 },
								})
							}
							disabled={page <= 1}
							className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
						>
							Previous
						</button>
						<span className="text-sm text-slate-400">Page {page}</span>
						<button
							type="button"
							onClick={() =>
								router.navigate({
									to: "/notifications",
									search: { page: page + 1 },
								})
							}
							disabled={!notifications.hasNextPage}
							className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
						>
							Next
						</button>
					</div>
				)}
			</div>
		</div>
	);
}

function NotificationCard({
	item,
	onMarkRead,
	isBusy,
}: {
	item: NotificationListItem;
	onMarkRead: () => Promise<void>;
	isBusy: boolean;
}) {
	return (
		<div
			className={`rounded-xl border bg-slate-900/80 p-5 shadow-xl ${
				item.read
					? "border-slate-800"
					: "border-cyan-500/40 ring-1 ring-cyan-500/20"
			}`}
		>
			<div className="flex flex-wrap items-start justify-between gap-4">
				<div className="min-w-0 flex-1">
					<div className="flex flex-wrap items-center gap-2 text-sm text-slate-400">
						<a
							href={`/u/${item.actorUsername}`}
							className="font-medium text-cyan-400 hover:underline"
						>
							{item.actorUsername}
						</a>
						<span>{item.label}</span>
						<span>&middot;</span>
						<span>{formatRelativeTime(item.createdUtc)}</span>
					</div>

					{item.postTitle && (
						<Link
							to={item.href as "/"}
							className="mt-2 block text-lg font-semibold text-white hover:text-cyan-400"
						>
							{item.postTitle}
						</Link>
					)}

					{item.commentSnippet && (
						<p className="mt-2 text-sm text-slate-300">{item.commentSnippet}</p>
					)}
				</div>

				<div className="flex items-center gap-2">
					<Link
						to={item.href as "/"}
						className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-700"
					>
						View
					</Link>
					{!item.read && (
						<button
							type="button"
							onClick={() => void onMarkRead()}
							disabled={isBusy}
							className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
						>
							{isBusy ? "Updating..." : "Mark read"}
						</button>
					)}
				</div>
			</div>
		</div>
	);
}
