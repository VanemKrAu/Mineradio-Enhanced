export interface PeakFollower {
	update(value: number, dtMs: number): number;
	get(): number;
	reset(): void;
}

export interface PeakFollowerParams {
	initial: number;
	attackMs: number;
	releaseMs: number;
	floor: number;
}

export function createPeakFollower(
	initial: number,
	attackMs: number,
	releaseMs: number,
	floor: number,
): PeakFollower {
	let peak = Math.max(initial, floor);
	return {
		update(value: number, dtMs: number): number {
			const dtSec = Math.max(0, dtMs) / 1000;
			const releaseTauSec = releaseMs > 0 ? releaseMs / 1000 : Infinity;
			const decayed = isFinite(releaseTauSec)
				? peak * Math.exp(-dtSec / releaseTauSec)
				: peak;
			if (value > peak && attackMs > 0.001) {
				const attackTauSec = attackMs / 1000;
				const t = 1 - Math.exp(-dtSec / Math.max(1e-6, attackTauSec));
				peak = peak + (value - peak) * t;
			} else {
				peak = Math.max(decayed, value, floor);
			}
			if (peak < floor) peak = floor;
			return peak;
		},
		get() {
			return peak;
		},
		reset() {
			peak = Math.max(initial, floor);
		},
	};
}