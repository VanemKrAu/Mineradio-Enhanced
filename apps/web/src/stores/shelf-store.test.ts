import { expect, test } from "bun:test";
import { useShelfStore } from "./shelf-store";

test("openShelf sets open true, toggleShelf flips", () => {
	useShelfStore.setState({ open: false });
	useShelfStore.getState().openShelf();
	expect(useShelfStore.getState().open).toBe(true);
	useShelfStore.getState().toggleShelf();
	expect(useShelfStore.getState().open).toBe(false);
});