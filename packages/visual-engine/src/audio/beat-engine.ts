import { clamp01 } from "./frequency-bands";

export interface BeatSamples {
	sub: number;
	kick: number;
	body: number;
	vocal: number;
	snap: number;
	rms: number;
	currentTimeSec: number;
}

export interface BeatEngineFrame {
	hit: boolean;
	strength: number;
	confidence: number;
	score: number;
	lowPresence: number;
	body: number;
	vocal: number;
	snap: number;
	mass: number;
	sharpness: number;
	tempoAssist: boolean;
	tempoGap: number;
	tempoConfidence: number;
	combo: string | null;
	lowDominance: number;
	pulse: number;
	bpm: number | null;
	time: number;
}

export interface BeatEngineOpts {
	tempoLockMinGapMs: number;
	tempoLockMaxGapMs: number;
	onsetSensitivity: number;
	followersAttackMs: number;
	followersReleaseMs: number;
	tempoConfidenceMin: number;
	warmupFrames: number;
	warmupDurationSec: number;
	minIntervalSec: number;
}

export const DEFAULT_BEAT_ENGINE_OPTS: BeatEngineOpts = {
	tempoLockMinGapMs: 420,
	tempoLockMaxGapMs: 880,
	onsetSensitivity: 0.16,
	followersAttackMs: 0,
	followersReleaseMs: 0,
	tempoConfidenceMin: 0.38,
	warmupFrames: 18,
	warmupDurationSec: 1.15,
	minIntervalSec: 0.34,
};

export type BeatOnsetCallback = (strength: number, isScheduled: boolean) => void;

export interface BeatEngine {
	update(samples: BeatSamples, dtMs: number): BeatEngineFrame;
	reset(currentTimeSec?: number): void;
	onOnset(cb: BeatOnsetCallback): () => void;
	getState(): RtStateView;
}

export interface RtStateView {
	pulse: number;
	onsetAvg: number;
	onsetPeak: number;
	subPeak: number;
	lowPeak: number;
	bodyPeak: number;
	vocalPeak: number;
	snapPeak: number;
	tempoGap: number;
	tempoConfidence: number;
	lastHitAt: number;
	beatCount: number;
}

interface RtState {
	subFast: number;
	subSlow: number;
	lowFast: number;
	lowSlow: number;
	bodyFast: number;
	bodySlow: number;
	vocalFast: number;
	vocalSlow: number;
	snapFast: number;
	snapSlow: number;
	prevSub: number;
	prevLow: number;
	prevBody: number;
	prevVocal: number;
	prevSnap: number;
	prevRms: number;
	onsetAvg: number;
	onsetPeak: number;
	subPeak: number;
	lowPeak: number;
	bodyPeak: number;
	vocalPeak: number;
	snapPeak: number;
	lastHitAt: number;
	tempoGap: number;
	tempoConfidence: number;
	beatCount: number;
	primedFrames: number;
	warmupUntil: number;
	pulse: number;
	score: number;
	stats: { hits: number; blocked: number; assisted: number; strong: number; rejected: number };
}

function createInitialState(): RtState {
	return {
		subFast: 0, subSlow: 0, lowFast: 0, lowSlow: 0,
		bodyFast: 0, bodySlow: 0, vocalFast: 0, vocalSlow: 0, snapFast: 0, snapSlow: 0,
		prevSub: 0, prevLow: 0, prevBody: 0, prevVocal: 0, prevSnap: 0, prevRms: 0,
		onsetAvg: 0.012, onsetPeak: 0.060,
		subPeak: 0.14, lowPeak: 0.18, bodyPeak: 0.16, vocalPeak: 0.16, snapPeak: 0.14,
		lastHitAt: -10,
		tempoGap: 0,
		tempoConfidence: 0,
		beatCount: 0,
		primedFrames: 0,
		warmupUntil: 0,
		pulse: 0,
		score: 0,
		stats: { hits: 0, blocked: 0, assisted: 0, strong: 0, rejected: 0 },
	};
}

function follow(cur: number, next: number, upTau: number, downTau: number, dt: number): number {
	const tau = next > cur ? upTau : downTau;
	return cur + (next - cur) * (1 - Math.exp(-dt / Math.max(0.001, tau)));
}

export function createBeatEngine(opts: Partial<BeatEngineOpts> = {}): BeatEngine {
	const cfg: BeatEngineOpts = { ...DEFAULT_BEAT_ENGINE_OPTS, ...opts };
	const tempoLockMinGap = cfg.tempoLockMinGapMs / 1000;
	const tempoLockMaxGap = cfg.tempoLockMaxGapMs / 1000;
	const subscribers = new Set<BeatOnsetCallback>();
	let state = createInitialState();

	function notify(strength: number) {
		for (const cb of subscribers) {
			try {
				cb(strength, false);
			} catch {
				// ignore handler failures
			}
		}
	}

	function update(samples: BeatSamples, dtMs: number): BeatEngineFrame {
		const dt = Math.max(0.001, Math.min(0.08, (dtMs || 16) / 1000));
		const { sub, kick, body, vocal, snap, rms, currentTimeSec } = samples;
		const low = Math.min(1, kick * 0.86 + sub * 0.42);
		const dj = false;

		state.subFast = follow(state.subFast, sub, 0.018, 0.064, dt);
		state.subSlow = follow(state.subSlow, sub, 0.320, 0.520, dt);
		state.lowFast = follow(state.lowFast, low, 0.016, 0.070, dt);
		state.lowSlow = follow(state.lowSlow, low, 0.300, 0.540, dt);
		state.bodyFast = follow(state.bodyFast, body, 0.020, 0.082, dt);
		state.bodySlow = follow(state.bodySlow, body, 0.360, 0.600, dt);
		state.vocalFast = follow(state.vocalFast, vocal, 0.026, 0.090, dt);
		state.vocalSlow = follow(state.vocalSlow, vocal, 0.340, 0.580, dt);
		state.snapFast = follow(state.snapFast, snap, 0.012, 0.060, dt);
		state.snapSlow = follow(state.snapSlow, snap, 0.300, 0.520, dt);

		const peakDecay = 0.990;
		state.subPeak = Math.max(state.subPeak * Math.pow(peakDecay, dt * 60), sub, 0.045);
		state.lowPeak = Math.max(state.lowPeak * Math.pow(0.989, dt * 60), low, 0.060);
		state.bodyPeak = Math.max(state.bodyPeak * Math.pow(peakDecay, dt * 60), body, 0.040);
		state.vocalPeak = Math.max(state.vocalPeak * Math.pow(peakDecay, dt * 60), vocal, 0.040);
		state.snapPeak = Math.max(state.snapPeak * Math.pow(peakDecay, dt * 60), snap, 0.035);

		const subFlux = Math.max(0, sub - state.prevSub);
		const lowFlux = Math.max(0, low - state.prevLow);
		const bodyFlux = Math.max(0, body - state.prevBody);
		const vocalFlux = Math.max(0, vocal - state.prevVocal);
		const snapFlux = Math.max(0, snap - state.prevSnap);
		const rmsFlux = Math.max(0, rms - state.prevRms);
		const subRise = Math.max(0, state.subFast - state.subSlow);
		const lowRise = Math.max(0, state.lowFast - state.lowSlow);
		const bodyRise = Math.max(0, state.bodyFast - state.bodySlow);
		const vocalRise = Math.max(0, state.vocalFast - state.vocalSlow);
		const snapRise = Math.max(0, state.snapFast - state.snapSlow);
		const drumOnset = subRise * 0.88 + subFlux * 0.66 + lowRise * 1.62 + lowFlux * 1.34;
		const musicalOnset =
			bodyRise * 0.34 + bodyFlux * 0.24 + vocalRise * 0.52 + vocalFlux * 0.36 +
			snapRise * 0.08 + snapFlux * 0.06 + rmsFlux * 0.20;
		const onset = dj ? (drumOnset * 1.05 + musicalOnset * 0.07) : (drumOnset + musicalOnset * 0.16);

		const avgTau = onset > state.onsetAvg ? 1.10 : 0.34;
		state.onsetAvg = follow(state.onsetAvg, onset, avgTau, avgTau, dt);
		state.onsetPeak = Math.max(state.onsetPeak * Math.pow(0.988, dt * 60), onset, 0.032);
		const floor = state.onsetAvg * 0.84;
		const score = clamp01((onset - floor) / Math.max(0.014, state.onsetPeak - floor));
		const subNorm = clamp01(sub / Math.max(0.045, state.subPeak * 0.70));
		const lowNorm = clamp01(low / Math.max(0.060, state.lowPeak * 0.72));
		const bodyNorm = clamp01(body / Math.max(0.045, state.bodyPeak * 0.72));
		const vocalNorm = clamp01(vocal / Math.max(0.045, state.vocalPeak * 0.72));
		const snapNorm = clamp01(snap / Math.max(0.040, state.snapPeak * 0.72));

		const nowT = currentTimeSec || 0;
		state.primedFrames++;
		const warmingUp = nowT < state.warmupUntil || state.primedFrames < cfg.warmupFrames;
		const gapFromLast = nowT - state.lastHitAt;
		const expectedGap = state.tempoGap > 0 ? state.tempoGap : 0;
		const phaseErr = expectedGap > 0 ? Math.abs(gapFromLast - expectedGap) : 99;
		const phaseWindow =
			expectedGap > 0
				? Math.max(0.055, Math.min(0.105, expectedGap * 0.16))
				: 0;
		void phaseErr;
		const tempoDue =
			expectedGap > 0 &&
			gapFromLast > expectedGap - phaseWindow &&
			gapFromLast < expectedGap + phaseWindow;
		const lowPresence = Math.max(lowNorm, subNorm * 0.74);
		const lowAttack = lowRise + lowFlux * 0.72 + subRise * 0.58 + subFlux * 0.40;
		const lowDominance = low / Math.max(0.001, vocal * 0.84 + body * 0.36 + snap * 0.10);
		const lowFluxDominance =
			(lowFlux + subFlux * 0.58) /
			Math.max(0.001, vocalFlux * 0.72 + bodyFlux * 0.42 + snapFlux * 0.16);
		const voiceMask =
			dj
				? (vocalNorm > 0.62 && lowDominance < 0.92 && lowFluxDominance < 1.06 && subNorm < 0.54)
				: (vocalNorm > 0.58 && lowDominance < 0.86 && lowFluxDominance < 1.10);
		let drumGate =
			lowPresence > 0.38 &&
			lowAttack > Math.max(0.014, state.onsetAvg * 0.34) &&
			!voiceMask;
		drumGate =
			drumGate &&
			(lowDominance > 0.72 || lowFluxDominance > 1.02 || subNorm > 0.56);
		const strongTransient =
			drumGate && score > 0.54 && drumOnset > state.onsetAvg * 0.84;
		const kickTransient =
			drumGate && score > 0.40 && lowAttack > Math.max(0.018, state.onsetAvg * 0.46);
		const tempoAssist =
			tempoDue &&
			state.tempoConfidence > 0.42 &&
			drumGate &&
			lowPresence > 0 &&
			score > 0.22 &&
			lowAttack > Math.max(0.016, state.onsetAvg * 0.34);
		let candidateHit = strongTransient || kickTransient || tempoAssist;
		if (warmingUp) candidateHit = false;
		const hasTempoLock =
			expectedGap >= tempoLockMinGap && expectedGap <= tempoLockMaxGap && state.tempoConfidence > cfg.tempoConfidenceMin;
		const lockedWindow =
			hasTempoLock ? Math.max(0.070, Math.min(0.110, expectedGap * 0.16)) : 0;
		const gapRaw = nowT - state.lastHitAt;
		let rhythmAccept = false;
		if (candidateHit) {
			if (state.lastHitAt < 0) {
				rhythmAccept = strongTransient && score > 0.62 && lowPresence > 0.48;
			} else if (hasTempoLock) {
				const oneBeatErr = Math.abs(gapRaw - expectedGap);
				const twoBeatErr = Math.abs(gapRaw - expectedGap * 2);
				rhythmAccept = oneBeatErr <= lockedWindow && (kickTransient || strongTransient);
				rhythmAccept = rhythmAccept || (twoBeatErr <= lockedWindow * 1.35 && strongTransient && score > 0.58);
				rhythmAccept = rhythmAccept || (gapRaw > expectedGap * 1.55 && strongTransient && lowPresence > 0.44);
			} else {
				rhythmAccept =
					gapRaw >= cfg.minIntervalSec && strongTransient && score > 0.58 && lowPresence > 0.44;
			}
		}
		let hit = candidateHit && rhythmAccept;
		if (!hit && (candidateHit || score > 0.42 || vocalNorm > 0.62 || bodyNorm > 0.54)) {
			state.stats.rejected++;
		}
		const minGap = hasTempoLock
			? Math.max(0.400, Math.min(0.540, expectedGap * 0.72))
			: cfg.minIntervalSec;
		if (hit && gapRaw < minGap) {
			state.stats.blocked++;
			hit = false;
		}

		state.prevSub = sub;
		state.prevLow = low;
		state.prevBody = body;
		state.prevVocal = vocal;
		state.prevSnap = snap;
		state.prevRms = rms;
		state.score = score;
		state.pulse *= Math.pow(0.18, dt);
		state.tempoConfidence *= Math.pow(0.996, dt * 60);

		if (!hit) {
			return {
				hit: false,
				strength: 0,
				confidence: state.tempoConfidence,
				score,
				lowPresence: lowNorm,
				body: bodyNorm,
				vocal: vocalNorm,
				snap: snapNorm,
				mass: 0,
				sharpness: 0,
				tempoAssist: tempoAssist,
				tempoGap: state.tempoGap,
				tempoConfidence: state.tempoConfidence,
				combo: null,
				lowDominance,
				pulse: state.pulse,
				bpm: state.tempoGap > 0 ? 60 / state.tempoGap : null,
				time: nowT,
			};
		}

		let gapShift = 0;
		if (state.lastHitAt > 0) {
			let gap = nowT - state.lastHitAt;
			while (gap > 0.88) gap *= 0.5;
			while (gap < 0.42) gap *= 2.0;
			if (gap >= 0.42 && gap <= 0.88) {
				gapShift = state.tempoGap ? Math.abs(gap - state.tempoGap) / Math.max(0.001, state.tempoGap) : 0;
				const tempoEase = hasTempoLock ? 0.10 : 0.22;
				state.tempoGap = state.tempoGap ? state.tempoGap * (1 - tempoEase) + gap * tempoEase : gap;
				state.tempoConfidence = Math.min(1, state.tempoConfidence + (tempoAssist ? 0.04 : 0.18));
			}
		}
		state.lastHitAt = nowT;
		state.beatCount++;
		state.stats.hits++;
		if (tempoAssist) state.stats.assisted++;
		if (strongTransient || kickTransient) state.stats.strong++;
		let strength = clamp01(
			0.24 + score * 0.36 + lowPresence * 0.34 + Math.min(1.25, lowDominance) * 0.07 + rmsFlux * 0.95,
		);
		if (tempoAssist) {
			strength = Math.max(strength, 0.48 + state.tempoConfidence * 0.10 + lowPresence * 0.14);
		}
		const comboSlot = (state.beatCount - 1) % 4;
		let combo: string = comboSlot === 0 ? "downbeat" : comboSlot === 1 ? "push" : comboSlot === 2 ? "drop" : "rebound";
		if (strength > 0.84 && comboSlot !== 0) combo = "accent";
		if (gapShift > 0.14 && strongTransient && lowPresence > 0.52) combo = "downbeat";
		state.pulse = Math.max(state.pulse, strength);
		notify(strength);
		return {
			hit: true,
			strength,
			confidence: clamp01(score * 0.62 + lowPresence * 0.26 + state.tempoConfidence * 0.12),
			score,
			lowPresence: Math.max(0.05, lowPresence),
			body: Math.max(0.02, bodyNorm * 0.62),
			vocal: vocalNorm,
			snap: Math.max(0.02, snapNorm),
			mass: clamp01(lowPresence * 0.76 + bodyNorm * 0.20),
			sharpness: clamp01(snapNorm * 0.70 + bodyNorm * 0.12),
			tempoAssist,
			tempoGap: state.tempoGap,
			tempoConfidence: state.tempoConfidence,
			combo,
			lowDominance,
			pulse: state.pulse,
			bpm: state.tempoGap > 0 ? 60 / state.tempoGap : null,
			time: nowT,
		};
	}

	function reset(currentTimeSec: number = 0): void {
		state = createInitialState();
		state.warmupUntil = (currentTimeSec || 0) + cfg.warmupDurationSec;
	}

	return {
		update,
		reset,
		onOnset(cb: BeatOnsetCallback) {
			subscribers.add(cb);
			return () => {
				subscribers.delete(cb);
			};
		},
		getState() {
			return {
				pulse: state.pulse,
				onsetAvg: state.onsetAvg,
				onsetPeak: state.onsetPeak,
				subPeak: state.subPeak,
				lowPeak: state.lowPeak,
				bodyPeak: state.bodyPeak,
				vocalPeak: state.vocalPeak,
				snapPeak: state.snapPeak,
				tempoGap: state.tempoGap,
				tempoConfidence: state.tempoConfidence,
				lastHitAt: state.lastHitAt,
				beatCount: state.beatCount,
			};
		},
	};
}