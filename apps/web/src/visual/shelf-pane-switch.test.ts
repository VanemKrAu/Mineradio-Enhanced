import { expect, test } from "bun:test";
import { createShelfPaneWheelSwitcher } from "./shelf-pane-switch";

test("pane wheel switcher changes mine to fav after baseline reveal threshold at end", () => {
	const calls: string[] = [];
	const switcher = createShelfPaneWheelSwitcher({
		getPane: () => "mine",
		getMergeCollections: () => false,
		getMineCount: () => 3,
		getFavCount: () => 2,
		getCenterTarget: () => 2,
		setPane: (pane) => calls.push(pane),
	});

	expect(switcher.step(1)).toBe(true);
	expect(calls).toEqual([]);
	expect(switcher.step(1)).toBe(true);
	expect(calls).toEqual([]);
	expect(switcher.step(1)).toBe(true);
	expect(calls).toEqual(["fav"]);
});

test("pane wheel switcher changes fav to mine after baseline reveal threshold at start", () => {
	const calls: string[] = [];
	const switcher = createShelfPaneWheelSwitcher({
		getPane: () => "fav",
		getMergeCollections: () => false,
		getMineCount: () => 4,
		getFavCount: () => 3,
		getCenterTarget: () => 0,
		setPane: (pane) => calls.push(pane),
	});

	expect(switcher.step(-2)).toBe(true);
	expect(calls).toEqual([]);
	expect(switcher.step(-1)).toBe(true);
	expect(calls).toEqual([]);
	expect(switcher.step(-1)).toBe(true);
	expect(calls).toEqual(["mine"]);
});

test("pane wheel switcher lets normal scrolling continue away from boundaries and while merged", () => {
	const calls: string[] = [];
	const switcher = createShelfPaneWheelSwitcher({
		getPane: () => "mine",
		getMergeCollections: () => false,
		getMineCount: () => 3,
		getFavCount: () => 2,
		getCenterTarget: () => 1,
		setPane: (pane) => calls.push(pane),
	});

	expect(switcher.step(1)).toBe(false);
	expect(calls).toEqual([]);

	const merged = createShelfPaneWheelSwitcher({
		getPane: () => "mine",
		getMergeCollections: () => true,
		getMineCount: () => 3,
		getFavCount: () => 2,
		getCenterTarget: () => 2,
		setPane: (pane) => calls.push(pane),
	});
	expect(merged.step(1)).toBe(false);
	expect(calls).toEqual([]);
});
