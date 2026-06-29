import type * as THREE from "three";
import type { GsapLike, GsapTimelineLike } from "../control/control-console-motion";

export type CustomEaseCreator = (id: string, path: string) => string;

export const LYRIC_TRANSITION_DURATIONS = {
	LYR_IN_MS: 900,
	LYR_BOB_MS: 5600,
	LYR_OUT_MS: 700,
	LYR_BOB_START_OFFSET_MS: 900,
	LYR_IN_OPACITY_REACH_FRACTION: 0.55,
} as const;

export const LYR_IN_BEZIER_PATH = "M0,0 C0.16,0.84 0.32,1.02 1,1";
export const LYR_OUT_BEZIER_PATH = "M0,0 C0.55,0 0.85,0.45 1,1";

export const LYR_IN_EASE_NAME = "lyr-in-ease";
export const LYR_OUT_EASE_NAME = "lyr-out-ease";

export const LYR_IN_EASE_FALLBACK = "back.out(1.4)";
export const LYR_OUT_EASE_FALLBACK = "power2.in";
export const LYR_BOB_EASE = "sine.inOut";

export interface LyricTransitionEasings {
	inEase: string;
	outEase: string;
	bobEase: string;
}

export function defaultTransitionEasings(): LyricTransitionEasings {
	return { inEase: LYR_IN_EASE_FALLBACK, outEase: LYR_OUT_EASE_FALLBACK, bobEase: LYR_BOB_EASE };
}

export function createTransitionEasings(customEase: CustomEaseCreator): LyricTransitionEasings {
	let inEase = LYR_IN_EASE_FALLBACK;
	let outEase = LYR_OUT_EASE_FALLBACK;
	try {
		inEase = customEase(LYR_IN_EASE_NAME, LYR_IN_BEZIER_PATH);
	} catch {
		inEase = LYR_IN_EASE_FALLBACK;
	}
	try {
		outEase = customEase(LYR_OUT_EASE_NAME, LYR_OUT_BEZIER_PATH);
	} catch {
		outEase = LYR_OUT_EASE_FALLBACK;
	}
	return { inEase, outEase, bobEase: LYR_BOB_EASE };
}

export interface LyricTransitionOpts {
	easings?: LyricTransitionEasings;
	inX?: number;
	inY?: number;
	inZ?: number;
	inRotXdeg?: number;
	inRotYdeg?: number;
	inScale?: number;
	outX?: number;
	outY?: number;
	outZ?: number;
	outRotXdeg?: number;
	outRotYdeg?: number;
	outScale?: number;
	bobScaleDistortion?: boolean;
	reduceMotion?: boolean;
	onComplete?: () => void;
}

type Vec3Like = { x: number; y: number; z: number };

function restOf(group: THREE.Group): Vec3Like {
	const p = group.position as unknown as Vec3Like;
	return { x: p.x, y: p.y, z: p.z };
}

function getLyricOpacityTarget(group: THREE.Group): { value: number } | null {
	const data = (group as unknown as { userData?: { lyric?: { textMat?: { uniforms?: { uOpacity?: { value: number } } } } } }).userData?.lyric;
	const u = data?.textMat?.uniforms?.uOpacity;
	return u ?? null;
}

function degToRad(d: number): number {
	return (d * Math.PI) / 180;
}

export function playStageLineInTimeline(
	gsap: GsapLike,
	group: THREE.Group,
	opts: LyricTransitionOpts = {},
): GsapTimelineLike | null {
	const easings = opts.easings ?? defaultTransitionEasings();
	const rest = restOf(group);
	const inX = opts.inX ?? -0.04;
	const inY = opts.inY ?? 0.08;
	const inZ = opts.inZ ?? -0.08;
	const inRotX = degToRad(opts.inRotXdeg ?? 2);
	const inRotY = degToRad(opts.inRotYdeg ?? -2);
	const inScale = opts.inScale ?? 0.96;
	const inDur = LYRIC_TRANSITION_DURATIONS.LYR_IN_MS / 1000;
	const opacityDur = inDur * LYRIC_TRANSITION_DURATIONS.LYR_IN_OPACITY_REACH_FRACTION;
	const tl = gsap.timeline({
		defaults: { ease: easings.inEase },
	});
	const posTarget = group.position as unknown as Vec3Like;
	const rotTarget = group.rotation as unknown as Vec3Like;
	const scaleTarget = group.scale as unknown as Vec3Like;
	tl.fromTo(
		posTarget,
		{ x: rest.x + inX, y: rest.y + inY, z: rest.z + inZ },
		{ x: rest.x, y: rest.y, z: rest.z, duration: inDur, ease: easings.inEase },
		0,
	);
	tl.fromTo(rotTarget, { x: inRotX, y: inRotY }, { x: 0, y: 0, duration: inDur, ease: easings.inEase }, 0);
	tl.fromTo(
		scaleTarget,
		{ x: inScale, y: inScale, z: inScale },
		{ x: 1, y: 1, z: 1, duration: inDur, ease: easings.inEase },
		0,
	);
	const uOpacity = getLyricOpacityTarget(group);
	if (uOpacity) {
		tl.fromTo(uOpacity, { value: 0 }, { value: 1, duration: opacityDur, ease: easings.inEase }, 0);
	}
	return tl;
}

export function playStageLineBobTimeline(
	gsap: GsapLike,
	group: THREE.Group,
	opts: LyricTransitionOpts = {},
): GsapTimelineLike | null {
	const easings = opts.easings ?? defaultTransitionEasings();
	const rest = restOf(group);
	if (opts.reduceMotion) return null;
	const startOffset = LYRIC_TRANSITION_DURATIONS.LYR_BOB_START_OFFSET_MS / 1000;
	const phaseDur = (LYRIC_TRANSITION_DURATIONS.LYR_BOB_MS / 1000) / 4;
	const tl = gsap.timeline({
		repeat: -1,
		defaults: { ease: easings.bobEase },
	});
	const posTarget = group.position as unknown as Vec3Like;
	const rotTarget = group.rotation as unknown as Vec3Like;
	const scaleTarget = group.scale as unknown as Vec3Like;
	tl.to(posTarget, { x: rest.x + 0.035, y: rest.y - 0.045, z: rest.z + 0.060, duration: phaseDur, ease: easings.bobEase }, startOffset);
	tl.to(rotTarget, { x: degToRad(1.1), y: degToRad(-0.8), duration: phaseDur, ease: easings.bobEase }, startOffset);
	tl.to(scaleTarget, { x: 1.01, y: 1.01, z: 1.01, duration: phaseDur, ease: easings.bobEase }, startOffset);
	tl.to(posTarget, { x: rest.x, y: rest.y + 0.030, z: rest.z, duration: phaseDur, ease: easings.bobEase }, startOffset + phaseDur);
	tl.to(rotTarget, { x: degToRad(-0.9), y: 0, duration: phaseDur, ease: easings.bobEase }, startOffset + phaseDur);
	tl.to(scaleTarget, { x: 0.99, y: 0.99, z: 0.99, duration: phaseDur, ease: easings.bobEase }, startOffset + phaseDur);
	tl.to(posTarget, { x: rest.x - 0.040, y: rest.y - 0.030, z: rest.z + 0.050, duration: phaseDur, ease: easings.bobEase }, startOffset + 2 * phaseDur);
	tl.to(rotTarget, { x: degToRad(0.7), y: degToRad(0.8), duration: phaseDur, ease: easings.bobEase }, startOffset + 2 * phaseDur);
	tl.to(scaleTarget, { x: 1.005, y: 1.005, z: 1.005, duration: phaseDur, ease: easings.bobEase }, startOffset + 2 * phaseDur);
	tl.to(posTarget, { x: rest.x, y: rest.y, z: rest.z, duration: phaseDur, ease: easings.bobEase }, startOffset + 3 * phaseDur);
	tl.to(rotTarget, { x: 0, y: 0, duration: phaseDur, ease: easings.bobEase }, startOffset + 3 * phaseDur);
	tl.to(scaleTarget, { x: 1, y: 1, z: 1, duration: phaseDur, ease: easings.bobEase }, startOffset + 3 * phaseDur);
	return tl;
}

export function playStageLineOutTimeline(
	gsap: GsapLike,
	group: THREE.Group,
	opts: LyricTransitionOpts = {},
): GsapTimelineLike | null {
	const easings = opts.easings ?? defaultTransitionEasings();
	const rest = restOf(group);
	const outX = opts.outX ?? 0.04;
	const outY = opts.outY ?? -0.08;
	const outZ = opts.outZ ?? -0.10;
	const outRotX = degToRad(opts.outRotXdeg ?? -2);
	const outRotY = degToRad(opts.outRotYdeg ?? 2);
	const outScale = opts.outScale ?? 0.98;
	const outDur = LYRIC_TRANSITION_DURATIONS.LYR_OUT_MS / 1000;
	const tl = gsap.timeline({
		defaults: { ease: easings.outEase },
		onComplete: opts.onComplete,
	});
	const posTarget = group.position as unknown as Vec3Like;
	const rotTarget = group.rotation as unknown as Vec3Like;
	const scaleTarget = group.scale as unknown as Vec3Like;
	tl.to(posTarget, { x: rest.x + outX, y: rest.y + outY, z: rest.z + outZ, duration: outDur, ease: easings.outEase }, 0);
	tl.to(rotTarget, { x: outRotX, y: outRotY, duration: outDur, ease: easings.outEase }, 0);
	tl.to(scaleTarget, { x: outScale, y: outScale, z: outScale, duration: outDur, ease: easings.outEase }, 0);
	const uOpacity = getLyricOpacityTarget(group);
	if (uOpacity) {
		tl.to(uOpacity, { value: 0, duration: outDur, ease: easings.outEase }, 0);
	}
	return tl;
}
