import { expect, test } from "bun:test";
import "../runtime/happy-dom-preload";
import type { FrameContext } from "../runtime/frame-context";
import type { RuntimeUniforms } from "../runtime/uniforms";
import { createRuntimeUniforms } from "../runtime/uniforms";
import { SHELF_MAX_RENDER } from "./card-position";
import { createShelfManager, type ShelfManager } from "./shelf-animate";

function makeCtx(uniforms: RuntimeUniforms, now = 0): FrameContext {
	return {
		dt: 0,
		now,
		snapshot: {} as never,
		uniforms,
		scene: {} as never,
		camera: {} as never,
		pointerParallax: { x: 0, y: 0 },
		pointerTarget: { x: 0, y: 0 },
	};
}

test("ShelfManager.setData stores items length in state.lastSig", () => {
	const m = createShelfManager({});
	m.setData([
		{ type: "playlist", title: "A", playlistId: "p1" },
		{ type: "playlist", title: "B", playlistId: "p2" },
	]);
	expect(m.getData().length).toBe(2);
	expect(m.getState().lastSig).toContain("2");
});

test("ShelfManager.setSelectedIdx persists into state", () => {
	const m = createShelfManager({});
	m.setSelectedIdx(3);
	expect(m.getSelectedIdx()).toBe(3);
	expect(m.getState().selectedIdx).toBe(3);
});

test("ShelfManager.setShelfPane tracks pane memory and switches shelfPane", () => {
	const m = createShelfManager({});
	m.getState().centerTarget = 2;
	m.setShelfPane("fav");
	expect(m.getShelfPane()).toBe("fav");
	expect(m.getState().paneMemory.mine).toBe(2);
});

test("ShelfManager.setShelfPane restores remembered target, overshoots by pane direction, and timestamps switch", () => {
	const m = createShelfManager({});
	m.setData(Array.from({ length: 8 }, (_, i) => ({ type: "queue", title: `Q${i}` })));
	m.getState().centerTarget = 2.4;
	m.getState().paneMemory.fav = 5;

	m.setShelfPane("fav", 12.5);

	expect(m.getShelfPane()).toBe("fav");
	expect(m.getState().paneMemory.mine).toBe(2);
	expect(m.getState().centerTarget).toBe(5);
	expect(m.getState().centerIdx).toBe(5);
	expect(m.getState().centerSmooth).toBeCloseTo(6.85, 5);
	expect(m.getState().paneSwitchDir).toBe(1);
	expect(m.getState().paneSwitchAt).toBe(12.5);
	expect(m.getState().shelfOpenAnimAt).toBe(12.5);

	m.getState().paneMemory.mine = 1;
	m.setShelfPane("mine", 13.25);
	expect(m.getState().centerTarget).toBe(1);
	expect(m.getState().centerIdx).toBe(1);
	expect(m.getState().centerSmooth).toBeCloseTo(0, 5);
	expect(m.getState().paneSwitchDir).toBe(-1);
	expect(m.getState().paneSwitchAt).toBe(13.25);
	expect(m.getState().shelfOpenAnimAt).toBe(13.25);
});

test("ShelfManager.setMode switches state.mode", () => {
	const m = createShelfManager({});
	m.setMode("stage");
	expect(m.getMode()).toBe("stage");
	expect(m.getState().mode).toBe("stage");
});

test("ShelfManager.schedulePaneSwitch records paneSwitchDir sign only", () => {
	const m = createShelfManager({});
	m.schedulePaneSwitch(-5);
	expect(m.getState().paneSwitchDir).toBe(-1);
	m.schedulePaneSwitch(7);
	expect(m.getState().paneSwitchDir).toBe(1);
});

test("ShelfManager.setShelfVisibility stays in state for downstream consumers", () => {
	const m = createShelfManager({});
	m.setShelfVisibility(0.42);
	expect(m.getShelfVisibility()).toBeCloseTo(0.42, 4);
	expect(m.getSnapshot().shelfVisibility).toBeCloseTo(0.42, 4);
});

test("ShelfManager.openDetail + closeDetail mutate openCardIdx", () => {
	const m = createShelfManager({});
	m.openDetail(1);
	expect(m.getState().openCardIdx).toBe(1);
	expect(m.getSnapshot().openCardIdx).toBe(1);
	m.closeDetail();
	expect(m.getState().openCardIdx).toBe(-1);
});

test("ShelfManager.update advances centerSmooth toward target with baseline lerp 0.16", () => {
	const m = createShelfManager({});
	const u = createRuntimeUniforms();
	m.getState().centerTarget = 1;
	const expected = 0 + (1 - 0) * 0.16;
	m.update(makeCtx(u, 16));
	expect(m.getState().centerSmooth).toBeCloseTo(expected, 5);
});

test("ShelfManager.update computes a real breathPulse snapshot value", () => {
	const m = createShelfManager({});
	m.setShelfVisibility(1);
	const u = createRuntimeUniforms();
	u.uTime.value = 0;
	m.update(makeCtx(u, 0));
	expect(m.getSnapshot().breathPulse).toBeCloseTo(0.5, 5);
});

test("3D shelf update does not crash when group is null", () => {
	const m = createShelfManager({});
	const u = createRuntimeUniforms();
	expect(() => m.update(makeCtx(u, 16))).not.toThrow();
	expect(m.getState().centerSmooth).toBeGreaterThanOrEqual(0);
});

test("ShelfManager.dispose removes the group from the scene if present", () => {
	const removed: unknown[] = [];
	const scene = {
		add() {},
		remove(obj: unknown) {
			removed.push(obj);
		},
	} as unknown as import("three").Scene;
	const group = { visible: true } as unknown as import("three").Group;
	const m = createShelfManager({ scene, group });
	m.dispose();
	expect(removed.length).toBe(1);
});

test("ShelfManager builds only SHELF_MAX_RENDER card meshes around center for long data", () => {
	const children: unknown[] = [];
	const scene = {
		add() {},
		remove() {},
	} as unknown as import("three").Scene;
	class FakeGroup {
		visible = true;
		children = children;
		add(obj: unknown) {
			children.push(obj);
		}
		remove(obj: unknown) {
			const idx = children.indexOf(obj);
			if (idx >= 0) children.splice(idx, 1);
		}
	}
	class FakeMesh {
		position = { set() {} };
		rotation = { set() {} };
		scale = { setScalar() {} };
		visible = true;
		renderOrder = 0;
		userData: Record<string, unknown> = {};
		constructor(
			public geometry: unknown,
			public material: unknown,
		) {}
	}
	const documentLike = {
		createElement(tag: string) {
			expect(tag).toBe("canvas");
			return {
				width: 0,
				height: 0,
				getContext() {
					return {
						clearRect() {},
						fillRect() {},
						roundRect() {},
						beginPath() {},
						fill() {},
						stroke() {},
						moveTo() {},
						lineTo() {},
						save() {},
						restore() {},
						clip() {},
						createLinearGradient() {
							return { addColorStop() {} };
						},
						measureText(text: string) {
							return { width: text.length * 8 };
						},
						fillText() {},
					};
				},
			};
		},
	};
	const three = {
		Group: FakeGroup,
		Mesh: FakeMesh,
		PlaneGeometry: class {
			constructor(
				public width: number,
				public height: number,
			) {}
		},
		CanvasTexture: class {
			needsUpdate = false;
			minFilter: unknown = null;
			magFilter: unknown = null;
			generateMipmaps = true;
			constructor(public canvas: unknown) {}
		},
		MeshBasicMaterial: class {
			opacity = 1;
			color = { setScalar() {} };
			constructor(init: Record<string, unknown>) {
				Object.assign(this, init);
			}
		},
		LinearFilter: "LinearFilter",
		DoubleSide: "DoubleSide",
	} as unknown as typeof import("three");
	const m = createShelfManager({ scene, three, document: documentLike as unknown as Document });
	m.setShelfVisibility(1);
	m.getState().centerTarget = 12;
	m.getState().centerSmooth = 12;
	m.setData(Array.from({ length: 25 }, (_, i) => ({ type: "playlist", title: `P${i}`, playlistId: `${i}` })));
	m.update(makeCtx(createRuntimeUniforms(), 16));
	expect(children.length).toBe(SHELF_MAX_RENDER);
});

test("ShelfManager redraws existing card sprites when selected state changes inside the same render window", () => {
	const children: unknown[] = [];
	const fillTextCalls: string[] = [];
	const scene = {
		add() {},
		remove() {},
	} as unknown as import("three").Scene;
	class FakeGroup {
		visible = true;
		children = children;
		add(obj: unknown) {
			children.push(obj);
		}
		remove(obj: unknown) {
			const idx = children.indexOf(obj);
			if (idx >= 0) children.splice(idx, 1);
		}
	}
	class FakeMesh {
		position = { set() {} };
		rotation = { set() {} };
		scale = { setScalar() {} };
		visible = true;
		renderOrder = 0;
		userData: Record<string, unknown> = {};
		constructor(
			public geometry: unknown,
			public material: unknown,
		) {}
	}
	const documentLike = {
		createElement() {
			return {
				width: 0,
				height: 0,
				getContext() {
					return {
						clearRect() {},
						fillRect() {},
						roundRect() {},
						beginPath() {},
						fill() {},
						stroke() {},
						moveTo() {},
						lineTo() {},
						save() {},
						restore() {},
						clip() {},
						createLinearGradient() {
							return { addColorStop() {} };
						},
						measureText(text: string) {
							return { width: text.length * 8 };
						},
						fillText(text: string) {
							fillTextCalls.push(text);
						},
					};
				},
			};
		},
	};
	const three = {
		Group: FakeGroup,
		Mesh: FakeMesh,
		PlaneGeometry: class {
			dispose() {}
		},
		CanvasTexture: class {
			needsUpdate = false;
			minFilter: unknown = null;
			magFilter: unknown = null;
			generateMipmaps = true;
			dispose() {}
		},
		MeshBasicMaterial: class {
			opacity = 1;
			color = { setScalar() {} };
			constructor(init: Record<string, unknown>) {
				Object.assign(this, init);
			}
			dispose() {}
		},
		LinearFilter: "LinearFilter",
		DoubleSide: "DoubleSide",
	} as unknown as typeof import("three");
	const m = createShelfManager({ scene, three, document: documentLike as unknown as Document });
	m.setShelfVisibility(1);
	m.setData([{ type: "playlist", title: "P0", playlistId: "0" }]);
	m.update(makeCtx(createRuntimeUniforms(), 16));
	const afterFirstUpdate = fillTextCalls.length;
	m.setSelectedIdx(0);
	m.update(makeCtx(createRuntimeUniforms(), 32));
	expect(children.length).toBe(1);
	expect(fillTextCalls.length).toBeGreaterThan(afterFirstUpdate);
});

test("ShelfManager clamps center and open detail indices when data shrinks", () => {
	const children: unknown[] = [];
	const scene = {
		add() {},
		remove() {},
	} as unknown as import("three").Scene;
	class FakeGroup {
		visible = true;
		add(obj: unknown) {
			children.push(obj);
		}
		remove(obj: unknown) {
			const idx = children.indexOf(obj);
			if (idx >= 0) children.splice(idx, 1);
		}
	}
	class FakeMesh {
		position = { x: 0, y: 0, z: 0, set(x: number, y: number, z: number) {
			this.x = x;
			this.y = y;
			this.z = z;
		} };
		rotation = { set() {} };
		scale = { setScalar() {} };
		visible = true;
		renderOrder = 0;
		userData: Record<string, unknown> = {};
		constructor(
			public geometry: unknown,
			public material: unknown,
		) {}
	}
	const documentLike = {
		createElement() {
			return {
				width: 0,
				height: 0,
				getContext() {
					return {
						clearRect() {},
						fillRect() {},
						roundRect() {},
						beginPath() {},
						fill() {},
						stroke() {},
						moveTo() {},
						lineTo() {},
						save() {},
						restore() {},
						clip() {},
						createLinearGradient() {
							return { addColorStop() {} };
						},
						measureText(text: string) {
							return { width: text.length * 8 };
						},
						fillText() {},
					};
				},
			};
		},
	};
	const three = {
		Group: FakeGroup,
		Mesh: FakeMesh,
		PlaneGeometry: class {
			dispose() {}
		},
		CanvasTexture: class {
			needsUpdate = false;
			minFilter: unknown = null;
			magFilter: unknown = null;
			generateMipmaps = true;
			dispose() {}
		},
		MeshBasicMaterial: class {
			opacity = 1;
			color = { setScalar() {} };
			constructor(init: Record<string, unknown>) {
				Object.assign(this, init);
			}
			dispose() {}
		},
		LinearFilter: "LinearFilter",
		DoubleSide: "DoubleSide",
	} as unknown as typeof import("three");
	const m = createShelfManager({ scene, three, document: documentLike as unknown as Document });
	m.setShelfVisibility(1);
	m.getState().centerTarget = 12;
	m.getState().centerSmooth = 12;
	m.openDetail(12);
	m.setData([{ type: "playlist", title: "Only", playlistId: "only" }]);
	m.update(makeCtx(createRuntimeUniforms(), 16));
	expect(m.getState().centerTarget).toBe(0);
	expect(m.getState().centerSmooth).toBe(0);
	expect(m.getState().openCardIdx).toBe(-1);
	expect(children.length).toBe(1);
	expect((children[0] as { visible: boolean }).visible).toBe(true);
});
