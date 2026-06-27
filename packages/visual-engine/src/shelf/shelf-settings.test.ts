import { expect, test } from "bun:test";
import { SHELF_SETTINGS, type ShelfSettings } from "./shelf-settings";

test("SHELF_SETTINGS exports the eight baseline keys", () => {
	const keys = Object.keys(SHELF_SETTINGS);
	expect(keys).toEqual(
		expect.arrayContaining([
			"size",
			"x",
			"y",
			"z",
			"angle",
			"opacity",
			"bgOpacity",
			"accent",
		]),
	);
	expect(keys.length).toBe(8);
});

test("SHELF_SETTINGS numeric bounds match baseline shelfSettings()", () => {
	const s = SHELF_SETTINGS as ShelfSettings;
	expect(s.size).toBeGreaterThan(0.65 - 1e-6);
	expect(s.size).toBeLessThanOrEqual(1.45 + 1e-6);
	expect(s.x).toBeGreaterThanOrEqual(-1.2);
	expect(s.x).toBeLessThanOrEqual(1.2);
	expect(s.y).toBeGreaterThanOrEqual(-0.9);
	expect(s.y).toBeLessThanOrEqual(0.9);
	expect(s.z).toBeGreaterThanOrEqual(-0.9);
	expect(s.z).toBeLessThanOrEqual(0.9);
	expect(s.opacity).toBeGreaterThanOrEqual(0.25);
	expect(s.opacity).toBeLessThanOrEqual(1);
	expect(s.bgOpacity).toBeGreaterThanOrEqual(0.25);
	expect(s.bgOpacity).toBeLessThanOrEqual(0.98);
});

test("SHELF_SETTINGS.angle is already converted from degrees to radians", () => {
	const s = SHELF_SETTINGS as ShelfSettings;
	expect(s.angle).toBeGreaterThanOrEqual(-30 * Math.PI / 180 - 1e-6);
	expect(s.angle).toBeLessThanOrEqual(30 * Math.PI / 180 + 1e-6);
});

test("SHELF_SETTINGS.accent is a normalized hex color string", () => {
	const s = SHELF_SETTINGS as ShelfSettings;
	expect(typeof s.accent).toBe("string");
	expect(s.accent).toMatch(/^#[0-9a-fA-F]{6}$/);
});