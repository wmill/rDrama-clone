import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireUser } from "@/lib/auth-guards.server";
import {
	clearReadNotifications,
	markAllNotificationsRead,
	markNotificationRead,
} from "@/lib/notifications.server";
import { idSchema } from "@/lib/validation";

export const markNotificationReadInputSchema = z.object({
	notificationId: idSchema,
});

export const markNotificationReadFn = createServerFn({ method: "POST" })
	.inputValidator((data: { notificationId: number }) =>
		markNotificationReadInputSchema.parse(data),
	)
	.handler(async ({ data }) => {
		const guard = await requireUser();
		if (!guard.ok) {
			return guard.failure;
		}
		const user = guard.user;

		await markNotificationRead({
			userId: user.id,
			notificationId: data.notificationId,
		});
		return { success: true as const };
	});

export const markAllNotificationsReadFn = createServerFn({
	method: "POST",
}).handler(async () => {
	const guard = await requireUser();
	if (!guard.ok) {
		return guard.failure;
	}
	const user = guard.user;

	await markAllNotificationsRead(user.id);
	return { success: true as const };
});

export const clearReadNotificationsFn = createServerFn({
	method: "POST",
}).handler(async () => {
	const guard = await requireUser();
	if (!guard.ok) {
		return guard.failure;
	}
	const user = guard.user;

	await clearReadNotifications(user.id);
	return { success: true as const };
});
