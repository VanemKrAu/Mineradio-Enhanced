import { afterEach, expect, test } from "bun:test";
import { checkForUpdate, getUpdaterStatus, installUpdate, shouldOpenDevUpdatePreview } from "./updater";

const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");

afterEach(() => {
	if (originalWindowDescriptor) {
		Object.defineProperty(globalThis, "window", originalWindowDescriptor);
		return;
	}
	delete (globalThis as { window?: unknown }).window;
});

function setMockUpdateSearch(search: string): void {
	Object.defineProperty(globalThis, "window", {
		configurable: true,
		value: {
			location: { search },
		},
	});
}

test("checkForUpdate returns a gated placeholder outside Tauri", async () => {
	const result = await checkForUpdate();

	expect(result).toEqual({
		available: false,
		version: null,
		currentVersion: "0.0.0-dev",
		body: null,
		message: null,
		date: null,
		error: null,
		requiresSignature: true,
		signatureGate: true,
		installState: "signature-key-missing",
	});
});

test("installUpdate returns a gated placeholder outside Tauri", async () => {
	const result = await installUpdate();

	expect(result.installState).toBe("signature-key-missing");
	expect(result.signatureGate).toBe(true);
});

test("checkForUpdate returns a dev preview update from the mockUpdate query", async () => {
	setMockUpdateSearch("?mockUpdate=available");

	const result = await checkForUpdate();

	expect(result.available).toBe(true);
	expect(result.version).toBe("0.2.0");
	expect(result.currentVersion).toBe("0.1.0");
	expect(result.signatureGate).toBe(false);
	expect(result.installState).toBe("ready-to-download");
	expect(result.body).toContain("模拟更新");
});

test("getUpdaterStatus can hydrate the dev preview update on startup", async () => {
	setMockUpdateSearch("?mockUpdate=available");

	const result = await getUpdaterStatus();

	expect(result.available).toBe(true);
	expect(result.installState).toBe("ready-to-download");
});

test("shouldOpenDevUpdatePreview requires a mock update mode and open flag", () => {
	setMockUpdateSearch("?mockUpdate=available&mockUpdateOpen=1");
	expect(shouldOpenDevUpdatePreview()).toBe(true);

	setMockUpdateSearch("?mockUpdate=available");
	expect(shouldOpenDevUpdatePreview()).toBe(false);

	setMockUpdateSearch("?mockUpdateOpen=1");
	expect(shouldOpenDevUpdatePreview()).toBe(false);
});
