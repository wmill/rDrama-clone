import { getRequest } from "@tanstack/react-start/server";

import { RATE_LIMITS, type RateLimitName } from "@/lib/constants";
import { redis } from "@/lib/redis";

export const RATE_LIMIT_MESSAGE =
	"You're doing that too often. Try again in a little while.";

export type RateLimitResult =
	| { allowed: true }
	| { allowed: false; error: string };

// Best-effort client key for unauthenticated endpoints; null outside a request
// context (e.g. unit tests) so callers can fall back to another identifier.
export function getClientIp(): string | null {
	try {
		const request = getRequest();
		return (
			request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
			request?.headers.get("x-real-ip") ??
			null
		);
	} catch {
		return null;
	}
}

// Sliding window over a Redis sorted set: one member per attempt, scored by
// timestamp; members older than the window are pruned before counting.
// Denied attempts still count, so hammering keeps the window saturated.
export async function enforceRateLimit(
	name: RateLimitName,
	key: string,
): Promise<RateLimitResult> {
	const { limit, windowSeconds } = RATE_LIMITS[name];
	const redisKey = `rate_limit:${name}:${key}`;
	const now = Date.now();

	try {
		const pipeline = redis.pipeline();
		pipeline.zremrangebyscore(redisKey, 0, now - windowSeconds * 1000);
		pipeline.zadd(
			redisKey,
			now,
			`${now}:${Math.random().toString(36).slice(2)}`,
		);
		pipeline.zcard(redisKey);
		pipeline.expire(redisKey, windowSeconds);
		const results = await pipeline.exec();

		const zcardResult = results?.[2];
		if (zcardResult?.[0]) {
			throw zcardResult[0];
		}
		const count = Number(zcardResult?.[1] ?? 0);

		if (count > limit) {
			return { allowed: false, error: RATE_LIMIT_MESSAGE };
		}
		return { allowed: true };
	} catch (error) {
		// Fail open: rate limiting is a shield, not a dependency.
		console.error(
			`[rate-limit] check failed for "${name}", allowing request:`,
			error,
		);
		return { allowed: true };
	}
}
