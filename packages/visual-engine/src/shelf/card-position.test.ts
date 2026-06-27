import { expect, test } from "bun:test";
import { computeCardLayout } from "./card-position";
import { getDefaultShelfLayoutProfile } from "./shelf-layout-profile";

const profile = getDefaultShelfLayoutProfile({ portrait: false, narrow: false, skullSafe: false });

const SETTLED = 1;

const base = (index: number) =>
	computeCardLayout({
		index,
		centerSmooth: 0,
		mode: "side",
		profile,
		revealRaw: SETTLED,
		paneRaw: SETTLED,
		absD: Math.abs(index),
	});

test("side-mode center card (delta 0) reproduces baseline x/y/z/scale/opacity", () => {
	const c = base(0);
	expect(c.x).toBeCloseTo(3.18, 4);
	expect(c.y).toBeCloseTo(0, 4);
	expect(c.z).toBeCloseTo(0.86, 4);
	expect(c.scale).toBeCloseTo(1.12, 4);
	expect(c.opacity).toBeCloseTo(1.0, 4);
	expect(c.rotationY).toBeCloseTo(0.28, 4);
});

test("side-mode delta +1 (absD 1, reveal=1, paneEase=0) matches baseline formulas", () => {
	const c = base(1);
	expect(c.x).toBeCloseTo(3.18 + 1 * 0.040, 4);
	expect(c.y).toBeCloseTo(0 - 1 * 0.68, 4);
	expect(c.z).toBeCloseTo(0.86 - 1 * 0.170, 4);
	expect(c.scale).toBeCloseTo(0.90, 4);
	expect(c.opacity).toBeCloseTo(0.70, 4);
	expect(c.rotationY).toBeCloseTo(0.28, 4);
});

test("side-mode delta -1 mirrors y sign (lane sloping)", () => {
	const c = base(-1);
	expect(c.x).toBeCloseTo(3.22, 4);
	expect(c.y).toBeCloseTo(0.68, 4);
	expect(c.z).toBeCloseTo(0.69, 4);
	expect(c.scale).toBeCloseTo(0.90, 4);
	expect(c.opacity).toBeCloseTo(0.70, 4);
});

test("side-mode delta +2 keeps falloff bounds (max(0.55, 1.04 - 2*0.14)=0.76)", () => {
	const c = base(2);
	expect(c.x).toBeCloseTo(3.18 + 2 * 0.040, 4);
	expect(c.y).toBeCloseTo(-1.36, 4);
	expect(c.z).toBeCloseTo(0.86 - 2 * 0.170, 4);
	expect(c.scale).toBeCloseTo(Math.max(0.55, 1.04 - 2 * 0.14), 4);
	expect(c.opacity).toBeCloseTo(Math.max(0.22, 1.0 - 2 * 0.30), 4);
});

test("side-mode renderOrder higher for center (lift=0 baseline)", () => {
	const near = base(0).renderOrder;
	const mid = base(1).renderOrder;
	const far = base(2).renderOrder;
	expect(near).toBeGreaterThan(mid);
	expect(mid).toBeGreaterThan(far);
});

test("stage-mode center card scale is exactly 1.20 (baseline centerScale)", () => {
	const c = computeCardLayout({
		index: 0,
		centerSmooth: 0,
		mode: "stage",
		profile,
		revealRaw: SETTLED,
		paneRaw: SETTLED,
		absD: 0,
	});
	expect(c.x).toBeCloseTo(0, 4);
	expect(c.y).toBeCloseTo(-2.20, 4);
	expect(c.z).toBeCloseTo(1.0, 4);
	expect(c.scale).toBeCloseTo(1.20, 4);
	expect(c.opacity).toBeCloseTo(1.0, 4);
	expect(c.rotationY).toBeCloseTo(0, 4);
});

test("stage-mode delta ±1 spacing uses stageXStep=1.55, depth=0.55 falloff", () => {
	const right = computeCardLayout({
		index: 1,
		centerSmooth: 0,
		mode: "stage",
		profile,
		revealRaw: SETTLED,
		paneRaw: SETTLED,
		absD: 1,
	});
	expect(right.x).toBeCloseTo(1.55, 4);
	expect(right.y).toBeCloseTo(-2.20, 4);
	expect(right.z).toBeCloseTo(1.0 - 1 * 0.55, 4);
	expect(right.scale).toBeCloseTo(Math.max(0.45, 1.0 - 1 * 0.22), 4);
	expect(right.opacity).toBeCloseTo(Math.max(0.18, 1.0 - 1 * 0.32), 4);
	expect(right.rotationY).toBeCloseTo(-1 * 0.22, 4);
});

test("stage-mode rotationY flips sign with delta", () => {
	expect(
		computeCardLayout({ index: -2, centerSmooth: 0, mode: "stage", profile, revealRaw: SETTLED, paneRaw: SETTLED, absD: 2 }).rotationY,
	).toBeCloseTo(2 * 0.22, 4);
	expect(
		computeCardLayout({ index: 2, centerSmooth: 0, mode: "stage", profile, revealRaw: SETTLED, paneRaw: SETTLED, absD: 2 }).rotationY,
	).toBeCloseTo(-2 * 0.22, 4);
});

test("reveal animation kicks scale/opacity while revealRaw<1 (paneEase=0)", () => {
	const settledCenter = base(0);
	const justOpenedCenter = computeCardLayout({
		index: 0,
		centerSmooth: 0,
		mode: "side",
		profile,
		revealRaw: 0,
		paneRaw: SETTLED,
		absD: 0,
	});
	expect(justOpenedCenter.scale).toBeLessThan(settledCenter.scale);
	// entry = (1-reveal)*(0.82 + absD*0.075) = 0.82 at delta0; x = sideX + entry * sideEntryX (0.82)
	expect(justOpenedCenter.x).toBeCloseTo(3.18 + 0.82 * 0.82, 4);
});

test("pane switch slide (paneRaw=0, paneSwitchDir=+1) pushes x by +0.60 and y by sign(delta)*0.16", () => {
	const c = computeCardLayout({
		index: 0,
		centerSmooth: 0,
		mode: "side",
		profile,
		revealRaw: SETTLED,
		paneRaw: 0,
		paneSwitchDir: 1,
		absD: 0,
	});
	expect(c.x).toBeCloseTo(3.18 + 0.60, 4);
	expect(c.y).toBeCloseTo(0 + 0.16, 4);
});