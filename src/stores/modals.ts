import { create } from "zustand";

type ReportModalConfig = {
	type: "report";
	id: string;
	resolve: (reason: string) => void;
	reject: () => void;
};

type ModalConfig = ReportModalConfig;

type ModalsStore = {
	modals: ModalConfig[];
	openReportModal: () => Promise<string>;
};

export const useModalsStore = create<ModalsStore>((set) => ({
	modals: [],
	openReportModal: () =>
		new Promise<string>((resolve, reject) => {
			const id = crypto.randomUUID();
			set((state) => ({
				modals: [
					...state.modals,
					{
						type: "report",
						id,
						resolve: (reason: string) => {
							set((s) => ({ modals: s.modals.filter((m) => m.id !== id) }));
							resolve(reason);
						},
						reject: () => {
							set((s) => ({ modals: s.modals.filter((m) => m.id !== id) }));
							reject();
						},
					},
				],
			}));
		}),
}));
