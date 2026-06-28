import { expect, test } from "bun:test";
import { checkForUpdate } from "./updater";

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
