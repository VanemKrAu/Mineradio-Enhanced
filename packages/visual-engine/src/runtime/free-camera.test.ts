import { expect, test } from "bun:test";
import {
	applyFreeCameraPointerDelta,
	applyFreeCameraWheel,
	createDefaultFreeCameraState,
	DEFAULT_FREE_CAMERA_POSE,
	FREE_CAMERA_BASE_FOV,
	FREE_CAMERA_FOV_RANGE,
	FREE_CAMERA_PITCH_RANGE,
	hydrateFreeCameraState,
	serializeFreeCameraState,
	startFreeCameraReset,
	toggleFreeCamera,
	updateFreeCamera,
} from "./free-camera";
import type { FreeCameraPose, FreeCameraState } from "./free-camera";

function expectClose(actual: number, expected: number, digits = 6) {
	expect(actual).toBeCloseTo(expected, digits);
}

function pose(overrides: Partial<FreeCameraPose> = {}): FreeCameraPose {
	return {
		position: { x: 1, y: 2, z: 3 },
		yaw: 0.25,
		pitch: -0.15,
		roll: 0.08,
		fov: 50,
		...overrides,
	};
}

function cloneState(state: FreeCameraState): FreeCameraState {
	return hydrateFreeCameraState(serializeFreeCameraState(state));
}

test("createDefaultFreeCameraState matches baseline defaults", () => {
	const state = createDefaultFreeCameraState();
	expect(state.active).toBe(false);
	expect(state.locked).toBe(false);
	expect(state.position).toEqual({ x: 0, y: 0, z: 6.6 });
	expect(state.velocity).toEqual({ x: 0, y: 0, z: 0 });
	expect(state.keys).toEqual({});
	expect(state.resetTween).toBeNull();
	expect(state.yaw).toBe(0);
	expect(state.pitch).toBe(0);
	expect(state.roll).toBe(0);
	expect(state.fov).toBe(FREE_CAMERA_BASE_FOV);
	expect(DEFAULT_FREE_CAMERA_POSE.position.z).toBe(6.6);
});

test("hydrateFreeCameraState clamps persisted pose and resumes inactive but locked when active was saved", () => {
	const state = hydrateFreeCameraState({
		active: true,
		locked: false,
		position: { x: 120, y: -100, z: 0 },
		yaw: Math.PI * 12,
		pitch: 4,
		roll: -5,
		fov: 120,
	});
	expect(state.active).toBe(false);
	expect(state.locked).toBe(true);
	expect(state.position).toEqual({ x: 80, y: -80, z: 6.6 });
	expectClose(state.yaw, Math.PI * 8);
	expectClose(state.pitch, FREE_CAMERA_PITCH_RANGE.max);
	expectClose(state.roll, -Math.PI);
	expect(state.fov).toBe(FREE_CAMERA_FOV_RANGE.max);
});

test("serializeFreeCameraState preserves only persisted baseline fields", () => {
	const state = createDefaultFreeCameraState();
	state.active = true;
	state.locked = true;
	state.position = { x: 4, y: 5, z: 6 };
	state.velocity = { x: 9, y: 9, z: 9 };
	state.keys = { KeyW: true };
	state.resetTween = { startMs: 1, durationMs: 620, from: pose(), to: pose({ yaw: 1 }) };
	state.yaw = 0.2;
	state.pitch = 0.3;
	state.roll = 0.4;
	state.fov = 55;
	expect(serializeFreeCameraState(state)).toEqual({
		active: true,
		locked: true,
		position: { x: 4, y: 5, z: 6 },
		yaw: 0.2,
		pitch: 0.3,
		roll: 0.4,
		fov: 55,
	});
});

test("toggleFreeCamera activates from current camera pose and clears transient input state", () => {
	const state = createDefaultFreeCameraState();
	state.keys = { KeyW: true };
	state.velocity = { x: 1, y: 0, z: 0 };
	state.pointer = { seen: true, x: 99, y: 33 };
	state.resetTween = { startMs: 1, durationMs: 620, from: pose(), to: pose({ yaw: 1 }) };
	toggleFreeCamera(state, pose({ fov: 90 }));
	expect(state.active).toBe(true);
	expect(state.locked).toBe(true);
	expect(state.position).toEqual({ x: 1, y: 2, z: 3 });
	expect(state.yaw).toBe(0.25);
	expect(state.pitch).toBe(-0.15);
	expect(state.roll).toBe(0.08);
	expect(state.fov).toBe(FREE_CAMERA_FOV_RANGE.max);
	expect(state.keys).toEqual({});
	expect(state.pointer.seen).toBe(false);
	expect(state.resetTween).toBeNull();
});

test("toggleFreeCamera deactivates to locked fixed-camera mode and clears velocity", () => {
	const state = createDefaultFreeCameraState();
	toggleFreeCamera(state, pose());
	state.keys = { KeyW: true, ShiftLeft: true };
	state.velocity = { x: 2, y: 3, z: 4 };
	toggleFreeCamera(state);
	expect(state.active).toBe(false);
	expect(state.locked).toBe(true);
	expect(state.keys).toEqual({});
	expect(state.velocity).toEqual({ x: 0, y: 0, z: 0 });
});

test("applyFreeCameraPointerDelta uses movement deltas and clamps pitch", () => {
	const state = createDefaultFreeCameraState();
	state.active = true;
	applyFreeCameraPointerDelta(state, { movementX: 10, movementY: -9999, clientX: 12, clientY: 24 });
	expectClose(state.yaw, -0.0125);
	expectClose(state.pitch, FREE_CAMERA_PITCH_RANGE.max);
	expect(state.pointer).toEqual({ seen: true, x: 12, y: 24 });
});

test("applyFreeCameraPointerDelta falls back to client deltas after first pointer sample", () => {
	const state = createDefaultFreeCameraState();
	state.active = true;
	applyFreeCameraPointerDelta(state, { movementX: 0, movementY: 0, clientX: 10, clientY: 10 });
	applyFreeCameraPointerDelta(state, { movementX: 0, movementY: 0, clientX: 18, clientY: 6 });
	expectClose(state.yaw, -8 * 0.00125);
	expectClose(state.pitch, 4 * 0.00125);
});

test("applyFreeCameraWheel adjusts fov with baseline delta and clamps range", () => {
	const state = createDefaultFreeCameraState();
	state.active = true;
	state.fov = 45;
	applyFreeCameraWheel(state, 100);
	expectClose(state.fov, 46.8);
	applyFreeCameraWheel(state, 9999);
	expect(state.fov).toBe(FREE_CAMERA_FOV_RANGE.max);
	applyFreeCameraWheel(state, -9999);
	expect(state.fov).toBe(FREE_CAMERA_FOV_RANGE.min);
});

test("updateFreeCamera moves in yaw-facing local axes with baseline velocity easing", () => {
	const state = createDefaultFreeCameraState();
	state.active = true;
	state.yaw = Math.PI / 2;
	state.keys = { KeyW: true };
	updateFreeCamera(state, 1 / 60, 0);
	const easedSpeed = 2.35 * 8.2 * (1 / 60);
	expectClose(state.velocity.x, -easedSpeed);
	expectClose(state.velocity.y, 0);
	expect(Math.abs(state.velocity.z)).toBeLessThan(1e-10);
	expectClose(state.position.x, -easedSpeed / 60);
});

test("updateFreeCamera uses shift speed, vertical keys, idle damping, and roll clamp", () => {
	const state = createDefaultFreeCameraState();
	state.active = true;
	state.roll = Math.PI - 0.01;
	state.keys = { Space: true, ShiftLeft: true, KeyQ: true };
	updateFreeCamera(state, 1, 0);
	expect(state.velocity).toEqual({ x: 0, y: 6.2, z: 0 });
	expect(state.position.y).toBe(6.2);
	expect(state.roll).toBe(Math.PI);
	state.keys = {};
	updateFreeCamera(state, 1 / 60, 1000);
	expect(state.velocity.y).toBeLessThan(6.2);
});

test("startFreeCameraReset and updateFreeCamera tween back over baseline 620ms easing", () => {
	const state = createDefaultFreeCameraState();
	toggleFreeCamera(state, pose({ yaw: Math.PI - 0.1, roll: -Math.PI + 0.1, fov: 60 }));
	startFreeCameraReset(state, 1000);
	expect(state.active).toBe(false);
	expect(state.locked).toBe(true);
	expect(state.velocity).toEqual({ x: 0, y: 0, z: 0 });
	updateFreeCamera(state, 1 / 60, 1310);
	const halfEase = 1 - Math.pow(0.5, 3);
	expectClose(state.position.x, 1 + (0 - 1) * halfEase);
	expectClose(state.position.z, 3 + (6.6 - 3) * halfEase);
	expectClose(state.fov, 60 + (45 - 60) * halfEase);
	expect(state.resetTween).not.toBeNull();
	updateFreeCamera(state, 1 / 60, 1620);
	expect(state.position).toEqual({ x: 0, y: 0, z: 6.6 });
	expect(state.yaw).toBe(0);
	expect(state.pitch).toBe(0);
	expect(state.roll).toBe(0);
	expect(state.fov).toBe(45);
	expect(state.active).toBe(false);
	expect(state.locked).toBe(false);
	expect(state.resetTween).toBeNull();
});

test("hydrate/serialize round trip keeps persisted camera pose independent from transient fields", () => {
	const state = cloneState(hydrateFreeCameraState({
		active: false,
		locked: true,
		position: { x: -7, y: 8, z: -9 },
		yaw: -0.7,
		pitch: 0.4,
		roll: -0.2,
		fov: 33,
	}));
	expect(state.active).toBe(false);
	expect(state.locked).toBe(true);
	expect(state.position).toEqual({ x: -7, y: 8, z: -9 });
	expect(state.yaw).toBe(-0.7);
	expect(state.pitch).toBe(0.4);
	expect(state.roll).toBe(-0.2);
	expect(state.fov).toBe(33);
	expect(state.velocity).toEqual({ x: 0, y: 0, z: 0 });
	expect(state.keys).toEqual({});
	expect(state.resetTween).toBeNull();
});
