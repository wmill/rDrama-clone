import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { pipelineMock, getRequestMock } = vi.hoisted(() => ({
	pipelineMock: {
		zremrangebyscore: vi.fn(),
		zadd: vi.fn(),
		zcard: vi.fn(),
		expire: vi.fn(),
		exec: vi.fn(),
	},
	getRequestMock: vi.fn(),
}));

vi.mock("@/lib/redis", () => ({
	redis: { pipeline: () => pipelineMock },
}));

vi.mock("@tanstack/react-start/server", () => ({
	getRequest: getRequestMock,
}));

import { RATE_LIMITS } from "@/lib/constants";
import {
	enforceRateLimit,
	getClientIp,
	RATE_LIMIT_MESSAGE,
} from "@/lib/rate-limit.server";

function mockAttemptCount(count: number) {
	pipelineMock.exec.mockResolvedValueOnce([
		[null, 1],
		[null, 1],
		[null, count],
		[null, 1],
	]);
}

describe("rate-limit.server", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.spyOn(Date, "now").mockReturnValue(1_000_000_000);
		vi.spyOn(console, "error").mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("allows requests under the limit", async () => {
		mockAttemptCount(RATE_LIMITS.login.limit);

		await expect(enforceRateLimit("login", "1.2.3.4")).resolves.toEqual({
			allowed: true,
		});
	});

	it("denies requests over the limit with a friendly error", async () => {
		mockAttemptCount(RATE_LIMITS.login.limit + 1);

		await expect(enforceRateLimit("login", "1.2.3.4")).resolves.toEqual({
			allowed: false,
			error: RATE_LIMIT_MESSAGE,
		});
	});

	it("prunes attempts older than the window before counting", async () => {
		mockAttemptCount(1);

		await enforceRateLimit("login", "1.2.3.4");

		expect(pipelineMock.zremrangebyscore).toHaveBeenCalledWith(
			"rate_limit:login:1.2.3.4",
			0,
			1_000_000_000 - RATE_LIMITS.login.windowSeconds * 1000,
		);
		expect(pipelineMock.expire).toHaveBeenCalledWith(
			"rate_limit:login:1.2.3.4",
			RATE_LIMITS.login.windowSeconds,
		);
	});

	it("allows again once the window has reset", async () => {
		mockAttemptCount(RATE_LIMITS.login.limit + 1);
		await expect(enforceRateLimit("login", "1.2.3.4")).resolves.toEqual({
			allowed: false,
			error: RATE_LIMIT_MESSAGE,
		});

		// after the window passes, pruning brings the count back down
		mockAttemptCount(1);
		await expect(enforceRateLimit("login", "1.2.3.4")).resolves.toEqual({
			allowed: true,
		});
	});

	it("fails open when Redis is unavailable", async () => {
		pipelineMock.exec.mockRejectedValueOnce(new Error("connection refused"));

		await expect(enforceRateLimit("login", "1.2.3.4")).resolves.toEqual({
			allowed: true,
		});
	});

	it("fails open when the count command errors", async () => {
		pipelineMock.exec.mockResolvedValueOnce([
			[null, 1],
			[null, 1],
			[new Error("WRONGTYPE"), null],
			[null, 1],
		]);

		await expect(enforceRateLimit("vote", "7")).resolves.toEqual({
			allowed: true,
		});
	});

	describe("getClientIp", () => {
		it("takes the first x-forwarded-for hop", () => {
			getRequestMock.mockReturnValue({
				headers: new Headers({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" }),
			});

			expect(getClientIp()).toBe("1.2.3.4");
		});

		it("falls back to x-real-ip", () => {
			getRequestMock.mockReturnValue({
				headers: new Headers({ "x-real-ip": "9.8.7.6" }),
			});

			expect(getClientIp()).toBe("9.8.7.6");
		});

		it("returns null outside a request context", () => {
			getRequestMock.mockImplementation(() => {
				throw new Error("no request");
			});

			expect(getClientIp()).toBeNull();
		});
	});
});
