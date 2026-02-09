import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useId, useState } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { getCurrentUser } from "@/lib/sessions.server";
import { createSubmission } from "@/lib/submissions.server";

const submitSchema = z
	.object({
		title: z
			.string()
			.min(1, "Title is required")
			.max(500, "Title must be 500 characters or less"),
		url: z
			.string()
			.url("Please enter a valid URL")
			.optional()
			.or(z.literal("")),
		body: z
			.string()
			.max(20000, "Body must be 20000 characters or less")
			.optional(),
		isNsfw: z.boolean().default(false),
	})
	.refine((data) => data.url || data.body, {
		message: "Either a URL or body text is required",
		path: ["body"],
	});

type SubmitInput = z.infer<typeof submitSchema>;

const submitAction = createServerFn({ method: "POST" })
	.inputValidator((data: SubmitInput) => submitSchema.parse(data))
	.handler(async ({ data }: { data: SubmitInput }) => {
		const user = await getCurrentUser();
		if (!user) {
			return {
				success: false as const,
				error: "You must be logged in to submit",
			};
		}

		if (user.isBanned > 0) {
			return { success: false as const, error: "You are banned from posting" };
		}

		try {
			const postId = await createSubmission({
				authorId: user.id,
				title: data.title,
				url: data.url || undefined,
				body: data.body || undefined,
				isNsfw: data.isNsfw,
			});

			return { success: true as const, postId };
		} catch (err) {
			return {
				success: false as const,
				error:
					err instanceof Error ? err.message : "Failed to create submission",
			};
		}
	});

const getCurrentUserFn = createServerFn({ method: "GET" }).handler(async () => {
	return getCurrentUser();
});

export const Route = createFileRoute("/submit")({
	component: SubmitPage,
	loader: async () => {
		const user = await getCurrentUserFn();
		return { user };
	},
});

function SubmitPage() {
	const router = useRouter();
	const { user } = Route.useLoaderData();
	const [title, setTitle] = useState("");
	const [url, setUrl] = useState("");
	const [body, setBody] = useState("");
	const [isNsfw, setIsNsfw] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
	const [isLoading, setIsLoading] = useState(false);
	const [submitType, setSubmitType] = useState<"link" | "text">("link");

	const titleId = useId();
	const urlId = useId();
	const bodyId = useId();
	const nsfwId = useId();

	if (!user) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 p-4">
				<div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900/80 p-8 text-center shadow-xl">
					<h1 className="mb-4 text-2xl font-bold text-white">Login Required</h1>
					<p className="mb-6 text-slate-400">
						You need to be logged in to create a post.
					</p>
					<Button asChild>
						<Link to="/login">Sign in</Link>
					</Button>
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
			const submitData = {
				title,
				url: submitType === "link" ? url : undefined,
				body: submitType === "text" ? body : undefined,
				isNsfw,
			};

			const validation = submitSchema.safeParse(submitData);

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

			const result = await submitAction({ data: submitData });

			if (!result.success) {
				setError(result.error);
				return;
			}

			router.navigate({ to: `/post/${result.postId}` as "/" });
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "An unexpected error occurred",
			);
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 p-4">
			<div className="mx-auto max-w-2xl">
				<div className="rounded-xl border border-slate-800 bg-slate-900/80 p-8 shadow-xl">
					<h1 className="mb-6 text-2xl font-bold text-white">Create a Post</h1>

					<div className="mb-6 flex gap-2">
						<button
							type="button"
							onClick={() => setSubmitType("link")}
							className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
								submitType === "link"
									? "bg-cyan-500 text-white"
									: "bg-slate-800 text-slate-300 hover:bg-slate-700"
							}`}
						>
							Link
						</button>
						<button
							type="button"
							onClick={() => setSubmitType("text")}
							className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
								submitType === "text"
									? "bg-cyan-500 text-white"
									: "bg-slate-800 text-slate-300 hover:bg-slate-700"
							}`}
						>
							Text
						</button>
					</div>

					<form onSubmit={handleSubmit} className="space-y-6">
						{error && (
							<div className="rounded-lg border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-400">
								{error}
							</div>
						)}

						<div className="space-y-2">
							<Label htmlFor={titleId} className="text-slate-300">
								Title
							</Label>
							<Input
								id={titleId}
								type="text"
								value={title}
								onChange={(e) => setTitle(e.target.value)}
								placeholder="Enter a descriptive title"
								required
								maxLength={500}
								className="border-slate-700 bg-slate-800 text-white placeholder:text-slate-500"
							/>
							<div className="flex justify-between text-xs text-slate-500">
								<span>{fieldErrors.title}</span>
								<span>{title.length}/500</span>
							</div>
						</div>

						{submitType === "link" && (
							<div className="space-y-2">
								<Label htmlFor={urlId} className="text-slate-300">
									URL
								</Label>
								<Input
									id={urlId}
									type="url"
									value={url}
									onChange={(e) => setUrl(e.target.value)}
									placeholder="https://example.com"
									className="border-slate-700 bg-slate-800 text-white placeholder:text-slate-500"
								/>
								{fieldErrors.url && (
									<p className="text-sm text-red-400">{fieldErrors.url}</p>
								)}
							</div>
						)}

						{submitType === "text" && (
							<div className="space-y-2">
								<Label htmlFor={bodyId} className="text-slate-300">
									Body
								</Label>
								<Textarea
									id={bodyId}
									value={body}
									onChange={(e) => setBody(e.target.value)}
									placeholder="Write your post content here..."
									rows={8}
									maxLength={20000}
									className="border-slate-700 bg-slate-800 text-white placeholder:text-slate-500"
								/>
								<div className="flex justify-between text-xs text-slate-500">
									<span>{fieldErrors.body}</span>
									<span>{body.length}/20000</span>
								</div>
							</div>
						)}

						<div className="flex items-center gap-3">
							<Switch
								id={nsfwId}
								checked={isNsfw}
								onCheckedChange={setIsNsfw}
							/>
							<Label htmlFor={nsfwId} className="text-slate-300">
								Mark as NSFW (18+)
							</Label>
						</div>

						<div className="flex gap-4">
							<Button
								type="submit"
								disabled={isLoading}
								className="bg-cyan-500 hover:bg-cyan-600"
							>
								{isLoading ? "Submitting..." : "Submit Post"}
							</Button>
							<Button type="button" variant="outline" asChild>
								<Link to="/" search={{ sort: "hot", t: "all" }}>
									Cancel
								</Link>
							</Button>
						</div>
					</form>
				</div>
			</div>
		</div>
	);
}
