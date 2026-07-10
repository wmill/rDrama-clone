import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useId, useState } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestPasswordReset } from "@/lib/password-reset.server";

const forgotPasswordSchema = z.object({
	email: z.string().email("Please enter a valid email address"),
});

type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

const forgotPasswordAction = createServerFn({ method: "POST" })
	.inputValidator((data: ForgotPasswordInput) =>
		forgotPasswordSchema.parse(data),
	)
	.handler(async ({ data }: { data: ForgotPasswordInput }) => {
		return requestPasswordReset(data.email);
	});

export const Route = createFileRoute("/forgot-password")({
	component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
	const [email, setEmail] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [submitted, setSubmitted] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const emailId = useId();

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);
		setIsLoading(true);

		try {
			const res = await forgotPasswordAction({ data: { email } });
			if (res.success) {
				setSubmitted(true);
			} else {
				setError(res.error);
			}
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Failed to request password reset",
			);
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 p-4">
			<div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900/80 p-8 shadow-xl">
				<div className="mb-8 text-center">
					<h1 className="text-3xl font-bold text-white">Reset password</h1>
					<p className="mt-2 text-slate-400">
						Enter your email address and we&apos;ll send you a reset link.
					</p>
				</div>

				{submitted ? (
					<div className="space-y-6">
						<div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-300">
							If that email matches an account, a reset link has been sent.
						</div>
						<div className="flex gap-4">
							<Button asChild className="flex-1 bg-cyan-500 hover:bg-cyan-600">
								<Link to="/login">Back to sign in</Link>
							</Button>
							<Button variant="outline" asChild className="flex-1">
								<Link to="/" search={{ sort: "hot", t: "all" }}>
									Go home
								</Link>
							</Button>
						</div>
					</div>
				) : (
					<form onSubmit={handleSubmit} className="space-y-6">
						{error && (
							<div className="rounded-lg border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-400">
								{error}
							</div>
						)}

						<div className="space-y-2">
							<Label htmlFor={emailId} className="text-slate-300">
								Email
							</Label>
							<Input
								id={emailId}
								type="email"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								placeholder="Enter your account email"
								required
								className="border-slate-700 bg-slate-800 text-white placeholder:text-slate-500"
							/>
						</div>

						<Button
							type="submit"
							disabled={isLoading}
							className="w-full bg-cyan-500 hover:bg-cyan-600"
						>
							{isLoading ? "Sending reset link..." : "Send reset link"}
						</Button>
					</form>
				)}

				<p className="mt-6 text-center text-sm text-slate-400">
					Remembered your password?{" "}
					<Link to="/login" className="text-cyan-400 hover:text-cyan-300">
						Sign in
					</Link>
				</p>
			</div>
		</div>
	);
}
