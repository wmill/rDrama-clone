import { createServerFn } from "@tanstack/react-start";

import {
	clearReadNotifications,
	markAllNotificationsRead,
	markNotificationRead,
} from "@/lib/notifications.server";
import { getCurrentUser } from "@/lib/sessions.server";

export const markNotificationReadFn = createServerFn({ method: "POST" })
	.inputValidator((data: { commentId: number }) => data)
	.handler(async ({ data }) => {
		const user = await getCurrentUser();
		if (!user) {
			return { success: false as const, error: "Not logged in" };
		}

		await markNotificationRead({ userId: user.id, commentId: data.commentId });
		return { success: true as const };
	});

export const markAllNotificationsReadFn = createServerFn({
	method: "POST",
}).handler(async () => {
	const user = await getCurrentUser();
	if (!user) {
		return { success: false as const, error: "Not logged in" };
	}

	await markAllNotificationsRead(user.id);
	return { success: true as const };
});

export const clearReadNotificationsFn = createServerFn({
	method: "POST",
}).handler(async () => {
	const user = await getCurrentUser();
	if (!user) {
		return { success: false as const, error: "Not logged in" };
	}

	await clearReadNotifications(user.id);
	return { success: true as const };
});
