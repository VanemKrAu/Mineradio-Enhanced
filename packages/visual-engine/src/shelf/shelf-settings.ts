export interface ShelfSettings {
	size: number;
	x: number;
	y: number;
	z: number;
	angle: number;
	opacity: number;
	bgOpacity: number;
	accent: string;
}

const DEFAULT_ACCENT = "#f4d28a";

function clampRange(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}

function normalizeHexColor(value: string | undefined, fallback: string): string {
	if (!value || typeof value !== "string") return fallback;
	const trimmed = value.trim();
	const longHex = /^#([0-9a-fA-F]{6})$/.exec(trimmed);
	if (longHex) return `#${longHex[1].toLowerCase()}`;
	const shortHex = /^#([0-9a-fA-F]{3})$/.exec(trimmed);
	if (shortHex) {
		const [, h] = shortHex;
		return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`.toLowerCase();
	}
	return fallback;
}

export const SHELF_SETTINGS: ShelfSettings = {
	size: clampRange(1, 0.65, 1.45),
	x: clampRange(0, -1.2, 1.2),
	y: clampRange(0, -0.9, 0.9),
	z: clampRange(0, -0.9, 0.9),
	angle: clampRange(0, -30, 30) * Math.PI / 180,
	opacity: clampRange(0.96, 0.25, 1),
	bgOpacity: clampRange(0.55, 0.25, 0.98),
	accent: normalizeHexColor(DEFAULT_ACCENT, DEFAULT_ACCENT),
};