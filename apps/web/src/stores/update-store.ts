import { create } from "zustand";

export type UpdateStatus =
	| "idle"
	| "checking"
	| "available"
	| "not-available"
	| "downloading"
	| "installing"
	| "error";

export interface UpdateState {
	status: UpdateStatus;
	version: string | null;
	message: string | null;
	setStatus: (status: UpdateStatus) => void;
	setVersion: (version: string | null) => void;
	setMessage: (message: string | null) => void;
	reset: () => void;
}

export const useUpdateStore = create<UpdateState>()((set) => ({
	status: "idle",
	version: null,
	message: null,
	setStatus: (status) => set({ status }),
	setVersion: (version) => set({ version }),
	setMessage: (message) => set({ message }),
	reset: () => set({ status: "idle", version: null, message: null }),
}));