import type * as THREE from "three";
import type { ShelfManager } from "./shelf-animate";

export interface ShelfPointerRaycastInfo {
	clientX: number;
	clientY: number;
	viewportWidth: number;
	viewportHeight: number;
}

export type ShelfPointerRaycastFocusGetter = (pointer: ShelfPointerRaycastInfo) => boolean;

export interface ShelfPointerRaycastFocusOptions {
	camera: THREE.Camera;
	shelfManager: Pick<ShelfManager, "getMode" | "raycastCards">;
	three?: Pick<typeof import("three"), "Raycaster" | "Vector2">;
}

export async function createShelfPointerRaycastFocus(
	opts: ShelfPointerRaycastFocusOptions,
): Promise<ShelfPointerRaycastFocusGetter> {
	const three = opts.three ?? await import("three");
	const raycaster = new three.Raycaster();
	const pointerNdc = new three.Vector2();
	return (pointer) => {
		if (opts.shelfManager.getMode() !== "side") return false;
		if (pointer.viewportWidth <= 0 || pointer.viewportHeight <= 0) return false;
		pointerNdc.set(
			(pointer.clientX / pointer.viewportWidth) * 2 - 1,
			-(pointer.clientY / pointer.viewportHeight) * 2 + 1,
		);
		raycaster.setFromCamera(pointerNdc, opts.camera);
		return opts.shelfManager.raycastCards(raycaster) !== null;
	};
}
