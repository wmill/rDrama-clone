import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type ReportModalProps = {
	onSubmit: (reason: string) => void;
	onCancel: () => void;
};

export function ReportModal({ onSubmit, onCancel }: ReportModalProps) {
	const [reason, setReason] = useState("");
	const titleId = useId();

	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			if (e.key === "Escape") onCancel();
		};
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, [onCancel]);

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
				<Textarea
					placeholder="Reason (optional)"
					value={reason}
					onChange={(e) => setReason(e.target.value)}
					rows={4}
					className="mb-4 border-slate-700 bg-slate-800 text-white placeholder:text-slate-500"
				/>
				<div className="flex justify-end gap-3">
					<Button variant="outline" onClick={onCancel}>
						Cancel
					</Button>
					<Button
						className="bg-amber-500 text-white hover:bg-amber-600"
						onClick={() => onSubmit(reason)}
					>
						Submit Report
					</Button>
				</div>
			</div>
		</div>
	);
}
