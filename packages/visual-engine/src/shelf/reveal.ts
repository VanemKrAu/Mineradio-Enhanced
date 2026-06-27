export function computeRevealRaw(
	uTime: number,
	shelfOpenAnimAt: number,
	absD: number,
): number {
	return (uTime - shelfOpenAnimAt - absD * 0.035) / 0.62;
}

export function computePaneRaw(
	uTime: number,
	paneSwitchAt: number,
	absD: number,
): number {
	return (uTime - paneSwitchAt - absD * 0.030) / 0.72;
}

function clamp01(v: number): number {
	if (v < 0) return 0;
	if (v > 1) return 1;
	return v;
}

export function smoothstep01(t: number): number {
	const c = clamp01(t);
	return c * c * (3 - 2 * c);
}