import { createServerFn } from "@tanstack/react-start";

import { getPublicStats } from "@/lib/transparency.server";

export const getPublicStatsFn = createServerFn({ method: "GET" }).handler(
	async () => getPublicStats(),
);
