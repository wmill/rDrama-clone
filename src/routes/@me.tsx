import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/@me")({
	loader: () => {
		throw redirect({ to: "/u/me", statusCode: 301 });
	},
});
