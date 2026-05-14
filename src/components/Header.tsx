import { Link, useNavigate } from "@tanstack/react-router";
import { Bell, Home, Menu, Shield, X } from "lucide-react";
import { type FormEvent, useState } from "react";

import { AuthButton } from "@/components/auth-button";
import type { SafeUser } from "@/lib/auth.server";

export default function Header({
	user,
	unreadNotificationCount,
}: {
	user: SafeUser | null;
	unreadNotificationCount: number;
}) {
	const [isOpen, setIsOpen] = useState(false);
	const [query, setQuery] = useState("");
	const navigate = useNavigate();

	const handleSearchSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		await navigate({
			to: "/search",
			search: {
				q: query.trim(),
				type: "posts",
				page: 1,
			},
		});
	};

	return (
		<>
			<header className="flex flex-wrap items-center gap-3 bg-gray-800 p-4 text-white shadow-lg">
				<button
					onClick={() => setIsOpen(true)}
					className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
					aria-label="Open menu"
					type="button"
				>
					<Menu size={24} />
				</button>
				<h1 className="ml-4 text-xl font-semibold">
					<Link to="/" search={{ sort: "hot", t: "all" }}>
						<img
							src="/tanstack-word-logo-white.svg"
							alt="TanStack Logo"
							className="h-10"
						/>
					</Link>
				</h1>
				<form
					onSubmit={handleSearchSubmit}
					className="order-3 w-full sm:order-none sm:ml-6 sm:max-w-md sm:flex-1"
				>
					<div className="flex gap-2">
						<input
							type="search"
							name="q"
							value={query}
							onChange={(event) => setQuery(event.target.value)}
							placeholder="Search posts and comments"
							aria-label="Search"
							className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-400"
						/>
						<button
							type="submit"
							className="rounded-lg bg-cyan-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-cyan-600"
						>
							Search
						</button>
					</div>
				</form>
				<div className="ml-auto">
					<AuthButton />
				</div>
			</header>

			<aside
				className={`fixed top-0 left-0 h-full w-80 bg-gray-900 text-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out flex flex-col ${
					isOpen ? "translate-x-0" : "-translate-x-full"
				}`}
			>
				<div className="flex items-center justify-between p-4 border-b border-gray-700">
					<h2 className="text-xl font-bold">Navigation</h2>
					<button
						onClick={() => setIsOpen(false)}
						className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
						aria-label="Close menu"
						type="button"
					>
						<X size={24} />
					</button>
				</div>

				<nav className="flex-1 p-4 overflow-y-auto">
					<Link
						to="/"
						search={{ sort: "hot", t: "all" }}
						onClick={() => setIsOpen(false)}
						className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-800 transition-colors mb-2"
						activeProps={{
							className:
								"flex items-center gap-3 p-3 rounded-lg bg-cyan-600 hover:bg-cyan-700 transition-colors mb-2",
						}}
					>
						<Home size={20} />
						<span className="font-medium">Home</span>
					</Link>

					{user && (
						<Link
							to="/notifications"
							search={{ page: 1 }}
							onClick={() => setIsOpen(false)}
							className="flex items-center justify-between gap-3 p-3 rounded-lg hover:bg-gray-800 transition-colors mb-2"
							activeProps={{
								className:
									"flex items-center justify-between gap-3 p-3 rounded-lg bg-cyan-600 hover:bg-cyan-700 transition-colors mb-2",
							}}
						>
							<div className="flex items-center gap-3">
								<Bell size={20} />
								<span className="font-medium">Notifications</span>
							</div>
							{unreadNotificationCount > 0 && (
								<span className="min-w-6 rounded-full bg-rose-500 px-2 py-0.5 text-center text-xs font-semibold text-white">
									{unreadNotificationCount}
								</span>
							)}
						</Link>
					)}

					{user && user.adminLevel >= 2 && (
						<Link
							to="/admin"
							onClick={() => setIsOpen(false)}
							className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-800 transition-colors mb-2"
							activeProps={{
								className:
									"flex items-center gap-3 p-3 rounded-lg bg-cyan-600 hover:bg-cyan-700 transition-colors mb-2",
							}}
						>
							<Shield size={20} />
							<span className="font-medium">Admin</span>
						</Link>
					)}
				</nav>
			</aside>
		</>
	);
}
