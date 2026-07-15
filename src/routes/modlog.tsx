import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";

const searchSchema = z.object({
	page: z.coerce.number().int().min(1).default(1),
});
export const Route = createFileRoute("/modlog")({
	validateSearch: searchSchema,
	loaderDeps: ({ search }) => search,
	loader: ({ deps }) => {
		throw redirect({
			to: "/mod-log",
			search: { page: deps.page },
			statusCode: 301,
		});
	},
});
