import { createFileRoute, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

import { getRandomPublicUsername } from "@/lib/users.server";

export const getRandomUserFn = createServerFn({ method: "GET" }).handler(
	getRandomPublicUsername,
);

export const Route = createFileRoute("/random_user")({
	loader: async () => {
		const username = await getRandomUserFn();
		if (username)
			throw redirect({ href: `/u/${encodeURIComponent(username)}` });
		throw redirect({ to: "/" });
	},
	component: () => null,
});
