import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { BanModalResult } from "@/stores/modals";
import { ModalFrame } from "./ModalFrame";

type BanModalProps = {
	knownAlts?: string[];
	onSubmit: (result: BanModalResult) => void;
	onCancel: () => void;
};

export function BanModal({ knownAlts, onSubmit, onCancel }: BanModalProps) {
	const [reason, setReason] = useState("");
	const [durationDays, setDurationDays] = useState("");
	const [banAlts, setBanAlts] = useState(false);
	const reasonId = useId();
	const daysId = useId();

	return (
		<ModalFrame
			title="Ban user"
			onClose={onCancel}
			footer={
				<>
					<Button type="button" variant="outline" onClick={onCancel}>
						Cancel
					</Button>
					<Button
						type="button"
						variant="destructive"
						onClick={() =>
							onSubmit({
								reason: reason.trim(),
								durationDays: durationDays
									? Number.parseFloat(durationDays)
									: undefined,
								banAlts,
							})
						}
					>
						Ban user
					</Button>
				</>
			}
		>
			<div className="space-y-4">
				<div className="space-y-2">
					<Label htmlFor={reasonId} className="text-slate-200">
						Public ban reason
					</Label>
					<Textarea
						id={reasonId}
						maxLength={64}
						value={reason}
						onChange={(event) => setReason(event.target.value)}
						placeholder="Enter reason"
						className="border-slate-700 bg-slate-800 text-white placeholder:text-slate-500"
					/>
				</div>

				<div className="space-y-2">
					<Label htmlFor={daysId} className="text-slate-200">
						Duration days
					</Label>
					<Input
						id={daysId}
						type="number"
						step="any"
						value={durationDays}
						onChange={(event) => setDurationDays(event.target.value)}
						placeholder="Leave blank for permanent"
						className="border-slate-700 bg-slate-800 text-white placeholder:text-slate-500"
					/>
				</div>

				<label className="flex items-center gap-3 text-sm text-slate-300">
					<input
						type="checkbox"
						checked={banAlts}
						onChange={(event) => setBanAlts(event.target.checked)}
						className="size-4 rounded border-slate-700 bg-slate-800 accent-red-500"
					/>
					Ban known alts
				</label>

				{knownAlts && knownAlts.length > 0 && (
					<p className="text-xs text-slate-400">
						Known alts:{" "}
						{knownAlts.map((alt, index) => (
							<span key={alt}>
								{index > 0 && ", "}
								<span className="text-slate-200">{alt}</span>
							</span>
						))}
					</p>
				)}
			</div>
		</ModalFrame>
	);
}
