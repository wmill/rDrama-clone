import crypto from "node:crypto";
import { and, eq, gt, lt } from "drizzle-orm";
import { getCookie, getRequest, setCookie } from "@tanstack/react-start/server";

import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { type SafeUser, sanitizeUser } from "./auth.server";

const SESSION_COOKIE_NAME = "rdrama_session";
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function generateSessionId(): string {
	return crypto.randomBytes(32).toString("hex");
}

export async function createSession(
	userId: number,
	userAgent?: string,
	ipAddress?: string,
): Promise<string> {
	const sessionId = generateSessionId();
	const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

	await db.insert(sessions).values({
		id: sessionId,
		userId,
		expiresAt,
		userAgent,
		ipAddress,
	});

	return sessionId;
}

export async function getSessionById(sessionId: string) {
	const [session] = await db
		.select()
		.from(sessions)
		.where(
			and(eq(sessions.id, sessionId), gt(sessions.expiresAt, new Date())),
		)
		.limit(1);

	return session ?? null;
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
	await db.delete(sessions).where(eq(sessions.id, sessionId));
}

export async function deleteAllUserSessions(userId: number): Promise<void> {
	await db.delete(sessions).where(eq(sessions.userId, userId));
}

export async function extendSession(sessionId: string): Promise<void> {
	const newExpiresAt = new Date(Date.now() + SESSION_DURATION_MS);
	await db
		.update(sessions)
		.set({ expiresAt: newExpiresAt })
		.where(eq(sessions.id, sessionId));
}

export async function cleanupExpiredSessions(): Promise<number> {
	const result = await db
		.delete(sessions)
		.where(lt(sessions.expiresAt, new Date()))
		.returning();
	return result.length;
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
