import { X } from "lucide-react";
import { type ReactNode, useEffect, useId } from "react";
import { Button } from "@/components/ui/button";

type ModalFrameProps = {
	title: string;
	onClose: () => void;
	children: ReactNode;
	footer?: ReactNode;
	className?: string;
};

export function ModalFrame({
	title,
	onClose,
	children,
	footer,
	className,
}: ModalFrameProps) {
	const titleId = useId();

	useEffect(() => {
		const handler = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				onClose();
			}
		};

		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, [onClose]);

	return (
		<div className="fixed inset-0 flex items-center justify-center p-4">
			<button
				type="button"
				className="absolute inset-0 cursor-default bg-slate-950/70 backdrop-blur-sm"
				onClick={onClose}
				aria-label="Close dialog"
			/>
			<div
				role="dialog"
				aria-modal="true"
				aria-labelledby={titleId}
				className={`relative z-10 flex w-full flex-col overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-900 shadow-2xl ${className ?? "max-w-md"}`}
			>
				<div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
					<h2 id={titleId} className="text-lg font-semibold text-white">
						{title}
					</h2>
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						onClick={onClose}
						className="text-slate-400 hover:bg-slate-800 hover:text-white"
					>
						<X className="size-4" />
						<span className="sr-only">Close</span>
					</Button>
				</div>
				<div className="px-5 py-4">{children}</div>
				{footer ? (
					<div className="flex justify-end gap-3 border-t border-slate-800 px-5 py-4">
						{footer}
					</div>
				) : null}
			</div>
		</div>
	);
}
