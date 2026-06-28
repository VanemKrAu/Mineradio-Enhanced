import { create } from "zustand";
import type { UpdateCheckResult, UpdateInstallState } from "../tauri/updater";

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
	currentVersion: string | null;
	body: string | null;
	message: string | null;
	date: string | null;
	error: string | null;
	requiresSignature: boolean;
	signatureGate: boolean;
	installState: UpdateInstallState | null;
	setStatus: (status: UpdateStatus) => void;
	setVersion: (version: string | null) => void;
	setMessage: (message: string | null) => void;
	applyCheckResult: (result: UpdateCheckResult) => void;
	reset: () => void;
}

export const useUpdateStore = create<UpdateState>()((set) => ({
	status: "idle",
	version: null,
	currentVersion: null,
	body: null,
	message: null,
	date: null,
	error: null,
	requiresSignature: true,
	signatureGate: true,
	installState: null,
	setStatus: (status) => set({ status }),
	setVersion: (version) => set({ version }),
	setMessage: (message) => set({ message }),
	applyCheckResult: (result) =>
		set({
			status: result.error ? "error" : result.available ? "available" : "not-available",
			version: result.version,
			currentVersion: result.currentVersion,
			body: result.body,
			message: result.message,
			date: result.date,
			error: result.error,
			requiresSignature: result.requiresSignature,
			signatureGate: result.signatureGate,
			installState: result.installState,
		}),
	reset: () =>
		set({
			status: "idle",
			version: null,
			currentVersion: null,
			body: null,
			message: null,
			date: null,
			error: null,
			requiresSignature: true,
			signatureGate: true,
			installState: null,
		}),
}));
