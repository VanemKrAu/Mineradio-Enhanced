import { expect, test } from "bun:test";
import { createPeakFollower } from "./peak-followers";

test("instant attack rises to first value above peak", () => {
	const f = createPeakFollower(0.12, 0, 4000, 0.03);
	const v = f.update(0.5, 16);
	expect(v).toBe(0.5);
});

test("exponential release decays toward floor", () => {
	const f = createPeakFollower(0.5, 0, 4000, 0.03);
	const tau = 4;
	const dtMs = 100;
	const expected = 0.5 * Math.exp(-dtMs / 1000 / tau);
	const v = f.update(0, dtMs);
	expect(Math.abs(v - expected) < 1e-9).toBe(true);
	expect(v > 0.03).toBe(true);
});

test("floor is enforced when decay would drop below it", () => {
	const f = createPeakFollower(0.5, 0, 1000, 0.06);
	for (let i = 0; i < 200; i++) f.update(0, 16);
	expect(f.get()).toBeGreaterThanOrEqual(0.06);
	expect(Math.abs(f.get() - 0.06) < 1e-9).toBe(true);
});

test("rising value with attack smoothing approaches target", () => {
	const f = createPeakFollower(0.1, 50, 2000, 0.05);
	const tauSec = 0.05;
	const expected = 0.1 + (0.9 - 0.1) * (1 - Math.exp(-0.016 / tauSec));
	const v = f.update(0.9, 16);
	expect(Math.abs(v - expected) < 1e-9).toBe(true);
});

test("reset restores initial peak", () => {
	const f = createPeakFollower(0.42, 0, 4000, 0.05);
	f.update(0.9, 16);
	expect(f.get()).toBe(0.9);
	f.reset();
	expect(f.get()).toBe(0.42);
});

test("lin-matched release to baseline 0.994 per-frame coefficient at 60fps", () => {
	const releaseMs = -1000 / 60 / Math.log(0.994);
	const f = createPeakFollower(0.5, 0, releaseMs, 0.03);
	const v = f.update(0, 1000 / 60);
	expect(Math.abs(v - 0.5 * 0.994) < 1e-9).toBe(true);
});