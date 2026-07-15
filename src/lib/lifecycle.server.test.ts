import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({
	db: { transaction: vi.fn(), update: vi.fn(), insert: vi.fn() },
}));

import { db } from "@/db";
import {
	authorDeleteComment,
	authorDeleteSubmission,
	authorRestoreComment,
	authorRestoreSubmission,
	setCommentModerationState,
	setCommentNsfwState,
	setCommentOpPinnedState,
	setCommentPinnedState,
	setCommentRemovedState,
	setCommentSavedState,
	setSubmissionModerationState,
	setSubmissionProfilePinnedState,
	setSubmissionRemovedState,
	setSubmissionSavedState,
	setSubmissionStickyState,
} from "@/lib/lifecycle.server";

function createUpdateChain(result = [{ id: 1 }]) {
	const returning = vi.fn().mockResolvedValue(result);
	const where = vi.fn().mockReturnValue({ returning });
	const set = vi.fn().mockReturnValue({ where });
	return { set, where, returning };
}

function createInsertChain() {
	const chain = {
		values: vi.fn().mockReturnValue({
			onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
		}),
		onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
	};
	return chain;
}

function createSelectChain<T>(result: T) {
	return {
		from: vi.fn().mockReturnThis(),
		innerJoin: vi.fn().mockReturnThis(),
		where: vi.fn().mockReturnThis(),
		limit: vi.fn().mockResolvedValue(result),
	};
}

function createDeleteChain() {
	return {
		where: vi.fn().mockResolvedValue(undefined),
	};
}

describe("lifecycle helpers", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("author delete helpers succeed only when a row is updated", async () => {
		const submissionUpdate = createUpdateChain();
		const commentUpdate = createUpdateChain();
		const tx = {
			update: vi
				.fn()
				.mockReturnValueOnce(submissionUpdate)
				.mockReturnValueOnce(commentUpdate),
		};

		await expect(authorDeleteSubmission(10, 20, tx as never)).resolves.toBe(
			true,
		);
		await expect(authorDeleteComment(11, 21, tx as never)).resolves.toBe(true);
		expect(submissionUpdate.set).toHaveBeenCalled();
		expect(commentUpdate.set).toHaveBeenCalled();
	});

	it("restores author-deleted content transactionally without touching counts", async () => {
		const submissionUpdate = createUpdateChain();
		const commentUpdate = createUpdateChain();
		const tx = {
			update: vi
				.fn()
				.mockReturnValueOnce(submissionUpdate)
				.mockReturnValueOnce(commentUpdate),
		};
		vi.mocked(db.transaction).mockImplementation(
			async (fn) => fn(tx as never) as never,
		);

		await expect(authorRestoreSubmission(10, 20)).resolves.toBe(true);
		await expect(authorRestoreComment(11, 21)).resolves.toBe(true);
		expect(submissionUpdate.set).toHaveBeenCalledWith(
			expect.objectContaining({ stateUserDeletedUtc: null }),
		);
		expect(commentUpdate.set).toHaveBeenCalledWith(
			expect.objectContaining({ stateUserDeletedUtc: null }),
		);
		expect(tx.update).toHaveBeenCalledTimes(2);
	});

	it("does not restore content rejected by ownership or lifecycle predicates", async () => {
		const tx = { update: vi.fn(() => createUpdateChain([])) };
		vi.mocked(db.transaction).mockImplementation(
			async (fn) => fn(tx as never) as never,
		);
		await expect(authorRestoreSubmission(10, 999)).resolves.toBe(false);
		await expect(authorRestoreComment(11, 999)).resolves.toBe(false);
	});

	it("logs submission moderation actions", async () => {
		const updateChain = createUpdateChain();
		const insertChain = createInsertChain();
		const tx = {
			select: vi.fn(() => createSelectChain([{ stateMod: "FILTERED" }])),
			update: vi.fn(() => updateChain),
			insert: vi.fn(() => insertChain),
		};

		const success = await setSubmissionModerationState(
			{
				submissionId: 10,
				moderatorId: 2,
				moderatorName: "mod",
				state: "VISIBLE",
			},
			tx as never,
		);

		expect(success).toBe(true);
		expect(updateChain.set).toHaveBeenCalledWith({
			stateMod: "VISIBLE",
			stateModSetBy: null,
			stateReport: "RESOLVED",
		});
		expect(insertChain.values).toHaveBeenCalledWith({
			userId: 2,
			targetSubmissionId: 10,
			kind: "unfilter_post",
		});
	});

	it("logs comment moderation and pin actions", async () => {
		const removeUpdateChain = createUpdateChain();
		const pinUpdateChain = createUpdateChain();
		const insertChain = createInsertChain();
		const tx = {
			select: vi.fn(() => createSelectChain([{ stateMod: "VISIBLE" }])),
			update: vi
				.fn()
				.mockReturnValueOnce(removeUpdateChain)
				.mockReturnValueOnce(pinUpdateChain),
			insert: vi.fn(() => insertChain),
		};

		await setCommentModerationState(
			{
				commentId: 22,
				moderatorId: 3,
				moderatorName: "mod",
				state: "FILTERED",
			},
			tx as never,
		);
		await setCommentPinnedState(
			{
				commentId: 22,
				moderatorId: 3,
				moderatorName: "mod",
				pinned: true,
			},
			tx as never,
		);

		expect(removeUpdateChain.set).toHaveBeenCalledWith({
			stateMod: "FILTERED",
			stateModSetBy: "mod",
			stateReport: "RESOLVED",
		});
		expect(pinUpdateChain.set).toHaveBeenCalledWith({
			pinnedBy: "mod",
			isPinnedUtc: expect.any(Number),
		});
		expect(insertChain.values).toHaveBeenCalledWith({
			userId: 3,
			targetCommentId: 22,
			kind: "filter_comment",
		});
	});

	it("supports legacy removed-state wrappers", async () => {
		const submissionSelect = createSelectChain([{ stateMod: "VISIBLE" }]);
		const commentSelect = createSelectChain([{ stateMod: "REMOVED" }]);
		const submissionUpdate = createUpdateChain();
		const commentUpdate = createUpdateChain();
		const insertChain = createInsertChain();
		const tx = {
			select: vi
				.fn()
				.mockReturnValueOnce(submissionSelect)
				.mockReturnValueOnce(commentSelect),
			update: vi
				.fn()
				.mockReturnValueOnce(submissionUpdate)
				.mockReturnValueOnce(commentUpdate),
			insert: vi.fn(() => insertChain),
		};

		await setSubmissionRemovedState(
			{
				submissionId: 1,
				moderatorId: 2,
				moderatorName: "mod",
				removed: true,
			},
			tx as never,
		);
		await setCommentRemovedState(
			{
				commentId: 2,
				moderatorId: 2,
				moderatorName: "mod",
				removed: false,
			},
			tx as never,
		);

		expect(submissionUpdate.set).toHaveBeenCalledWith({
			stateMod: "REMOVED",
			stateModSetBy: "mod",
			stateReport: "RESOLVED",
		});
		expect(commentUpdate.set).toHaveBeenCalledWith({
			stateMod: "VISIBLE",
			stateModSetBy: null,
			stateReport: "RESOLVED",
		});
	});

	it("sticks and saves submissions", async () => {
		const stickyUpdateChain = createUpdateChain();
		const modInsertChain = createInsertChain();
		const saveInsertChain = createInsertChain();
		const saveDeleteChain = createDeleteChain();
		const tx = {
			update: vi.fn(() => stickyUpdateChain),
			insert: vi
				.fn()
				.mockReturnValueOnce(modInsertChain)
				.mockReturnValueOnce(saveInsertChain),
			delete: vi.fn(() => saveDeleteChain),
		};

		await setSubmissionStickyState(
			{
				submissionId: 1,
				moderatorId: 2,
				moderatorName: "mod",
				stickied: true,
			},
			tx as never,
		);
		await setSubmissionSavedState(
			{ submissionId: 1, userId: 9, saved: true },
			tx as never,
		);
		await setSubmissionSavedState(
			{ submissionId: 1, userId: 9, saved: false },
			tx as never,
		);

		expect(stickyUpdateChain.set).toHaveBeenCalledWith({
			stickied: "mod",
			stickiedUtc: expect.any(Number),
		});
		expect(saveInsertChain.values).toHaveBeenCalledWith({
			submissionId: 1,
			userId: 9,
		});
		expect(saveDeleteChain.where).toHaveBeenCalled();
	});

	it("saves and unsaves comments", async () => {
		const saveInsertChain = createInsertChain();
		const saveDeleteChain = createDeleteChain();
		const tx = {
			insert: vi.fn(() => saveInsertChain),
			delete: vi.fn(() => saveDeleteChain),
		};

		await setCommentSavedState(
			{ commentId: 5, userId: 4, saved: true },
			tx as never,
		);
		await setCommentSavedState(
			{ commentId: 5, userId: 4, saved: false },
			tx as never,
		);

		expect(saveInsertChain.values).toHaveBeenCalledWith({
			commentId: 5,
			userId: 4,
		});
		expect(saveDeleteChain.where).toHaveBeenCalled();
	});

	it("lets only an author toggle their own profile-post pin", async () => {
		const update = createUpdateChain();
		vi.mocked(db.update).mockReturnValueOnce(update as never);

		await expect(
			setSubmissionProfilePinnedState({
				submissionId: 8,
				authorId: 7,
				pinned: true,
			}),
		).resolves.toBe(true);
		expect(update.set).toHaveBeenCalledWith({ isPinned: true });
		expect(update.where).toHaveBeenCalled();
	});

	it("uses the OP marker and refuses to overwrite moderator comment pins", async () => {
		const opUpdate = createUpdateChain();
		const opTx = {
			select: vi.fn(() =>
				createSelectChain([
					{ commentAuthorId: 4, postAuthorId: 7, pinnedBy: null },
				]),
			),
			update: vi.fn(() => opUpdate),
		};
		const moderatorTx = {
			select: vi.fn(() =>
				createSelectChain([
					{ commentAuthorId: 4, postAuthorId: 7, pinnedBy: "moderator" },
				]),
			),
			update: vi.fn(),
		};
		vi.mocked(db.transaction)
			.mockImplementationOnce(async (fn) => fn(opTx as never) as never)
			.mockImplementationOnce(async (fn) => fn(moderatorTx as never) as never);

		await expect(
			setCommentOpPinnedState({ commentId: 3, postAuthorId: 7, pinned: true }),
		).resolves.toEqual({ ok: true, commentAuthorId: 4, changed: true });
		expect(opUpdate.set).toHaveBeenCalledWith({
			pinnedBy: "(OP)",
			isPinnedUtc: expect.any(Number),
		});
		await expect(
			setCommentOpPinnedState({ commentId: 3, postAuthorId: 7, pinned: false }),
		).resolves.toEqual({ ok: false, reason: "moderator_pin" });
		expect(moderatorTx.update).not.toHaveBeenCalled();
	});

	it("enforces author ownership and logs moderator NSFW changes", async () => {
		const authorUpdate = createUpdateChain([]);
		const moderatorUpdate = createUpdateChain();
		const logInsert = createInsertChain();
		vi.mocked(db.update).mockReturnValueOnce(authorUpdate as never);
		const moderatorTx = {
			update: vi.fn(() => moderatorUpdate),
			insert: vi.fn(() => logInsert),
		};
		vi.mocked(db.transaction).mockImplementationOnce(
			async (fn) => fn(moderatorTx as never) as never,
		);

		await expect(
			setCommentNsfwState({
				commentId: 4,
				actorId: 99,
				nsfw: true,
				moderator: false,
			}),
		).resolves.toBe(false);
		await expect(
			setCommentNsfwState({
				commentId: 4,
				actorId: 2,
				nsfw: true,
				moderator: true,
			}),
		).resolves.toBe(true);
		expect(moderatorUpdate.set).toHaveBeenCalledWith({ over18: true });
		expect(logInsert.values).toHaveBeenCalledWith({
			userId: 2,
			targetCommentId: 4,
			kind: "mark_comment_nsfw",
		});
	});
});
