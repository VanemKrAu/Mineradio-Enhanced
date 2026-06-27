import { expect, test } from "bun:test";
import { computeBreathPulse } from "./breath";

test("breathPulse at uTime=0 index=0 is exactly 0.5 (sin(0)=0)", () => {
	expect(computeBreathPulse(0, 0, 1)).toBeCloseTo(0.5, 5);
});

test("breathPulse index=1 uTime=0 shelfVisibility=1 ≈ 0.5+0.5*sin(0.74)", () => {
	const expected = 0.5 + 0.5 * Math.sin(0.74);
	expect(computeBreathPulse(0, 1, 1)).toBeCloseTo(expected, 5);
});

test("breathPulse index=0 shelfVisibility=0 returns 0 regardless of uTime", () => {
	expect(computeBreathPulse(12.34, 0, 0)).toBeCloseTo(0, 5);
	expect(computeBreathPulse(0, 5, 0)).toBeCloseTo(0, 5);
});

test("breathPulse scales linearly with shelfVisibility", () => {
	const v = computeBreathPulse(2.5, 3, 1);
	expect(computeBreathPulse(2.5, 3, 0.5)).toBeCloseTo(0.5 * v, 5);
});

test("breathPulse saturates to 1.0 max (0.5+0.5*sin peak)", () => {
	let max = 0;
	for (let i = 0; i < 200; i++) {
		const b = computeBreathPulse(i * 0.07, i, 1);
		if (b > max) max = b;
	}
	expect(max).toBeLessThanOrEqual(1.0 + 1e-9);
});