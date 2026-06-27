import { create } from "zustand";

export interface UiState {
	modal: string | null;
	consoleVisible: boolean;
	openModal: (name: string) => void;
	closeModal: () => void;
	toggleConsole: () => void;
	setConsole: (visible: boolean) => void;
}

export const useUiStore = create<UiState>()((set, get) => ({
	modal: null,
	consoleVisible: false,
	openModal: (name) => set({ modal: name }),
	closeModal: () => set({ modal: null }),
	toggleConsole: () => set({ consoleVisible: !get().consoleVisible }),
	setConsole: (visible) => set({ consoleVisible: visible }),
}));