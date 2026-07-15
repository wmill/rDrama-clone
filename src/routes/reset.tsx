import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";

const searchSchema = z.object({ token: z.string().min(1).max(512) });
export const Route = createFileRoute("/reset")({
	validateSearch: (search: Record<string, unknown>) =>
		searchSchema.parse(search),
	loaderDeps: ({ search }) => search,
	loader: ({ deps }) => {
		throw redirect({
			to: "/reset-password",
			search: { token: deps.token },
			statusCode: 301,
		});
	},
});
