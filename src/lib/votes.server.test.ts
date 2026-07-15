import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({
	db: {
		select: vi.fn(),
		insert: vi.fn(),
		update: vi.fn(),
		delete: vi.fn(),
	},
}));

import { db } from "@/db";
import {
	getCommentVote,
	voteOnComment,
	voteOnSubmission,
} from "@/lib/votes.server";

function createSelectLimitChain(result: unknown) {
	return {
		from: vi.fn(() => ({
			where: vi.fn(() => ({
				limit: vi.fn().mockResolvedValue(result),
			})),
		})),
	};
}

function createInsertChain() {
	return {
		values: vi.fn().mockResolvedValue(undefined),
	};
}

function createUpdateChain() {
	const where = vi.fn().mockResolvedValue(undefined);
	return {
		set: vi.fn(() => ({ where })),
	};
}

function createDeleteChain() {
	return {
		where: vi.fn().mockResolvedValue(undefined),
	};
}

describe("getCommentVote", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns the stored vote type", async () => {
		vi.mocked(db.select).mockReturnValueOnce(
			createSelectLimitChain([{ voteType: -1 }]) as never,
		);

		await expect(getCommentVote(1, 2)).resolves.toBe(-1);
	});

	it("returns 0 when the user has not voted", async () => {
		vi.mocked(db.select).mockReturnValueOnce(
			createSelectLimitChain([]) as never,
		);

		await expect(getCommentVote(1, 2)).resolves.toBe(0);
	});
});

describe("voteOnSubmission", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("inserts a new upvote and returns the recomputed score", async () => {
		const insertChain = createInsertChain();
		const counterUpdate = createUpdateChain();
		vi.mocked(db.select)
			.mockReturnValueOnce(createSelectLimitChain([{ id: 42 }]) as never)
			.mockReturnValueOnce(createSelectLimitChain([]) as never)
			.mockReturnValueOnce(
				createSelectLimitChain([{ upvotes: 5, downvotes: 2 }]) as never,
			);
		vi.mocked(db.insert).mockReturnValueOnce(insertChain as never);
		vi.mocked(db.update).mockReturnValueOnce(counterUpdate as never);

		await expect(voteOnSubmission(11, 42, 1)).resolves.toEqual({
			success: true,
			newScore: 3,
			userVote: 1,
		});

		expect(insertChain.values).toHaveBeenCalledWith({
			userId: 11,
			submissionId: 42,
			voteType: 1,
			createdDatetimez: expect.any(Date),
		});
		expect(counterUpdate.set).toHaveBeenCalled();
		expect(db.delete).not.toHaveBeenCalled();
	});

	it("toggles off when the same vote is cast again", async () => {
		const deleteChain = createDeleteChain();
		const counterUpdate = createUpdateChain();
		vi.mocked(db.select)
			.mockReturnValueOnce(createSelectLimitChain([{ id: 42 }]) as never)
			.mockReturnValueOnce(createSelectLimitChain([{ voteType: 1 }]) as never)
			.mockReturnValueOnce(
				createSelectLimitChain([{ upvotes: 4, downvotes: 2 }]) as never,
			);
		vi.mocked(db.delete).mockReturnValueOnce(deleteChain as never);
		vi.mocked(db.update).mockReturnValueOnce(counterUpdate as never);

		await expect(voteOnSubmission(11, 42, 1)).resolves.toEqual({
			success: true,
			newScore: 2,
			userVote: 0,
		});

		expect(deleteChain.where).toHaveBeenCalled();
		expect(db.insert).not.toHaveBeenCalled();
		expect(counterUpdate.set).toHaveBeenCalled();
	});

	it("switches an existing upvote to a downvote", async () => {
		const voteUpdate = createUpdateChain();
		const counterUpdate = createUpdateChain();
		vi.mocked(db.select)
			.mockReturnValueOnce(createSelectLimitChain([{ id: 42 }]) as never)
			.mockReturnValueOnce(createSelectLimitChain([{ voteType: 1 }]) as never)
			.mockReturnValueOnce(
				createSelectLimitChain([{ upvotes: 4, downvotes: 3 }]) as never,
			);
		vi.mocked(db.update)
			.mockReturnValueOnce(voteUpdate as never)
			.mockReturnValueOnce(counterUpdate as never);

		await expect(voteOnSubmission(11, 42, -1)).resolves.toEqual({
			success: true,
			newScore: 1,
			userVote: -1,
		});

		expect(voteUpdate.set).toHaveBeenCalledWith({ voteType: -1 });
		expect(counterUpdate.set).toHaveBeenCalled();
		expect(db.insert).not.toHaveBeenCalled();
		expect(db.delete).not.toHaveBeenCalled();
	});

	it("removing a nonexistent vote skips counter updates", async () => {
		const deleteChain = createDeleteChain();
		vi.mocked(db.select)
			.mockReturnValueOnce(createSelectLimitChain([{ id: 42 }]) as never)
			.mockReturnValueOnce(createSelectLimitChain([]) as never)
			.mockReturnValueOnce(
				createSelectLimitChain([{ upvotes: 0, downvotes: 0 }]) as never,
			);
		vi.mocked(db.delete).mockReturnValueOnce(deleteChain as never);

		await expect(voteOnSubmission(11, 42, 0)).resolves.toEqual({
			success: true,
			newScore: 0,
			userVote: 0,
		});

		expect(db.update).not.toHaveBeenCalled();
	});

	it("returns a failure result when the database errors", async () => {
		vi.mocked(db.select).mockImplementationOnce(() => {
			throw new Error("connection refused");
		});

		await expect(voteOnSubmission(11, 42, 1)).resolves.toEqual({
			success: false,
			newScore: 0,
			userVote: 0,
			error: "connection refused",
		});
	});

	it("rejects votes on drafts without writing vote or score state", async () => {
		vi.mocked(db.select).mockReturnValueOnce(
			createSelectLimitChain([]) as never,
		);

		await expect(voteOnSubmission(11, 42, 1)).resolves.toEqual({
			success: false,
			newScore: 0,
			userVote: 0,
			error: "This post is not available for voting",
		});
		expect(db.insert).not.toHaveBeenCalled();
		expect(db.update).not.toHaveBeenCalled();
		expect(db.delete).not.toHaveBeenCalled();
	});
});

describe("voteOnComment", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("inserts a new downvote and returns the recomputed score", async () => {
		const insertChain = createInsertChain();
		const counterUpdate = createUpdateChain();
		vi.mocked(db.select)
			.mockReturnValueOnce(createSelectLimitChain([]) as never)
			.mockReturnValueOnce(
				createSelectLimitChain([{ upvotes: 1, downvotes: 1 }]) as never,
			);
		vi.mocked(db.insert).mockReturnValueOnce(insertChain as never);
		vi.mocked(db.update).mockReturnValueOnce(counterUpdate as never);

		await expect(voteOnComment(7, 99, -1)).resolves.toEqual({
			success: true,
			newScore: 0,
			userVote: -1,
		});

		expect(insertChain.values).toHaveBeenCalledWith({
			userId: 7,
			commentId: 99,
			voteType: -1,
			createdDatetimez: expect.any(Date),
		});
	});

	it("toggles off when the same vote is cast again", async () => {
		const deleteChain = createDeleteChain();
		const counterUpdate = createUpdateChain();
		vi.mocked(db.select)
			.mockReturnValueOnce(createSelectLimitChain([{ voteType: -1 }]) as never)
			.mockReturnValueOnce(
				createSelectLimitChain([{ upvotes: 1, downvotes: 0 }]) as never,
			);
		vi.mocked(db.delete).mockReturnValueOnce(deleteChain as never);
		vi.mocked(db.update).mockReturnValueOnce(counterUpdate as never);

		await expect(voteOnComment(7, 99, -1)).resolves.toEqual({
			success: true,
			newScore: 1,
			userVote: 0,
		});

		expect(deleteChain.where).toHaveBeenCalled();
		expect(db.insert).not.toHaveBeenCalled();
	});

	it("treats a missing comment row as score 0", async () => {
		const insertChain = createInsertChain();
		const counterUpdate = createUpdateChain();
		vi.mocked(db.select)
			.mockReturnValueOnce(createSelectLimitChain([]) as never)
			.mockReturnValueOnce(createSelectLimitChain([]) as never);
		vi.mocked(db.insert).mockReturnValueOnce(insertChain as never);
		vi.mocked(db.update).mockReturnValueOnce(counterUpdate as never);

		await expect(voteOnComment(7, 12345, 1)).resolves.toEqual({
			success: true,
			newScore: 0,
			userVote: 1,
		});
	});

	it("returns a failure result with a fallback message for non-Error throws", async () => {
		vi.mocked(db.select).mockImplementationOnce(() => {
			throw "boom";
		});

		await expect(voteOnComment(7, 99, 1)).resolves.toEqual({
			success: false,
			newScore: 0,
			userVote: 0,
			error: "Failed to vote",
		});
	});
});
