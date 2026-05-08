import { eq } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";
import { getSocialViewerContext } from "@/lib/social.server";

export type CommentViewerContext = {
	viewerId: number | null;
	adminLevel: number;
	canModerate: boolean;
	canSeeShadowbanned: boolean;
	blockedAuthorIds: Set<number>;
};

export type CommentVisibilityInput = {
	authorId: number;
	authorName: string;
	distinguishLevel: number;
	stateMod: string | null;
	stateModSetBy?: string | null;
	stateUserDeletedUtc: Date | null;
	authorShadowBanned: string | null;
	isBlocking: boolean;
};

export type CommentVisibilityResult = {
	isVisible: boolean;
	message: string | null;
};

export async function getCommentViewerContext(
	userId?: number,
): Promise<CommentViewerContext> {
	if (!userId) {
		return {
			viewerId: null,
			adminLevel: 0,
			canModerate: false,
			canSeeShadowbanned: false,
			blockedAuthorIds: new Set<number>(),
		};
	}

	const [viewerRows, socialViewer] = await Promise.all([
		db
			.select({
				id: users.id,
				adminLevel: users.adminLevel,
				shadowBanned: users.shadowBanned,
			})
			.from(users)
			.where(eq(users.id, userId))
			.limit(1),
		getSocialViewerContext(userId),
	]);
	const viewer = viewerRows[0];

	if (!viewer) {
		return {
			viewerId: null,
			adminLevel: 0,
			canModerate: false,
			canSeeShadowbanned: false,
			blockedAuthorIds: socialViewer.blockedUserIds,
		};
	}

	return {
		viewerId: viewer.id,
		adminLevel: viewer.adminLevel,
		canModerate: viewer.adminLevel >= 2,
		canSeeShadowbanned: viewer.adminLevel >= 2 || viewer.shadowBanned !== null,
		blockedAuthorIds: socialViewer.blockedUserIds,
	};
}

export function getCommentVisibility(
	input: CommentVisibilityInput,
	viewer: CommentViewerContext,
): CommentVisibilityResult {
	if (viewer.viewerId !== null && viewer.viewerId === input.authorId) {
		return { isVisible: true, message: null };
	}

	if (
		(input.stateMod === "REMOVED" && !viewer.canModerate) ||
		(input.authorShadowBanned !== null && !viewer.canSeeShadowbanned)
	) {
		return {
			isVisible: false,
			message: input.stateModSetBy
				? `Removed by @${input.stateModSetBy}`
				: "Removed",
		};
	}

	if (input.stateMod === "FILTERED" && !viewer.canModerate) {
		return { isVisible: false, message: "Filtered" };
	}

	if (input.stateUserDeletedUtc !== null && !viewer.canModerate) {
		return { isVisible: false, message: "Deleted by author" };
	}

	if (input.isBlocking) {
		if (input.distinguishLevel > 0) {
			return {
				isVisible: true,
				message: `(You are blocking @${input.authorName}, but this is an official post and cannot be blocked)`,
			};
		}

		return {
			isVisible: false,
			message: `You are blocking @${input.authorName}`,
		};
	}

	return { isVisible: true, message: null };
}

export function shouldIncludeCommentInFeed(
	input: CommentVisibilityInput & {
		parentSubmissionId: number | null;
		parentSubmissionPrivate?: boolean | null;
		parentSubmissionDeletedUtc?: Date | null;
		parentSubmissionStateMod?: string | null;
	},
	viewer: CommentViewerContext,
): boolean {
	if (input.parentSubmissionId === null) {
		return false;
	}

	if (
		input.parentSubmissionPrivate ||
		input.parentSubmissionDeletedUtc !== null ||
		input.parentSubmissionStateMod !== "VISIBLE"
	) {
		return false;
	}

	if (viewer.blockedAuthorIds.has(input.authorId)) {
		return false;
	}

	if (input.stateMod !== "VISIBLE" || input.stateUserDeletedUtc !== null) {
		return false;
	}

	if (input.authorShadowBanned !== null && !viewer.canSeeShadowbanned) {
		return false;
	}

	return true;
}
