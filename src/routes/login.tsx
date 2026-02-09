import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useId, useState } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authenticateUser } from "@/lib/auth.server";
import {
	createSession,
	getCurrentUser,
	getRequestInfo,
	setSessionCookie,
} from "@/lib/sessions.server";

const loginSchema = z.object({
	usernameOrEmail: z.string().min(1, "Username or email is required"),
	password: z.string().min(1, "Password is required"),
});

type LoginInput = z.infer<typeof loginSchema>;

const loginAction = createServerFn({ method: "POST" })
	.inputValidator((data: LoginInput) => loginSchema.parse(data))
	.handler(async ({ data }: { data: LoginInput }) => {
		const result = await authenticateUser(data.usernameOrEmail, data.password);

		if (!result.success) {
			return { success: false as const, error: result.error };
		}

		const { userAgent, ipAddress } = getRequestInfo();
		const sessionId = await createSession(result.user.id, userAgent, ipAddress);
		setSessionCookie(sessionId);

		return { success: true as const, user: result.user };
	});

const getCurrentUserFn = createServerFn({ method: "GET" }).handler(async () => {
	return getCurrentUser();
});

export const Route = createFileRoute("/login")({
	component: LoginPage,
	loader: async () => {
		const user = await getCurrentUserFn();
		return { user };
	},
});

function LoginPage() {
	const router = useRouter();
	const { user } = Route.useLoaderData();
	const [usernameOrEmail, setUsernameOrEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const usernameOrEmailId = useId();
	const passwordId = useId();

	if (user) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 p-4">
				<div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900/80 p-8 shadow-xl">
					<h1 className="mb-4 text-2xl font-bold text-white">
						Already logged in
					</h1>
					<p className="mb-6 text-slate-400">
						You are logged in as{" "}
						<span className="font-semibold text-cyan-400">{user.username}</span>
					</p>
					<div className="flex gap-4">
						<Button asChild>
							<Link to="/" search={{ sort: "hot", t: "all" }}>
								Go Home
							</Link>
						</Button>
						<Button variant="outline" asChild>
							<Link to="/logout">Log out</Link>
						</Button>
					</div>
				</div>
			</div>
		);
	}

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);
		setIsLoading(true);

		try {
			const result = await loginAction({
				data: { usernameOrEmail, password },
			});

			if (!result.success) {
				setError(result.error);
				return;
			}

			router.invalidate();
			router.navigate({ to: "/" });
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "An unexpected error occurred",
			);
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 p-4">
			<div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900/80 p-8 shadow-xl">
				<div className="mb-8 text-center">
					<h1 className="text-3xl font-bold text-white">Welcome back</h1>
					<p className="mt-2 text-slate-400">
						Sign in to your account to continue
					</p>
				</div>

				<form onSubmit={handleSubmit} className="space-y-6">
					{error && (
						<div className="rounded-lg border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-400">
							{error}
						</div>
					)}

					<div className="space-y-2">
						<Label htmlFor={usernameOrEmailId} className="text-slate-300">
							Username or Email
						</Label>
						<Input
							id={usernameOrEmailId}
							type="text"
							value={usernameOrEmail}
							onChange={(e) => setUsernameOrEmail(e.target.value)}
							placeholder="Enter your username or email"
							required
							className="border-slate-700 bg-slate-800 text-white placeholder:text-slate-500"
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor={passwordId} className="text-slate-300">
							Password
						</Label>
						<Input
							id={passwordId}
							type="password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							placeholder="Enter your password"
							required
							className="border-slate-700 bg-slate-800 text-white placeholder:text-slate-500"
						/>
					</div>

					<div className="flex items-center justify-between">
						{/* TODO: Implement forgot password route in Phase 1 */}
						<span className="text-sm text-slate-500 cursor-not-allowed">
							Forgot password?
						</span>
					</div>

					<Button
						type="submit"
						disabled={isLoading}
						className="w-full bg-cyan-500 hover:bg-cyan-600"
					>
						{isLoading ? "Signing in..." : "Sign in"}
					</Button>
				</form>

				<p className="mt-6 text-center text-sm text-slate-400">
					Don't have an account?{" "}
					<Link to="/signup" className="text-cyan-400 hover:text-cyan-300">
						Sign up
					</Link>
				</p>
			</div>
		</div>
	);
}
