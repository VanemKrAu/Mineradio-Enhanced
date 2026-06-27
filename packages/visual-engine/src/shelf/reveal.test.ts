import { expect, test } from "bun:test";
import { computeRevealRaw, computePaneRaw } from "./reveal";

test("revealRaw uses stagger 0.035 + duration 0.62 verbatim", () => {
	const uTime = 1.5;
	const animAt = 0.5;
	const absD = 2;
	const expected = (uTime - animAt - absD * 0.035) / 0.62;
	expect(computeRevealRaw(uTime, animAt, absD)).toBeCloseTo(expected, 6);
});

test("revealRaw at uTime == animAt absD=0 is exactly 0", () => {
	expect(computeRevealRaw(0.5, 0.5, 0)).toBeCloseTo(0, 6);
});

test("revealRaw increasing when uTime advances", () => {
	const a = computeRevealRaw(1.0, 0.0, 0);
	const b = computeRevealRaw(1.5, 0.0, 0);
	expect(b).toBeGreaterThan(a);
});

test("revealRaw further cards stagger later (absD positive shifts revealRaw down)", () => {
	const near = computeRevealRaw(0.7, 0.0, 0);
	const far = computeRevealRaw(0.7, 0.0, 3);
	expect(far).toBeLessThan(near);
});

test("paneRaw uses stagger 0.030 + duration 0.72 verbatim", () => {
	const uTime = 2.0;
	const paneAt = 0.4;
	const absD = 1.5;
	const expected = (uTime - paneAt - absD * 0.030) / 0.72;
	expect(computePaneRaw(uTime, paneAt, absD)).toBeCloseTo(expected, 6);
});

test("paneRaw at switch moment is 0", () => {
	expect(computePaneRaw(0.4, 0.4, 0)).toBeCloseTo(0, 6);
});