import { expect, test } from "bun:test";
import {
	getDefaultShelfLayoutProfile,
	type SideProfile,
	type StageProfile,
	type DetailProfile,
} from "./shelf-layout-profile";

test("getDefaultShelfLayoutProfile exposes side/stage/detail sub-objects", () => {
	const p = getDefaultShelfLayoutProfile();
	expect(p.side).toBeDefined();
	expect(p.stage).toBeDefined();
	expect(p.detail).toBeDefined();
});

test("side profile preserves all baseline sideX/sideY/sideZ constants", () => {
	const s: SideProfile = getDefaultShelfLayoutProfile().side;
	const keys = Object.keys(s);
	for (const k of [
		"sideX",
		"sideY",
		"sideXStep",
		"sideYStep",
		"sideZ",
		"sideZStep",
		"sideEntryX",
		"sideDetailShift",
		"sideScale",
		"sideRotY",
		"sideRotX",
	]) {
		expect(keys).toContain(k);
	}
});

test("stage profile exposes stageX/stageXStep/stageY/stageZ/stageScale from baseline", () => {
	const s: StageProfile = getDefaultShelfLayoutProfile().stage;
	for (const k of ["stageX", "stageXStep", "stageY", "stageZ", "stageScale"]) {
		expect(Object.keys(s)).toContain(k);
	}
});

test("detail profile carries x/y/z/rx/ry/scale/rowStep/rowScale", () => {
	const d: DetailProfile = getDefaultShelfLayoutProfile().detail;
	for (const k of ["x", "y", "z", "rx", "ry", "scale", "rowStep", "rowScale"]) {
		expect(Object.keys(d)).toContain(k);
	}
});

test("baseline default portrait=false/narrow=false/skull=false sideX is 3.18 + shelfSettings.x", () => {
	const p = getDefaultShelfLayoutProfile({ portrait: false, narrow: false, skullSafe: false });
	expect(p.side.sideX).toBeCloseTo(3.18, 4);
});

test("baseline default sideZStep landscape non-skull is 0.170", () => {
	const p = getDefaultShelfLayoutProfile({ portrait: false, narrow: false, skullSafe: false });
	expect(p.side.sideZStep).toBeCloseTo(0.170, 4);
});

test("baseline stage portrait=false/narrow=false stageXStep is 1.55", () => {
	const p = getDefaultShelfLayoutProfile({ portrait: false, narrow: false, skullSafe: false });
	expect(p.stage.stageXStep).toBeCloseTo(1.55, 4);
});

test("baseline stage portrait=false stageY base is -2.20", () => {
	const p = getDefaultShelfLayoutProfile({ portrait: false, narrow: false, skullSafe: false });
	expect(p.stage.stageY).toBeCloseTo(-2.20, 4);
});