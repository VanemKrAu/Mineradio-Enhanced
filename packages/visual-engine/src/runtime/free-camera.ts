export interface Vec3Like {
	x: number;
	y: number;
	z: number;
}

export interface FreeCameraPose {
	position: Vec3Like;
	yaw: number;
	pitch: number;
	roll: number;
	fov: number;
}

export interface FreeCameraPointer {
	seen: boolean;
	x: number;
	y: number;
}

export interface FreeCameraResetTween {
	startMs: number;
	durationMs: number;
	from: FreeCameraPose;
	to: FreeCameraPose;
}

export interface FreeCameraState extends FreeCameraPose {
	active: boolean;
	locked: boolean;
	velocity: Vec3Like;
	keys: Record<string, boolean>;
	pointer: FreeCameraPointer;
	resetTween: FreeCameraResetTween | null;
}

export interface PersistedFreeCameraState {
	active?: boolean;
	locked?: boolean;
	position?: Partial<Vec3Like> | null;
	yaw?: number;
	pitch?: number;
	roll?: number;
	fov?: number;
}

export interface FreeCameraPointerDelta {
	movementX?: number;
	movementY?: number;
	clientX: number;
	clientY: number;
}

export const FREE_CAMERA_BASE_FOV = 45;
export const FREE_CAMERA_DEFAULT_POSITION: Vec3Like = { x: 0, y: 0, z: 6.6 };
export const FREE_CAMERA_PITCH_RANGE = {
	min: -Math.PI * 0.49,
	max: Math.PI * 0.49,
} as const;
export const FREE_CAMERA_FOV_RANGE = {
	min: 26,
	max: 72,
} as const;
export const FREE_CAMERA_POSITION_RANGE = {
	min: -80,
	max: 80,
} as const;
export const DEFAULT_FREE_CAMERA_POSE: FreeCameraPose = {
	position: { ...FREE_CAMERA_DEFAULT_POSITION },
	yaw: 0,
	pitch: 0,
	roll: 0,
	fov: FREE_CAMERA_BASE_FOV,
};

const POINTER_FACTOR = 0.00125;
const WHEEL_FOV_FACTOR = 0.018;
const NORMAL_MOVE_SPEED = 2.35;
const SHIFT_MOVE_SPEED = 6.2;
const ACTIVE_VELOCITY_EASE = 8.2;
const IDLE_VELOCITY_EASE = 13.5;
const ROLL_SPEED = 0.9;
const RESET_DURATION_MS = 620;

export function createDefaultFreeCameraState(): FreeCameraState {
	return {
		active: false,
		locked: false,
		position: { ...FREE_CAMERA_DEFAULT_POSITION },
		yaw: 0,
		pitch: 0,
		roll: 0,
		fov: FREE_CAMERA_BASE_FOV,
		velocity: zeroVec3(),
		keys: {},
		pointer: { seen: false, x: 0, y: 0 },
		resetTween: null,
	};
}

export function hydrateFreeCameraState(raw: unknown): FreeCameraState {
	const state = createDefaultFreeCameraState();
	const src = asObject(raw);
	if (!src) return state;
	const rawPosition = asObject(src.position);
	if (rawPosition) {
		state.position = {
			x: clampRange(numberOr(rawPosition.x, 0), FREE_CAMERA_POSITION_RANGE.min, FREE_CAMERA_POSITION_RANGE.max),
			y: clampRange(numberOr(rawPosition.y, 0), FREE_CAMERA_POSITION_RANGE.min, FREE_CAMERA_POSITION_RANGE.max),
			z: clampRange(numberOr(rawPosition.z, 0) || 6.6, FREE_CAMERA_POSITION_RANGE.min, FREE_CAMERA_POSITION_RANGE.max),
		};
	}
	state.yaw = clampRange(numberOr(src.yaw, 0), -Math.PI * 8, Math.PI * 8);
	state.pitch = clampRange(numberOr(src.pitch, 0), FREE_CAMERA_PITCH_RANGE.min, FREE_CAMERA_PITCH_RANGE.max);
	state.roll = clampRange(numberOr(src.roll, 0), -Math.PI, Math.PI);
	state.fov = clampRange(numberOr(src.fov, FREE_CAMERA_BASE_FOV), FREE_CAMERA_FOV_RANGE.min, FREE_CAMERA_FOV_RANGE.max);
	state.locked = !!(src.locked || src.active);
	state.active = false;
	return state;
}

export function serializeFreeCameraState(state: FreeCameraState): Required<PersistedFreeCameraState> {
	return {
		locked: !!state.locked,
		active: !!state.active,
		position: cloneVec3(state.position),
		yaw: state.yaw,
		pitch: state.pitch,
		roll: state.roll,
		fov: state.fov,
	};
}

export function toggleFreeCamera(state: FreeCameraState, currentPose?: FreeCameraPose): void {
	if (state.active) {
		state.active = false;
		state.locked = true;
		state.keys = {};
		state.velocity = zeroVec3();
		return;
	}
	if (currentPose) applyPose(state, currentPose);
	state.active = true;
	state.locked = true;
	state.resetTween = null;
	state.keys = {};
	state.pointer = { seen: false, x: 0, y: 0 };
	if (!state.velocity) state.velocity = zeroVec3();
}

export function applyFreeCameraPointerDelta(state: FreeCameraState, delta: FreeCameraPointerDelta): boolean {
	if (!state.active) return false;
	let mdx = numberOr(delta.movementX, 0);
	let mdy = numberOr(delta.movementY, 0);
	if (!mdx && !mdy && state.pointer.seen) {
		mdx = delta.clientX - state.pointer.x;
		mdy = delta.clientY - state.pointer.y;
	}
	state.pointer = { seen: true, x: delta.clientX, y: delta.clientY };
	state.yaw -= mdx * POINTER_FACTOR;
	state.pitch = clampRange(state.pitch - mdy * POINTER_FACTOR, FREE_CAMERA_PITCH_RANGE.min, FREE_CAMERA_PITCH_RANGE.max);
	return true;
}

export function applyFreeCameraWheel(state: FreeCameraState, deltaY: number): boolean {
	if (!state.active) return false;
	state.fov = clampRange((state.fov || FREE_CAMERA_BASE_FOV) + deltaY * WHEEL_FOV_FACTOR, FREE_CAMERA_FOV_RANGE.min, FREE_CAMERA_FOV_RANGE.max);
	return true;
}

export function startFreeCameraReset(state: FreeCameraState, nowMs: number, target: FreeCameraPose = DEFAULT_FREE_CAMERA_POSE): void {
	state.resetTween = {
		startMs: nowMs,
		durationMs: RESET_DURATION_MS,
		from: stateToPose(state),
		to: clonePose(target),
	};
	state.active = false;
	state.locked = true;
	state.keys = {};
	state.velocity = zeroVec3();
}

export function updateFreeCamera(state: FreeCameraState, dt: number, nowMs: number): { resetCompleted: boolean } {
	if (state.resetTween) {
		updateResetTween(state, nowMs);
		return { resetCompleted: state.resetTween === null };
	}
	if (!state.active) return { resetCompleted: false };
	const safeDt = Math.max(0.001, dt || 1 / 60);
	const keys = state.keys || {};
	const move = zeroVec3();
	if (keys.KeyW) move.z -= 1;
	if (keys.KeyS) move.z += 1;
	if (keys.KeyA) move.x -= 1;
	if (keys.KeyD) move.x += 1;
	if (keys.Space) move.y += 1;
	if (keys.ControlLeft || keys.ControlRight) move.y -= 1;
	const targetVel = zeroVec3();
	if (lengthSq(move) > 0) {
		normalizeInPlace(move);
		const rotated = rotateYX(move, state.pitch, state.yaw);
		const speed = keys.ShiftLeft || keys.ShiftRight ? SHIFT_MOVE_SPEED : NORMAL_MOVE_SPEED;
		targetVel.x = rotated.x * speed;
		targetVel.y = rotated.y * speed;
		targetVel.z = rotated.z * speed;
	}
	const ease = lengthSq(targetVel) > 0 ? ACTIVE_VELOCITY_EASE : IDLE_VELOCITY_EASE;
	lerpVec3InPlace(state.velocity, targetVel, clampRange(ease * safeDt, 0, 1));
	if (lengthSq(state.velocity) < 0.0004) state.velocity = zeroVec3();
	state.position.x += state.velocity.x * safeDt;
	state.position.y += state.velocity.y * safeDt;
	state.position.z += state.velocity.z * safeDt;
	const rollDir = (keys.KeyQ ? 1 : 0) - (keys.KeyE ? 1 : 0);
	if (rollDir) state.roll = clampRange(state.roll + rollDir * safeDt * ROLL_SPEED, -Math.PI, Math.PI);
	return { resetCompleted: false };
}

function updateResetTween(state: FreeCameraState, nowMs: number): void {
	const tw = state.resetTween;
	if (!tw) return;
	const duration = Math.max(1, tw.durationMs || RESET_DURATION_MS);
	const t = easeOutCubic01((nowMs - tw.startMs) / duration);
	state.position = lerpVec3(tw.from.position, tw.to.position, t);
	state.yaw = tw.from.yaw + shortestAngleDelta(tw.from.yaw, tw.to.yaw) * t;
	state.pitch = tw.from.pitch + (tw.to.pitch - tw.from.pitch) * t;
	state.roll = tw.from.roll + shortestAngleDelta(tw.from.roll, tw.to.roll) * t;
	state.fov = tw.from.fov + (tw.to.fov - tw.from.fov) * t;
	if (t >= 0.999) {
		applyPose(state, tw.to);
		state.resetTween = null;
		state.active = false;
		state.locked = false;
	}
}

function applyPose(state: FreeCameraState, next: FreeCameraPose): void {
	state.position = cloneVec3(next.position);
	state.yaw = numberOr(next.yaw, 0);
	state.pitch = clampRange(numberOr(next.pitch, 0), FREE_CAMERA_PITCH_RANGE.min, FREE_CAMERA_PITCH_RANGE.max);
	state.roll = clampRange(numberOr(next.roll, 0), -Math.PI, Math.PI);
	state.fov = clampRange(numberOr(next.fov, FREE_CAMERA_BASE_FOV), FREE_CAMERA_FOV_RANGE.min, FREE_CAMERA_FOV_RANGE.max);
}

function stateToPose(state: FreeCameraState): FreeCameraPose {
	return {
		position: cloneVec3(state.position),
		yaw: numberOr(state.yaw, 0),
		pitch: numberOr(state.pitch, 0),
		roll: numberOr(state.roll, 0),
		fov: numberOr(state.fov, FREE_CAMERA_BASE_FOV),
	};
}

function clonePose(next: FreeCameraPose): FreeCameraPose {
	return {
		position: cloneVec3(next.position),
		yaw: next.yaw,
		pitch: next.pitch,
		roll: next.roll,
		fov: next.fov,
	};
}

function cloneVec3(v: Vec3Like): Vec3Like {
	return { x: v.x, y: v.y, z: v.z };
}

function zeroVec3(): Vec3Like {
	return { x: 0, y: 0, z: 0 };
}

function lengthSq(v: Vec3Like): number {
	return v.x * v.x + v.y * v.y + v.z * v.z;
}

function normalizeInPlace(v: Vec3Like): Vec3Like {
	const len = Math.sqrt(lengthSq(v));
	if (len > 0) {
		v.x /= len;
		v.y /= len;
		v.z /= len;
	}
	return v;
}

function rotateYX(v: Vec3Like, pitch: number, yaw: number): Vec3Like {
	const cy = Math.cos(yaw);
	const sy = Math.sin(yaw);
	const cp = Math.cos(pitch);
	const sp = Math.sin(pitch);
	const x1 = v.x * cy + v.z * sy;
	const z1 = -v.x * sy + v.z * cy;
	return {
		x: x1,
		y: v.y * cp - z1 * sp,
		z: v.y * sp + z1 * cp,
	};
}

function lerpVec3InPlace(v: Vec3Like, to: Vec3Like, t: number): Vec3Like {
	v.x += (to.x - v.x) * t;
	v.y += (to.y - v.y) * t;
	v.z += (to.z - v.z) * t;
	return v;
}

function lerpVec3(from: Vec3Like, to: Vec3Like, t: number): Vec3Like {
	return {
		x: from.x + (to.x - from.x) * t,
		y: from.y + (to.y - from.y) * t,
		z: from.z + (to.z - from.z) * t,
	};
}

function easeOutCubic01(t: number): number {
	const x = clampRange(t, 0, 1);
	return 1 - Math.pow(1 - x, 3);
}

function shortestAngleDelta(from: number, to: number): number {
	return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

function clampRange(v: number, lo: number, hi: number): number {
	return v < lo ? lo : v > hi ? hi : v;
}

function numberOr(v: unknown, fallback: number): number {
	const n = Number(v);
	return Number.isFinite(n) ? n : fallback;
}

function asObject(v: unknown): Record<string, unknown> | null {
	return v && typeof v === "object" ? v as Record<string, unknown> : null;
}
