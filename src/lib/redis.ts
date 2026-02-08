import Redis from "ioredis";

const redisUrl = process.env.REDIS_URL;
if (!redisUrl) {
	const error = new Error("REDIS_URL is not set");
	console.error("[Redis Error]", error.message);
	throw error;
}

export const redis = new Redis(redisUrl, {
	retryStrategy(times) {
		const delay = Math.min(times * 200, 5000);
		return delay;
	},
	maxRetriesPerRequest: 3,
});

redis.on("error", (err) => {
	console.error("[Redis Error]", err.message);
});
