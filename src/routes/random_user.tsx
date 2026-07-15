import { createFileRoute, redirect } from "@tanstack/react-router";
import { getRandomUserFn } from "@/lib/discovery-actions.server";

export const Route = createFileRoute("/random_user")({
	loader: async () => {
		const username = await getRandomUserFn();
		if (username)
			throw redirect({ href: `/u/${encodeURIComponent(username)}` });
		throw redirect({ to: "/" });
	},
	component: () => null,
});
