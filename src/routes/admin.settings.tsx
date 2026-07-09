import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { Switch } from "@/components/ui/switch";
import { SITE_SETTINGS, type SiteSettingKey } from "@/lib/constants";
import {
	getSiteSettingsFn,
	updateSiteSettingFn,
} from "@/lib/site-settings-actions.server";

export const Route = createFileRoute("/admin/settings")({
	component: SiteSettingsPage,
	loader: async () => {
		return getSiteSettingsFn();
	},
});

function SiteSettingsPage() {
	const initialSettings = Route.useLoaderData();
	const [settings, setSettings] = useState(initialSettings);
	const [pendingKey, setPendingKey] = useState<SiteSettingKey | null>(null);
	const [error, setError] = useState<string | null>(null);

	const handleToggle = async (key: SiteSettingKey, value: boolean) => {
		setPendingKey(key);
		setError(null);
		try {
			const res = await updateSiteSettingFn({ data: { key, value } });
			if (res.success) {
				setSettings((prev) => ({ ...prev, [key]: res.value }));
			} else {
				setError(res.error);
			}
		} finally {
			setPendingKey(null);
		}
	};

	return (
		<div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl">
			<h2 className="mb-1 text-lg font-semibold text-white">Site Settings</h2>
			<p className="mb-4 text-sm text-slate-400">
				Runtime toggles — changes take effect immediately.
			</p>

			{error && <p className="mb-4 text-sm text-red-400">{error}</p>}

			<div className="space-y-3">
				{SITE_SETTINGS.map((setting) => (
					<div
						key={setting.key}
						className="flex items-center gap-4 rounded-lg border border-slate-800 bg-slate-950/50 px-4 py-3"
					>
						<div className="flex-1">
							<p className="text-sm font-medium text-white">{setting.label}</p>
							<p className="text-xs text-slate-400">{setting.description}</p>
						</div>
						<Switch
							checked={settings[setting.key]}
							disabled={pendingKey === setting.key}
							onCheckedChange={(value) => handleToggle(setting.key, value)}
						/>
					</div>
				))}
			</div>
		</div>
	);
}
