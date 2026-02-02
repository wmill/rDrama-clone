import * as Sentry from "@sentry/tanstackstart-react";
import { createRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import * as TanstackQuery from "./integrations/tanstack-query/root-provider";

// Import the generated route tree
import { routeTree } from "./routeTree.gen";

// Default error component that shows useful error info
function DefaultErrorComponent({ error }: { error: Error }) {
	// Log error to stderr on server
	if (typeof window === "undefined") {
		console.error("[Server Error]", error);
	}

	return (
		<div className="min-h-screen bg-slate-950 p-8">
			<div className="mx-auto max-w-2xl rounded-xl border border-red-800 bg-red-950/50 p-6">
				<h1 className="mb-4 text-2xl font-bold text-red-400">
					Something went wrong
				</h1>
				<pre className="overflow-auto rounded bg-slate-900 p-4 text-sm text-red-300">
					{error.message}
				</pre>
				{process.env.NODE_ENV === "development" && error.stack && (
					<pre className="mt-4 overflow-auto rounded bg-slate-900 p-4 text-xs text-slate-400">
						{error.stack}
					</pre>
				)}
			</div>
		</div>
	);
}

// Create a new router instance
export const getRouter = () => {
	const rqContext = TanstackQuery.getContext();

	const router = createRouter({
		routeTree,
		context: { ...rqContext },
		defaultPreload: "intent",
		defaultErrorComponent: DefaultErrorComponent,
		Wrap: (props: { children: React.ReactNode }) => {
			return (
				<TanstackQuery.Provider {...rqContext}>
					{props.children}
				</TanstackQuery.Provider>
			);
		},
	});

	setupRouterSsrQueryIntegration({
		router,
		queryClient: rqContext.queryClient,
	});

	if (!router.isServer) {
		Sentry.init({
			dsn: import.meta.env.VITE_SENTRY_DSN,
			integrations: [],
		});
	}

	return router;
};
