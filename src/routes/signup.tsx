import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useId, useState } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createUser } from "@/lib/auth.server";
import {
	createSession,
	getCurrentUser,
	getRequestInfo,
	setSessionCookie,
} from "@/lib/sessions.server";

const signupSchema = z
	.object({
		username: z
			.string()
			.min(3, "Username must be at least 3 characters")
			.max(25, "Username must be at most 25 characters")
			.regex(
				/^[a-zA-Z0-9_]+$/,
				"Username can only contain letters, numbers, and underscores",
			),
		email: z.string().email("Please enter a valid email address"),
		password: z.string().min(8, "Password must be at least 8 characters"),
		confirmPassword: z.string(),
	})
	.refine((data) => data.password === data.confirmPassword, {
		message: "Passwords do not match",
		path: ["confirmPassword"],
	});

type SignupInput = z.infer<typeof signupSchema>;

const signupAction = createServerFn({ method: "POST" })
	.inputValidator((data: SignupInput) => signupSchema.parse(data))
	.handler(async ({ data }: { data: SignupInput }) => {
		const result = await createUser(data.username, data.email, data.password);

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

export const Route = createFileRoute("/signup")({
	component: SignupPage,
	loader: async () => {
		const user = await getCurrentUserFn();
		return { user };
	},
});

function SignupPage() {
	const router = useRouter();
	const { user } = Route.useLoaderData();
	const [username, setUsername] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
	const [isLoading, setIsLoading] = useState(false);
	const usernameId = useId();
	const emailId = useId();
	const passwordId = useId();
	const confirmPasswordId = useId();

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
							<Link to="/">Go Home</Link>
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
		setFieldErrors({});
		setIsLoading(true);

		try {
			const validation = signupSchema.safeParse({
				username,
				email,
				password,
				confirmPassword,
			});

			if (!validation.success) {
				const errors: Record<string, string> = {};
				for (const issue of validation.error.issues) {
					const path = issue.path[0];
					if (path && typeof path === "string") {
						errors[path] = issue.message;
					}
				}
				setFieldErrors(errors);
				return;
			}

			const result = await signupAction({
				data: { username, email, password, confirmPassword },
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
					<h1 className="text-3xl font-bold text-white">Create an account</h1>
					<p className="mt-2 text-slate-400">Join the community today</p>
				</div>

				<form onSubmit={handleSubmit} className="space-y-6">
					{error && (
						<div className="rounded-lg border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-400">
							{error}
						</div>
					)}

					<div className="space-y-2">
						<Label htmlFor={usernameId} className="text-slate-300">
							Username
						</Label>
						<Input
							id={usernameId}
							type="text"
							value={username}
							onChange={(e) => setUsername(e.target.value)}
							placeholder="Choose a username"
							required
							className="border-slate-700 bg-slate-800 text-white placeholder:text-slate-500"
						/>
						{fieldErrors.username && (
							<p className="text-sm text-red-400">{fieldErrors.username}</p>
						)}
					</div>

					<div className="space-y-2">
						<Label htmlFor={emailId} className="text-slate-300">
							Email
						</Label>
						<Input
							id={emailId}
							type="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							placeholder="Enter your email"
							required
							className="border-slate-700 bg-slate-800 text-white placeholder:text-slate-500"
						/>
						{fieldErrors.email && (
							<p className="text-sm text-red-400">{fieldErrors.email}</p>
						)}
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
							placeholder="Create a password"
							required
							className="border-slate-700 bg-slate-800 text-white placeholder:text-slate-500"
						/>
						{fieldErrors.password && (
							<p className="text-sm text-red-400">{fieldErrors.password}</p>
						)}
					</div>

					<div className="space-y-2">
						<Label htmlFor={confirmPasswordId} className="text-slate-300">
							Confirm Password
						</Label>
						<Input
							id={confirmPasswordId}
							type="password"
							value={confirmPassword}
							onChange={(e) => setConfirmPassword(e.target.value)}
							placeholder="Confirm your password"
							required
							className="border-slate-700 bg-slate-800 text-white placeholder:text-slate-500"
						/>
						{fieldErrors.confirmPassword && (
							<p className="text-sm text-red-400">
								{fieldErrors.confirmPassword}
							</p>
						)}
					</div>

					<Button
						type="submit"
						disabled={isLoading}
						className="w-full bg-cyan-500 hover:bg-cyan-600"
					>
						{isLoading ? "Creating account..." : "Create account"}
					</Button>
				</form>

				<p className="mt-6 text-center text-sm text-slate-400">
					Already have an account?{" "}
					<Link to="/login" className="text-cyan-400 hover:text-cyan-300">
						Sign in
					</Link>
				</p>
			</div>
		</div>
	);
}
