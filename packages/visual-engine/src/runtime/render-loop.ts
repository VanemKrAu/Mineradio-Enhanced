import type * as THREE from "three";
import type { AudioReactivityEngine, AudioSnapshot } from "../audio/audio-snapshot";
import type { RuntimeUniforms } from "./uniforms";
import { createRuntimeUniforms } from "./uniforms";
import { createPerfState, type PerfState, type PerfStateSnapshot } from "./perf-state";
import { RENDER_STEP_ORDER, type RenderStepSlot } from "./render-step-slot";
import type { FrameContext } from "./frame-context";

export interface RenderLoopOptions {
	renderer: THREE.WebGLRenderer;
	scene: THREE.Scene;
	camera: THREE.PerspectiveCamera;
	audio: Pick<AudioReactivityEngine, "getSnapshot">;
	uniforms?: RuntimeUniforms;
	isMainSceneCoveredBySplash?: () => boolean;
	getAdaptiveFps?: (now: number) => number;
	prefersReducedMotion?: () => boolean;
	pointerParallax?: { x: number; y: number };
	pointerTarget?: { x: number; y: number };
	now?: () => number;
	raf?: (cb: (t: number) => void) => number;
	cancelRaf?: (handle: number) => void;
	onCacheTrim?: (now: number) => void;
}

type StepCallback = (ctx: FrameContext) => void;

const SPLASH_WARM_INTERVAL_MS = 520;
const DT_CLAMP = 0.05;
const POINTER_PARALLAX_LERP = 0.040;
const LONG_FRAME_DT = 0.034;

export interface RenderLoop {
	start(): void;
	stop(): void;
	registerStep(slot: RenderStepSlot, fn: StepCallback): () => void;
	dispose(): void;
	getFps(): number;
	getPerfState(): PerfStateSnapshot;
	getPointerParallax(): { x: number; y: number };
	stepOnce(): void;
}

export function createRenderLoop(opts: RenderLoopOptions): RenderLoop {
	const renderer = opts.renderer;
	const scene = opts.scene;
	const camera = opts.camera;
	const audio = opts.audio;
	const uniforms = opts.uniforms ?? createRuntimeUniforms();
	const isMainSceneCoveredBySplash = opts.isMainSceneCoveredBySplash ?? (() => false);
	const getAdaptiveFps = opts.getAdaptiveFps ?? (() => 0);
	const prefersReducedMotion = opts.prefersReducedMotion ?? (() => false);
	const pointerParallax = opts.pointerParallax ?? { x: 0, y: 0 };
	const pointerTarget = opts.pointerTarget ?? { x: 0, y: 0 };
	const nowFn = opts.now ?? (() => (typeof performance !== "undefined" ? performance.now() : Date.now()));
	const raf = opts.raf ?? ((cb) => (typeof requestAnimationFrame === "function" ? requestAnimationFrame(cb) : setTimeout(() => cb(nowFn()), 16)));
	const cancelRaf = opts.cancelRaf ?? ((h: number) => {
		if (typeof cancelAnimationFrame === "function") cancelAnimationFrame(h);
		else clearTimeout(h);
	});

	const perfState: PerfState = createPerfState(nowFn());
	const registry = new Map<RenderStepSlot, StepCallback>();
	let rafHandle: number | null = null;
	let prevTime = nowFn();
	let splashWarmRenderLast = 0;
	let disposed = false;
	let snapshotCache: AudioSnapshot = audio.getSnapshot();

	function shouldSkipAdaptiveRenderFrame(now: number): boolean {
		const fps = getAdaptiveFps(now);
		perfState.mode = fps ? (`${fps}fps` as const) : "vsync";
		if (!fps) {
			perfState.lastRenderAt = now;
			return false;
		}
		const minGap = 1000 / fps;
		if (now - perfState.lastRenderAt < minGap) {
			perfState.skipped += 1;
			return true;
		}
		perfState.lastRenderAt = now;
		return false;
	}

	function sampleRenderPerf(now: number, dt: number): void {
		perfState.frames += 1;
		if (dt > LONG_FRAME_DT) perfState.longFrames += 1;
		if (now - perfState.lastSampleAt >= 1000) {
			perfState.fps = Math.round((perfState.frames * 1000) / Math.max(1, now - perfState.lastSampleAt));
			perfState.frames = 0;
			perfState.lastSampleAt = now;
		}
		if (opts.onCacheTrim) opts.onCacheTrim(now);
	}

	function buildContext(dt: number, now: number): FrameContext {
		snapshotCache = audio.getSnapshot();
		if (prefersReducedMotion()) {
			return {
				dt,
				now,
				snapshot: { ...snapshotCache, bass: 0, mid: 0, treble: 0, beatPulse: 0, scheduledBeatPulse: 0 },
				uniforms,
				scene,
				camera,
				pointerParallax,
				pointerTarget,
			};
		}
		return { dt, now, snapshot: snapshotCache, uniforms, scene, camera, pointerParallax, pointerTarget };
	}

	function tick(): void {
		if (disposed) return;
		rafHandle = raf(tick);
		const now = nowFn();
		if (shouldSkipAdaptiveRenderFrame(now)) return;
		const dt = Math.min((now - prevTime) / 1000, DT_CLAMP);
		prevTime = now;
		sampleRenderPerf(now, dt);
		uniforms.uTime.value += dt;
		if (isMainSceneCoveredBySplash()) {
			if (now - splashWarmRenderLast > SPLASH_WARM_INTERVAL_MS) {
				splashWarmRenderLast = now;
				renderer.render(scene, camera);
			}
			return;
		}
		pointerParallax.x += (pointerTarget.x - pointerParallax.x) * POINTER_PARALLAX_LERP;
		pointerParallax.y += (pointerTarget.y - pointerParallax.y) * POINTER_PARALLAX_LERP;
		const ctx = buildContext(dt, now);
		for (let i = 0; i < RENDER_STEP_ORDER.length; i++) {
			const slot = RENDER_STEP_ORDER[i];
			const fn = registry.get(slot);
			if (fn) {
				try {
					fn(ctx);
				} catch {
				}
			}
		}
		renderer.render(scene, camera);
	}

	return {
		start() {
			if (rafHandle != null) return;
			prevTime = nowFn();
			perfState.lastSampleAt = prevTime;
			perfState.lastRenderAt = prevTime;
			rafHandle = raf(tick);
		},
		stop() {
			if (rafHandle == null) return;
			cancelRaf(rafHandle);
			rafHandle = null;
		},
		registerStep(slot, fn) {
			registry.set(slot, fn);
			return () => {
				if (registry.get(slot) === fn) registry.delete(slot);
			};
		},
		dispose() {
			disposed = true;
			if (rafHandle != null) {
				cancelRaf(rafHandle);
				rafHandle = null;
			}
			registry.clear();
		},
		getFps() {
			return perfState.fps;
		},
		getPerfState() {
			return { ...perfState } as PerfStateSnapshot;
		},
		getPointerParallax() {
			return pointerParallax;
		},
		stepOnce() {
			if (disposed) return;
			tick();
		},
	};
}