import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/forgot")({
	loader: () => {
		throw redirect({ to: "/forgot-password", statusCode: 301 });
	},
});
