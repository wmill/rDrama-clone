import { TanStackDevtools } from "@tanstack/react-devtools";
import type { QueryClient } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Scripts,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { createServerFn } from "@tanstack/react-start";
import Header from "../components/Header";
import { Modals } from "../components/Modals";
import TanStackQueryDevtools from "../integrations/tanstack-query/devtools";
import { getUnreadNotificationCount } from "../lib/notifications.server";
import { getCurrentUser } from "../lib/sessions.server";
import appCss from "../styles.css?url";

interface MyRouterContext {
	queryClient: QueryClient;
}

const getRootDataFn = createServerFn({ method: "GET" }).handler(async () => {
	const user = await getCurrentUser();

	return {
		user,
		unreadNotificationCount: user
			? await getUnreadNotificationCount(user.id)
			: 0,
	};
});

export const Route = createRootRouteWithContext<MyRouterContext>()({
	head: () => ({
		meta: [
			{
				charSet: "utf-8",
			},
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1",
			},
			{
				title: "TanStack Start Starter",
			},
		],
		links: [
			{
				rel: "stylesheet",
				href: appCss,
			},
		],
	}),

	loader: async () => getRootDataFn(),
	shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
	const { user, unreadNotificationCount } = Route.useLoaderData();

	return (
		<html lang="en" data-theme={user?.theme === "light" ? "light" : "dark"}>
			<head>
				<HeadContent />
			</head>
			<body className="min-h-screen bg-slate-950">
				<Header user={user} unreadNotificationCount={unreadNotificationCount} />
				{children}
				<Modals />
				<TanStackDevtools
					config={{
						position: "bottom-right",
					}}
					plugins={[
						{
							name: "Tanstack Router",
							render: <TanStackRouterDevtoolsPanel />,
						},
						TanStackQueryDevtools,
					]}
				/>
				<Scripts />
			</body>
		</html>
	);
}
