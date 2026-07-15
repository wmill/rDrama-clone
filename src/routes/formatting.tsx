import { createFileRoute } from "@tanstack/react-router";

import { FORMATTING_EXAMPLES } from "@/lib/community-content";
import { renderCommentMarkdown } from "@/lib/markdown";

export const Route = createFileRoute("/formatting")({
	component: FormattingPage,
	head: () => ({ meta: [{ title: "Markdown Formatting" }] }),
});

export function FormattingPage() {
	return (
		<main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-4 py-8">
			<div className="mx-auto max-w-5xl">
				<h1 className="text-3xl font-bold text-white">Markdown formatting</h1>
				<p className="mt-2 text-slate-300">
					Posts, comments, profiles, and titles support Markdown. Raw HTML is
					displayed as text for safety.
				</p>
				<div className="mt-6 overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/80 shadow-xl">
					<table className="w-full min-w-[720px] text-left text-sm">
						<thead className="bg-slate-800 text-slate-200">
							<tr>
								<th className="p-3">Feature</th>
								<th className="p-3">What you type</th>
								<th className="p-3">What is displayed</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-slate-800">
							{FORMATTING_EXAMPLES.map((example) => (
								<tr key={example.name} className="align-top">
									<td className="p-3 text-slate-200">
										<p className="font-semibold">{example.name}</p>
										<p className="mt-1 text-xs text-slate-400">
											{example.description}
										</p>
									</td>
									<td className="p-3">
										<pre className="whitespace-pre-wrap rounded bg-slate-950 p-3 text-xs text-cyan-200">
											{example.markdown}
										</pre>
									</td>
									<td className="p-3">
										<div
											className="prose prose-invert prose-sm max-w-none text-slate-300"
											// biome-ignore lint/security/noDangerouslySetInnerHtml: production markdown renderer uses html:false
											dangerouslySetInnerHTML={{
												__html: renderCommentMarkdown(example.markdown),
											}}
										/>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</div>
		</main>
	);
}
