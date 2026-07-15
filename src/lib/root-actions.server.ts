import { createServerFn } from "@tanstack/react-start";

import { getUnreadNotificationCount } from "@/lib/notifications.server";
import { getCurrentUser } from "@/lib/sessions.server";

export const getRootDataFn = createServerFn({ method: "GET" }).handler(
	async () => {
		const user = await getCurrentUser();

		return {
			user,
			unreadNotificationCount: user
				? await getUnreadNotificationCount(user.id)
				: 0,
		};
	},
);
