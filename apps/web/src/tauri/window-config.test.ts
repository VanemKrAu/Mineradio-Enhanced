import { expect, test } from "bun:test";
import tauriConfig from "../../../desktop/src-tauri/tauri.conf.json";

test("main transparent frameless window disables native shadow to avoid a visible rounded border", () => {
	const mainWindow = tauriConfig.app.windows.find((window) => window.label === "main");

	expect(mainWindow).not.toBe(undefined);
	expect(mainWindow?.decorations).toBe(false);
	expect(mainWindow?.transparent).toBe(true);
	expect(mainWindow?.shadow).toBe(false);
});
