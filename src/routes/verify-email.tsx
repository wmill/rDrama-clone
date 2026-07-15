import { createFileRoute, Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { verifyEmailFn } from "@/lib/email-verification-actions.server";

export const Route = createFileRoute("/verify-email")({
	validateSearch: (search: Record<string, unknown>) => ({
		token: typeof search.token === "string" ? search.token : "",
	}),
	loaderDeps: ({ search }) => ({ token: search.token }),
	loader: ({ deps }) => verifyEmailFn({ data: { token: deps.token } }),
	component: VerifyEmailPage,
});

function VerifyEmailPage() {
	const result = Route.useLoaderData();
	return (
		<div className="mx-auto mt-16 max-w-lg rounded-xl border border-slate-800 bg-slate-900/80 p-8 text-center shadow-xl">
			<h1 className="text-2xl font-bold text-white">
				{result.success ? "Email verified" : "Verification failed"}
			</h1>
			<p
				className={`mt-3 ${result.success ? "text-emerald-300" : "text-red-300"}`}
			>
				{result.success ? `${result.email} is now verified.` : result.error}
			</p>
			<Button className="mt-6" asChild>
				<Link to="/me" search={{ blockedPage: 1 }}>
					Account settings
				</Link>
			</Button>
		</div>
	);
}
