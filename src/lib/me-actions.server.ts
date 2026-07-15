import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { renderCommentMarkdown, renderPostTitleHtml } from "@/lib/markdown";
import { settingsSchema } from "@/lib/me-settings";
import { sanitizeProfileCss } from "@/lib/profile-css.server";
import {
	getCurrentUser,
	getSessionIdFromCookie,
	listUserSessions,
} from "@/lib/sessions.server";
import { getBlockedUsersPage } from "@/lib/social.server";
import { getUserSettingsById, updateUserSettings } from "@/lib/users.server";

export const getMePageFn = createServerFn({ method: "GET" })
	.inputValidator((data: { blockedPage: number }) =>
		z.object({ blockedPage: z.number().int().positive() }).parse(data),
	)
	.handler(async ({ data }) => {
		const user = await getCurrentUser();
		if (!user) {
			return { user: null, settings: null, sessions: [], blockedUsers: null };
		}

		const [settings, sessions, blockedUsers] = await Promise.all([
			getUserSettingsById(user.id),
			listUserSessions(user.id, getSessionIdFromCookie()),
			getBlockedUsersPage({ userId: user.id, page: data.blockedPage }),
		]);

		return {
			user,
			settings,
			sessions: sessions.map((session) => ({
				key: session.id.slice(0, 8),
				createdAt: session.createdAt.toISOString(),
				userAgent: session.userAgent,
				ipAddress: session.ipAddress,
				isCurrent: session.isCurrent,
			})),
			blockedUsers,
		};
	});

export const updateSettingsFn = createServerFn({ method: "POST" })
	.inputValidator((data) => settingsSchema.parse(data))
	.handler(async ({ data }) => {
		const user = await getCurrentUser();
		if (!user) throw new Error("You must be logged in");

		const currentSettings = await getUserSettingsById(user.id);
		if (!currentSettings) {
			return { success: false as const, error: "User not found" };
		}
		if (
			currentSettings.titleLocked &&
			data.customTitlePlain.trim() !== currentSettings.customTitlePlain
		) {
			return {
				success: false as const,
				error: "Your custom title is locked by a moderator",
			};
		}

		if (data.bio && renderCommentMarkdown(data.bio).length > 10000) {
			return {
				success: false as const,
				error: "Rendered bio is too long for the legacy database columns",
			};
		}
		if (
			data.customTitlePlain &&
			renderPostTitleHtml(data.customTitlePlain).length > 1000
		) {
			return {
				success: false as const,
				error:
					"Rendered custom title is too long for the legacy database columns",
			};
		}

		let profileCss: string;
		try {
			profileCss = sanitizeProfileCss(data.profileCss, user.id);
		} catch (error) {
			return {
				success: false as const,
				error: error instanceof Error ? error.message : "Invalid profile CSS",
			};
		}
		if (profileCss.length > 4000) {
			return {
				success: false as const,
				error: "Sanitized profile CSS must be 4000 characters or fewer",
			};
		}

		await updateUserSettings(
			user.id,
			{
				...data,
				profileCss,
				nameColor: data.nameColor.toLowerCase(),
				titleColor: data.titleColor.toLowerCase(),
				themeColor: data.themeColor.toLowerCase(),
			},
			{ preserveCustomTitle: currentSettings.titleLocked },
		);

		return { success: true as const };
	});
