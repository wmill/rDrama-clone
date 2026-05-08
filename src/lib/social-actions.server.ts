import { createServerFn } from "@tanstack/react-start";

import { getCurrentUser } from "@/lib/sessions.server";
import { setBlockState, setFollowState } from "@/lib/social.server";

export const setFollowStateFn = createServerFn({ method: "POST" })
	.inputValidator((data: { targetUserId: number; following: boolean }) => data)
	.handler(async ({ data }) => {
		const user = await getCurrentUser();
		if (!user) {
			return { success: false as const, error: "Not logged in" };
		}

		try {
			await setFollowState({
				userId: user.id,
				targetUserId: data.targetUserId,
				following: data.following,
			});
		} catch (error) {
			return {
				success: false as const,
				error:
					error instanceof Error
						? error.message
						: "Failed to update follow state",
			};
		}

		return { success: true as const };
	});

export const setBlockStateFn = createServerFn({ method: "POST" })
	.inputValidator((data: { targetUserId: number; blocked: boolean }) => data)
	.handler(async ({ data }) => {
		const user = await getCurrentUser();
		if (!user) {
			return { success: false as const, error: "Not logged in" };
		}

		try {
			await setBlockState({
				userId: user.id,
				targetUserId: data.targetUserId,
				blocked: data.blocked,
			});
		} catch (error) {
			return {
				success: false as const,
				error:
					error instanceof Error
						? error.message
						: "Failed to update block state",
			};
		}

		return { success: true as const };
	});
