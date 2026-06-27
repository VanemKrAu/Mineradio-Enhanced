import type * as THREE from "three";
import type { AudioSnapshot } from "../audio/audio-snapshot";
import type { RuntimeUniforms } from "./uniforms";

export interface FrameContext {
	readonly dt: number;
	readonly now: number;
	readonly snapshot: AudioSnapshot;
	readonly uniforms: RuntimeUniforms;
	readonly scene: THREE.Scene;
	readonly camera: THREE.PerspectiveCamera;
	readonly pointerParallax: { x: number; y: number };
	readonly pointerTarget: { x: number; y: number };
}