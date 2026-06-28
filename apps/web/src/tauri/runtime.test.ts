import { expect, test } from "bun:test";
import {
	closeDesktopLyricsWindow,
	configureGlobalHotkeys,
	exportJsonFile,
	getRuntimeConfig,
	getSidecarStatus,
	importJsonFile,
	isTauriRuntime,
	listenGlobalHotkey,
	openProviderLoginWindow,
	showDesktopLyricsWindow,
	toggleWindowFullscreen,
	updateDesktopLyricsPayload
} from "./runtime";

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

test("getSidecarStatus resolves to a non-crashing placeholder outside Tauri", async () => {
	const status = await getSidecarStatus();
	expect(status).toEqual({
		phase: "stopped",
		baseUrl: "",
		pid: null,
		restarts: 0,
		lastError: null,
		lastHealthOkMs: null,
		providers: [],
		logPath: "",
	});
});

test("JSON file helpers return cancelled placeholders outside Tauri", async () => {
	const exported = await exportJsonFile("preset.json", { enabled: true });
	expect(exported).toEqual({
		cancelled: true,
		path: null,
	});
	const imported = await importJsonFile();
	expect(imported).toEqual({
		cancelled: true,
		path: null,
		data: null,
	});
});

test("global hotkey helpers are inert outside Tauri", async () => {
	const configured = await configureGlobalHotkeys([
		{ action: "togglePlay", accelerator: "Control+Alt+Space" },
	]);
	expect(configured).toEqual({
		ok: true,
		results: [],
	});
	let called = false;
	const unlisten = await listenGlobalHotkey(() => {
		called = true;
	});
	unlisten();
	expect(called).toBe(false);
});

test("window fullscreen helper is inert outside Tauri", async () => {
	expect(await toggleWindowFullscreen()).toBe(undefined);
});

test("desktop lyrics window helpers are inert outside Tauri", async () => {
	expect(await showDesktopLyricsWindow()).toBe(undefined);
	expect(await updateDesktopLyricsPayload({ enabled: true, text: "line" })).toBe(undefined);
	expect(await closeDesktopLyricsWindow()).toBe(undefined);
});

test("provider login helper returns a no-cookie placeholder outside Tauri", async () => {
	const result = await openProviderLoginWindow("netease");
	expect(result).toEqual({
		provider: "netease",
		stored: false,
		reused: false,
		partial: false,
	});
});
