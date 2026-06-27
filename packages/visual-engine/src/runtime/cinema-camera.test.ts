import { expect, test } from "bun:test";
import "./happy-dom-preload";
import { createCinemaCamera } from "./cinema-camera";
import type { AudioSnapshot } from "../audio/audio-snapshot";
import type { RuntimeUniforms } from "./uniforms";
import type { FrameContext } from "./frame-context";

function makeSnapshot(over: Partial<AudioSnapshot> = {}): AudioSnapshot {
	return {
		bass: 0,
		mid: 0,
		treble: 0,
		energy: 0,
		rb: 0,
		rm: 0,
		rt: 0,
		re: 0,
		beatPulse: 0,
		scheduledBeatPulse: 0,
		beatOnsetFlag: false,
		...over,
	};
}

function makeFakeCamera() {
	return {
		fov: 45,
		aspect: 1,
		near: 0.1,
		far: 100,
		position: {
			x: 0,
			y: 0,
			z: 6.6,
			set: function (x: number, y: number, z: number) { (this as { x: number; y: number; z: number }).x = x; (this as { x: number; y: number; z: number }).y = y; (this as { x: number; y: number; z: number }).z = z; },
		},
		rotation: { x: 0, y: 0, z: 0, order: "YXZ" },
		lookAt: () => {},
		updateProjectionMatrix: () => {},
	};
}

function makeUniforms(): RuntimeUniforms {
	return {
		uTime: { value: 0 },
		uBass: { value: 0 },
		uMid: { value: 0 },
		uTreble: { value: 0 },
		uBeat: { value: 0 },
		uEnergy: { value: 0 },
		uMouseXY: { value: { x: 0, y: 0, set: () => {} } as never },
		uMouseActive: { value: 0 },
		uVinylSpin: { value: 0 },
		uParticleDim: { value: 0 },
		uBurstAmt: { value: 0 },
	} as unknown as RuntimeUniforms;
}

function makeContext(snapshot: AudioSnapshot, dt: number, now = 0): FrameContext {
	const camera = makeFakeCamera() as never;
	const scene = { add: () => {} } as never;
	const uniforms = makeUniforms();
	return {
		dt,
		now,
		snapshot,
		uniforms,
		scene,
		camera,
		pointerParallax: { x: 0, y: 0 },
		pointerTarget: { x: 0, y: 0 },
	} as FrameContext;
}

test("updateCinemaDynamics converges cinemaDynamics.scale toward baseline non-DJ target formula", () => {
	const camera = makeFakeCamera();
	let now = 0;
	const cinema = createCinemaCamera({
		camera: camera as never,
		defaultProfile: { cinema: true, cinemaShake: 1.0, isDj: false, trackScaleAuto: true },
		getCurrentTime: () => now,
	});
	const ctx = makeContext(makeSnapshot({ energy: 0.5, rb: 0.5 }), 1 / 60);
	for (let i = 0; i < 600; i++) {
		cinema.update(ctx);
		now += 1 / 60;
	}
	const state = cinema.getState();
	expect(state.cinemaDynamics.avg).toBeGreaterThan(0.20);
	expect(state.cinemaDynamics.scale).toBeGreaterThan(0.45);
	expect(state.cinemaDynamics.scale).toBeLessThan(1.20);
	cinema.dispose();
});

test("applyBeat schedules an event that produces a positive punch and reduces camera fov within tolerance", () => {
	const camera = makeFakeCamera();
	let now = 0;
	const cinema = createCinemaCamera({
		camera: camera as never,
		defaultProfile: { cinema: true, cinemaShake: 1.0, isDj: false, trackScaleAuto: true },
		getCurrentTime: () => now,
	});
	cinema.applyBeat(0.85, true);
	const ctx = makeContext(makeSnapshot({ energy: 0.6, rb: 0.6 }), 1 / 60);
	now = 0.001;
	cinema.update(ctx);
	const beatCam = cinema.getState().beatCam;
	expect(beatCam.punch).toBeGreaterThan(0);
	cinema.update(ctx);
	cinema.update(ctx);
	cinema.update(ctx);
	expect(camera.fov).toBeLessThan(45);
	cinema.dispose();
});

test("paused snapshot decays beatCam kicks and punch toward zero", () => {
	const camera = makeFakeCamera();
	let now = 0;
	const cinema = createCinemaCamera({
		camera: camera as never,
		defaultProfile: { cinema: true, cinemaShake: 1.0, isDj: false, trackScaleAuto: true },
		getCurrentTime: () => now,
	});
	cinema.applyBeat(0.9, true);
	now = 0.001;
	const silent = makeContext(makeSnapshot(), 1 / 60);
	for (let i = 0; i < 200; i++) {
		cinema.update(silent);
		now += 1 / 60;
	}
	const beatCam = cinema.getState().beatCam;
	expect(beatCam.punch).toBeLessThan(0.001);
	expect(beatCam.thetaKick).toBeLessThan(0.001);
	expect(beatCam.phiKick).toBeLessThan(0.001);
	expect(beatCam.radiusKick).toBeLessThan(0.001);
	expect(beatCam.rollKick).toBeLessThan(0.001);
	cinema.dispose();
});

test("camera cinematic sine drift produces a non-zero cine offset (no beat) within baseline amplitude", () => {
	const camera = makeFakeCamera();
	const cinema = createCinemaCamera({
		camera: camera as never,
		defaultProfile: { cinema: true, cinemaShake: 1.0, isDj: false, trackScaleAuto: true },
	});
	const ctx = makeContext(makeSnapshot({ energy: 0.3, rb: 0.3 }), 1 / 60);
	for (let i = 0; i < 240; i++) cinema.update(ctx);
	const cine = cinema.getState().cineOffset;
	expect(Math.abs(cine.theta)).toBeLessThan(0.02);
	expect(Math.abs(cine.phi)).toBeLessThan(0.02);
	expect(Math.abs(cine.radius)).toBeLessThan(0.20);
	cinema.dispose();
});

test("setProfile toggling cinema=false freezes sine drift (cinePhi/Theta decay toward zero)", () => {
	const camera = makeFakeCamera();
	const cinema = createCinemaCamera({
		camera: camera as never,
		defaultProfile: { cinema: true, cinemaShake: 1.0, isDj: false, trackScaleAuto: true },
	});
	cinema.setProfile({ cinema: false, cinemaShake: 1.0, isDj: false, trackScaleAuto: true });
	const ctx = makeContext(makeSnapshot({ energy: 0.5, rb: 0.5 }), 1 / 60);
	for (let i = 0; i < 120; i++) cinema.update(ctx);
	const cine = cinema.getState().cineOffset;
	expect(Math.abs(cine.theta)).toBeLessThan(0.0005);
	expect(Math.abs(cine.phi)).toBeLessThan(0.0005);
	expect(Math.abs(cine.radius)).toBeLessThan(0.0005);
	cinema.dispose();
});