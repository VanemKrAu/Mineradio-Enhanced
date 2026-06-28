import type * as THREE from "three";
import { normalizeCoverResolution } from "./home-particle-field";

export interface HomeCoverTextureUniforms {
	uCoverTex: { value: THREE.Texture };
	uPrevCoverTex: { value: THREE.Texture };
	uColorMixT: { value: number };
	uHasCover: { value: number };
	uLoading?: { value: number };
	uHasDepth?: { value: number };
	uAiBoost?: { value: number };
}

export type HomeCoverImage = CanvasImageSource | { width?: number; height?: number; src?: string };
export type HomeCoverLoader = (url: string) => Promise<HomeCoverImage>;
export type HomeCoverCanvasFactory = (width: number, height: number) => CanvasImageSource & {
	width: number;
	height: number;
	getContext?: (contextId: "2d") => CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
};

export interface HomeCoverTextureControllerOptions {
	uniforms: HomeCoverTextureUniforms;
	loadImage?: HomeCoverLoader;
	colorMixDurationMs?: number;
	coverResolution?: number;
	createCanvas?: HomeCoverCanvasFactory;
}

export interface HomeCoverTextureController {
	setCoverUrl(url: string | null | undefined): void;
	advanceColorMix(dtSeconds: number): void;
	getCurrentUrl(): string;
	whenIdle(): Promise<void>;
}

const HTTP_URL_RE = /^https?:\/\//i;

export function coverTextureSizeForResolution(v: number): number {
	const normalized = normalizeCoverResolution(v);
	if (normalized >= 1.32) return 512;
	if (normalized >= 1.10) return 384;
	return 256;
}

function defaultCreateCanvas(width: number, height: number): ReturnType<HomeCoverCanvasFactory> | null {
	if (typeof document === "undefined") return null;
	const cv = document.createElement("canvas");
	cv.width = width;
	cv.height = height;
	return cv as ReturnType<HomeCoverCanvasFactory>;
}

function imageNaturalDimension(image: HomeCoverImage, axis: "width" | "height"): number {
	const naturalKey = axis === "width" ? "naturalWidth" : "naturalHeight";
	const value = (image as unknown as Record<string, unknown>)[naturalKey] ?? (image as unknown as Record<string, unknown>)[axis];
	return Math.max(1, Number(value) || 1);
}

export function prepareSquareCoverCanvas(
	image: HomeCoverImage,
	opts: {
		coverResolution?: number;
		createCanvas?: HomeCoverCanvasFactory;
	} = {},
): HomeCoverImage {
	const size = coverTextureSizeForResolution(opts.coverResolution ?? 1.55);
	const createCanvas = opts.createCanvas ?? defaultCreateCanvas;
	const cv = createCanvas(size, size);
	if (!cv || typeof cv.getContext !== "function") return image;
	cv.width = size;
	cv.height = size;
	const ctx = cv.getContext("2d");
	if (!ctx || typeof ctx.drawImage !== "function") return image;
	const iw = imageNaturalDimension(image, "width");
	const ih = imageNaturalDimension(image, "height");
	const square = Math.min(iw, ih);
	ctx.drawImage(image as CanvasImageSource, (iw - square) / 2, (ih - square) / 2, square, square, 0, 0, size, size);
	return cv;
}

function defaultLoadImage(url: string): Promise<HomeCoverImage> {
	if (typeof Image === "undefined") return Promise.reject(new Error("Image unavailable"));
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.crossOrigin = "anonymous";
		img.decoding = "async";
		img.onload = () => resolve(img);
		img.onerror = () => reject(new Error(`failed to load cover image: ${url}`));
		img.src = url;
	});
}

function markTextureImage(tex: THREE.Texture, image: HomeCoverImage): void {
	(tex as unknown as { image: HomeCoverImage }).image = image;
	(tex as unknown as { needsUpdate: boolean }).needsUpdate = true;
}

function resetDepthUniforms(uniforms: HomeCoverTextureUniforms): void {
	if (uniforms.uHasDepth) uniforms.uHasDepth.value = 0;
	if (uniforms.uAiBoost) uniforms.uAiBoost.value = 0;
}

export function createHomeCoverTextureController(
	opts: HomeCoverTextureControllerOptions,
): HomeCoverTextureController {
	const uniforms = opts.uniforms;
	const loadImage = opts.loadImage ?? defaultLoadImage;
	const colorMixDurationMs = Math.max(1, opts.colorMixDurationMs ?? 1400);
	const coverResolution = opts.coverResolution ?? 1.55;
	let currentUrl = "";
	let token = 0;
	let pending: Promise<void> | null = null;

	function clearCover(): void {
		token += 1;
		currentUrl = "";
		uniforms.uHasCover.value = 0;
		uniforms.uColorMixT.value = 1;
		if (uniforms.uLoading) uniforms.uLoading.value = 0;
		resetDepthUniforms(uniforms);
		pending = null;
	}

	function setCoverUrl(rawUrl: string | null | undefined): void {
		const url = String(rawUrl ?? "").trim();
		if (!url || !HTTP_URL_RE.test(url)) {
			clearCover();
			return;
		}
		if (url === currentUrl && uniforms.uHasCover.value > 0.5) return;
		currentUrl = url;
		const runToken = ++token;
		if (uniforms.uLoading) uniforms.uLoading.value = 1;
		pending = loadImage(url)
			.then((image) => {
				if (runToken !== token) return;
				const preparedImage = prepareSquareCoverCanvas(image, { coverResolution, createCanvas: opts.createCanvas });
				if (uniforms.uHasCover.value > 0.5 && uniforms.uCoverTex.value.image) {
					markTextureImage(uniforms.uPrevCoverTex.value, uniforms.uCoverTex.value.image as HomeCoverImage);
				}
				markTextureImage(uniforms.uCoverTex.value, preparedImage);
				uniforms.uHasCover.value = 1;
				uniforms.uColorMixT.value = 0;
				if (uniforms.uLoading) uniforms.uLoading.value = 0;
				resetDepthUniforms(uniforms);
			})
			.catch(() => {
				if (runToken !== token) return;
				uniforms.uHasCover.value = 0;
				if (uniforms.uLoading) uniforms.uLoading.value = 0;
				resetDepthUniforms(uniforms);
			});
	}

	function advanceColorMix(dtSeconds: number): void {
		if (uniforms.uColorMixT.value >= 1) return;
		const dt = Number.isFinite(dtSeconds) ? Math.max(0, dtSeconds) : 0;
		uniforms.uColorMixT.value = Math.min(1, uniforms.uColorMixT.value + (dt * 1000) / colorMixDurationMs);
	}

	return {
		setCoverUrl,
		advanceColorMix,
		getCurrentUrl() {
			return currentUrl;
		},
		whenIdle() {
			return pending ?? Promise.resolve();
		},
	};
}
