import { expect, test } from "bun:test";
import "./happy-dom-preload";
import { createRenderer, type ThreeFactory, type RendererHandle } from "./renderer-setup";

interface FakeThree {
	scene: { background: unknown };
	camera: {
		fov: number;
		aspect: number;
		near: number;
		far: number;
		position: { x: number; y: number; z: number };
		lookAt: (v: unknown) => void;
		updateProjectionMatrix: () => void;
	};
	renderer: {
		domElement: HTMLCanvasElement;
		setPixelRatio: (n: number) => void;
		setSize: (w: number, h: number) => void;
		setClearColor: (c: number, a: number) => void;
		render: () => void;
		dispose: () => void;
	};
}

function makeFakeThree(): FakeThree & ThreeFactory {
	const camera = {
		fov: 45,
		aspect: 1,
		near: 0.1,
		far: 100,
		position: { x: 0, y: 0, z: 0 },
		lookAt: () => {},
		updateProjectionMatrix: () => {},
	};
	const domElement = document.createElement("canvas");
	const renderer = {
		domElement,
		setPixelRatio: () => {},
		setSize: () => {},
		setClearColor: () => {},
		render: () => {},
		dispose: () => {},
	};
	const scene = { background: undefined };
	const factory = (() => ({
		Scene: function () { return scene; },
		PerspectiveCamera: function () { return camera; },
		WebGLRenderer: function () { return renderer; },
	})) as unknown as ThreeFactory & FakeThree;
	(factory as FakeThree).scene = scene;
	(factory as FakeThree).camera = camera as unknown as FakeThree["camera"];
	(factory as FakeThree).renderer = renderer as unknown as FakeThree["renderer"];
	return factory;
}

test("createRenderer constructs Scene, PerspectiveCamera(45,aspect,0.1,100) and WebGLRenderer with alpha:true powerPreference:high-performance antialias:false", async () => {
	const fake = makeFakeThree();
	const container = document.createElement("div");
	container.style.width = "1024px";
	container.style.height = "768px";
	Object.defineProperty(container, "clientWidth", { value: 1024 });
	Object.defineProperty(container, "clientHeight", { value: 768 });
	const handle: RendererHandle = await createRenderer(container, { threeFactory: fake });
	expect(handle.scene).toBe(fake.scene as object);
	expect(handle.camera).toBe(fake.camera as object);
	expect(handle.camera.fov).toBe(45);
	expect(handle.camera.near).toBeCloseTo(0.1, 5);
	expect(handle.camera.far).toBe(100);
	expect(handle.renderer).toBe(fake.renderer as object);
	expect(container.contains(fake.renderer.domElement)).toBe(true);
	expect(fake.scene.background).toBe(null);
});

test("createRenderer dispose removes domElement and calls renderer.dispose", async () => {
	const fake = makeFakeThree();
	const container = document.createElement("div");
	Object.defineProperty(container, "clientWidth", { value: 800 });
	Object.defineProperty(container, "clientHeight", { value: 600 });
	const handle = await createRenderer(container, { threeFactory: fake });
	let disposed = false;
	fake.renderer.dispose = () => { disposed = true; };
	handle.dispose();
	expect(disposed).toBe(true);
	expect(container.contains(fake.renderer.domElement)).toBe(false);
});