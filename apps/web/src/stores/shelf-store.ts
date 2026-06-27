import { create } from "zustand";

export type ShelfMode = "resident" | "static" | "dynamic";

export interface ShelfState {
	mode: ShelfMode | null;
	open: boolean;
	selectedPlaylistId: string | null;
	setMode: (mode: ShelfMode | null) => void;
	openShelf: () => void;
	closeShelf: () => void;
	toggleShelf: () => void;
	selectPlaylist: (id: string | null) => void;
}

export const useShelfStore = create<ShelfState>()((set, get) => ({
	mode: null,
	open: false,
	selectedPlaylistId: null,
	setMode: (mode) => set({ mode }),
	openShelf: () => set({ open: true }),
	closeShelf: () => set({ open: false }),
	toggleShelf: () => set({ open: !get().open }),
	selectPlaylist: (id) => set({ selectedPlaylistId: id }),
}));