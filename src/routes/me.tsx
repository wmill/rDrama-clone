import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useId, useState } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
	changePasswordFn,
	changePasswordInputSchema,
	changeUsernameFn,
	changeUsernameInputSchema,
} from "@/lib/account-actions.server";
import type {
	CommentFeedSortType,
	SortType,
	TimeFilter,
} from "@/lib/constants";
import {
	emailChangeInputSchema,
	requestEmailChangeFn,
	resendEmailVerificationFn,
} from "@/lib/email-verification-actions.server";
import { getMePageFn, updateSettingsFn } from "@/lib/me-actions.server";
import { type SettingsInput, settingsSchema } from "@/lib/me-settings";
import type { ClientSessionInfo } from "@/lib/session-actions.server";
import { logoutOtherSessionsFn } from "@/lib/session-actions.server";
import type { BlockedUsersPage } from "@/lib/social.server";
import { setBlockStateFn } from "@/lib/social-actions.server";
import type { UserSettings } from "@/lib/users.server";

export const Route = createFileRoute("/me")({
	component: MePage,
	validateSearch: (search: Record<string, unknown>) => ({
		blockedPage: z.coerce
			.number()
			.int()
			.positive()
			.catch(1)
			.parse(search.blockedPage),
	}),
	loaderDeps: ({ search }) => ({ blockedPage: search.blockedPage }),
	loader: async ({ deps }) => {
		return getMePageFn({ data: { blockedPage: deps.blockedPage } });
	},
});

function MePage() {
	const { user, settings, sessions, blockedUsers } = Route.useLoaderData();

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
	if (!blockedUsers) return null;

	return (
		<SettingsForm
			settings={settings}
			sessions={sessions}
			blockedUsers={blockedUsers}
		/>
	);
}

function SettingsForm({
	settings,
	sessions,
	blockedUsers,
}: {
	settings: UserSettings;
	sessions: ClientSessionInfo[];
	blockedUsers: BlockedUsersPage;
}) {
	const router = useRouter();
	const [form, setForm] = useState<SettingsInput>({
		bio: settings.bio,
		customTitlePlain: settings.customTitlePlain,
		profileUrl: settings.profileUrl,
		bannerUrl: settings.bannerUrl,
		profileCss: settings.profileCss,
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
		theme: settings.theme,
		over18: settings.over18,
		slurReplacer: settings.slurReplacer,
	});
	const [error, setError] = useState<string | null>(null);
	const [successMessage, setSuccessMessage] = useState<string | null>(null);
	const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
	const [isLoading, setIsLoading] = useState(false);

	const bioId = useId();
	const customTitleId = useId();
	const profileUrlId = useId();
	const bannerUrlId = useId();
	const profileCssId = useId();
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

							<CustomTitleField
								id={customTitleId}
								value={form.customTitlePlain}
								locked={settings.titleLocked}
								error={fieldErrors.customTitlePlain}
								onChange={(value) => updateField("customTitlePlain", value)}
							/>

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
								<Label htmlFor={profileCssId} className="text-slate-300">
									Profile CSS
								</Label>
								<Textarea
									id={profileCssId}
									value={form.profileCss}
									onChange={(event) =>
										updateField("profileCss", event.target.value)
									}
									maxLength={4000}
									placeholder=".profile-bio { color: rebeccapurple; }"
									className="min-h-32 font-mono text-sm border-slate-700 bg-slate-800 text-white"
								/>
								<p className="text-xs text-slate-500">
									Safe visual rules are scoped to your profile. URLs, at-rules,
									positioning, custom properties, and global selectors are
									rejected.
								</p>
								<FieldError error={fieldErrors.profileCss} />
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
								label="Light theme"
								description="Use the light color theme across the site."
								checked={form.theme === "light"}
								onCheckedChange={(checked) =>
									updateField("theme", checked ? "light" : "dark")
								}
							/>
							<ToggleRow
								label="Show NSFW posts"
								description="Allow adult-marked post titles, bodies, and media to display."
								checked={form.over18}
								onCheckedChange={(checked) => updateField("over18", checked)}
							/>
							<ToggleRow
								label="Replace slurs"
								description="Replace common slurs in rendered post and comment text."
								checked={form.slurReplacer}
								onCheckedChange={(checked) =>
									updateField("slurReplacer", checked)
								}
							/>
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

				<EmailCard email={settings.email} isActivated={settings.isActivated} />
				<PasswordCard />
				<UsernameCard currentUsername={settings.username} />
				<SessionsCard sessions={sessions} />
				<BlockedUsersCard page={blockedUsers} />
			</div>
		</div>
	);
}

function BlockedUsersCard({ page }: { page: BlockedUsersPage }) {
	const router = useRouter();
	const [pendingId, setPendingId] = useState<number | null>(null);
	const [error, setError] = useState<string | null>(null);

	const unblock = async (targetUserId: number) => {
		setPendingId(targetUserId);
		setError(null);
		try {
			const result = await setBlockStateFn({
				data: { targetUserId, blocked: false },
			});
			if (!result.success) {
				setError(result.error);
				return;
			}
			await router.invalidate();
		} finally {
			setPendingId(null);
		}
	};

	return (
		<section className="rounded-xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl">
			<h2 className="text-xl font-semibold text-white">Blocked users</h2>
			<p className="mt-1 text-sm text-slate-400">
				Review and unblock accounts you have blocked.
			</p>
			{error && <p className="mt-3 text-sm text-red-300">{error}</p>}
			{page.items.length === 0 ? (
				<p className="mt-4 text-sm text-slate-400">No blocked users found.</p>
			) : (
				<ul className="mt-4 divide-y divide-slate-800">
					{page.items.map((user) => (
						<li
							key={user.id}
							className="flex items-center justify-between py-3"
						>
							{user.username ? (
								<Link
									to="/u/$username"
									params={{ username: user.username }}
									search={{ sort: "new", t: "all", page: 1 }}
									className="text-cyan-400 hover:underline"
								>
									@{user.username}
								</Link>
							) : (
								<span className="text-slate-400">Private account</span>
							)}
							<Button
								type="button"
								size="sm"
								variant="outline"
								disabled={pendingId === user.id}
								onClick={() => unblock(user.id)}
							>
								{pendingId === user.id ? "Unblocking..." : "Unblock"}
							</Button>
						</li>
					))}
				</ul>
			)}
			<div className="mt-4 flex items-center justify-center gap-3 text-sm">
				<Button
					variant="outline"
					size="sm"
					asChild={page.page > 1}
					disabled={page.page <= 1}
				>
					{page.page > 1 ? (
						<Link to="/me" search={{ blockedPage: page.page - 1 }}>
							Previous
						</Link>
					) : (
						<span>Previous</span>
					)}
				</Button>
				<span className="text-slate-400">Page {page.page}</span>
				<Button
					variant="outline"
					size="sm"
					asChild={page.hasNextPage}
					disabled={!page.hasNextPage}
				>
					{page.hasNextPage ? (
						<Link to="/me" search={{ blockedPage: page.page + 1 }}>
							Next
						</Link>
					) : (
						<span>Next</span>
					)}
				</Button>
			</div>
		</section>
	);
}

export function CustomTitleField({
	id,
	value,
	locked,
	error,
	onChange,
}: {
	id: string;
	value: string;
	locked: boolean;
	error?: string;
	onChange: (value: string) => void;
}) {
	return (
		<div className="space-y-2">
			<Label htmlFor={id} className="text-slate-300">
				Custom title
			</Label>
			<Input
				id={id}
				value={value}
				onChange={(event) => onChange(event.target.value)}
				maxLength={100}
				disabled={locked}
				className="border-slate-700 bg-slate-800 text-white"
			/>
			{locked && (
				<p className="text-xs text-amber-300">
					A moderator has locked this title. You can edit it again after a
					moderator unlocks it.
				</p>
			)}
			<FieldError error={error} />
		</div>
	);
}

function UsernameCard({ currentUsername }: { currentUsername: string }) {
	const router = useRouter();
	const [username, setUsername] = useState(currentUsername);
	const [currentPassword, setCurrentPassword] = useState("");
	const [message, setMessage] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [isWorking, setIsWorking] = useState(false);
	const usernameId = useId();
	const passwordId = useId();

	const submit = async (event: React.FormEvent) => {
		event.preventDefault();
		setMessage(null);
		setError(null);
		const parsed = changeUsernameInputSchema.safeParse({
			username,
			currentPassword,
		});
		if (!parsed.success) {
			setError(parsed.error.issues[0]?.message ?? "Invalid username");
			return;
		}
		setIsWorking(true);
		try {
			const result = await changeUsernameFn({ data: parsed.data });
			if (!result.success) {
				setError(result.error);
				return;
			}
			setUsername(result.username);
			setCurrentPassword("");
			setMessage(`Username changed to @${result.username}.`);
			await router.invalidate();
		} finally {
			setIsWorking(false);
		}
	};

	return (
		<section className="rounded-xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl">
			<h2 className="text-xl font-semibold text-white">Change username</h2>
			<p className="mt-1 text-sm text-slate-400">
				Your old profile URL will redirect to the new username.
			</p>
			<form onSubmit={submit} className="mt-4 grid gap-4 md:grid-cols-2">
				<div className="space-y-2">
					<Label htmlFor={usernameId}>New username</Label>
					<Input
						id={usernameId}
						value={username}
						onChange={(event) => setUsername(event.target.value)}
						maxLength={25}
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor={passwordId}>Current password</Label>
					<Input
						id={passwordId}
						type="password"
						value={currentPassword}
						onChange={(event) => setCurrentPassword(event.target.value)}
					/>
				</div>
				<div className="md:col-span-2">
					<Button type="submit" disabled={isWorking}>
						{isWorking ? "Changing..." : "Change username"}
					</Button>
				</div>
			</form>
			{error && <p className="mt-3 text-sm text-red-300">{error}</p>}
			{message && <p className="mt-3 text-sm text-emerald-300">{message}</p>}
		</section>
	);
}

function EmailCard({
	email,
	isActivated,
}: {
	email: string | null;
	isActivated: boolean;
}) {
	const [nextEmail, setNextEmail] = useState("");
	const [password, setPassword] = useState("");
	const [message, setMessage] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [isWorking, setIsWorking] = useState(false);
	const emailId = useId();
	const passwordId = useId();

	const resend = async () => {
		setError(null);
		setMessage(null);
		setIsWorking(true);
		try {
			const result = await resendEmailVerificationFn();
			if (!result.success) setError(result.error);
			else
				setMessage(
					"If verification is still needed, a new link has been sent.",
				);
		} catch (err) {
			setError(
				err instanceof Error
					? err.message
					: "Failed to send verification email",
			);
		} finally {
			setIsWorking(false);
		}
	};

	const requestChange = async (event: React.FormEvent) => {
		event.preventDefault();
		setError(null);
		setMessage(null);
		const validation = emailChangeInputSchema.safeParse({
			email: nextEmail,
			currentPassword: password,
		});
		if (!validation.success) {
			setError(
				validation.error.issues[0]?.message ?? "Invalid email change request",
			);
			return;
		}
		setIsWorking(true);
		try {
			const result = await requestEmailChangeFn({ data: validation.data });
			if (!result.success) setError(result.error);
			else {
				setNextEmail("");
				setPassword("");
				setMessage(
					"Confirmation sent. Your email will change only after you use the link.",
				);
			}
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Failed to request email change",
			);
		} finally {
			setIsWorking(false);
		}
	};

	return (
		<form
			onSubmit={requestChange}
			className="rounded-xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl"
		>
			<div className="flex items-start justify-between gap-4">
				<div>
					<h2 className="text-xl font-semibold text-white">Email address</h2>
					<p className="text-sm text-slate-400">
						{email ?? "No email"} · {isActivated ? "Verified" : "Unverified"}
					</p>
				</div>
				{!isActivated && (
					<Button
						type="button"
						variant="outline"
						disabled={isWorking}
						onClick={resend}
					>
						Resend verification
					</Button>
				)}
			</div>
			{error && <p className="mt-3 text-sm text-red-400">{error}</p>}
			{message && <p className="mt-3 text-sm text-emerald-400">{message}</p>}
			<div className="mt-4 grid gap-4 md:grid-cols-2">
				<div className="space-y-2">
					<Label htmlFor={emailId}>New email</Label>
					<Input
						id={emailId}
						type="email"
						autoComplete="email"
						value={nextEmail}
						onChange={(event) => setNextEmail(event.target.value)}
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor={passwordId}>Current password</Label>
					<Input
						id={passwordId}
						type="password"
						autoComplete="current-password"
						value={password}
						onChange={(event) => setPassword(event.target.value)}
					/>
				</div>
			</div>
			<Button className="mt-4" type="submit" disabled={isWorking}>
				Send confirmation
			</Button>
		</form>
	);
}

function PasswordCard() {
	const [currentPassword, setCurrentPassword] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [message, setMessage] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [isWorking, setIsWorking] = useState(false);
	const currentPasswordId = useId();
	const newPasswordId = useId();
	const confirmPasswordId = useId();

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		setMessage(null);
		setError(null);
		const validation = changePasswordInputSchema.safeParse({
			currentPassword,
			newPassword,
			confirmPassword,
		});
		if (!validation.success) {
			setError(validation.error.issues[0]?.message ?? "Invalid password");
			return;
		}
		setIsWorking(true);
		try {
			const result = await changePasswordFn({ data: validation.data });
			if (!result.success) {
				setError(result.error);
				return;
			}
			setCurrentPassword("");
			setNewPassword("");
			setConfirmPassword("");
			setMessage("Password changed. Other sessions have been logged out.");
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Failed to change password",
			);
		} finally {
			setIsWorking(false);
		}
	};

	return (
		<form
			onSubmit={handleSubmit}
			className="rounded-xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl"
		>
			<h2 className="text-xl font-semibold text-white">Change password</h2>
			<p className="mb-4 text-sm text-slate-400">
				Changing your password logs out every other device and invalidates reset
				links.
			</p>
			{error && <p className="mb-3 text-sm text-red-400">{error}</p>}
			{message && <p className="mb-3 text-sm text-emerald-400">{message}</p>}
			<div className="grid gap-4 md:grid-cols-3">
				<div className="space-y-2">
					<Label htmlFor={currentPasswordId}>Current password</Label>
					<Input
						id={currentPasswordId}
						type="password"
						autoComplete="current-password"
						value={currentPassword}
						onChange={(event) => setCurrentPassword(event.target.value)}
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor={newPasswordId}>New password</Label>
					<Input
						id={newPasswordId}
						type="password"
						autoComplete="new-password"
						value={newPassword}
						onChange={(event) => setNewPassword(event.target.value)}
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor={confirmPasswordId}>Confirm new password</Label>
					<Input
						id={confirmPasswordId}
						type="password"
						autoComplete="new-password"
						value={confirmPassword}
						onChange={(event) => setConfirmPassword(event.target.value)}
					/>
				</div>
			</div>
			<Button className="mt-4" type="submit" disabled={isWorking}>
				{isWorking ? "Changing..." : "Change password"}
			</Button>
		</form>
	);
}

function SessionsCard({ sessions }: { sessions: ClientSessionInfo[] }) {
	const router = useRouter();
	const [message, setMessage] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [isWorking, setIsWorking] = useState(false);
	const otherSessionCount = sessions.filter((s) => !s.isCurrent).length;

	const handleLogoutOthers = async () => {
		setMessage(null);
		setError(null);
		setIsWorking(true);
		try {
			const result = await logoutOtherSessionsFn();
			if (!result.success) {
				setError(result.error);
				return;
			}
			setMessage(
				result.removed === 0
					? "No other sessions to log out."
					: `Logged out ${result.removed} other session${result.removed === 1 ? "" : "s"}.`,
			);
			await router.invalidate();
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "An unexpected error occurred",
			);
		} finally {
			setIsWorking(false);
		}
	};

	return (
		<section className="rounded-xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl">
			<div className="mb-4 flex items-center justify-between gap-4">
				<div>
					<h2 className="text-xl font-semibold text-white">Active sessions</h2>
					<p className="text-sm text-slate-400">
						Everywhere you are currently logged in. Log out other sessions if
						you see a device you don't recognize.
					</p>
				</div>
				<Button
					variant="destructive"
					onClick={handleLogoutOthers}
					disabled={isWorking || otherSessionCount === 0}
				>
					{isWorking ? "Logging out..." : "Log out other sessions"}
				</Button>
			</div>

			{error && (
				<div className="mb-4 rounded-lg border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-300">
					{error}
				</div>
			)}
			{message && (
				<div className="mb-4 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-300">
					{message}
				</div>
			)}

			<ul className="space-y-3">
				{sessions.map((session) => (
					<li
						key={session.key}
						className="flex items-start justify-between gap-4 rounded-lg border border-slate-800 bg-slate-950/50 p-4"
					>
						<div className="min-w-0">
							<div className="flex items-center gap-2">
								<span className="font-mono text-sm text-slate-300">
									{session.key}…
								</span>
								{session.isCurrent && (
									<span className="rounded-full border border-cyan-500/50 bg-cyan-500/10 px-2 py-0.5 text-xs text-cyan-300">
										This device
									</span>
								)}
							</div>
							<p className="mt-1 truncate text-sm text-slate-400">
								{session.userAgent ?? "Unknown device"}
							</p>
						</div>
						<div className="shrink-0 text-right text-sm text-slate-400">
							<div>{new Date(session.createdAt).toLocaleString()}</div>
							<div className="text-xs text-slate-500">
								{session.ipAddress ?? "IP unknown"}
							</div>
						</div>
					</li>
				))}
			</ul>
		</section>
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
