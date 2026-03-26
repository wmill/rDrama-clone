import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useId, useState } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
	type CommentFeedSortType,
	CommentSortTypes,
	type SortType,
	SortTypes,
	type TimeFilter,
	TimeFilters,
} from "@/lib/constants";
import { getCurrentUser } from "@/lib/sessions.server";
import {
	getUserSettingsById,
	type UserSettings,
	updateUserSettings,
} from "@/lib/users.server";

const getCurrentUserFn = createServerFn({ method: "GET" }).handler(async () => {
	return getCurrentUser();
});

const colorSchema = z
	.string()
	.trim()
	.regex(/^[0-9a-fA-F]{3,6}$/, "Use a 3 or 6 character hex color");

const optionalUrlSchema = z
	.string()
	.trim()
	.max(65, "URL must be 65 characters or fewer")
	.refine((value) => {
		if (!value) return true;
		try {
			const url = new URL(value);
			return url.protocol === "http:" || url.protocol === "https:";
		} catch {
			return false;
		}
	}, "Enter a valid http:// or https:// URL");

const settingsSchema = z.object({
	bio: z.string().trim().max(1500, "Bio must be 1500 characters or fewer"),
	customTitlePlain: z
		.string()
		.trim()
		.max(100, "Custom title must be 100 characters or fewer"),
	profileUrl: optionalUrlSchema,
	bannerUrl: optionalUrlSchema,
	defaultSorting: z.enum(SortTypes),
	defaultSortingComments: z.enum(CommentSortTypes),
	defaultTime: z.enum(TimeFilters),
	isPrivate: z.boolean(),
	hideVotedOn: z.boolean(),
	cardView: z.boolean(),
	highlightComments: z.boolean(),
	newTabExternal: z.boolean(),
	newTab: z.boolean(),
	nameColor: colorSchema,
	titleColor: colorSchema,
	themeColor: colorSchema,
});

type SettingsInput = z.infer<typeof settingsSchema>;

const getCurrentUserSettingsFn = createServerFn({ method: "GET" }).handler(
	async () => {
		const user = await getCurrentUser();
		if (!user) return null;

		return getUserSettingsById(user.id);
	},
);

const updateSettingsFn = createServerFn({ method: "POST" })
	.inputValidator((data: SettingsInput) => settingsSchema.parse(data))
	.handler(async ({ data }) => {
		const user = await getCurrentUser();
		if (!user) {
			throw new Error("You must be logged in");
		}

		const bioHtmlLength = data.bio
			? (await import("@/lib/markdown")).renderCommentMarkdown(data.bio).length
			: 0;
		if (bioHtmlLength > 10000) {
			return {
				success: false as const,
				error: "Rendered bio is too long for the legacy database columns",
			};
		}

		const customTitleHtmlLength = data.customTitlePlain
			? (await import("@/lib/markdown")).renderPostTitleHtml(
					data.customTitlePlain,
				).length
			: 0;
		if (customTitleHtmlLength > 1000) {
			return {
				success: false as const,
				error:
					"Rendered custom title is too long for the legacy database columns",
			};
		}

		await updateUserSettings(user.id, {
			...data,
			nameColor: data.nameColor.toLowerCase(),
			titleColor: data.titleColor.toLowerCase(),
			themeColor: data.themeColor.toLowerCase(),
		});

		return { success: true as const };
	});

export const Route = createFileRoute("/me")({
	component: MePage,
	loader: async () => {
		const user = await getCurrentUserFn();
		const settings = await getCurrentUserSettingsFn();
		return { user, settings };
	},
});

function MePage() {
	const _router = useRouter();
	const { user, settings } = Route.useLoaderData();

	if (!user || !settings) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 p-4">
				<div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900/80 p-8 text-center shadow-xl">
					<h1 className="mb-4 text-2xl font-bold text-white">Not logged in</h1>
					<p className="mb-6 text-slate-400">
						You need to be logged in to view this page.
					</p>
					<Button asChild>
						<Link to="/login">Sign in</Link>
					</Button>
				</div>
			</div>
		);
	}

	return <SettingsForm settings={settings} />;
}

function SettingsForm({ settings }: { settings: UserSettings }) {
	const router = useRouter();
	const [form, setForm] = useState<SettingsInput>({
		bio: settings.bio,
		customTitlePlain: settings.customTitlePlain,
		profileUrl: settings.profileUrl,
		bannerUrl: settings.bannerUrl,
		defaultSorting: settings.defaultSorting,
		defaultSortingComments: settings.defaultSortingComments,
		defaultTime: settings.defaultTime,
		isPrivate: settings.isPrivate,
		hideVotedOn: settings.hideVotedOn,
		cardView: settings.cardView,
		highlightComments: settings.highlightComments,
		newTabExternal: settings.newTabExternal,
		newTab: settings.newTab,
		nameColor: settings.nameColor,
		titleColor: settings.titleColor,
		themeColor: settings.themeColor,
	});
	const [error, setError] = useState<string | null>(null);
	const [successMessage, setSuccessMessage] = useState<string | null>(null);
	const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
	const [isLoading, setIsLoading] = useState(false);

	const bioId = useId();
	const customTitleId = useId();
	const profileUrlId = useId();
	const bannerUrlId = useId();
	const nameColorId = useId();
	const titleColorId = useId();
	const themeColorId = useId();

	const updateField = <K extends keyof SettingsInput>(
		key: K,
		value: SettingsInput[K],
	) => {
		setForm((current) => ({ ...current, [key]: value }));
	};

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		setError(null);
		setSuccessMessage(null);
		setFieldErrors({});
		setIsLoading(true);

		try {
			const validation = settingsSchema.safeParse(form);
			if (!validation.success) {
				const errors: Record<string, string> = {};
				for (const issue of validation.error.issues) {
					const path = issue.path[0];
					if (typeof path === "string") {
						errors[path] = issue.message;
					}
				}
				setFieldErrors(errors);
				return;
			}

			const result = await updateSettingsFn({ data: validation.data });
			if (!result.success) {
				setError(result.error);
				return;
			}

			setSuccessMessage("Settings saved");
			await router.invalidate();
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
			<div className="mx-auto max-w-5xl space-y-6">
				<section className="rounded-xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl">
					<div className="mb-8 flex items-center gap-4">
						{settings.profileUrl ? (
							<img
								src={settings.profileUrl}
								alt={settings.username}
								className="h-20 w-20 rounded-full border-2 border-cyan-500 object-cover"
							/>
						) : (
							<div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-cyan-500 bg-slate-800 text-3xl font-bold text-cyan-400">
								{settings.username.charAt(0).toUpperCase()}
							</div>
						)}
						<div>
							<h1 className="text-3xl font-bold text-white">Edit settings</h1>
							<p className="mt-1 text-slate-400">
								Updating `users` fields directly for @{settings.username} while
								keeping the legacy derived HTML columns in sync.
							</p>
						</div>
					</div>

					<div className="grid gap-4 md:grid-cols-4">
						<InfoCard label="Email" value={settings.email ?? "Not set"} />
						<InfoCard
							label="Joined"
							value={new Date(settings.createdUtc * 1000).toLocaleDateString()}
						/>
						<InfoCard label="Coins" value={settings.coins.toLocaleString()} />
						<InfoCard
							label="Pro Coins"
							value={settings.proCoins.toLocaleString()}
						/>
					</div>

					{settings.isBanned > 0 && (
						<div className="mt-6 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
							{settings.banReason
								? `Banned: ${settings.banReason}`
								: "This account is currently banned."}
						</div>
					)}
				</section>

				<form
					onSubmit={handleSubmit}
					className="rounded-xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl"
				>
					<div className="mb-6 flex items-center justify-between gap-4">
						<div>
							<h2 className="text-xl font-semibold text-white">
								Profile and preferences
							</h2>
							<p className="text-sm text-slate-400">
								Bio and custom title are re-rendered to stored HTML on save.
							</p>
						</div>
						<div className="flex gap-3">
							<Button variant="outline" asChild>
								<Link
									to="/u/$username"
									params={{ username: settings.username }}
									search={{ sort: "new", t: "all", page: 1 }}
								>
									View public profile
								</Link>
							</Button>
							<Button type="submit" disabled={isLoading}>
								{isLoading ? "Saving..." : "Save settings"}
							</Button>
						</div>
					</div>

					{error && (
						<div className="mb-4 rounded-lg border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-300">
							{error}
						</div>
					)}
					{successMessage && (
						<div className="mb-4 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-300">
							{successMessage}
						</div>
					)}

					<div className="grid gap-6 lg:grid-cols-2">
						<div className="space-y-5 rounded-lg border border-slate-800 bg-slate-950/50 p-5">
							<h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
								Profile
							</h3>

							<div className="space-y-2">
								<Label htmlFor={customTitleId} className="text-slate-300">
									Custom title
								</Label>
								<Input
									id={customTitleId}
									value={form.customTitlePlain}
									onChange={(event) =>
										updateField("customTitlePlain", event.target.value)
									}
									maxLength={100}
									className="border-slate-700 bg-slate-800 text-white"
								/>
								<FieldError error={fieldErrors.customTitlePlain} />
							</div>

							<div className="space-y-2">
								<Label htmlFor={bioId} className="text-slate-300">
									Bio
								</Label>
								<Textarea
									id={bioId}
									value={form.bio}
									onChange={(event) => updateField("bio", event.target.value)}
									maxLength={1500}
									className="min-h-32 border-slate-700 bg-slate-800 text-white"
								/>
								<p className="text-xs text-slate-500">
									{form.bio.length}/1500 characters
								</p>
								<FieldError error={fieldErrors.bio} />
							</div>

							<div className="space-y-2">
								<Label htmlFor={profileUrlId} className="text-slate-300">
									Avatar URL
								</Label>
								<Input
									id={profileUrlId}
									value={form.profileUrl}
									onChange={(event) =>
										updateField("profileUrl", event.target.value)
									}
									placeholder="https://example.com/avatar.webp"
									className="border-slate-700 bg-slate-800 text-white"
								/>
								<FieldError error={fieldErrors.profileUrl} />
							</div>

							<div className="space-y-2">
								<Label htmlFor={bannerUrlId} className="text-slate-300">
									Banner URL
								</Label>
								<Input
									id={bannerUrlId}
									value={form.bannerUrl}
									onChange={(event) =>
										updateField("bannerUrl", event.target.value)
									}
									placeholder="https://example.com/banner.webp"
									className="border-slate-700 bg-slate-800 text-white"
								/>
								<FieldError error={fieldErrors.bannerUrl} />
							</div>
						</div>

						<div className="space-y-5 rounded-lg border border-slate-800 bg-slate-950/50 p-5">
							<h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
								Feed defaults
							</h3>

							<SelectRow<SortType>
								label="Default post sorting"
								value={form.defaultSorting}
								onChange={(value) => updateField("defaultSorting", value)}
								options={[
									["hot", "Hot"],
									["new", "New"],
									["top", "Top"],
									["controversial", "Controversial"],
									["comments", "Comments"],
								]}
							/>

							<SelectRow<CommentFeedSortType>
								label="Default comment sorting"
								value={form.defaultSortingComments}
								onChange={(value) =>
									updateField("defaultSortingComments", value)
								}
								options={[
									["new", "New"],
									["top", "Top"],
									["controversial", "Controversial"],
								]}
							/>

							<SelectRow<TimeFilter>
								label="Default post time filter"
								value={form.defaultTime}
								onChange={(value) => updateField("defaultTime", value)}
								options={[
									["hour", "Hour"],
									["day", "Day"],
									["week", "Week"],
									["month", "Month"],
									["year", "Year"],
									["all", "All Time"],
								]}
							/>

							<div className="grid gap-4 md:grid-cols-3">
								<ColorField
									id={nameColorId}
									label="Name color"
									value={form.nameColor}
									onChange={(value) => updateField("nameColor", value)}
									error={fieldErrors.nameColor}
								/>
								<ColorField
									id={titleColorId}
									label="Title color"
									value={form.titleColor}
									onChange={(value) => updateField("titleColor", value)}
									error={fieldErrors.titleColor}
								/>
								<ColorField
									id={themeColorId}
									label="Theme color"
									value={form.themeColor}
									onChange={(value) => updateField("themeColor", value)}
									error={fieldErrors.themeColor}
								/>
							</div>
						</div>
					</div>

					<div className="mt-6 rounded-lg border border-slate-800 bg-slate-950/50 p-5">
						<h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
							Behavior toggles
						</h3>
						<div className="grid gap-4 md:grid-cols-2">
							<ToggleRow
								label="Private profile"
								description="Restrict posts and comments on your profile to you and admins."
								checked={form.isPrivate}
								onCheckedChange={(checked) => updateField("isPrivate", checked)}
							/>
							<ToggleRow
								label="Hide voted posts"
								description="Hide posts you have already voted on in feed queries that support it."
								checked={form.hideVotedOn}
								onCheckedChange={(checked) =>
									updateField("hideVotedOn", checked)
								}
							/>
							<ToggleRow
								label="Card view"
								description="Prefer richer media cards when listing posts."
								checked={form.cardView}
								onCheckedChange={(checked) => updateField("cardView", checked)}
							/>
							<ToggleRow
								label="Highlight comments"
								description="Keep the legacy highlight-new-comments preference enabled."
								checked={form.highlightComments}
								onCheckedChange={(checked) =>
									updateField("highlightComments", checked)
								}
							/>
							<ToggleRow
								label="Open internal links in new tabs"
								description="Store the legacy `newtab` preference for site links."
								checked={form.newTab}
								onCheckedChange={(checked) => updateField("newTab", checked)}
							/>
							<ToggleRow
								label="Open external links in new tabs"
								description="Store the legacy `newtabexternal` preference for outbound links."
								checked={form.newTabExternal}
								onCheckedChange={(checked) =>
									updateField("newTabExternal", checked)
								}
							/>
						</div>
					</div>

					<div className="mt-6 flex gap-4">
						<Button type="submit" disabled={isLoading}>
							{isLoading ? "Saving..." : "Save settings"}
						</Button>
						<Button variant="destructive" asChild>
							<Link to="/logout">Log out</Link>
						</Button>
					</div>
				</form>
			</div>
		</div>
	);
}

function InfoCard({ label, value }: { label: string; value: string }) {
	return (
		<div className="rounded-lg border border-slate-800 bg-slate-950/50 p-4">
			<div className="text-xs uppercase tracking-wide text-slate-500">
				{label}
			</div>
			<div className="mt-1 text-sm text-white">{value}</div>
		</div>
	);
}

function FieldError({ error }: { error?: string }) {
	if (!error) return null;
	return <p className="text-sm text-red-400">{error}</p>;
}

function ToggleRow({
	label,
	description,
	checked,
	onCheckedChange,
}: {
	label: string;
	description: string;
	checked: boolean;
	onCheckedChange: (checked: boolean) => void;
}) {
	return (
		<div className="flex items-start justify-between gap-4 rounded-lg border border-slate-800 bg-slate-900/70 p-4">
			<div>
				<div className="font-medium text-white">{label}</div>
				<p className="mt-1 text-sm text-slate-400">{description}</p>
			</div>
			<Switch checked={checked} onCheckedChange={onCheckedChange} />
		</div>
	);
}

function SelectRow<T extends string>({
	label,
	value,
	onChange,
	options,
}: {
	label: string;
	value: T;
	onChange: (value: T) => void;
	options: ReadonlyArray<readonly [T, string]>;
}) {
	return (
		<label className="block space-y-2">
			<span className="text-sm text-slate-300">{label}</span>
			<select
				value={value}
				onChange={(event) => onChange(event.target.value as T)}
				className="h-10 w-full rounded-md border border-slate-700 bg-slate-800 px-3 text-sm text-white outline-none ring-0 focus:border-cyan-500"
			>
				{options.map(([optionValue, optionLabel]) => (
					<option key={optionValue} value={optionValue}>
						{optionLabel}
					</option>
				))}
			</select>
		</label>
	);
}

function ColorField({
	id,
	label,
	value,
	onChange,
	error,
}: {
	id: string;
	label: string;
	value: string;
	onChange: (value: string) => void;
	error?: string;
}) {
	return (
		<div className="space-y-2">
			<Label htmlFor={id} className="text-slate-300">
				{label}
			</Label>
			<div className="flex items-center gap-3">
				<div
					className="h-10 w-10 rounded-md border border-slate-700"
					style={{ backgroundColor: `#${value || "000"}` }}
				/>
				<Input
					id={id}
					value={value}
					onChange={(event) => onChange(event.target.value.replace(/^#/, ""))}
					maxLength={6}
					className="border-slate-700 bg-slate-800 text-white"
				/>
			</div>
			<FieldError error={error} />
		</div>
	);
}
