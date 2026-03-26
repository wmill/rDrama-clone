import { useModalsStore } from "@/stores/modals";
import { ReportModal } from "./modals/ReportModal";

export function Modals() {
	const modals = useModalsStore((s) => s.modals);

	if (modals.length === 0) return null;

	return (
		<div className="isolate fixed inset-0 z-50">
			{modals.map((modal) => {
				if (modal.type === "report") {
					return (
						<ReportModal
							key={modal.id}
							onSubmit={modal.resolve}
							onCancel={modal.reject}
						/>
					);
				}
				return null;
			})}
		</div>
	);
}
