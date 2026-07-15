import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { fail, requireUser } from "@/lib/auth-guards.server";
import {
	removeFollower,
	setBlockState,
	setFollowState,
} from "@/lib/social.server";
import { idSchema } from "@/lib/validation";

export const followInputSchema = z.object({
	targetUserId: idSchema,
	following: z.boolean(),
});
export const blockInputSchema = z.object({
	targetUserId: idSchema,
	blocked: z.boolean(),
});
export const removeFollowerInputSchema = z.object({ followerId: idSchema });

export const setFollowStateFn = createServerFn({ method: "POST" })
	.inputValidator((data: { targetUserId: number; following: boolean }) =>
		followInputSchema.parse(data),
	)
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
	.inputValidator((data: { targetUserId: number; blocked: boolean }) =>
		blockInputSchema.parse(data),
	)
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

export const removeFollowerFn = createServerFn({ method: "POST" })
	.inputValidator((data: { followerId: number }) =>
		removeFollowerInputSchema.parse(data),
	)
	.handler(async ({ data }) => {
		const guard = await requireUser();
		if (!guard.ok) return guard.failure;
		try {
			await removeFollower({
				ownerId: guard.user.id,
				followerId: data.followerId,
			});
		} catch (error) {
			return fail(
				error instanceof Error ? error.message : "Failed to remove follower",
			);
		}
		return { success: true as const };
	});
