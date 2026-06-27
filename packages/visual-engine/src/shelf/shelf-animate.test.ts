import { expect, test } from "bun:test";
import "../runtime/happy-dom-preload";
import type { FrameContext } from "../runtime/frame-context";
import type { RuntimeUniforms } from "../runtime/uniforms";
import { createRuntimeUniforms } from "../runtime/uniforms";
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