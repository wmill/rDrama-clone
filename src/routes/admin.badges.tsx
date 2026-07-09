import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { type BadgeDef, listBadgeDefs } from "@/lib/admin.server";
import {
	createBadgeDefFn,
	grantBadgeFn,
	revokeBadgeFn,
} from "@/lib/award-actions.server";

const listBadgeDefsFn = createServerFn({ method: "GET" }).handler(async () => {
	return listBadgeDefs();
});

export const Route = createFileRoute("/admin/badges")({
	component: BadgesPage,
	loader: async () => {
		return listBadgeDefsFn();
	},
});

function BadgesPage() {
	const initialDefs = Route.useLoaderData();
	const [defs, setDefs] = useState<BadgeDef[]>(initialDefs);

	return (
		<div className="space-y-4">
			<CreateBadgeCard onCreated={(def) => setDefs((prev) => [...prev, def])} />
			<GrantBadgeCard defs={defs} />
			<div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl">
				<h3 className="mb-3 text-base font-semibold text-white">
					Defined Badges ({defs.length})
				</h3>
				{defs.length === 0 ? (
					<p className="text-sm text-slate-400">No badges defined yet.</p>
				) : (
					<div className="space-y-2">
						{defs.map((def) => (
							<div
								key={def.id}
								className="flex flex-wrap items-baseline gap-3 rounded-lg border border-slate-800 bg-slate-950/50 px-4 py-2"
							>
								<span className="font-mono text-xs text-slate-500">
									#{def.id}
								</span>
								<span className="text-sm font-medium text-white">
									{def.name}
								</span>
								{def.description && (
									<span className="text-sm text-slate-400">
										{def.description}
									</span>
								)}
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
}

function CreateBadgeCard({
	onCreated,
}: {
	onCreated: (def: BadgeDef) => void;
}) {
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [isPending, setIsPending] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsPending(true);
		setError(null);
		try {
			const res = await createBadgeDefFn({ data: { name, description } });
			if (res.success) {
				onCreated(res.badgeDef);
				setName("");
				setDescription("");
			} else {
				setError(res.error);
			}
		} finally {
			setIsPending(false);
		}
	};

	return (
		<div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl">
			<h3 className="mb-3 text-base font-semibold text-white">
				Define a Badge
			</h3>
			<form onSubmit={handleSubmit} className="flex flex-wrap gap-3">
				<Input
					value={name}
					onChange={(e) => setName(e.target.value)}
					placeholder="Badge name"
					maxLength={50}
					required
					className="max-w-xs border-slate-700 bg-slate-800 text-white placeholder:text-slate-500"
				/>
				<Input
					value={description}
					onChange={(e) => setDescription(e.target.value)}
					placeholder="Description (optional)"
					maxLength={200}
					className="max-w-md border-slate-700 bg-slate-800 text-white placeholder:text-slate-500"
				/>
				<Button
					type="submit"
					disabled={isPending || !name.trim()}
					className="shrink-0 bg-cyan-500 hover:bg-cyan-600"
				>
					Create Badge
				</Button>
			</form>
			{error && <p className="mt-2 text-xs text-red-400">{error}</p>}
		</div>
	);
}

function GrantBadgeCard({ defs }: { defs: BadgeDef[] }) {
	const [username, setUsername] = useState("");
	const [badgeId, setBadgeId] = useState<string>("");
	const [isPending, setIsPending] = useState(false);
	const [message, setMessage] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	const act = async (action: "grant" | "revoke") => {
		const id = Number(badgeId);
		if (!Number.isInteger(id) || !username.trim()) return;
		setIsPending(true);
		setMessage(null);
		setError(null);
		try {
			const fn = action === "grant" ? grantBadgeFn : revokeBadgeFn;
			const res = await fn({
				data: { username: username.trim(), badgeId: id },
			});
			if (res.success) {
				setMessage(
					action === "grant"
						? `Badge granted to ${username.trim()}.`
						: `Badge revoked from ${username.trim()}.`,
				);
			} else {
				setError(res.error);
			}
		} finally {
			setIsPending(false);
		}
	};

	return (
		<div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl">
			<h3 className="mb-3 text-base font-semibold text-white">
				Grant / Revoke a Badge
			</h3>
			<div className="flex flex-wrap gap-3">
				<Input
					value={username}
					onChange={(e) => setUsername(e.target.value)}
					placeholder="Username"
					className="max-w-xs border-slate-700 bg-slate-800 text-white placeholder:text-slate-500"
				/>
				<select
					value={badgeId}
					onChange={(e) => setBadgeId(e.target.value)}
					className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-sm text-white"
				>
					<option value="">Select a badge...</option>
					{defs.map((def) => (
						<option key={def.id} value={String(def.id)}>
							{def.name}
						</option>
					))}
				</select>
				<Button
					type="button"
					disabled={isPending || !badgeId || !username.trim()}
					onClick={() => act("grant")}
					className="shrink-0 bg-cyan-500 hover:bg-cyan-600"
				>
					Grant
				</Button>
				<Button
					type="button"
					variant="outline"
					disabled={isPending || !badgeId || !username.trim()}
					onClick={() => act("revoke")}
					className="shrink-0 border-red-600 text-red-400 hover:bg-red-900/30"
				>
					Revoke
				</Button>
			</div>
			{message && <p className="mt-2 text-xs text-emerald-400">{message}</p>}
			{error && <p className="mt-2 text-xs text-red-400">{error}</p>}
		</div>
	);
}
