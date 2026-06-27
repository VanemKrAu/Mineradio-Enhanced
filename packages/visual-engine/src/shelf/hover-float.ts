export function updateHoverFloatMix(
	current: number,
	selected: boolean,
	dtMs: number,
): number {
	const target = selected ? 1 : 0;
	const factor = selected ? 0.20 : 0.13;
	const stepMix = 1 - Math.pow(1 - factor, dtMs / 16.67);
	let next = current + (target - current) * stepMix;
	if (!selected && next < 0.004) next = 0;
	return next;
}