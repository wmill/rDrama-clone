import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const PRESET_REASONS = [
	{ value: "low-effort", label: "Low Effort" },
	{ value: "antagonistic", label: "Antagonistic/Uncharitable/Unkind" },
	{ value: "boo-outgroup", label: "Boo Outgroup" },
	{
		value: "build-consensus",
		label: "Attempting to speak for the whole forum or build consensus",
	},
	{ value: "quality-contribution", label: "Actually a quality contribution" },
	{ value: "other", label: "Other" },
] as const;

type ReportModalProps = {
	onSubmit: (reason: string) => void;
	onCancel: () => void;
};

export function ReportModal({ onSubmit, onCancel }: ReportModalProps) {
	const [preset, setPreset] = useState<string | null>(null);
	const [customReason, setCustomReason] = useState("");
	const titleId = useId();
	const groupName = useId();

	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			if (e.key === "Escape") onCancel();
		};
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, [onCancel]);

	const handleSubmit = () => {
		if (preset && preset !== "other") {
			const label =
				PRESET_REASONS.find((r) => r.value === preset)?.label ?? preset;
			onSubmit(label);
		} else {
			onSubmit(customReason);
		}
	};

	return (
		<div className="fixed inset-0 flex items-center justify-center">
			<button
				type="button"
				className="absolute inset-0 cursor-default bg-black/60"
				onClick={onCancel}
				aria-label="Close dialog"
			/>
			<div
				role="dialog"
				aria-modal="true"
				aria-labelledby={titleId}
				className="relative z-10 w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-2xl"
			>
				<h2 id={titleId} className="mb-4 text-lg font-semibold text-white">
					Report
				</h2>
				<div className="mb-4 space-y-2">
					{PRESET_REASONS.map(({ value, label }) => (
						<label
							key={value}
							className="flex cursor-pointer items-center gap-2 text-sm text-slate-300"
						>
							<input
								type="radio"
								name={groupName}
								value={value}
								checked={preset === value}
								onChange={() => setPreset(value)}
								className="accent-amber-500"
							/>
							{label}
						</label>
					))}
				</div>
				{(preset === "other" || preset === null) && (
					<Textarea
						placeholder="Reason (optional)"
						value={customReason}
						onChange={(e) => setCustomReason(e.target.value)}
						rows={3}
						className="mb-4 border-slate-700 bg-slate-800 text-white placeholder:text-slate-500"
					/>
				)}
				<div className="flex justify-end gap-3">
					<Button variant="outline" onClick={onCancel}>
						Cancel
					</Button>
					<Button
						className="bg-amber-500 text-white hover:bg-amber-600"
						onClick={handleSubmit}
					>
						Submit Report
					</Button>
				</div>
			</div>
		</div>
	);
}
