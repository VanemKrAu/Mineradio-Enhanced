import { expect, test } from "bun:test";
import { createBeatEngine, type BeatSamples } from "./beat-engine";

const MS_PER_FRAME = 1000 / 60;

function makeSamples(t: number): BeatSamples {
	return {
		sub: 0.6,
		kick: 0.85,
		body: 0.4,
		vocal: 0.3,
		snap: 0.2,
		rms: 0.7,
		currentTimeSec: t,
	};
}

function makeSilence(t: number): BeatSamples {
	return {
		sub: 0,
		kick: 0,
		body: 0,
		vocal: 0,
		snap: 0,
		rms: 0,
		currentTimeSec: t,
	};
}

test("warmup phase suppresses the first beat hits", () => {
	const engine = createBeatEngine();
	engine.reset(0);
	let t = 0;
	let hitsDuringWarmup = 0;
	for (let i = 0; i < 10; i++) {
		const out = engine.update(makeSamples(t), MS_PER_FRAME);
		if (out.hit) hitsDuringWarmup++;
		t += MS_PER_FRAME / 1000;
	}
	expect(hitsDuringWarmup).toBe(0);
});

test("successful hits fire onOnset callback and arrive after warmup", () => {
	const engine = createBeatEngine();
	engine.reset(0);
	let t = 0;
	let callbacks = 0;
	engine.onOnset(() => {
		callbacks++;
	});
	for (let i = 0; i < 70; i++) {
		engine.update(makeSilence(t), MS_PER_FRAME);
		t += MS_PER_FRAME / 1000;
	}
	let hits = 0;
	for (let pulse = 0; pulse < 6; pulse++) {
		t += 0.5;
		const out = engine.update(makeSamples(t), MS_PER_FRAME);
		if (out.hit) hits++;
		engine.update(makeSilence(t), MS_PER_FRAME);
	}
	expect(hits).toBeGreaterThan(3);
	expect(callbacks).toBeGreaterThan(3);
});

test("tempo lock converges toward 0.5s gap; bpm ≈ 120", () => {
	const engine = createBeatEngine();
	engine.reset(0);
	let t = 0;
	let lastFrame = null;
	for (let i = 0; i < 70; i++) {
		engine.update(makeSilence(t), MS_PER_FRAME);
		t += MS_PER_FRAME / 1000;
	}
	for (let pulse = 0; pulse < 16; pulse++) {
		t += 0.5;
		lastFrame = engine.update(makeSamples(t), MS_PER_FRAME);
		engine.update(makeSilence(t), MS_PER_FRAME);
	}
	const st = engine.getState();
	expect(st.tempoGap).toBeGreaterThan(0);
	expect(Math.abs(st.tempoGap - 0.5) < 0.04).toBe(true);
	expect(lastFrame?.hit).toBe(true);
	expect(lastFrame?.bpm).not.toBeNull();
	if (lastFrame && lastFrame.bpm != null) {
		expect(Math.abs(lastFrame.bpm - 120) < 10).toBe(true);
	}
});

test("reset clears tempo and hit statistics", () => {
	const engine = createBeatEngine();
	engine.reset(0);
	let t = 0;
	for (let i = 0; i < 70; i++) {
		engine.update(makeSilence(t), MS_PER_FRAME);
		t += MS_PER_FRAME / 1000;
	}
	for (let pulse = 0; pulse < 4; pulse++) {
		t += 0.5;
		engine.update(makeSamples(t), MS_PER_FRAME);
		engine.update(makeSilence(t), MS_PER_FRAME);
	}
	expect(engine.getState().tempoGap).toBeGreaterThan(0);
	engine.reset(t);
	expect(engine.getState().tempoGap).toBe(0);
	expect(engine.getState().tempoConfidence).toBe(0);
	expect(engine.getState().lastHitAt).toBe(-10);
});

test("onOnset returns an unsubscribe function that removes the handler", () => {
	const engine = createBeatEngine();
	engine.reset(0);
	let t = 0;
	let calls = 0;
	const unsub = engine.onOnset(() => calls++);
	for (let i = 0; i < 70; i++) {
		engine.update(makeSilence(t), MS_PER_FRAME);
		t += MS_PER_FRAME / 1000;
	}
	for (let pulse = 0; pulse < 4; pulse++) {
		t += 0.5;
		engine.update(makeSamples(t), MS_PER_FRAME);
		engine.update(makeSilence(t), MS_PER_FRAME);
	}
	const baselineCalls = calls;
	unsub();
	for (let pulse = 0; pulse < 4; pulse++) {
		t += 0.5;
		engine.update(makeSamples(t), MS_PER_FRAME);
		engine.update(makeSilence(t), MS_PER_FRAME);
	}
	expect(calls).toBe(baselineCalls);
});