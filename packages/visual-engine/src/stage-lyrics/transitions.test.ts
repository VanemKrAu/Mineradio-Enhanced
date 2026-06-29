import { expect, test } from "bun:test";
import type { GsapLike, GsapTimelineLike, GsapTweenLike } from "../control/control-console-motion";
import {
	createTransitionEasings,
	defaultTransitionEasings,
	LYRIC_TRANSITION_DURATIONS,
	LYR_IN_EASE_FALLBACK,
	LYR_OUT_EASE_FALLBACK,
	LYR_BOB_EASE,
	playStageLineInTimeline,
	playStageLineBobTimeline,
	playStageLineOutTimeline,
} from "./transitions";

type RecordedCall = { method: string; args: unknown[] };

function makeFakeTimeline(recorder: RecordedCall[]): GsapTimelineLike {
	const node: GsapTimelineLike = {
		to(target, vars, position) {
			recorder.push({ method: "tl.to", args: [target, vars, position] });
			return node;
		},
		fromTo(target, from, to, position) {
			recorder.push({ method: "tl.fromTo", args: [target, from, to, position] });
			return node;
		},
		kill() {
			recorder.push({ method: "tl.kill", args: [] });
			return node;
		},
	};
	return node;
}

function makeFakeGsap(recorder: RecordedCall[]): GsapLike {
	return {
		to(target, vars) {
			recorder.push({ method: "to", args: [target, vars] });
			return { kill: () => recorder.push({ method: "tween.kill", args: [target] }) } as GsapTweenLike;
		},
		fromTo(target, from, to) {
			recorder.push({ method: "fromTo", args: [target, from, to] });
			return { kill: () => recorder.push({ method: "tween.kill", args: [target] }) } as GsapTweenLike;
		},
		set(target, vars) {
			recorder.push({ method: "set", args: [target, vars] });
		},
		killTweensOf(target, _props) {
			recorder.push({ method: "killTweensOf", args: [target] });
		},
		timeline(vars) {
			recorder.push({ method: "timeline", args: [vars] });
			return makeFakeTimeline(recorder);
		},
	};
}

function makeFakeGroup(): { group: object; position: object; rotation: object; scale: object; uniforms: object } {
	const uOpacity = { value: 0 };
	const textMat = { uniforms: { uOpacity } };
	const group = {
		position: { x: 0.1, y: 0.2, z: 1.46 },
		rotation: { x: 0, y: 0, z: 0 },
		scale: { x: 0.96, y: 0.96, z: 0.96 },
		userData: { lyric: { textMat } },
	};
	return { group, position: group.position, rotation: group.rotation, scale: group.scale, uniforms: uOpacity as object } as never;
}

test("transition duration constants match baseline (900/5600/700ms; bob starts at 0.9s)", () => {
	expect(LYRIC_TRANSITION_DURATIONS.LYR_IN_MS).toBe(900);
	expect(LYRIC_TRANSITION_DURATIONS.LYR_BOB_MS).toBe(5600);
	expect(LYRIC_TRANSITION_DURATIONS.LYR_OUT_MS).toBe(700);
	expect(LYRIC_TRANSITION_DURATIONS.LYR_BOB_START_OFFSET_MS).toBe(900);
	expect(LYRIC_TRANSITION_DURATIONS.LYR_IN_OPACITY_REACH_FRACTION).toBeCloseTo(0.55, 6);
});

test("defaultTransitionEasings uses documented approximations (back.out(1.4) / power2.in / sine.inOut)", () => {
	const e = defaultTransitionEasings();
	expect(e.inEase).toBe(LYR_IN_EASE_FALLBACK);
	expect(e.outEase).toBe(LYR_OUT_EASE_FALLBACK);
	expect(e.bobEase).toBe(LYR_BOB_EASE);
});

test("createTransitionEasings uses customEase creator output when provided", () => {
	const e = createTransitionEasings((id, _path) => id);
	expect(e.inEase).toBe("lyr-in-ease");
	expect(e.outEase).toBe("lyr-out-ease");
	expect(e.bobEase).toBe(LYR_BOB_EASE);
});

test("createTransitionEasings falls back when customEase throws", () => {
	const e = createTransitionEasings(() => {
		throw new Error("no");
	});
	expect(e.inEase).toBe(LYR_IN_EASE_FALLBACK);
	expect(e.outEase).toBe(LYR_OUT_EASE_FALLBACK);
});

test("playStageLineInTimeline uses 900ms duration + target transforms from rest toward final", () => {
	const rec: RecordedCall[] = [];
	const gsap = makeFakeGsap(rec);
	const { group, position, rotation, scale, uniforms } = makeFakeGroup();
	playStageLineInTimeline(gsap, group as never, {});
	const fromTos = rec.filter((c) => c.method === "tl.fromTo");
	const posFromTo = fromTos.find((c) => c.args[0] === position);
	const rotFromTo = fromTos.find((c) => c.args[0] === rotation);
	const scaleFromTo = fromTos.find((c) => c.args[0] === scale);
	expect(posFromTo).not.toBeUndefined();
	expect(((posFromTo!.args[2] as Record<string, unknown>).duration as number) * 1000).toBe(900);
	expect((posFromTo!.args[2] as Record<string, unknown>).x).toBeCloseTo(0.1, 6);
	expect((posFromTo!.args[2] as Record<string, unknown>).z).toBeCloseTo(1.46, 6);
	expect(rotFromTo).not.toBeUndefined();
	expect(((rotFromTo!.args[2] as Record<string, unknown>).duration as number) * 1000).toBe(900);
	expect((rotFromTo!.args[2] as Record<string, unknown>).y).toBe(0);
	expect(scaleFromTo).not.toBeUndefined();
	expect((scaleFromTo!.args[2] as Record<string, unknown>).x).toBe(1);
	const opacityFromTo = fromTos.find((c) => c.args[0] === uniforms);
	expect(opacityFromTo).not.toBeUndefined();
	const toVars = opacityFromTo!.args[2] as Record<string, unknown>;
	expect((toVars.duration as number) * 1000).toBeCloseTo(900 * 0.55, 4);
	expect(toVars.value).toBe(1);
});

test("playStageLineInTimeline default from transforms stay in Three world units instead of legacy pixels", () => {
	const rec: RecordedCall[] = [];
	const gsap = makeFakeGsap(rec);
	const { group, position, rotation, scale } = makeFakeGroup();
	playStageLineInTimeline(gsap, group as never, {});
	const fromTos = rec.filter((c) => c.method === "tl.fromTo");
	const posFromTo = fromTos.find((c) => c.args[0] === position)!.args[1] as Record<string, unknown>;
	expect(Math.abs((posFromTo.x as number) - 0.1)).toBeLessThanOrEqual(0.12);
	expect(Math.abs((posFromTo.y as number) - 0.2)).toBeLessThanOrEqual(0.12);
	expect(Math.abs((posFromTo.z as number) - 1.46)).toBeLessThanOrEqual(0.12);
	const rotFromTo = fromTos.find((c) => c.args[0] === rotation)!.args[1] as Record<string, unknown>;
	expect(Math.abs(rotFromTo.x as number)).toBeLessThanOrEqual((3 * Math.PI) / 180);
	expect(Math.abs(rotFromTo.y as number)).toBeLessThanOrEqual((3 * Math.PI) / 180);
	const scaleFromTo = fromTos.find((c) => c.args[0] === scale)!.args[1] as Record<string, unknown>;
	expect(scaleFromTo.x).toBeCloseTo(0.96, 4);
});

test("playStageLineBobTimeline uses 5600ms timing but only subtle Three-world drift", () => {
	const rec: RecordedCall[] = [];
	const gsap = makeFakeGsap(rec);
	const { group, position } = makeFakeGroup();
	playStageLineBobTimeline(gsap, group as never, {});
	const tos = rec.filter((c) => c.method === "tl.to" && c.args[0] === position);
	expect(todos_longer_than(tos, 4)).toBe(true);
	const phaseDur = ((tos[0].args[1] as Record<string, unknown>).duration as number) * 1000;
	expect(phaseDur).toBeCloseTo(1400, 4);
	expect(tos[0].args[2]).toBeCloseTo(0.9, 4);
	expect(tos[2].args[2]).toBeCloseTo(0.9 + 2.8 + 0.0001, 2);
	for (const call of tos) {
		const vars = call.args[1] as Record<string, unknown>;
		if (typeof vars.x === "number") expect(Math.abs(vars.x - 0.1)).toBeLessThanOrEqual(0.08);
		if (typeof vars.y === "number") expect(Math.abs(vars.y - 0.2)).toBeLessThanOrEqual(0.08);
		if (typeof vars.z === "number") expect(Math.abs(vars.z - 1.46)).toBeLessThanOrEqual(0.08);
	}
});

function todos_longer_than(tos: RecordedCall[], n: number): boolean {
	return tos.length === n;
}

test("playStageLineOutTimeline uses 700ms duration with subtle baseline-compatible drift", () => {
	const rec: RecordedCall[] = [];
	const gsap = makeFakeGsap(rec);
	const { group, position, rotation, scale } = makeFakeGroup();
	playStageLineOutTimeline(gsap, group as never, {});
	const tos = rec.filter((c) => c.method === "tl.to");
	const posTo = tos.find((c) => c.args[0] === position);
	const rotTo = tos.find((c) => c.args[0] === rotation);
	const scaleTo = tos.find((c) => c.args[0] === scale);
	expect(posTo).not.toBeUndefined();
	expect(((posTo!.args[1] as Record<string, unknown>).duration as number) * 1000).toBe(700);
	expect(Math.abs(((posTo!.args[1] as Record<string, unknown>).x as number) - 0.1)).toBeLessThanOrEqual(0.12);
	expect(Math.abs(((posTo!.args[1] as Record<string, unknown>).y as number) - 0.2)).toBeLessThanOrEqual(0.12);
	expect(Math.abs(((posTo!.args[1] as Record<string, unknown>).z as number) - 1.46)).toBeLessThanOrEqual(0.12);
	expect(rotTo).not.toBeUndefined();
	expect(((rotTo!.args[1] as Record<string, unknown>).duration as number) * 1000).toBe(700);
	expect(Math.abs((rotTo!.args[1] as Record<string, unknown>).x as number)).toBeLessThanOrEqual((3 * Math.PI) / 180);
	expect(Math.abs((rotTo!.args[1] as Record<string, unknown>).y as number)).toBeLessThanOrEqual((3 * Math.PI) / 180);
	expect(scaleTo).not.toBeUndefined();
	expect((scaleTo!.args[1] as Record<string, unknown>).x).toBeCloseTo(0.98, 5);
});

test("playStageLineBobTimeline returns null when reduceMotion enabled", () => {
	const rec: RecordedCall[] = [];
	const gsap = makeFakeGsap(rec);
	const { group } = makeFakeGroup();
	const out = playStageLineBobTimeline(gsap, group as never, { reduceMotion: true });
	expect(out).toBeNull();
});
