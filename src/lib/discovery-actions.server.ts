import { createServerFn } from "@tanstack/react-start";

import { getRandomPublicUsername } from "@/lib/users.server";

export const getRandomUserFn = createServerFn({ method: "GET" }).handler(
	async () => getRandomPublicUsername(),
);
