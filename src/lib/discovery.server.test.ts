import { expect, it, vi } from "vitest";

vi.mock("@/db", async () => {
	const { createMockDb } = await import("@/test/mocks");
	return { db: createMockDb() };
});

vi.mock("@/lib/social.server", () => ({ getUserRelationship: vi.fn() }));

import { db } from "@/db";
import { getRandomPublicUsername } from "@/lib/users.server";
import { createQueryChain } from "@/test/mocks";

it("selects a random username through the public-profile query", async () => {
	const chain = createQueryChain([{ username: "public_user" }]);
	vi.mocked(db.select).mockReturnValue(chain as never);
	expect(await getRandomPublicUsername()).toBe("public_user");
	expect(chain.where).toHaveBeenCalledOnce();
	expect(chain.orderBy).toHaveBeenCalledOnce();
	expect(chain.limit).toHaveBeenCalledWith(1);
});
