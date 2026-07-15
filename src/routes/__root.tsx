import { TanStackDevtools } from "@tanstack/react-devtools";
import type { QueryClient } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Scripts,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import Header from "../components/Header";
import { LinkPreferenceController } from "../components/link-preference-controller";
import { Modals } from "../components/Modals";
import TanStackQueryDevtools from "../integrations/tanstack-query/devtools";
import { normalizeThemeColor } from "../lib/content-preferences";
import { getRootDataFn } from "../lib/root-actions.server";
import appCss from "../styles.css?url";

interface MyRouterContext {
	queryClient: QueryClient;
}

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
	const themeColor = normalizeThemeColor(user?.themeColor);

	return (
		<html
			lang="en"
			data-theme={user?.theme === "light" ? "light" : "dark"}
			style={{ "--theme-color": themeColor } as React.CSSProperties}
		>
			<head>
				<HeadContent />
			</head>
			<body className="min-h-screen bg-slate-950">
				<LinkPreferenceController
					newTab={user?.newTab ?? false}
					newTabExternal={user?.newTabExternal ?? false}
				/>
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
