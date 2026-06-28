import {
	applyFreeCameraPointerDelta,
	applyFreeCameraWheel,
	startFreeCameraReset,
	toggleFreeCamera,
	updateFreeCamera,
	type FreeCameraPose,
	type FreeCameraState,
} from "@mineradio/visual-engine";

export interface PerspectiveCameraLike {
	fov: number;
	position: {
		x: number;
		y: number;
		z: number;
		set?: (x: number, y: number, z: number) => void;
	};
	rotation: {
		x: number;
		y: number;
		z: number;
		order?: string;
		set?: (x: number, y: number, z: number, order?: never) => unknown;
	};
	updateProjectionMatrix: () => void;
}

export interface FreeCameraBeatLike {
	phiKick?: number;
	thetaKick?: number;
	rollKick?: number;
	punch?: number;
	radiusKick?: number;
}

export interface ApplyFreeCameraOptions {
	cameraShake?: number;
	beatCam?: FreeCameraBeatLike;
	camPunch?: number;
}

export interface AttachFreeCameraHostOptions {
	target: EventTarget;
	wheelTarget?: EventTarget;
	state: FreeCameraState;
	getCameraPose: () => FreeCameraPose;
	getNowMs: () => number;
	isTypingTarget?: (target: EventTarget | null) => boolean;
	isPointerOverUi?: (event: MouseEvent | WheelEvent) => boolean;
	onReset?: () => void;
	onToggle?: () => void;
}

export function isFreeCameraControlCode(code: string): boolean {
	return /^(KeyW|KeyA|KeyS|KeyD|KeyQ|KeyE|Space|ShiftLeft|ShiftRight|ControlLeft|ControlRight)$/.test(code);
}

export function createFreeCameraPoseFromPerspectiveCamera(camera: PerspectiveCameraLike): FreeCameraPose {
	return {
		position: {
			x: camera.position.x,
			y: camera.position.y,
			z: camera.position.z,
		},
		pitch: camera.rotation.x || 0,
		yaw: camera.rotation.y || 0,
		roll: camera.rotation.z || 0,
		fov: camera.fov || 45,
	};
}

export function applyFreeCameraToPerspectiveCamera(
	state: FreeCameraState,
	camera: PerspectiveCameraLike,
	opts: ApplyFreeCameraOptions = {},
): boolean {
	if (!(state.active || state.locked)) return false;
	const beatCam = opts.beatCam ?? {};
	const cameraShake = clampRange(Number(opts.cameraShake) || 0, 0, 1.8);
	setCameraPosition(camera, state.position.x, state.position.y, state.position.z);
	const pitch = state.pitch + (beatCam.phiKick || 0) * cameraShake * 0.45;
	const yaw = state.yaw + (beatCam.thetaKick || 0) * cameraShake * 0.45;
	const roll = state.roll + (beatCam.rollKick || 0) * cameraShake;
	if (camera.rotation.set) camera.rotation.set(pitch, yaw, roll, "YXZ" as never);
	else {
		camera.rotation.x = pitch;
		camera.rotation.y = yaw;
		camera.rotation.z = roll;
		camera.rotation.order = "YXZ";
	}
	const radiusKick = beatCam.radiusKick || 0;
	if (cameraShake > 0 && Math.abs(radiusKick) > 0.0001) {
		const dir = forwardDirectionFromYawPitch(yaw, pitch);
		camera.position.x += dir.x * radiusKick * cameraShake * 0.52;
		camera.position.y += dir.y * radiusKick * cameraShake * 0.52;
		camera.position.z += dir.z * radiusKick * cameraShake * 0.52;
	}
	const cameraPunch = Math.max((opts.camPunch || 0) * 0.55, (beatCam.punch || 0) * 0.54 + radiusKick * 0.16) * cameraShake;
	const targetFov = clampRange(state.fov || 45, 26, 72) - cameraPunch * 1.75;
	camera.fov += (targetFov - camera.fov) * (targetFov < camera.fov ? 0.24 : 0.12);
	camera.updateProjectionMatrix();
	return true;
}

export function attachFreeCameraHost(opts: AttachFreeCameraHostOptions): () => void {
	const target = opts.target;
	const wheelTarget = opts.wheelTarget ?? opts.target;
	const state = opts.state;
	const isTypingTarget = opts.isTypingTarget ?? defaultIsTypingTarget;
	const isPointerOverUi = opts.isPointerOverUi ?? (() => false);

	function keydown(event: Event): void {
		const e = event as KeyboardEvent;
		if (isTypingTarget(e.target)) return;
		if (e.code === "KeyR") {
			e.preventDefault();
			e.stopImmediatePropagation?.();
			if (e.repeat) return;
			toggleFreeCamera(state, opts.getCameraPose());
			opts.onToggle?.();
			return;
		}
		if (!state.active) return;
		if (e.code === "KeyK") {
			e.preventDefault();
			e.stopImmediatePropagation?.();
			startFreeCameraReset(state, opts.getNowMs());
			opts.onReset?.();
			return;
		}
		if (!isFreeCameraControlCode(e.code)) return;
		e.preventDefault();
		e.stopImmediatePropagation?.();
		state.keys = state.keys || {};
		state.keys[e.code] = true;
	}

	function keyup(event: Event): void {
		const e = event as KeyboardEvent;
		if (!state.keys || !isFreeCameraControlCode(e.code)) return;
		if (!isTypingTarget(e.target)) {
			e.preventDefault();
			e.stopImmediatePropagation?.();
		}
		state.keys[e.code] = false;
	}

	function mousemove(event: Event): void {
		const e = event as MouseEvent;
		if (!state.active) return;
		applyFreeCameraPointerDelta(state, {
			movementX: e.movementX || 0,
			movementY: e.movementY || 0,
			clientX: e.clientX,
			clientY: e.clientY,
		});
	}

	function wheel(event: Event): void {
		const e = event as WheelEvent;
		if (isPointerOverUi(e)) return;
		if (!state.active) return;
		e.preventDefault();
		applyFreeCameraWheel(state, e.deltaY);
	}

	function blur(): void {
		state.keys = {};
	}

	target.addEventListener("keydown", keydown, true);
	target.addEventListener("keyup", keyup, true);
	target.addEventListener("mousemove", mousemove);
	target.addEventListener("blur", blur);
	wheelTarget.addEventListener("wheel", wheel, { passive: false });
	return () => {
		target.removeEventListener("keydown", keydown, true);
		target.removeEventListener("keyup", keyup, true);
		target.removeEventListener("mousemove", mousemove);
		target.removeEventListener("blur", blur);
		wheelTarget.removeEventListener("wheel", wheel);
	};
}

export function updateAndApplyFreeCamera(
	state: FreeCameraState,
	camera: PerspectiveCameraLike,
	dt: number,
	nowMs: number,
	opts: ApplyFreeCameraOptions = {},
): boolean {
	updateFreeCamera(state, dt, nowMs);
	return applyFreeCameraToPerspectiveCamera(state, camera, opts);
}

function setCameraPosition(camera: PerspectiveCameraLike, x: number, y: number, z: number): void {
	if (camera.position.set) camera.position.set(x, y, z);
	else {
		camera.position.x = x;
		camera.position.y = y;
		camera.position.z = z;
	}
}

function forwardDirectionFromYawPitch(yaw: number, pitch: number): { x: number; y: number; z: number } {
	const cp = Math.cos(pitch);
	return {
		x: -Math.sin(yaw) * cp,
		y: Math.sin(pitch),
		z: -Math.cos(yaw) * cp,
	};
}

function defaultIsTypingTarget(target: EventTarget | null): boolean {
	const el = target as HTMLElement | null;
	if (!el) return false;
	const tag = el.tagName?.toLowerCase();
	return tag === "input" || tag === "textarea" || tag === "select" || el.isContentEditable === true;
}

function clampRange(v: number, lo: number, hi: number): number {
	return v < lo ? lo : v > hi ? hi : v;
}
