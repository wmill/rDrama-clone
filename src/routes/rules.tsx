import { createFileRoute } from "@tanstack/react-router";

import rulesHtml from "@/content/rules.html?raw";

export const Route = createFileRoute("/rules")({
	component: RulesPage,
	head: () => ({ meta: [{ title: "The Motte Rules" }] }),
});

export function RulesPage() {
	return (
		<main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-4 py-8">
			<article
				className="prose prose-invert mx-auto max-w-4xl rounded-xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl prose-headings:scroll-mt-6 prose-a:text-cyan-400"
				// biome-ignore lint/security/noDangerouslySetInnerHtml: bundled, trusted legacy TheMotte rules content
				dangerouslySetInnerHTML={{ __html: rulesHtml }}
			/>
		</main>
	);
}
