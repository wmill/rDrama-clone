import { createServerFn } from "@tanstack/react-start";

import { fail, requireUser } from "@/lib/auth-guards.server";
import { setBlockState, setFollowState } from "@/lib/social.server";

export const setFollowStateFn = createServerFn({ method: "POST" })
	.inputValidator((data: { targetUserId: number; following: boolean }) => data)
	.handler(async ({ data }) => {
		const guard = await requireUser();
		if (!guard.ok) {
			return guard.failure;
		}
		const user = guard.user;

		try {
			await setFollowState({
				userId: user.id,
				targetUserId: data.targetUserId,
				following: data.following,
			});
		} catch (error) {
			return fail(
				error instanceof Error
					? error.message
					: "Failed to update follow state",
			);
		}

		return { success: true as const };
	});

export const setBlockStateFn = createServerFn({ method: "POST" })
	.inputValidator((data: { targetUserId: number; blocked: boolean }) => data)
	.handler(async ({ data }) => {
		const guard = await requireUser();
		if (!guard.ok) {
			return guard.failure;
		}
		const user = guard.user;

		try {
			await setBlockState({
				userId: user.id,
				targetUserId: data.targetUserId,
				blocked: data.blocked,
			});
		} catch (error) {
			return fail(
				error instanceof Error ? error.message : "Failed to update block state",
			);
		}

		return { success: true as const };
	});
