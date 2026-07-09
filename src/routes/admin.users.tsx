import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { type AdminUserSearchResult, searchUsers } from "@/lib/admin.server";
import {
	banUserFn,
	shadowbanUserFn,
	unbanUserFn,
	unshadowbanUserFn,
} from "@/lib/admin-actions.server";

const searchUsersFn = createServerFn({ method: "GET" })
	.inputValidator((data: { query: string }) => data)
	.handler(async ({ data }) => {
		return searchUsers(data.query);
	});

export const Route = createFileRoute("/admin/users")({
	component: AdminUsersPage,
});

function AdminUsersPage() {
	const [query, setQuery] = useState("");
	const [results, setResults] = useState<AdminUserSearchResult[]>([]);
	const [isSearching, setIsSearching] = useState(false);

	const handleSearch = async (e: React.FormEvent) => {
		e.preventDefault();
		const q = query.trim();
		if (!q) return;
		setIsSearching(true);
		try {
			const res = await searchUsersFn({ data: { query: q } });
			setResults(res);
		} finally {
			setIsSearching(false);
		}
	};

	return (
		<div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl">
			<h2 className="mb-4 text-lg font-semibold text-white">User Search</h2>
			<form onSubmit={handleSearch} className="mb-6 flex gap-3">
				<Input
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					placeholder="Search by username..."
					className="border-slate-700 bg-slate-800 text-white placeholder:text-slate-500"
				/>
				<Button
					type="submit"
					disabled={isSearching}
					className="shrink-0 bg-cyan-500 hover:bg-cyan-600"
				>
					{isSearching ? "Searching..." : "Search"}
				</Button>
			</form>

			{results.length === 0 && !isSearching && query && (
				<p className="text-slate-400">No users found.</p>
			)}

			<div className="space-y-3">
				{results.map((user) => (
					<UserRow key={user.id} initialUser={user} />
				))}
			</div>
		</div>
	);
}

function UserRow({ initialUser }: { initialUser: AdminUserSearchResult }) {
	const [isBanned, setIsBanned] = useState(initialUser.isBanned > 0);
	const [isShadowBanned, setIsShadowBanned] = useState(
		!!initialUser.shadowBanned,
	);
	const [showBanForm, setShowBanForm] = useState(false);
	const [banReason, setBanReason] = useState("");
	const [isPending, setIsPending] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handleBanSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsPending(true);
		setError(null);
		try {
			const res = await banUserFn({
				data: { userId: initialUser.id, reason: banReason },
			});
			if (res.success) {
				setIsBanned(true);
				setShowBanForm(false);
				setBanReason("");
			} else {
				setError(res.error);
			}
		} finally {
			setIsPending(false);
		}
	};

	const handleUnban = async () => {
		setIsPending(true);
		setError(null);
		try {
			const res = await unbanUserFn({ data: { userId: initialUser.id } });
			if (res.success) {
				setIsBanned(false);
			} else {
				setError(res.error);
			}
		} finally {
			setIsPending(false);
		}
	};

	const handleShadowban = async () => {
		setIsPending(true);
		setError(null);
		try {
			const res = await shadowbanUserFn({
				data: { userId: initialUser.id },
			});
			if (res.success) {
				setIsShadowBanned(true);
			} else {
				setError(res.error);
			}
		} finally {
			setIsPending(false);
		}
	};

	const handleUnshadowban = async () => {
		setIsPending(true);
		setError(null);
		try {
			const res = await unshadowbanUserFn({
				data: { userId: initialUser.id },
			});
			if (res.success) {
				setIsShadowBanned(false);
			} else {
				setError(res.error);
			}
		} finally {
			setIsPending(false);
		}
	};

	return (
		<div className="rounded-lg border border-slate-800 bg-slate-950/50 p-4">
			<div className="flex flex-wrap items-center gap-3">
				<Link
					to="/u/$username"
					params={{ username: initialUser.username }}
					search={{ sort: "new", t: "all", page: 1 }}
					className="font-semibold text-cyan-400 hover:underline"
				>
					{initialUser.username}
				</Link>

				<Link
					to="/admin/users/$id"
					params={{ id: String(initialUser.id) }}
					className="text-xs text-slate-400 underline hover:text-slate-200"
				>
					Investigate
				</Link>

				{initialUser.adminLevel > 0 && (
					<span className="rounded bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-400">
						Admin L{initialUser.adminLevel}
					</span>
				)}

				{isBanned && (
					<span className="rounded bg-red-500/20 px-2 py-0.5 text-xs text-red-400">
						Banned
					</span>
				)}

				{isShadowBanned && (
					<span className="rounded bg-amber-500/20 px-2 py-0.5 text-xs text-amber-400">
						Shadowbanned
					</span>
				)}

				<div className="ml-auto flex gap-2">
					{isBanned ? (
						<Button
							size="sm"
							variant="outline"
							disabled={isPending}
							onClick={handleUnban}
							className="border-emerald-600 text-emerald-400 hover:bg-emerald-900/30"
						>
							Unban
						</Button>
					) : (
						<Button
							size="sm"
							variant="outline"
							disabled={isPending}
							onClick={() => setShowBanForm((v) => !v)}
							className="border-red-600 text-red-400 hover:bg-red-900/30"
						>
							{showBanForm ? "Cancel" : "Ban"}
						</Button>
					)}

					{isShadowBanned ? (
						<Button
							size="sm"
							variant="outline"
							disabled={isPending}
							onClick={handleUnshadowban}
							className="border-emerald-600 text-emerald-400 hover:bg-emerald-900/30"
						>
							Unshadowban
						</Button>
					) : (
						<Button
							size="sm"
							variant="outline"
							disabled={isPending}
							onClick={handleShadowban}
							className="border-amber-600 text-amber-400 hover:bg-amber-900/30"
						>
							Shadowban
						</Button>
					)}
				</div>
			</div>

			{showBanForm && (
				<form
					onSubmit={handleBanSubmit}
					className="mt-3 flex gap-2 border-t border-slate-800 pt-3"
				>
					<Input
						value={banReason}
						onChange={(e) => setBanReason(e.target.value)}
						placeholder="Ban reason (required)"
						required
						className="border-slate-700 bg-slate-800 text-white placeholder:text-slate-500"
					/>
					<Button
						type="submit"
						disabled={isPending || !banReason.trim()}
						className="shrink-0 bg-red-600 hover:bg-red-700"
					>
						Confirm Ban
					</Button>
				</form>
			)}

			{error && <p className="mt-2 text-xs text-red-400">{error}</p>}
		</div>
	);
}
