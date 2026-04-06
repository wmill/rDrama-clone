import { Button } from "@/components/ui/button";
import { ModalFrame } from "./ModalFrame";

type ExpandedImageModalProps = {
	src: string;
	href?: string;
	alt?: string;
	onClose: () => void;
};

export function ExpandedImageModal({
	src,
	href,
	alt = "expanded image",
	onClose,
}: ExpandedImageModalProps) {
	return (
		<ModalFrame
			title="Expanded image"
			onClose={onClose}
			className="max-h-[90vh] max-w-5xl"
			footer={
				<>
					{href ? (
						<Button type="button" variant="outline" asChild>
							<a href={href} rel="noreferrer noopener" target="_blank">
								View original
							</a>
						</Button>
					) : null}
					<Button type="button" onClick={onClose}>
						Close
					</Button>
				</>
			}
		>
			<div className="flex max-h-[70vh] items-center justify-center overflow-auto rounded-xl bg-slate-950/70 p-2">
				<img
					src={src}
					alt={alt}
					className="max-h-[66vh] w-auto max-w-full rounded-lg object-contain"
				/>
			</div>
		</ModalFrame>
	);
}
