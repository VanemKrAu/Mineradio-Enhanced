import { expect, test } from "bun:test";
import {
	applyFreeCameraToPerspectiveCamera,
	attachFreeCameraHost,
	createFreeCameraPoseFromPerspectiveCamera,
	isFreeCameraControlCode,
} from "./free-camera-host";
import { createDefaultFreeCameraState } from "@mineradio/visual-engine";

function expectClose(actual: number, expected: number, tolerance = 0.000001) {
	expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
}

function fakeCamera() {
	return {
		fov: 45,
		position: {
			x: 0,
			y: 0,
			z: 6.6,
			set(x: number, y: number, z: number) {
				this.x = x;
				this.y = y;
				this.z = z;
			},
		},
		rotation: {
			x: 0,
			y: 0,
			z: 0,
			order: "XYZ",
			set(x: number, y: number, z: number, order?: string) {
				this.x = x;
				this.y = y;
				this.z = z;
				if (order) this.order = order;
			},
		},
		updateProjectionMatrixCalled: 0,
		updateProjectionMatrix() {
			this.updateProjectionMatrixCalled += 1;
		},
	};
}

function makeTarget() {
	const listeners = new Map<string, Array<(event: Event) => void>>();
	return {
		addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
			const fn = typeof listener === "function" ? listener : (event: Event) => listener.handleEvent(event);
			listeners.set(type, [...(listeners.get(type) ?? []), fn]);
		},
		removeEventListener(type: string, listener: EventListenerOrEventListenerObject) {
			const fn = typeof listener === "function" ? listener : (event: Event) => listener.handleEvent(event);
			listeners.set(type, (listeners.get(type) ?? []).filter((entry) => entry !== fn));
		},
		dispatch(type: string, event: Event) {
			for (const listener of listeners.get(type) ?? []) listener(event);
		},
		count(type: string) {
			return listeners.get(type)?.length ?? 0;
		},
	};
}

function keyboardEvent(code: string, overrides: Partial<KeyboardEvent> = {}): KeyboardEvent {
	return {
		code,
		repeat: false,
		target: {},
		prevented: false,
		stopped: false,
		preventDefault() {
			this.prevented = true;
		},
		stopImmediatePropagation() {
			this.stopped = true;
		},
		...overrides,
	} as KeyboardEvent & { prevented: boolean; stopped: boolean };
}

function wheelEvent(deltaY: number): WheelEvent {
	return {
		deltaY,
		clientX: 10,
		clientY: 20,
		prevented: false,
		preventDefault() {
			this.prevented = true;
		},
	} as WheelEvent & { prevented: boolean };
}

function mouseEvent(overrides: Partial<MouseEvent>): MouseEvent {
	return {
		movementX: 0,
		movementY: 0,
		clientX: 0,
		clientY: 0,
		...overrides,
	} as MouseEvent;
}

test("isFreeCameraControlCode matches the baseline movement key whitelist", () => {
	for (const code of ["KeyW", "KeyA", "KeyS", "KeyD", "KeyQ", "KeyE", "Space", "ShiftLeft", "ShiftRight", "ControlLeft", "ControlRight"]) {
		expect(isFreeCameraControlCode(code)).toBe(true);
	}
	expect(isFreeCameraControlCode("KeyR")).toBe(false);
	expect(isFreeCameraControlCode("KeyK")).toBe(false);
	expect(isFreeCameraControlCode("ArrowUp")).toBe(false);
});

test("createFreeCameraPoseFromPerspectiveCamera captures baseline camera pose fields", () => {
	const camera = fakeCamera();
	camera.position.set(2, 3, 4);
	camera.rotation.set(0.1, 0.2, -0.3, "YXZ");
	camera.fov = 66;
	expect(createFreeCameraPoseFromPerspectiveCamera(camera)).toEqual({
		position: { x: 2, y: 3, z: 4 },
		pitch: 0.1,
		yaw: 0.2,
		roll: -0.3,
		fov: 66,
	});
});

test("applyFreeCameraToPerspectiveCamera locks camera when free camera is active or fixed", () => {
	const camera = fakeCamera();
	const state = createDefaultFreeCameraState();
	state.active = true;
	state.position = { x: 1, y: 2, z: 3 };
	state.pitch = 0.11;
	state.yaw = -0.22;
	state.roll = 0.33;
	state.fov = 60;
	const applied = applyFreeCameraToPerspectiveCamera(state, camera, {
		cameraShake: 1,
		beatCam: { phiKick: 0.02, thetaKick: 0.03, rollKick: 0.04, punch: 0.5, radiusKick: 0.1 },
		camPunch: 0.6,
	});
	expect(applied).toBe(true);
	expect(camera.position.x).toBeGreaterThan(1);
	expect(camera.position.y).toBeGreaterThan(2);
	expect(camera.position.z).toBeLessThan(3);
	expect(camera.rotation.order).toBe("YXZ");
	expectClose(camera.rotation.x, 0.11 + 0.02 * 0.45);
	expectClose(camera.rotation.y, -0.22 + 0.03 * 0.45);
	expectClose(camera.rotation.z, 0.33 + 0.04);
	expect(camera.fov).toBeLessThan(60);
	expect(camera.updateProjectionMatrixCalled).toBe(1);
});

test("attachFreeCameraHost toggles with R, resets with K, handles key state, and clears keys on blur", () => {
	const target = makeTarget();
	const wheelTarget = makeTarget();
	const camera = fakeCamera();
	const state = createDefaultFreeCameraState();
	const resets: number[] = [];
	const detach = attachFreeCameraHost({
		target: target as unknown as EventTarget,
		wheelTarget: wheelTarget as unknown as EventTarget,
		state,
		getCameraPose: () => createFreeCameraPoseFromPerspectiveCamera(camera),
		getNowMs: () => 1000,
		onReset: () => resets.push(1),
	});
	const r = keyboardEvent("KeyR");
	target.dispatch("keydown", r);
	expect(state.active).toBe(true);
	expect(state.locked).toBe(true);
	expect((r as KeyboardEvent & { prevented: boolean }).prevented).toBe(true);
	const w = keyboardEvent("KeyW");
	target.dispatch("keydown", w);
	expect(state.keys.KeyW).toBe(true);
	expect((w as KeyboardEvent & { stopped: boolean }).stopped).toBe(true);
	target.dispatch("keyup", keyboardEvent("KeyW"));
	expect(state.keys.KeyW).toBe(false);
	target.dispatch("keydown", keyboardEvent("KeyK"));
	expect(state.active).toBe(false);
	expect(state.locked).toBe(true);
	expect(state.resetTween?.startMs).toBe(1000);
	expect(resets).toEqual([1]);
	state.keys.KeyA = true;
	target.dispatch("blur", new Event("blur"));
	expect(state.keys).toEqual({});
	detach();
	expect(target.count("keydown")).toBe(0);
	expect(target.count("keyup")).toBe(0);
	expect(target.count("blur")).toBe(0);
});

test("attachFreeCameraHost ignores typing targets and repeated R while consuming active pointer and wheel input", () => {
	const target = makeTarget();
	const wheelTarget = makeTarget();
	const camera = fakeCamera();
	const state = createDefaultFreeCameraState();
	const detach = attachFreeCameraHost({
		target: target as unknown as EventTarget,
		wheelTarget: wheelTarget as unknown as EventTarget,
		state,
		getCameraPose: () => createFreeCameraPoseFromPerspectiveCamera(camera),
		getNowMs: () => 0,
		isTypingTarget: () => true,
	});
	target.dispatch("keydown", keyboardEvent("KeyR"));
	expect(state.active).toBe(false);
	detach();

	const activeDetach = attachFreeCameraHost({
		target: target as unknown as EventTarget,
		wheelTarget: wheelTarget as unknown as EventTarget,
		state,
		getCameraPose: () => createFreeCameraPoseFromPerspectiveCamera(camera),
		getNowMs: () => 0,
	});
	target.dispatch("keydown", keyboardEvent("KeyR"));
	target.dispatch("keydown", keyboardEvent("KeyR", { repeat: true }));
	expect(state.active).toBe(true);
	target.dispatch("mousemove", mouseEvent({ movementX: 12, movementY: -8, clientX: 30, clientY: 40 }));
	expectClose(state.yaw, -12 * 0.00125);
	expectClose(state.pitch, 8 * 0.00125);
	const wheel = wheelEvent(100);
	wheelTarget.dispatch("wheel", wheel);
	expectClose(state.fov, 46.8);
	expect((wheel as WheelEvent & { prevented: boolean }).prevented).toBe(true);
	activeDetach();
});
