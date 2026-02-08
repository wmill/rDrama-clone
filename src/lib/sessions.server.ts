import crypto from "node:crypto";
import { getCookie, getRequest, setCookie } from "@tanstack/react-start/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";
import { redis } from "@/lib/redis";
import { type SafeUser, sanitizeUser } from "./auth.server";

const SESSION_COOKIE_NAME = "rdrama_session";
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days
const SESSION_DURATION_MS = SESSION_TTL_SECONDS * 1000;

function sessionKey(id: string): string {
	return `session:${id}`;
}

function userSessionsKey(userId: number): string {
	return `user_sessions:${userId}`;
}

function generateSessionId(): string {
	return crypto.randomBytes(32).toString("hex");
}

export async function createSession(
	userId: number,
	userAgent?: string,
	ipAddress?: string,
): Promise<string> {
	const sessionId = generateSessionId();
	const data = JSON.stringify({
		userId,
		createdAt: new Date().toISOString(),
		userAgent,
		ipAddress,
	});

	const pipeline = redis.pipeline();
	pipeline.set(sessionKey(sessionId), data, "EX", SESSION_TTL_SECONDS);
	pipeline.sadd(userSessionsKey(userId), sessionId);
	await pipeline.exec();

	return sessionId;
}

export async function getSessionById(sessionId: string) {
	const data = await redis.get(sessionKey(sessionId));
	if (!data) return null;

	const parsed = JSON.parse(data) as {
		userId: number;
		createdAt: string;
		userAgent?: string;
		ipAddress?: string;
	};

	return {
		id: sessionId,
		userId: parsed.userId,
		createdAt: new Date(parsed.createdAt),
		userAgent: parsed.userAgent ?? null,
		ipAddress: parsed.ipAddress ?? null,
	};
}

export async function getUserFromSession(
	sessionId: string,
): Promise<SafeUser | null> {
	const session = await getSessionById(sessionId);
	if (!session) return null;

	const [user] = await db
		.select()
		.from(users)
		.where(eq(users.id, session.userId))
		.limit(1);

	if (!user) return null;

	return sanitizeUser(user);
}

export async function deleteSession(sessionId: string): Promise<void> {
	const session = await getSessionById(sessionId);

	const pipeline = redis.pipeline();
	pipeline.del(sessionKey(sessionId));
	if (session) {
		pipeline.srem(userSessionsKey(session.userId), sessionId);
	}
	await pipeline.exec();
}

export async function deleteAllUserSessions(userId: number): Promise<void> {
	const sessionIds = await redis.smembers(userSessionsKey(userId));

	if (sessionIds.length > 0) {
		const pipeline = redis.pipeline();
		for (const id of sessionIds) {
			pipeline.del(sessionKey(id));
		}
		pipeline.del(userSessionsKey(userId));
		await pipeline.exec();
	}
}

export async function extendSession(sessionId: string): Promise<void> {
	await redis.expire(sessionKey(sessionId), SESSION_TTL_SECONDS);
}

export async function cleanupExpiredSessions(): Promise<number> {
	// Redis TTL handles expiry automatically — no cleanup needed
	return 0;
}

export function setSessionCookie(sessionId: string): void {
	setCookie(SESSION_COOKIE_NAME, sessionId, {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax",
		path: "/",
		maxAge: SESSION_DURATION_MS / 1000,
	});
}

export function clearSessionCookie(): void {
	setCookie(SESSION_COOKIE_NAME, "", {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax",
		path: "/",
		maxAge: 0,
	});
}

export function getSessionIdFromCookie(): string | undefined {
	return getCookie(SESSION_COOKIE_NAME);
}

export async function getCurrentUser(): Promise<SafeUser | null> {
	const sessionId = getSessionIdFromCookie();
	if (!sessionId) return null;

	return getUserFromSession(sessionId);
}

export function getRequestInfo(): { userAgent?: string; ipAddress?: string } {
	try {
		const request = getRequest();
		const userAgent = request?.headers.get("user-agent") ?? undefined;
		const ipAddress =
			request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
			request?.headers.get("x-real-ip") ??
			undefined;
		return { userAgent, ipAddress };
	} catch {
		return {};
	}
}
