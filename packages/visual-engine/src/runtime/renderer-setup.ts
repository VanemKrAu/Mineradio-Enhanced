import type * as THREE from "three";

export type ThreeModule = typeof import("three");
export type ThreeFactory = () => ThreeModule | Promise<ThreeModule>;

export interface RendererSetupOptions {
	threeFactory?: ThreeFactory;
	antialias?: boolean;
	alpha?: boolean;
	powerPreference?: "high-performance" | "default" | "low-power";
	pixelRatio?: number;
}

export interface RendererHandle {
	readonly renderer: THREE.WebGLRenderer;
	readonly scene: THREE.Scene;
	readonly camera: THREE.PerspectiveCamera;
	dispose(): void;
}

const defaultThreeFactory: ThreeFactory = async () => await import("three");

export async function createRenderer(
	container: HTMLElement,
	opts: RendererSetupOptions = {},
): Promise<RendererHandle> {
	const factory = opts.threeFactory ?? defaultThreeFactory;
	const THREE = await factory();
	const scene = new THREE.Scene();
	scene.background = null;
	const camera = new THREE.PerspectiveCamera(45, getAspect(container), 0.1, 100);
	const renderer = new THREE.WebGLRenderer({
		antialias: opts.antialias ?? false,
		alpha: opts.alpha ?? true,
		powerPreference: opts.powerPreference ?? "high-performance",
	});
	renderer.setClearColor(0x000000, 0);
	const pixelRatio = opts.pixelRatio ?? getDevicePixelRatio();
	renderer.setPixelRatio(pixelRatio);
	renderer.setSize(container.clientWidth || 1, container.clientHeight || 1);
	renderer.domElement.style.background = "transparent";
	renderer.domElement.style.display = "block";
	renderer.domElement.style.width = "100%";
	renderer.domElement.style.height = "100%";
	container.appendChild(renderer.domElement);
	return {
		renderer,
		scene,
		camera,
		dispose() {
			try {
				renderer.dispose();
			} catch {
			}
			try {
				if (renderer.domElement.parentElement === container) {
					container.removeChild(renderer.domElement);
				}
			} catch {
			}
		},
	};
}

function getAspect(container: HTMLElement): number {
	const w = container.clientWidth || 1;
	const h = container.clientHeight || 1;
	return w / h;
}

function getDevicePixelRatio(): number {
	if (typeof window !== "undefined" && typeof window.devicePixelRatio === "number") {
		return Math.min(window.devicePixelRatio || 1, 1.35);
	}
	return 1;
}