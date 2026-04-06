import { Button } from "@/components/ui/button";
import { ModalFrame } from "./ModalFrame";

type DeleteConfirmModalProps = {
	title: string;
	description: string;
	confirmLabel: string;
	onConfirm: () => void;
	onCancel: () => void;
};

export function DeleteConfirmModal({
	title,
	description,
	confirmLabel,
	onConfirm,
	onCancel,
}: DeleteConfirmModalProps) {
	return (
		<ModalFrame
			title={title}
			onClose={onCancel}
			footer={
				<>
					<Button type="button" variant="outline" onClick={onCancel}>
						Cancel
					</Button>
					<Button type="button" variant="destructive" onClick={onConfirm}>
						{confirmLabel}
					</Button>
				</>
			}
		>
			<p className="text-sm leading-6 text-slate-300">{description}</p>
		</ModalFrame>
	);
}
