import { expect, test } from "bun:test";
import { createShelfPointerRaycastFocus } from "./shelf-raycast-focus";

test("createShelfPointerRaycastFocus maps pointer coordinates to NDC and raycasts side shelf cards", async () => {
	const vectorValues: number[][] = [];
	const raycasterCalls: unknown[] = [];
	class FakeVector2 {
		x = 0;
		y = 0;
		set(x: number, y: number) {
			this.x = x;
			this.y = y;
			vectorValues.push([x, y]);
		}
	}
	class FakeRaycaster {
		setFromCamera(vector: FakeVector2, camera: unknown) {
			raycasterCalls.push([vector.x, vector.y, camera]);
		}
	}
	const camera = { name: "camera" };
	const raycasted: unknown[] = [];
	const getSideShelfFocusHit = await createShelfPointerRaycastFocus({
		camera: camera as never,
		three: {
			Raycaster: FakeRaycaster,
			Vector2: FakeVector2,
		} as never,
		shelfManager: {
			getMode: () => "side",
			raycastCards: (raycaster) => {
				raycasted.push(raycaster);
				return { index: 0 } as never;
			},
		},
	});

	expect(getSideShelfFocusHit({
		clientX: 600,
		clientY: 225,
		viewportWidth: 1200,
		viewportHeight: 900,
	})).toBe(true);

	expect(vectorValues).toEqual([[0, 0.5]]);
	expect(raycasterCalls).toEqual([[0, 0.5, camera]]);
	expect(raycasted.length).toBe(1);
});

test("createShelfPointerRaycastFocus stays false outside side mode or without viewport size", async () => {
	const getSideShelfFocusHit = await createShelfPointerRaycastFocus({
		camera: {} as never,
		three: {
			Raycaster: class {
				setFromCamera() {
					throw new Error("should not raycast");
				}
			},
			Vector2: class {
				set() {}
			},
		} as never,
		shelfManager: {
			getMode: () => "stage",
			raycastCards: () => {
				throw new Error("should not raycast");
			},
		},
	});

	expect(getSideShelfFocusHit({
		clientX: 100,
		clientY: 100,
		viewportWidth: 1200,
		viewportHeight: 900,
	})).toBe(false);
	expect(getSideShelfFocusHit({
		clientX: 100,
		clientY: 100,
		viewportWidth: 0,
		viewportHeight: 900,
	})).toBe(false);
});
