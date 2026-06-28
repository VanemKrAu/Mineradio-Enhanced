import { expect, test } from "bun:test";
import { useUpdateStore } from "./update-store";

test("setStatus and setVersion update the store", () => {
	useUpdateStore.getState().reset();
	useUpdateStore.getState().setStatus("available");
	useUpdateStore.getState().setVersion("1.2.3");
	expect(useUpdateStore.getState().status).toBe("available");
	expect(useUpdateStore.getState().version).toBe("1.2.3");
});

test("applyCheckResult keeps signature gate visible", () => {
	useUpdateStore.getState().reset();
	useUpdateStore.getState().applyCheckResult({
		available: true,
		version: "0.2.0",
		currentVersion: "0.1.0",
		body: "更新说明",
		message: "更新说明",
		date: "2026-06-28T00:00:00Z",
		error: null,
		requiresSignature: true,
		signatureGate: true,
		installState: "signature-key-missing",
	});

	const state = useUpdateStore.getState();
	expect(state.status).toBe("available");
	expect(state.version).toBe("0.2.0");
	expect(state.currentVersion).toBe("0.1.0");
	expect(state.message).toBe("更新说明");
	expect(state.signatureGate).toBe(true);
	expect(state.installState).toBe("signature-key-missing");
});
