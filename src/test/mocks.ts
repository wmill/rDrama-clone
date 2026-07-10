import { vi } from "vitest";

import type { SafeUser } from "@/lib/auth.server";

/**
 * Shared test-mock helpers. Import inside async `vi.mock` factories:
 *
 *   vi.mock("@/db", async () => {
 *     const { createMockDb } = await import("@/test/mocks");
 *     return { db: createMockDb() };
 *   });
 *
 *   vi.mock("@tanstack/react-start", async () =>
 *     (await import("@/test/mocks")).createServerFnStub(),
 *   );
 *
 * Query results come from `createQueryChain(result)` handed to
 * `vi.mocked(db.select).mockReturnValueOnce(chain as never)`.
 */

const CHAIN_METHODS = [
	"from",
	"innerJoin",
	"leftJoin",
	"where",
	"orderBy",
	"groupBy",
	"limit",
	"offset",
	"values",
	"set",
	"returning",
	"onConflictDoNothing",
	"onConflictDoUpdate",
] as const;

export type QueryChain = Record<
	(typeof CHAIN_METHODS)[number],
	ReturnType<typeof vi.fn>
> & {
	then: (
		resolve: (value: unknown) => unknown,
		reject?: (reason: unknown) => unknown,
	) => Promise<unknown>;
};

/**
 * Chainable drizzle query-builder mock: every builder method is a vi.fn
 * returning the chain, and awaiting the chain at any point resolves to
 * `result`. Assert on individual methods, e.g.
 * `expect(chain.limit).toHaveBeenCalledWith(26)`.
 */
export function createQueryChain(result: unknown = []): QueryChain {
	const chain = {} as QueryChain;
	for (const method of CHAIN_METHODS) {
		chain[method] = vi.fn(() => chain);
	}
	// biome-ignore lint/suspicious/noThenProperty: the chain is deliberately thenable so `await db.select()...` resolves at any depth
	chain.then = (resolve, reject) =>
		Promise.resolve(result).then(resolve, reject);
	return chain;
}

/** The `db` object for `vi.mock("@/db", ...)`. */
export function createMockDb() {
	return {
		select: vi.fn(),
		insert: vi.fn(),
		update: vi.fn(),
		delete: vi.fn(),
		transaction: vi.fn(),
		execute: vi.fn(),
	};
}

/**
 * Module stub for `vi.mock("@tanstack/react-start", ...)`: `createServerFn`
 * returns a chain whose `.handler(fn)` yields the bare handler, so tests
 * call server fns as `fn({ data })`. Input validators are bypassed — test
 * exported zod schemas separately.
 */
export function createServerFnStub() {
	return {
		createServerFn: () => {
			const chain = {
				inputValidator: () => chain,
				handler: (handler: unknown) => handler,
			};
			return chain;
		},
	};
}

/** Module stub for `vi.mock("@/lib/sessions.server", ...)`. */
export function createSessionsMock() {
	return { getCurrentUser: vi.fn() };
}

/** A complete SafeUser fixture; override the fields a test cares about. */
export function makeSafeUser(overrides: Partial<SafeUser> = {}): SafeUser {
	return {
		id: 1,
		username: "testuser",
		email: "testuser@example.com",
		adminLevel: 0,
		createdUtc: 0,
		isActivated: true,
		isBanned: 0,
		banReason: null,
		unbanUtc: 0,
		shadowBanned: null,
		coins: 0,
		proCoins: 0,
		profileUrl: null,
		bannerUrl: null,
		bio: null,
		customTitle: null,
		...overrides,
	};
}
