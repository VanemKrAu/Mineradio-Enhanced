import { expect, test } from "bun:test";
import { loadFromStorage, useVisualStore } from "./visual-store";

test("loadFromStorage rejects a malformed payload", () => {
	expect(loadFromStorage("{not json")).toBeNull();
	expect(loadFromStorage(JSON.stringify({ version: "x" }))).toBeNull();
});

test("loadFromStorage accepts a valid PersistedVisualState", () => {
	const valid = {
		version: 1,
		preset: "stardust",
		intensity: 0.7,
		custom: { hue: 120 },
		updatedAt: 1,
	};
	const loaded = loadFromStorage(JSON.stringify(valid));
	expect(loaded?.preset).toBe("stardust");
	expect(loaded?.intensity).toBe(0.7);
});

test("visual store actions update state and serialize", () => {
	useVisualStore.setState({ preset: "default", intensity: 0.5, custom: {} });
	useVisualStore.getState().setPreset("nebula");
	useVisualStore.getState().setIntensity(0.3);
	useVisualStore.getState().setCustom("hue", 200);
	const serialized = useVisualStore.getState().serialize();
	expect(serialized.preset).toBe("nebula");
	expect(serialized.intensity).toBe(0.3);
	expect(serialized.custom.hue).toBe(200);
});