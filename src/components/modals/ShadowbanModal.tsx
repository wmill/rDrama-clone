import { Button } from "@/components/ui/button";
import { ModalFrame } from "./ModalFrame";

type ShadowbanModalProps = {
	username: string;
	onConfirm: () => void;
	onCancel: () => void;
};

export function ShadowbanModal({
	username,
	onConfirm,
	onCancel,
}: ShadowbanModalProps) {
	return (
		<ModalFrame
			title="Confirm Shadowban"
			onClose={onCancel}
			footer={
				<>
					<Button type="button" variant="outline" onClick={onCancel}>
						Cancel
					</Button>
					<Button type="button" variant="destructive" onClick={onConfirm}>
						Shadowban user
					</Button>
				</>
			}
		>
			<div className="space-y-3 text-sm leading-6 text-slate-300">
				<p>
					Are you sure you want to shadowban{" "}
					<span className="font-semibold text-white">{username}</span>?
				</p>
				<p className="text-slate-400">
					Shadowbanned users can still post and comment, but their content will
					be hidden from other users.
				</p>
			</div>
		</ModalFrame>
	);
}
