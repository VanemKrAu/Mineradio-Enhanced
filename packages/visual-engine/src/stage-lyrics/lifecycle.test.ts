import { expect, test } from "bun:test";
import "../runtime/happy-dom-preload";
import type { ThreeFactory, ThreeModule } from "../runtime/renderer-setup";
import type { GsapLike, GsapTimelineLike, GsapTweenLike } from "../control/control-console-motion";
import type { FrameContext } from "../runtime/frame-context";
import type { AudioSnapshot } from "../audio/audio-snapshot";
import { createStageLyricsLifecycle, type StageLyricsLifecycle } from "./lifecycle";
import { RenderStepSlot } from "../runtime/render-step-slot";

type RecordedCall = { method: string; args: unknown[] };

function makeFakeThree(): ThreeFactory {
	function Group() {
		return {
			isGroup: true,
			renderOrder: 0,
			children: [] as unknown[],
			userData: {} as Record<string, unknown>,
			parent: null as unknown,
			position: {
				x: 0, y: 0, z: 0,
				set(this: { x: number; y: number; z: number }, x: number, y: number, z: number) {
					this.x = x; this.y = y; this.z = z;
				},
				copy(this: { x: number; y: number; z: number }, other: { x: number; y: number; z: number }) {
					this.x = other.x; this.y = other.y; this.z = other.z;
				},
				lerp(this: { x: number; y: number; z: number }, other: { x: number; y: number; z: number }, a: number) {
					this.x += (other.x - this.x) * a; this.y += (other.y - this.y) * a; this.z += (other.z - this.z) * a;
				},
			},
			rotation: { x: 0, y: 0, z: 0 },
			scale: {
				x: 1, y: 1, z: 1,
				setScalar(this: { x: number; y: number; z: number }, s: number) {
					this.x = s; this.y = s; this.z = s;
				},
				set(this: { x: number; y: number; z: number }, x: number, y: number, z: number) {
					this.x = x; this.y = y; this.z = z;
				},
			},
			quaternion: { x: 0, y: 0, z: 0, w: 1 },
			add(child: unknown) {
				(this as { children: unknown[] }).children.push(child);
				(child as { parent: unknown }).parent = this;
			},
			remove(child: unknown) {
				const arr = (this as { children: unknown[] }).children;
				const idx = arr.indexOf(child);
				if (idx >= 0) arr.splice(idx, 1);
				(child as { parent: unknown }).parent = null;
			},
		};
	}
	function PlaneGeometry() {
		return { isBufferGeometry: true, isPlaneGeometry: true, disposed: false, dispose() { (this as { disposed: boolean }).disposed = true; } };
	}
	function BufferGeometry() {
		return {
			isBufferGeometry: true,
			attributes: {} as Record<string, { array: Float32Array; itemSize: number; count: number; needsUpdate: boolean }>,
			disposed: false,
			setAttribute(name: string, attr: { array: Float32Array; itemSize: number; count: number }) {
				(this as { attributes: Record<string, { array: Float32Array; itemSize: number; count: number; needsUpdate: boolean }> }).attributes[name] = { ...attr, needsUpdate: false };
			},
			dispose() { (this as { disposed: boolean }).disposed = true; },
		};
	}
	function BufferAttribute(arr: Float32Array, itemSize: number) {
		return { array: arr, itemSize, count: arr.length / itemSize, needsUpdate: false };
	}
	function MeshBasicMaterial(params: Record<string, unknown>) {
		return {
			isMaterial: true,
			transparent: params.transparent,
			opacity: params.opacity,
			depthWrite: params.depthWrite,
			depthTest: params.depthTest,
			side: params.side,
			blending: params.blending,
			map: params.map,
			color: params.color,
			disposed: false,
			dispose() { (this as { disposed: boolean }).disposed = true; },
		};
	}
	function ShaderMaterial(params: Record<string, unknown>) {
		return {
			isMaterial: true,
			isShaderMaterial: true,
			uniforms: params.uniforms,
			vertexShader: params.vertexShader,
			fragmentShader: params.fragmentShader,
			transparent: params.transparent,
			depthWrite: params.depthWrite,
			depthTest: params.depthTest,
			side: params.side,
			blending: params.blending,
			disposed: false,
			dispose() { (this as { disposed: boolean }).disposed = true; },
		};
	}
	function Mesh(geometry: unknown, material: unknown) {
		return {
			isMesh: true,
			geometry,
			material,
			renderOrder: 0,
			visible: true,
			userData: {} as Record<string, unknown>,
			position: { x: 0, y: 0, z: 0, set(this: { x: number; y: number; z: number }, x: number, y: number, z: number) { this.x = x; this.y = y; this.z = z; } },
			scale: { x: 1, y: 1, z: 1, set(this: { x: number; y: number; z: number }, x: number, y: number, z: number) { this.x = x; this.y = y; this.z = z; } },
		};
	}
	function Points(geometry: unknown, material: unknown) {
		return {
			isPoints: true,
			geometry,
			material,
			renderOrder: 0,
			visible: true,
			frustumCulled: true,
			position: { x: 0, y: 0, z: 0 },
			scale: { x: 1, y: 1, z: 1 },
			rotation: { x: 0, y: 0, z: 0 },
			updateMatrixWorld() {},
		};
	}
	function Color(r: number, g: number, b: number) {
		return {
			r, g, b, isColor: true,
			copy(this: { r: number; g: number; b: number }, other: { r: number; g: number; b: number }) {
				this.r = other.r; this.g = other.g; this.b = other.b; return this;
			},
			lerp(this: { r: number; g: number; b: number }, other: { r: number; g: number; b: number }, a: number) {
				this.r += (other.r - this.r) * a; this.g += (other.g - this.g) * a; this.b += (other.b - this.b) * a; return this;
			},
			setRGB(this: { r: number; g: number; b: number }, r: number, g: number, b: number) {
				this.r = r; this.g = g; this.b = b; return this;
			},
		};
	}
	function CanvasTexture(image: HTMLCanvasElement) {
		return { image, isTexture: true, minFilter: 0, magFilter: 0, generateMipmaps: false, anisotropy: 1, disposed: false, dispose() { (this as { disposed: boolean }).disposed = true; }, userData: {} };
	}
	function Texture() {
		return { isTexture: true, minFilter: 0, magFilter: 0, disposed: false, dispose() { (this as { disposed: boolean }).disposed = true; } };
	}
	const module = {
		Group, PlaneGeometry, BufferGeometry, BufferAttribute,
		MeshBasicMaterial, ShaderMaterial, Mesh, Points, Color,
		CanvasTexture, Texture,
		LinearFilter: 1006, NearestFilter: 1003,
		DoubleSide: 2, AdditiveBlending: 2, NormalBlending: 1,
	};
	return (() => module) as unknown as ThreeFactory;
}

function makeFakeGsap(recorder: RecordedCall[]): GsapLike {
	const timelineNode = (): GsapTimelineLike => {
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
	};
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
			return timelineNode();
		},
	};
}

function makeFakeDotTexture() {
	return { isTexture: true, disposed: false, dispose() {} } as never;
}

function makeFakeScene() {
	return {
		children: [] as unknown[],
		parent: null,
		add(child: unknown) {
			(this as { children: unknown[] }).children.push(child);
			(child as { parent: unknown }).parent = this;
		},
		remove(child: unknown) {
			const arr = (this as { children: unknown[] }).children;
			const idx = arr.indexOf(child);
			if (idx >= 0) arr.splice(idx, 1);
			(child as { parent: unknown }).parent = null;
		},
	} as { children: unknown[]; add(c: unknown): void; remove(c: unknown): void };
}

function makeCtx(now: number, dt: number, snap?: Partial<AudioSnapshot>): FrameContext {
	const snapshot: AudioSnapshot = {
		bass: 0, mid: 0, treble: 0, energy: 0, rb: 0, rm: 0, rt: 0, re: 0,
		beatPulse: 0, scheduledBeatPulse: 0, beatOnsetFlag: false,
		...snap,
	};
	return {
		dt, now, snapshot,
		uniforms: { uTime: { value: now } } as never,
		scene: null as never,
		camera: null as never,
		pointerParallax: { x: 0, y: 0 },
		pointerTarget: { x: 0, y: 0 },
	};
}

async function buildLifecycleWithCurrent(opts: {
	lyrics: Array<{ t: number; text: string }>;
	currentTime: number;
	playing?: boolean;
	shelfVisibility?: number;
	gsapRecorder?: RecordedCall[];
}): Promise<{ lifecycle: StageLyricsLifecycle; scene: { children: unknown[]; add(c: unknown): void; remove(c: unknown): void }; recorder: RecordedCall[]; setNow: (v: number) => void }> {
	const recorder: RecordedCall[] = [];
	const scene = makeFakeScene();
	let mutableTime = opts.currentTime;
	const lifecycle = createStageLyricsLifecycle({
		scene: scene as never,
		threeFactory: makeFakeThree(),
		gsapProvider: () => makeFakeGsap(opts.gsapRecorder ?? recorder),
		customEaseProvider: async () => null,
		lyricLinesSupplier: () => opts.lyrics as never,
		currentTimeSupplier: () => mutableTime,
		isPlayingSupplier: () => opts.playing ?? true,
		getShelfVisibility: () => opts.shelfVisibility ?? 0,
		audioDurationSupplier: () => 9999,
		dotTexture: makeFakeDotTexture(),
		particleLyricsFlagSupplier: () => true,
		lyricGlowStrengthSupplier: () => 0,
		lyricGlowBeatFlagSupplier: () => false,
		lyricSunEnergyHolder: { get: () => 0, set: () => {} },
		getBeatCamKick: () => null,
		rand: () => 0.35,
	});
	await lifecycle.mount(scene as never);
	lifecycle.setLyricLines(opts.lyrics as never);
	lifecycle.setShelfVisibility(opts.shelfVisibility ?? 0);
	lifecycle.update(makeCtx(opts.currentTime, 0.1));
	await lifecycle.whenIdle();
	return {
		lifecycle,
		scene,
		recorder: opts.gsapRecorder ?? recorder,
		setNow: (v: number) => {
			mutableTime = v;
		},
	};
}

test("lifecycle.slot === RenderStepSlot.StageLyrics", () => {
	const lc = createStageLyricsLifecycle({ threeFactory: makeFakeThree(), });
	expect(lc.slot).toBe(RenderStepSlot.StageLyrics);
});

test("mount() creates a group with renderOrder=38 and adds to scene", async () => {
	const scene = makeFakeScene();
	const lc = createStageLyricsLifecycle({ scene: scene as never, threeFactory: makeFakeThree(), });
	const group = await lc.mount(scene as never);
	expect(group).not.toBeNull();
	expect((group as unknown as { renderOrder: number }).renderOrder).toBe(38);
	expect((scene.children as unknown[]).length).toBe(1);
});

test("tickLyricsParticles advances currentIdx to 1 when currentTime reaches line B", async () => {
	const { lifecycle, scene } = await buildLifecycleWithCurrent({
		lyrics: [{ t: 0, text: "A" }, { t: 2, text: "B" }],
		currentTime: 2,
	});
	expect(lifecycle.getCurrentIdx()).toBe(1);
	expect(lifecycle.getCurrentText()).toBe("B");
	lifecycle.dispose();
	expect((scene.children as unknown[]).length).toBe(0);
});

test("tickLyricsParticles passes live lyric text options into the built lyric group and rebuilds when they change", async () => {
	const textOptions = {
		lyricFont: "stone-song",
		lyricLetterSpacing: 0.12,
		lyricLineHeight: 1.24,
		lyricWeight: 800,
	};
	const scene = makeFakeScene();
	const lifecycle = createStageLyricsLifecycle({
		scene: scene as never,
		threeFactory: makeFakeThree(),
		gsapProvider: () => makeFakeGsap([]),
		customEaseProvider: async () => null,
		lyricLinesSupplier: () => [{ t: 0, text: "Stone lyric" }] as never,
		currentTimeSupplier: () => 0.5,
		isPlayingSupplier: () => true,
		audioDurationSupplier: () => 9999,
		dotTexture: makeFakeDotTexture(),
		particleLyricsFlagSupplier: () => true,
		lyricGlowStrengthSupplier: () => 0,
		lyricGlowBeatFlagSupplier: () => false,
		lyricSunEnergyHolder: { get: () => 0, set: () => {} },
		lyricTextOptionsSupplier: () => textOptions,
		rand: () => 0.35,
	});
	await lifecycle.mount(scene as never);
	lifecycle.setLyricLines([{ t: 0, text: "Stone lyric" }]);
	lifecycle.update(makeCtx(0.5, 0.1));
	await lifecycle.whenIdle();
	const groupA = lifecycle.group as unknown as { children: Array<{ userData: { lyric?: { mask?: { fontSize: number; lineHeight: number }; textMat?: { uniforms?: { uTextOptionsSignature?: { value: string } } } } } }> };
	const firstLyric = groupA.children[0]?.userData.lyric;
	expect(firstLyric?.textMat?.uniforms?.uTextOptionsSignature?.value).toBe("stone-song|0.12|1.24|800");
	expect(firstLyric?.mask?.lineHeight).toBeGreaterThan((firstLyric?.mask?.fontSize ?? 0) * 1.2);

	textOptions.lyricLetterSpacing = 0.03;
	lifecycle.update(makeCtx(0.6, 0.1));
	await lifecycle.whenIdle();
	const groupB = lifecycle.group as unknown as { children: Array<{ userData: { lyric?: { textMat?: { uniforms?: { uTextOptionsSignature?: { value: string } } } } } }> };
	expect(groupB.children[0]?.userData.lyric?.textMat?.uniforms?.uTextOptionsSignature?.value).toBe("stone-song|0.03|1.24|800");
	lifecycle.dispose();
});

test("tickLyricsParticles intro fallback sets currentIdx=-2 when currentTime < first line t", async () => {
	const intros: RecordedCall[] = [];
	const lc = createStageLyricsLifecycle({
		threeFactory: makeFakeThree(),
		gsapProvider: () => makeFakeGsap(intros),
		customEaseProvider: async () => null,
		lyricLinesSupplier: () => [{ t: 5, text: "later" }] as never,
		currentTimeSupplier: () => 0.5,
		isPlayingSupplier: () => true,
		audioDurationSupplier: () => 9999,
		fallbackTextSupplier: () => "Song A - Artist",
		particleLyricsFlagSupplier: () => true,
		lyricGlowStrengthSupplier: () => 0,
		lyricGlowBeatFlagSupplier: () => false,
		lyricSunEnergyHolder: { get: () => 0, set: () => {} },
		dotTexture: makeFakeDotTexture(),
		rand: () => 0.35,
	});
	const scene = makeFakeScene();
	await lc.mount(scene as never);
	lc.setLyricLines([{ t: 5, text: "later" }]);
	lc.update(makeCtx(0.5, 0.1));
	await lc.whenIdle();
	expect(lc.getCurrentIdx()).toBe(-2);
	expect(lc.getCurrentText()).toBe("Song A - Artist");
	lc.dispose();
});

test("tickLyricsParticles clears stage when no fallback text and currentTime < first line t", async () => {
	const lc = createStageLyricsLifecycle({
		threeFactory: makeFakeThree(),
		gsapProvider: () => makeFakeGsap([]),
		customEaseProvider: async () => null,
		lyricLinesSupplier: () => [{ t: 5, text: "later" }] as never,
		currentTimeSupplier: () => 0.5,
		isPlayingSupplier: () => true,
		audioDurationSupplier: () => 9999,
		fallbackTextSupplier: () => "",
		particleLyricsFlagSupplier: () => true,
		lyricGlowStrengthSupplier: () => 0,
		lyricGlowBeatFlagSupplier: () => false,
		lyricSunEnergyHolder: { get: () => 0, set: () => {} },
		dotTexture: makeFakeDotTexture(),
		rand: () => 0.35,
	});
	const scene = makeFakeScene();
	await lc.mount(scene as never);
	lc.setLyricLines([{ t: 5, text: "later" }]);
	lc.update(makeCtx(0.5, 0.1));
	await lc.whenIdle();
	expect(lc.getCurrentIdx()).toBe(-1);
	expect(lc.getCurrentText()).toBe("");
	lc.dispose();
});

test("update() drives uOpacity toward 0.38 when shelfVisibility > 0.5 (non-skull)", async () => {
	const { lifecycle } = await buildLifecycleWithCurrent({
		lyrics: [{ t: 0, text: "hello world" }],
		currentTime: 0.5,
		shelfVisibility: 0.8,
	});
	lifecycle.setShelfVisibility(0.8);
	for (let i = 0; i < 60; i++) {
		lifecycle.update(makeCtx(0.5 + i * 0.016, 0.016, { beatPulse: 0 }));
	}
	await lifecycle.whenIdle();
	lifecycle.update(makeCtx(5, 0.016, { beatPulse: 0 }));
	const group = lifecycle.group as unknown as { children: unknown[] };
	const current = group.children[0] as { userData: { lyric?: { textMat?: { uniforms?: { uOpacity?: { value: number } } } } } };
	const opacity = current.userData.lyric?.textMat?.uniforms?.uOpacity?.value ?? 0;
	expect(opacity).toBeGreaterThan(0.30);
	expect(opacity).toBeLessThanOrEqual(0.38 + 0.005);
	lifecycle.dispose();
});

test("update() drives uOpacity toward 0.30 when shelfVisibility > 0.5 with skullShelfDetailOpen", async () => {
	const { lifecycle } = await buildLifecycleWithCurrent({
		lyrics: [{ t: 0, text: "dark mode" }],
		currentTime: 0.5,
		shelfVisibility: 0.8,
	});
	const lc2 = createStageLyricsLifecycle({
		threeFactory: makeFakeThree(),
		gsapProvider: () => makeFakeGsap([]),
		customEaseProvider: async () => null,
		lyricLinesSupplier: () => [{ t: 0, text: "dark mode" }] as never,
		currentTimeSupplier: () => 0.5,
		isPlayingSupplier: () => true,
		audioDurationSupplier: () => 9999,
		getShelfVisibility: () => 0.8,
		getSkullShelfOpen: () => true,
		particleLyricsFlagSupplier: () => true,
		lyricGlowStrengthSupplier: () => 0,
		lyricGlowBeatFlagSupplier: () => false,
		lyricSunEnergyHolder: { get: () => 0, set: () => {} },
		dotTexture: makeFakeDotTexture(),
		rand: () => 0.35,
	} as never);
	const scene2 = makeFakeScene();
	await lc2.mount(scene2 as never);
	lc2.setLyricLines([{ t: 0, text: "dark mode" }]);
	lc2.update(makeCtx(0.5, 0.016, { beatPulse: 0 }));
	await lc2.whenIdle();
	lc2.setShelfVisibility(0.8);
	for (let i = 0; i < 80; i++) {
		lc2.update(makeCtx(0.5 + i * 0.016, 0.016, { beatPulse: 0 }));
	}
	await lc2.whenIdle();
	const g2 = lc2.group as unknown as { children: unknown[] };
	const cur2 = g2.children[0] as { userData: { lyric?: { textMat?: { uniforms?: { uOpacity?: { value: number } } } } } };
	const opacity = cur2.userData.lyric?.textMat?.uniforms?.uOpacity?.value ?? 0;
	expect(opacity).toBeGreaterThan(0.25);
	expect(opacity).toBeLessThanOrEqual(0.30 + 0.005);
	lc2.dispose();
	(async () => { void lifecycle.dispose(); })();
});

test("setLyricLines replaces the active fixture set", async () => {
	const { lifecycle, setNow } = await buildLifecycleWithCurrent({
		lyrics: [{ t: 0, text: "A" }, { t: 2, text: "B" }],
		currentTime: 2,
	});
	lifecycle.setLyricLines([{ t: 10, text: "X" }, { t: 20, text: "Y" }]);
	lifecycle.setShelfVisibility(0);
	setNow(20);
	lifecycle.update(makeCtx(20, 0.1));
	await lifecycle.whenIdle();
	expect(lifecycle.getCurrentText()).toBe("Y");
	lifecycle.dispose();
});

test("dispose kills active timelines + removes group from scene", async () => {
	const rec: RecordedCall[] = [];
	const { lifecycle: helperLifecycle, scene } = await buildLifecycleWithCurrent({
		lyrics: [{ t: 0, text: "A" }],
		currentTime: 0.5,
		gsapRecorder: rec,
	});
	helperLifecycle.dispose();
	const sceneAny = scene as unknown as { children: unknown[] };
	expect(sceneAny.children.length).toBe(0);
	const lc = createStageLyricsLifecycle({
		scene: scene as never,
		threeFactory: makeFakeThree(),
		gsapProvider: () => makeFakeGsap(rec),
		customEaseProvider: async () => null,
		lyricLinesSupplier: () => [{ t: 0, text: "D" }] as never,
		currentTimeSupplier: () => 1,
		isPlayingSupplier: () => true,
		audioDurationSupplier: () => 9999,
		dotTexture: makeFakeDotTexture(),
		particleLyricsFlagSupplier: () => true,
		lyricGlowStrengthSupplier: () => 0,
		lyricGlowBeatFlagSupplier: () => false,
		lyricSunEnergyHolder: { get: () => 0, set: () => {} },
		rand: () => 0.5,
	});
	await lc.mount(scene as never);
	expect(sceneAny.children.length).toBe(1);
	lc.setLyricLines([{ t: 0, text: "D" }]);
	lc.update(makeCtx(1, 0.1));
	await lc.whenIdle();
	lc.dispose();
	const killsAfterDispose = rec.filter((r) => r.method === "tl.kill").length;
	expect(killsAfterDispose).toBeGreaterThanOrEqual(1);
	expect((sceneAny.children as unknown[]).length).toBe(0);
});
