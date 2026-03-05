import { createFileRoute, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

import { getCurrentUser } from "@/lib/sessions.server";

const getCurrentUserFn = createServerFn({ method: "GET" }).handler(async () => {
	return getCurrentUser();
});

export const Route = createFileRoute("/u/me")({
	component: () => null,
	loader: async () => {
		const user = await getCurrentUserFn();
		if (!user) {
			throw redirect({ to: "/login" });
		}
		throw redirect({ href: `/u/${user.username}` });
	},
});
