import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useId, useState } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	resetPasswordWithToken,
	validatePasswordResetToken,
} from "@/lib/password-reset.server";
import { clearSessionCookie } from "@/lib/sessions.server";

const tokenSearchSchema = z.object({
	token: z.string().min(1, "Reset token is required"),
});

const resetPasswordSchema = z
	.object({
		token: z.string().min(1, "Reset token is required"),
		password: z.string().min(8, "Password must be at least 8 characters"),
		confirmPassword: z.string(),
	})
	.refine((data) => data.password === data.confirmPassword, {
		message: "Passwords do not match",
		path: ["confirmPassword"],
	});

type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

const validateResetTokenFn = createServerFn({ method: "GET" })
	.inputValidator((data: { token: string }) => tokenSearchSchema.parse(data))
	.handler(async ({ data }) => {
		const user = await validatePasswordResetToken(data.token);
		return { user };
	});

const resetPasswordAction = createServerFn({ method: "POST" })
	.inputValidator((data: ResetPasswordInput) => resetPasswordSchema.parse(data))
	.handler(async ({ data }: { data: ResetPasswordInput }) => {
		const result = await resetPasswordWithToken(data.token, data.password);
		if (!result.success) {
			return result;
		}

		clearSessionCookie();
		return { success: true as const };
	});

export const Route = createFileRoute("/reset-password")({
	validateSearch: (search: Record<string, unknown>) =>
		tokenSearchSchema.parse(search),
	component: ResetPasswordPage,
	loaderDeps: ({ search }) => ({ token: search.token }),
	loader: async ({ deps }) =>
		validateResetTokenFn({ data: { token: deps.token } }),
});

function ResetPasswordPage() {
	const { token } = Route.useSearch();
	const { user } = Route.useLoaderData();
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [isComplete, setIsComplete] = useState(false);
	const passwordId = useId();
	const confirmPasswordId = useId();

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);
		setIsLoading(true);

		try {
			const result = await resetPasswordAction({
				data: { token, password, confirmPassword },
			});

			if (!result.success) {
				setError(result.error);
				return;
			}

			setIsComplete(true);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to reset password");
		} finally {
			setIsLoading(false);
		}
	};

	if (!user) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 p-4">
				<div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900/80 p-8 text-center shadow-xl">
					<h1 className="mb-4 text-2xl font-bold text-white">
						Invalid reset link
					</h1>
					<p className="mb-6 text-slate-400">
						This password reset link is invalid or has expired.
					</p>
					<Button asChild>
						<Link to="/forgot-password">Request a new link</Link>
					</Button>
				</div>
			</div>
		);
	}

	if (isComplete) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 p-4">
				<div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900/80 p-8 text-center shadow-xl">
					<h1 className="mb-4 text-2xl font-bold text-white">
						Password updated
					</h1>
					<p className="mb-6 text-slate-400">
						Your password has been reset for @{user.username}. Sign in with your
						new password.
					</p>
					<Button asChild className="w-full bg-cyan-500 hover:bg-cyan-600">
						<Link to="/login">Go to sign in</Link>
					</Button>
				</div>
			</div>
		);
	}

	return (
		<div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 p-4">
			<div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900/80 p-8 shadow-xl">
				<div className="mb-8 text-center">
					<h1 className="text-3xl font-bold text-white">
						Choose a new password
					</h1>
					<p className="mt-2 text-slate-400">
						Resetting the password for @{user.username}
					</p>
				</div>

				<form onSubmit={handleSubmit} className="space-y-6">
					{error && (
						<div className="rounded-lg border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-400">
							{error}
						</div>
					)}

					<div className="space-y-2">
						<Label htmlFor={passwordId} className="text-slate-300">
							New password
						</Label>
						<Input
							id={passwordId}
							type="password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							placeholder="Enter a new password"
							required
							className="border-slate-700 bg-slate-800 text-white placeholder:text-slate-500"
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor={confirmPasswordId} className="text-slate-300">
							Confirm new password
						</Label>
						<Input
							id={confirmPasswordId}
							type="password"
							value={confirmPassword}
							onChange={(e) => setConfirmPassword(e.target.value)}
							placeholder="Confirm your new password"
							required
							className="border-slate-700 bg-slate-800 text-white placeholder:text-slate-500"
						/>
					</div>

					<Button
						type="submit"
						disabled={isLoading}
						className="w-full bg-cyan-500 hover:bg-cyan-600"
					>
						{isLoading ? "Updating password..." : "Update password"}
					</Button>
				</form>
			</div>
		</div>
	);
}
