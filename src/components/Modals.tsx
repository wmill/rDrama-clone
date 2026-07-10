import { useModalsStore } from "@/stores/modals";
import { AwardModal } from "./modals/AwardModal";
import { BanModal } from "./modals/BanModal";
import { DeleteConfirmModal } from "./modals/DeleteConfirmModal";
import { ExpandedImageModal } from "./modals/ExpandedImageModal";
import { ReportModal } from "./modals/ReportModal";
import { ShadowbanModal } from "./modals/ShadowbanModal";

export function Modals() {
	const modals = useModalsStore((state) => state.modals);

	if (modals.length === 0) return null;

	return (
		<div className="isolate fixed inset-0 z-50">
			{modals.map((modal) => {
				switch (modal.type) {
					case "report":
						return (
							<ReportModal
								key={modal.id}
								onSubmit={modal.resolve}
								onCancel={modal.reject}
							/>
						);
					case "delete":
						return (
							<DeleteConfirmModal
								key={modal.id}
								title={modal.title}
								description={modal.description}
								confirmLabel={modal.confirmLabel}
								onConfirm={modal.resolve}
								onCancel={modal.reject}
							/>
						);
					case "ban":
						return (
							<BanModal
								key={modal.id}
								knownAlts={modal.knownAlts}
								onSubmit={modal.resolve}
								onCancel={modal.reject}
							/>
						);
					case "shadowban":
						return (
							<ShadowbanModal
								key={modal.id}
								username={modal.username}
								onConfirm={modal.resolve}
								onCancel={modal.reject}
							/>
						);
					case "expanded-image":
						return (
							<ExpandedImageModal
								key={modal.id}
								src={modal.src}
								href={modal.href}
								alt={modal.alt}
								onClose={modal.resolve}
							/>
						);
					case "award":
						return (
							<AwardModal
								key={modal.id}
								awards={modal.awards}
								title={modal.title}
								submitLabel={modal.submitLabel}
								noteLabel={modal.noteLabel}
								notePlaceholder={modal.notePlaceholder}
								onSubmit={modal.resolve}
								onCancel={modal.reject}
							/>
						);
					default:
						return null;
				}
			})}
		</div>
	);
}
