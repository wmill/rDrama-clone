import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/")({
	loader: () => {
		throw redirect({ to: "/admin/reported-posts", search: { page: 1 } });
	},
	component: () => null,
});
