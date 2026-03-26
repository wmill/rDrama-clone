import bcrypt from "bcrypt";
import { eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";

const SALT_ROUNDS = 12;
const DEFAULT_THEME = "TheMotte";
const DEFAULT_COLOR = "fff";
const DEFAULT_TIME_FILTER = "all";
const DEFAULT_REDDIT_DOMAIN = "old.reddit.com";
const DEFAULT_CHAT_LAST_SEEN = new Date(0);

function normalizeUsername(username: string): string {
	return username.trim();
}

function normalizeEmail(email: string): string {
	return email.trim().toLowerCase();
}

export async function hashPassword(password: string): Promise<string> {
	return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(
	password: string,
	hash: string,
): Promise<boolean> {
	return bcrypt.compare(password, hash);
}

export type SafeUser = {
	id: number;
	username: string;
	email: string | null;
	adminLevel: number;
	createdUtc: number;
	isActivated: boolean;
	isBanned: number;
	banReason: string | null;
	unbanUtc: number;
	shadowBanned: string | null;
	coins: number;
	proCoins: number;
	profileUrl: string | null;
	bannerUrl: string | null;
	bio: string | null;
	customTitle: string | null;
};

export function sanitizeUser(user: typeof users.$inferSelect): SafeUser {
	return {
		id: user.id,
		username: user.username,
		email: user.email,
		adminLevel: user.adminLevel,
		createdUtc: user.createdUtc,
		isActivated: user.isActivated,
		isBanned: user.isBanned,
		banReason: user.banReason,
		unbanUtc: user.unbanUtc,
		shadowBanned: user.shadowBanned,
		coins: user.coins,
		proCoins: user.proCoins,
		profileUrl: user.profileUrl,
		bannerUrl: user.bannerUrl,
		bio: user.bio,
		customTitle: user.customTitle,
	};
}

export async function getUserById(id: number) {
	const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
	return user ?? null;
}

export async function getUserByUsername(username: string) {
	const normalizedUsername = normalizeUsername(username);
	const [user] = await db
		.select()
		.from(users)
		.where(sql`lower(${users.username}) = ${normalizedUsername.toLowerCase()}`)
		.limit(1);
	return user ?? null;
}

export async function getUserByEmail(email: string) {
	const normalizedEmail = normalizeEmail(email);
	const [user] = await db
		.select()
		.from(users)
		.where(sql`lower(${users.email}) = ${normalizedEmail}`)
		.limit(1);
	return user ?? null;
}

export type LoginResult =
	| { success: true; user: SafeUser }
	| { success: false; error: string };

export async function authenticateUser(
	usernameOrEmail: string,
	password: string,
): Promise<LoginResult> {
	const user = usernameOrEmail.includes("@")
		? await getUserByEmail(usernameOrEmail)
		: await getUserByUsername(usernameOrEmail);

	if (!user) {
		return { success: false, error: "Invalid username or password" };
	}

	const isValidPassword = await verifyPassword(password, user.passhash);
	if (!isValidPassword) {
		return { success: false, error: "Invalid username or password" };
	}

	if (user.isBanned > 0 && user.unbanUtc > Math.floor(Date.now() / 1000)) {
		return {
			success: false,
			error: user.banReason
				? `Account banned: ${user.banReason}`
				: "Account is banned",
		};
	}

	return { success: true, user: sanitizeUser(user) };
}

export type SignupResult =
	| { success: true; user: SafeUser }
	| { success: false; error: string };

export async function createUser(
	username: string,
	email: string,
	password: string,
): Promise<SignupResult> {
	const normalizedUsername = normalizeUsername(username);
	const normalizedEmail = normalizeEmail(email);

	const existingUsername = await getUserByUsername(normalizedUsername);
	if (existingUsername) {
		return { success: false, error: "Username already taken" };
	}

	const existingEmail = await getUserByEmail(normalizedEmail);
	if (existingEmail) {
		return { success: false, error: "Email already registered" };
	}

	if (normalizedUsername.length < 3 || normalizedUsername.length > 25) {
		return {
			success: false,
			error: "Username must be between 3 and 25 characters",
		};
	}

	if (!/^[a-zA-Z0-9_]+$/.test(normalizedUsername)) {
		return {
			success: false,
			error: "Username can only contain letters, numbers, and underscores",
		};
	}

	if (password.length < 8) {
		return {
			success: false,
			error: "Password must be at least 8 characters",
		};
	}

	const passhash = await hashPassword(password);
	const createdUtc = Math.floor(Date.now() / 1000);

	const [newUser] = await db
		.insert(users)
		.values({
			username: normalizedUsername,
			originalUsername: normalizedUsername,
			email: normalizedEmail,
			passhash,
			createdUtc,
			defaultTime: DEFAULT_TIME_FILTER,
			nameColor: DEFAULT_COLOR,
			titleColor: DEFAULT_COLOR,
			themeColor: DEFAULT_COLOR,
			theme: DEFAULT_THEME,
			reddit: DEFAULT_REDDIT_DOMAIN,
			volunteerJanitorCorrectness: 0,
			chatAuthorized: false,
			chatLastSeen: DEFAULT_CHAT_LAST_SEEN,
			filterBehavior: "AUTOMATIC",
			cardView: true,
		})
		.returning();

	return { success: true, user: sanitizeUser(newUser) };
}
