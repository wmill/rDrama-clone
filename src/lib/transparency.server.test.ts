import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db", async () => {
	const { createMockDb } = await import("@/test/mocks");
	return { db: createMockDb() };
});

import { db } from "@/db";
import {
	listPublicAdmins,
	listPublicBannedUsers,
	listPublicModActions,
	PUBLIC_MOD_ACTION_KINDS,
	TRANSPARENCY_PAGE_SIZE,
} from "@/lib/transparency.server";
import { createQueryChain } from "@/test/mocks";

describe("public transparency", () => {
	beforeEach(() => vi.clearAllMocks());

	it("uses a positive, privacy-reviewed moderation allowlist", () => {
		expect(PUBLIC_MOD_ACTION_KINDS).toEqual(["ban_user", "unban_user"]);
		expect(PUBLIC_MOD_ACTION_KINDS).not.toContain("shadowban");
		expect(PUBLIC_MOD_ACTION_KINDS).not.toContain("link_alt");
	});

	it("returns a redacted moderation shape and paginates", async () => {
		const rows = Array.from(
			{ length: TRANSPARENCY_PAGE_SIZE + 1 },
			(_, id) => ({
				id,
				kind: "ban_user",
				createdDatetimez: new Date(0),
				actorId: 1,
				actorName: "mod",
				targetId: id + 10,
				targetName: `user${id}`,
				note: "must never escape",
				email: "private@example.com",
			}),
		);
		const chain = createQueryChain(rows);
		vi.mocked(db.select).mockReturnValue(chain as never);

		const result = await listPublicModActions(2);
		expect(result).toMatchObject({ page: 2, hasMore: true });
		expect(result.entries).toHaveLength(TRANSPARENCY_PAGE_SIZE);
		expect(result.entries[0]).toEqual({
			id: 0,
			kind: "ban_user",
			createdDatetimez: new Date(0),
			actor: { id: 1, username: "mod" },
			target: { type: "user", id: 10, username: "user0" },
		});
		expect(chain.limit).toHaveBeenCalledWith(TRANSPARENCY_PAGE_SIZE + 1);
		expect(chain.offset).toHaveBeenCalledWith(TRANSPARENCY_PAGE_SIZE);
	});

	it("paginates public admin and banned-user projections", async () => {
		const adminChain = createQueryChain([
			{ id: 1, username: "admin", adminLevel: 2 },
		]);
		const bannedChain = createQueryChain([{ id: 2, username: "banned" }]);
		vi.mocked(db.select)
			.mockReturnValueOnce(adminChain as never)
			.mockReturnValueOnce(bannedChain as never);
		expect((await listPublicAdmins(1)).entries[0]).toEqual({
			id: 1,
			username: "admin",
			adminLevel: 2,
		});
		expect((await listPublicBannedUsers(1)).entries[0]).toEqual({
			id: 2,
			username: "banned",
		});
	});
});
