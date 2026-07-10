import { create } from "zustand";

export type AwardOption = {
	kind: string;
	title: string;
	description?: string;
	owned?: number;
	canUseOwned?: boolean;
	canBuyWithCoins?: boolean;
	canBuyWithMarseybux?: boolean;
};

export type AwardModalResult = {
	kind: string;
	note: string;
	method: "owned" | "coins" | "marseybux";
};

export type BanModalResult = {
	reason: string;
	durationDays?: number;
	banAlts: boolean;
};

export type BanModalOptions = {
	knownAlts?: string[];
};

export type DeleteModalOptions = {
	title: string;
	description: string;
	confirmLabel: string;
};

export type ShadowbanModalOptions = {
	username: string;
};

export type ExpandedImageModalOptions = {
	src: string;
	href?: string;
	alt?: string;
};

export type AwardModalOptions = {
	awards: AwardOption[];
	title?: string;
	submitLabel?: string;
	noteLabel?: string;
	notePlaceholder?: string;
};

type ReportModalConfig = {
	type: "report";
	id: string;
	resolve: (reason: string) => void;
	reject: () => void;
};

type DeleteModalConfig = DeleteModalOptions & {
	type: "delete";
	id: string;
	resolve: () => void;
	reject: () => void;
};

type BanModalConfig = BanModalOptions & {
	type: "ban";
	id: string;
	resolve: (result: BanModalResult) => void;
	reject: () => void;
};

type ShadowbanModalConfig = ShadowbanModalOptions & {
	type: "shadowban";
	id: string;
	resolve: () => void;
	reject: () => void;
};

type ExpandedImageModalConfig = ExpandedImageModalOptions & {
	type: "expanded-image";
	id: string;
	resolve: () => void;
	reject: () => void;
};

type AwardModalConfig = AwardModalOptions & {
	type: "award";
	id: string;
	resolve: (result: AwardModalResult) => void;
	reject: () => void;
};

type ModalConfig =
	| AwardModalConfig
	| BanModalConfig
	| DeleteModalConfig
	| ExpandedImageModalConfig
	| ReportModalConfig
	| ShadowbanModalConfig;

type ModalsStore = {
	modals: ModalConfig[];
	openReportModal: () => Promise<string>;
	openDeleteCommentModal: () => Promise<void>;
	openDeletePostModal: () => Promise<void>;
	openBanModal: (options?: BanModalOptions) => Promise<BanModalResult>;
	openShadowbanModal: (options: ShadowbanModalOptions) => Promise<void>;
	openExpandedImageModal: (options: ExpandedImageModalOptions) => Promise<void>;
	openAwardModal: (options: AwardModalOptions) => Promise<AwardModalResult>;
};

function createModalPromise<T extends ModalConfig, TResult>(
	set: (fn: (state: ModalsStore) => Partial<ModalsStore>) => void,
	buildConfig: (
		id: string,
		resolve: (value: TResult) => void,
		reject: () => void,
	) => T,
) {
	return new Promise<TResult>((resolve, reject) => {
		const id = crypto.randomUUID();
		const close = () => {
			set((state) => ({
				modals: state.modals.filter((modal) => modal.id !== id),
			}));
		};

		set((state) => ({
			modals: [
				...state.modals,
				buildConfig(
					id,
					(value) => {
						close();
						resolve(value);
					},
					() => {
						close();
						reject();
					},
				),
			],
		}));
	});
}

export const useModalsStore = create<ModalsStore>((set) => ({
	modals: [],
	openReportModal: () =>
		createModalPromise(set, (id, resolve, reject) => ({
			type: "report",
			id,
			resolve,
			reject,
		})),
	openDeleteCommentModal: () =>
		createModalPromise(set, (id, resolve, reject) => ({
			type: "delete",
			id,
			title: "Delete comment?",
			description: "Your comment will be deleted everywhere on The Motte.",
			confirmLabel: "Delete comment",
			resolve,
			reject,
		})),
	openDeletePostModal: () =>
		createModalPromise(set, (id, resolve, reject) => ({
			type: "delete",
			id,
			title: "Delete post?",
			description: "Your post will be deleted everywhere on The Motte.",
			confirmLabel: "Delete post",
			resolve,
			reject,
		})),
	openBanModal: (options) =>
		createModalPromise(set, (id, resolve, reject) => ({
			type: "ban",
			id,
			knownAlts: options?.knownAlts,
			resolve,
			reject,
		})),
	openShadowbanModal: (options) =>
		createModalPromise(set, (id, resolve, reject) => ({
			type: "shadowban",
			id,
			username: options.username,
			resolve,
			reject,
		})),
	openExpandedImageModal: (options) =>
		createModalPromise(set, (id, resolve, reject) => ({
			type: "expanded-image",
			id,
			src: options.src,
			href: options.href,
			alt: options.alt,
			resolve,
			reject,
		})),
	openAwardModal: (options) =>
		createModalPromise(set, (id, resolve, reject) => ({
			type: "award",
			id,
			awards: options.awards,
			title: options.title,
			submitLabel: options.submitLabel,
			noteLabel: options.noteLabel,
			notePlaceholder: options.notePlaceholder,
			resolve,
			reject,
		})),
}));
