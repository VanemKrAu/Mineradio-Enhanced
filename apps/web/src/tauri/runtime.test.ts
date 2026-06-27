import { expect, test } from "bun:test";
import { getRuntimeConfig, isTauriRuntime } from "./runtime";

test("isTauriRuntime is false outside the Tauri webview", () => {
	expect(isTauriRuntime()).toBe(false);
});

test("getRuntimeConfig resolves to a non-crashing placeholder outside Tauri", async () => {
	const cfg = await getRuntimeConfig();
	expect(typeof cfg.sidecarBaseUrl).toBe("string");
	expect(cfg.sidecarBaseUrl).toBe("");
	expect(typeof cfg.appVersion).toBe("string");
	expect(cfg.appVersion.length).toBeGreaterThan(0);
});