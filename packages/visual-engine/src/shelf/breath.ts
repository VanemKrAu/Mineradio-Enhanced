export function computeBreathPulse(
	uTimeSeconds: number,
	index: number,
	shelfVisibility: number,
): number {
	return shelfVisibility * (0.5 + 0.5 * Math.sin(uTimeSeconds * 1.22 + index * 0.74));
}