import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({
	db: {},
}));

import {
	authorDeleteComment,
	authorDeleteSubmission,
	setCommentPinnedState,
	setCommentRemovedState,
	setCommentSavedState,
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

		await expect(authorDeleteSubmission(10, 20, tx as never)).resolves.toBe(true);
		await expect(authorDeleteComment(11, 21, tx as never)).resolves.toBe(true);
		expect(submissionUpdate.set).toHaveBeenCalled();
		expect(commentUpdate.set).toHaveBeenCalled();
	});

	it("logs submission moderation actions", async () => {
		const updateChain = createUpdateChain();
		const insertChain = createInsertChain();
		const tx = {
			update: vi.fn(() => updateChain),
			insert: vi.fn(() => insertChain),
		};

		const success = await setSubmissionRemovedState(
			{
				submissionId: 10,
				moderatorId: 2,
				moderatorName: "mod",
				removed: true,
			},
			tx as never,
		);

		expect(success).toBe(true);
		expect(updateChain.set).toHaveBeenCalledWith({
			stateMod: "REMOVED",
			stateModSetBy: "mod",
			stateReport: "RESOLVED",
		});
		expect(insertChain.values).toHaveBeenCalledWith({
			userId: 2,
			targetSubmissionId: 10,
			kind: "remove_post",
		});
	});

	it("logs comment moderation and pin actions", async () => {
		const removeUpdateChain = createUpdateChain();
		const pinUpdateChain = createUpdateChain();
		const insertChain = createInsertChain();
		const tx = {
			update: vi
				.fn()
				.mockReturnValueOnce(removeUpdateChain)
				.mockReturnValueOnce(pinUpdateChain),
			insert: vi.fn(() => insertChain),
		};

		await setCommentRemovedState(
			{
				commentId: 22,
				moderatorId: 3,
				moderatorName: "mod",
				removed: false,
				actionKind: "approve_comment",
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
			stateMod: "VISIBLE",
			stateModSetBy: null,
			stateReport: "RESOLVED",
		});
		expect(pinUpdateChain.set).toHaveBeenCalledWith({
			pinnedBy: "mod",
			isPinnedUtc: expect.any(Number),
		});
		expect(insertChain.values).toHaveBeenCalledWith({
			userId: 3,
			targetCommentId: 22,
			kind: "approve_comment",
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
});
