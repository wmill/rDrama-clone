import { createFileRoute, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

import { getRandomSubmissionId } from "@/lib/submissions.server";

const getRandomPostFn = createServerFn({ method: "GET" }).handler(async () => {
	return getRandomSubmissionId();
});

export const Route = createFileRoute("/random_post")({
	loader: async () => {
		const postId = await getRandomPostFn();
		if (postId) {
			throw redirect({ to: `/post/${postId}` as "/" });
		}
		throw redirect({ to: "/" });
	},
	component: () => null,
});
