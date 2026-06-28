import { expect, test } from "bun:test";
import { createHomeCoverTextureController, coverTextureSizeForResolution, prepareSquareCoverCanvas } from "./cover-texture";

function makeTexture(label: string) {
	return {
		label,
		image: { width: 4, height: 4, label },
		needsUpdate: false,
		disposed: false,
		dispose() {
			this.disposed = true;
		},
	};
}

function makeUniforms() {
	return {
		uCoverTex: { value: makeTexture("cover") },
		uPrevCoverTex: { value: makeTexture("prev") },
		uColorMixT: { value: 1 },
		uHasCover: { value: 0 },
		uLoading: { value: 0 },
		uHasDepth: { value: 0 },
		uAiBoost: { value: 0 },
	};
}

test("setCoverUrl('') clears baseline cover-state uniforms without changing texture objects", () => {
	const uniforms = makeUniforms();
	const ctl = createHomeCoverTextureController({
		uniforms: uniforms as never,
		loadImage: async () => ({ width: 32, height: 32, src: "unused" }),
	});
	const coverTex = uniforms.uCoverTex.value;
	ctl.setCoverUrl("");
	expect(uniforms.uHasCover.value).toBe(0);
	expect(uniforms.uLoading.value).toBe(0);
	expect(uniforms.uHasDepth.value).toBe(0);
	expect(uniforms.uAiBoost.value).toBe(0);
	expect(uniforms.uCoverTex.value).toBe(coverTex);
});

test("setCoverUrl(url) loads the current cover image, marks texture dirty, and sets uHasCover", async () => {
	const uniforms = makeUniforms();
	const loaded: string[] = [];
	const ctl = createHomeCoverTextureController({
		uniforms: uniforms as never,
		loadImage: async (url) => {
			loaded.push(url);
			return { width: 128, height: 96, src: url };
		},
	});
	ctl.setCoverUrl("https://img.example/a.jpg");
	expect(uniforms.uLoading.value).toBe(1);
	await ctl.whenIdle();
	expect(loaded).toEqual(["https://img.example/a.jpg"]);
	expect(uniforms.uCoverTex.value.image).toEqual({ width: 128, height: 96, src: "https://img.example/a.jpg" });
	expect(uniforms.uCoverTex.value.needsUpdate).toBe(true);
	expect(uniforms.uHasCover.value).toBe(1);
	expect(uniforms.uColorMixT.value).toBe(0);
	expect(uniforms.uLoading.value).toBe(0);
});

test("setCoverUrl(next) snapshots the previous loaded cover into uPrevCoverTex before applying next", async () => {
	const uniforms = makeUniforms();
	const ctl = createHomeCoverTextureController({
		uniforms: uniforms as never,
		loadImage: async (url) => ({ width: 64, height: 64, src: url }),
	});
	ctl.setCoverUrl("https://img.example/a.jpg");
	await ctl.whenIdle();
	ctl.setCoverUrl("https://img.example/b.jpg");
	await ctl.whenIdle();
	expect(uniforms.uPrevCoverTex.value.image).toEqual({ width: 64, height: 64, src: "https://img.example/a.jpg" });
	expect(uniforms.uPrevCoverTex.value.needsUpdate).toBe(true);
	expect(uniforms.uCoverTex.value.image).toEqual({ width: 64, height: 64, src: "https://img.example/b.jpg" });
	expect(uniforms.uColorMixT.value).toBe(0);
});

test("stale cover loads are ignored when a newer URL is requested", async () => {
	const uniforms = makeUniforms();
	const resolvers: Array<(image: unknown) => void> = [];
	const ctl = createHomeCoverTextureController({
		uniforms: uniforms as never,
		loadImage: (url) => new Promise((resolve) => {
			resolvers.push(() => resolve({ width: 32, height: 32, src: url }));
		}),
	});
	ctl.setCoverUrl("https://img.example/a.jpg");
	ctl.setCoverUrl("https://img.example/b.jpg");
	resolvers[0]?.({});
	await Promise.resolve();
	expect(uniforms.uHasCover.value).toBe(0);
	resolvers[1]?.({});
	await ctl.whenIdle();
	expect(uniforms.uCoverTex.value.image).toEqual({ width: 32, height: 32, src: "https://img.example/b.jpg" });
	expect(uniforms.uHasCover.value).toBe(1);
});

test("advanceColorMix moves uColorMixT toward 1 over the baseline color mix duration", async () => {
	const uniforms = makeUniforms();
	const ctl = createHomeCoverTextureController({
		uniforms: uniforms as never,
		loadImage: async (url) => ({ width: 64, height: 64, src: url }),
		colorMixDurationMs: 1000,
	});
	ctl.setCoverUrl("https://img.example/a.jpg");
	await ctl.whenIdle();
	ctl.advanceColorMix(0.25);
	expect(uniforms.uColorMixT.value).toBeCloseTo(0.25, 5);
	ctl.advanceColorMix(0.75);
	expect(uniforms.uColorMixT.value).toBe(1);
});

test("coverTextureSizeForResolution preserves baseline 256/384/512 thresholds", () => {
	expect(coverTextureSizeForResolution(0.75)).toBe(256);
	expect(coverTextureSizeForResolution(1.09)).toBe(256);
	expect(coverTextureSizeForResolution(1.10)).toBe(384);
	expect(coverTextureSizeForResolution(1.31)).toBe(384);
	expect(coverTextureSizeForResolution(1.32)).toBe(512);
	expect(coverTextureSizeForResolution(1.55)).toBe(512);
});

test("prepareSquareCoverCanvas crops the image center into a baseline square texture canvas", () => {
	const drawCalls: unknown[][] = [];
	const canvas = {
		width: 0,
		height: 0,
		getContext(type: string) {
			expect(type).toBe("2d");
			return {
				drawImage(...args: unknown[]) {
					drawCalls.push(args);
				},
			};
		},
	};
	const image = { naturalWidth: 800, naturalHeight: 600 };
	const result = prepareSquareCoverCanvas(image as never, {
		coverResolution: 1.55,
		createCanvas: () => canvas as never,
	});
	expect(result).toBe(canvas);
	expect(canvas.width).toBe(512);
	expect(canvas.height).toBe(512);
	expect(drawCalls).toEqual([[image, 100, 0, 600, 600, 0, 0, 512, 512]]);
});
