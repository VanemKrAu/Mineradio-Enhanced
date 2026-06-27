import { expect, test } from "bun:test";
import { updateHoverFloatMix } from "./hover-float";

test("updateHoverFloatMix lerps toward 1 with attack 0.20 at 16.67ms dt", () => {
	const mix = 0;
	const next = updateHoverFloatMix(mix, true, 16.67);
	expect(next).toBeCloseTo(0 + (1 - 0) * 0.20, 4);
});

test("updateHoverFloatMix lerps toward 0 with release 0.13 at 16.67ms dt", () => {
	const mix = 1;
	const next = updateHoverFloatMix(mix, false, 16.67);
	expect(next).toBeCloseTo(1 + (0 - 1) * 0.13, 4);
});

test("updateHoverFloatMix is frame-rate independent (two 8.335ms steps ≈ one 16.67ms step)", () => {
	const dt = 16.67;
	const oneStep = updateHoverFloatMix(0, true, dt);
	const twoSteps = updateHoverFloatMix(updateHoverFloatMix(0, true, dt / 2), true, dt / 2);
	expect(twoSteps).toBeCloseTo(oneStep, 3);
});

test("updateHoverFloatMix ~0 when already at target with same dt", () => {
	expect(updateHoverFloatMix(1, true, 16.67)).toBeCloseTo(1, 5);
	expect(updateHoverFloatMix(0, false, 16.67)).toBeCloseTo(0, 5);
});

test("attack > release (0.20 vs 0.13) at the same dt", () => {
	const up = updateHoverFloatMix(0.5, true, 16.67);
	const down = updateHoverFloatMix(0.5, false, 16.67);
	expect(up - 0.5).toBeGreaterThan(0.5 - down);
});