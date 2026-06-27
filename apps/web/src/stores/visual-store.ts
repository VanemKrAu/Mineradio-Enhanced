import { create } from "zustand";
import {
	PersistedVisualState,
	PersistedVisualStateSchema,
} from "@mineradio/shared";

export interface VisualState {
	preset: string;
	intensity: number;
	custom: Record<string, unknown>;
	setPreset: (preset: string) => void;
	setIntensity: (intensity: number) => void;
	setCustom: (key: string, value: unknown) => void;
	serialize: () => PersistedVisualState;
}

export function loadFromStorage(json: string): PersistedVisualState | null {
	let parsed: unknown;
	try {
		parsed = JSON.parse(json);
	} catch {
		return null;
	}
	const result = PersistedVisualStateSchema.safeParse(parsed);
	return result.success ? result.data : null;
}

export const useVisualStore = create<VisualState>()((set, get) => ({
	preset: "default",
	intensity: 0.5,
	custom: {},
	setPreset: (preset) => set({ preset }),
	setIntensity: (intensity) => set({ intensity }),
	setCustom: (key, value) =>
		set((s) => ({ custom: { ...s.custom, [key]: value } })),
	serialize: () => ({
		version: 1,
		preset: get().preset,
		intensity: get().intensity,
		custom: get().custom,
		updatedAt: Math.floor(Date.now() / 1000),
	}),
}));