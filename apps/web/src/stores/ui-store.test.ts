import { expect, test } from "bun:test";
import { useUiStore } from "./ui-store";

test("openModal sets modal and closeModal clears it", () => {
	useUiStore.setState({ modal: null });
	useUiStore.getState().openModal("settings");
	expect(useUiStore.getState().modal).toBe("settings");
	useUiStore.getState().closeModal();
	expect(useUiStore.getState().modal).toBeNull();
});

test("toggleConsole flips console visibility", () => {
	useUiStore.setState({ consoleVisible: false });
	useUiStore.getState().toggleConsole();
	expect(useUiStore.getState().consoleVisible).toBe(true);
});