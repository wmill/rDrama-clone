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
	over18?: boolean;
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
	isNsfw?: boolean;
};

export type CommentVisibilityResult = {
	isVisible: boolean;
	message: string | null;
	bodyHidden?: boolean;
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
				over18: users.over18,
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
		...(typeof viewer.over18 === "boolean" ? { over18: viewer.over18 } : {}),
	};
}

export type ModerationStateInput = {
	stateMod: string | null;
	stateUserDeletedUtc: Date | null;
};

export type ModerationVisibility = {
	isDeleted: boolean;
	isRemoved: boolean;
	isFiltered: boolean;
	/** Hidden from this viewer by the removed/filtered/deleted state machine. */
	isHidden: boolean;
	message: string | null;
};

// Shared REMOVED/FILTERED/user-deleted state machine used by both the
// submission and comment visibility paths. Message text and moderator
// treatment differ per content type, so callers pass them in: submissions
// render placeholders for removed and author-deleted posts even to
// moderators (who act via Unremove), while comments show moderators the
// content.
export function deriveModerationVisibility(
	state: ModerationStateInput,
	viewer: { canModerate: boolean },
	options: {
		messages: { deleted: string; removed: string; filtered: string };
		hideRemovedFromModerators?: boolean;
		hideDeletedFromModerators?: boolean;
	},
): ModerationVisibility {
	const isDeleted = state.stateUserDeletedUtc !== null;
	const isRemoved = state.stateMod === "REMOVED";
	const isFiltered = state.stateMod === "FILTERED";

	const removedHidden =
		isRemoved && (options.hideRemovedFromModerators || !viewer.canModerate);
	const filteredHidden = isFiltered && !viewer.canModerate;
	const deletedHidden =
		isDeleted && (options.hideDeletedFromModerators || !viewer.canModerate);

	const message = removedHidden
		? options.messages.removed
		: filteredHidden
			? options.messages.filtered
			: deletedHidden
				? options.messages.deleted
				: null;

	return {
		isDeleted,
		isRemoved,
		isFiltered,
		isHidden: removedHidden || filteredHidden || deletedHidden,
		message,
	};
}

export function getCommentVisibility(
	input: CommentVisibilityInput,
	viewer: CommentViewerContext,
): CommentVisibilityResult {
	if (input.isNsfw && !viewer.over18) {
		return {
			isVisible: true,
			message: "Enable NSFW content in settings to view this comment",
			bodyHidden: true,
		};
	}
	if (viewer.viewerId !== null && viewer.viewerId === input.authorId) {
		return { isVisible: true, message: null };
	}

	const removedMessage = input.stateModSetBy
		? `Removed by @${input.stateModSetBy}`
		: "Removed";

	if (input.authorShadowBanned !== null && !viewer.canSeeShadowbanned) {
		return { isVisible: false, message: removedMessage };
	}

	const moderation = deriveModerationVisibility(
		{
			stateMod: input.stateMod,
			stateUserDeletedUtc: input.stateUserDeletedUtc,
		},
		viewer,
		{
			messages: {
				deleted: "Deleted by author",
				removed: removedMessage,
				filtered: "Filtered",
			},
		},
	);
	if (moderation.isHidden) {
		return { isVisible: false, message: moderation.message };
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
