import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { type BannedDomain, listBannedDomains } from "@/lib/admin.server";
import {
	addBannedDomainFn,
	removeBannedDomainFn,
} from "@/lib/admin-actions.server";
import { assertAdmin } from "@/lib/auth-guards.server";

export const listBannedDomainsFn = createServerFn({ method: "GET" }).handler(
	async () => {
		await assertAdmin();
		return listBannedDomains();
	},
);

export const Route = createFileRoute("/admin/banned-domains")({
	component: BannedDomainsPage,
	loader: async () => {
		return listBannedDomainsFn();
	},
});

function BannedDomainsPage() {
	const initialDomains = Route.useLoaderData();
	const [domains, setDomains] = useState<BannedDomain[]>(initialDomains);
	const [domainInput, setDomainInput] = useState("");
	const [reasonInput, setReasonInput] = useState("");
	const [isPending, setIsPending] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handleAdd = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsPending(true);
		setError(null);
		try {
			const res = await addBannedDomainFn({
				data: { domain: domainInput, reason: reasonInput },
			});
			if (res.success) {
				setDomains((prev) =>
					[
						...prev.filter((d) => d.domain !== res.domain),
						{ domain: res.domain, reason: res.reason },
					].sort((a, b) => a.domain.localeCompare(b.domain)),
				);
				setDomainInput("");
				setReasonInput("");
			} else {
				setError(res.error);
			}
		} finally {
			setIsPending(false);
		}
	};

	const handleRemove = async (domain: string) => {
		setIsPending(true);
		setError(null);
		try {
			const res = await removeBannedDomainFn({ data: { domain } });
			if (res.success) {
				setDomains((prev) => prev.filter((d) => d.domain !== domain));
			} else {
				setError(res.error);
			}
		} finally {
			setIsPending(false);
		}
	};

	return (
		<div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl">
			<h2 className="mb-1 text-lg font-semibold text-white">Banned Domains</h2>
			<p className="mb-4 text-sm text-slate-400">
				Link posts to these domains (and their subdomains) are rejected with the
				stored reason.
			</p>

			<form onSubmit={handleAdd} className="mb-6 flex flex-wrap gap-3">
				<Input
					value={domainInput}
					onChange={(e) => setDomainInput(e.target.value)}
					placeholder="example.com"
					required
					className="max-w-xs border-slate-700 bg-slate-800 text-white placeholder:text-slate-500"
				/>
				<Input
					value={reasonInput}
					onChange={(e) => setReasonInput(e.target.value)}
					placeholder="Reason (shown to users)"
					required
					className="max-w-md border-slate-700 bg-slate-800 text-white placeholder:text-slate-500"
				/>
				<Button
					type="submit"
					disabled={isPending || !domainInput.trim() || !reasonInput.trim()}
					className="shrink-0 bg-cyan-500 hover:bg-cyan-600"
				>
					Ban Domain
				</Button>
			</form>

			{error && <p className="mb-4 text-sm text-red-400">{error}</p>}

			{domains.length === 0 ? (
				<p className="text-slate-400">No banned domains.</p>
			) : (
				<div className="space-y-2">
					{domains.map((entry) => (
						<div
							key={entry.domain}
							className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-800 bg-slate-950/50 px-4 py-2"
						>
							<span className="font-mono text-sm text-white">
								{entry.domain}
							</span>
							<span className="text-sm text-slate-400">{entry.reason}</span>
							<Button
								size="sm"
								variant="outline"
								disabled={isPending}
								onClick={() => handleRemove(entry.domain)}
								className="ml-auto border-emerald-600 text-emerald-400 hover:bg-emerald-900/30"
							>
								Unban
							</Button>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
