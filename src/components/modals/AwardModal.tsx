import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { AwardModalResult, AwardOption } from "@/stores/modals";
import { ModalFrame } from "./ModalFrame";

type AwardModalProps = {
	awards: AwardOption[];
	title?: string;
	submitLabel?: string;
	noteLabel?: string;
	notePlaceholder?: string;
	onSubmit: (result: AwardModalResult) => void;
	onCancel: () => void;
};

const METHOD_LABELS = {
	owned: "Give Award",
	coins: "Buy with coins",
	marseybux: "Buy with marseybux",
} as const;

export function AwardModal({
	awards,
	title = "Give Award",
	submitLabel,
	noteLabel = "Note (optional)",
	notePlaceholder = "Note to include in award notification...",
	onSubmit,
	onCancel,
}: AwardModalProps) {
	const [selectedKind, setSelectedKind] = useState<string | null>(
		awards[0]?.kind ?? null,
	);
	const [note, setNote] = useState("");
	const noteId = useId();

	const selectedAward =
		awards.find((award) => award.kind === selectedKind) ?? null;

	const availableMethods = selectedAward
		? ([
				selectedAward.canUseOwned ? "owned" : null,
				selectedAward.canBuyWithCoins ? "coins" : null,
				selectedAward.canBuyWithMarseybux ? "marseybux" : null,
			].filter(Boolean) as AwardModalResult["method"][])
		: [];

	const defaultMethod = availableMethods[0];

	return (
		<ModalFrame title={title} onClose={onCancel} className="max-w-2xl">
			<div className="space-y-5">
				<div className="grid gap-3 sm:grid-cols-2">
					{awards.map((award) => {
						const isSelected = selectedKind === award.kind;

						return (
							<button
								key={award.kind}
								type="button"
								onClick={() => setSelectedKind(award.kind)}
								className={`rounded-xl border p-4 text-left transition ${
									isSelected
										? "border-amber-500 bg-amber-500/10"
										: "border-slate-700 bg-slate-800/70 hover:border-slate-600"
								}`}
							>
								<div className="flex items-start justify-between gap-3">
									<div>
										<div className="font-semibold text-white">
											{award.title}
										</div>
										{award.description ? (
											<div className="mt-1 text-sm text-slate-400">
												{award.description}
											</div>
										) : null}
									</div>
									{typeof award.owned === "number" ? (
										<div className="rounded-full bg-slate-950/70 px-2 py-1 text-xs text-slate-300">
											{award.owned} owned
										</div>
									) : null}
								</div>
							</button>
						);
					})}
				</div>

				<div className="space-y-2">
					<label
						htmlFor={noteId}
						className="text-sm font-medium text-slate-200"
					>
						{noteLabel}
					</label>
					<Textarea
						id={noteId}
						maxLength={200}
						value={note}
						onChange={(event) => setNote(event.target.value)}
						placeholder={notePlaceholder}
						className="border-slate-700 bg-slate-800 text-white placeholder:text-slate-500"
					/>
				</div>

				<div className="flex flex-wrap justify-end gap-3 border-t border-slate-800 pt-4">
					<Button type="button" variant="outline" onClick={onCancel}>
						Cancel
					</Button>
					{availableMethods.map((method) => (
						<Button
							key={method}
							type="button"
							onClick={() => {
								if (!selectedAward) return;
								onSubmit({
									kind: selectedAward.kind,
									note: note.trim(),
									method,
								});
							}}
							className={
								method === "owned"
									? "bg-amber-500 text-white hover:bg-amber-600"
									: undefined
							}
						>
							{method === defaultMethod && submitLabel
								? submitLabel
								: METHOD_LABELS[method]}
						</Button>
					))}
				</div>
			</div>
		</ModalFrame>
	);
}
