import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/settings")({
	loader: () => {
		throw redirect({ href: "/me", statusCode: 301 });
	},
});
