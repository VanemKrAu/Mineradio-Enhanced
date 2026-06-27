import { expect, test } from "bun:test";
import type { FrameContext } from "../runtime/frame-context";
import type { ShelfManager } from "./shelf-animate";
import { createShelfStep } from "./shelf-step";
import type { ShelfMode, ShelfPresence } from "./shelf-state";

function makeCtx(): FrameContext {
	return {
		dt: 0,
		now: 16,
		snapshot: {} as never,
		uniforms: {} as never,
		scene: {} as never,
		camera: {} as never,
		pointerParallax: { x: 0, y: 0 },
		pointerTarget: { x: 0, y: 0 },
	};
}

function makeManager(): {
	manager: ShelfManager;
	modes: ShelfMode[];
	presences: ShelfPresence[];
	revealed: boolean[];
	getUpdateCalls: () => number;
} {
	const calls = {
		modes: [] as ShelfMode[],
		presences: [] as ShelfPresence[],
		revealed: [] as boolean[],
		updateCalls: 0,
	};
	const manager = {
		setMode(mode: ShelfMode) {
			calls.modes.push(mode);
		},
		setShelfPresence(presence: ShelfPresence) {
			calls.presences.push(presence);
		},
		setAppRevealed(revealed: boolean) {
			calls.revealed.push(revealed);
		},
		update() {
			calls.updateCalls += 1;
		},
	} as unknown as ShelfManager;
	return {
		manager,
		modes: calls.modes,
		presences: calls.presences,
		revealed: calls.revealed,
		getUpdateCalls: () => calls.updateCalls,
	};
}

test("createShelfStep syncs shelf mode and presence before updating", () => {
	const harness = makeManager();
	const step = createShelfStep(harness.manager, {
		getShelfMode: () => "stage",
		getShelfPresence: () => "auto",
	});

	step(makeCtx());

	expect(harness.modes).toEqual(["stage"]);
	expect(harness.presences).toEqual(["auto"]);
	expect(harness.revealed).toEqual([true]);
	expect(harness.getUpdateCalls()).toBe(1);
});

test("createShelfStep defaults invalid shelf mode to side and invalid presence to always", () => {
	const harness = makeManager();
	const step = createShelfStep(harness.manager, {
		getShelfMode: () => "resident",
		getShelfPresence: () => "hover",
	});

	step(makeCtx());

	expect(harness.modes).toEqual(["side"]);
	expect(harness.presences).toEqual(["always"]);
});

test("createShelfStep preserves shelf mode and marks app unrevealed while splash covers the main scene", () => {
	const harness = makeManager();
	const step = createShelfStep(harness.manager, {
		getShelfMode: () => "stage",
		getShelfPresence: () => "always",
		getSplashActive: () => true,
	});

	step(makeCtx());

	expect(harness.modes).toEqual(["stage"]);
	expect(harness.presences).toEqual(["always"]);
	expect(harness.revealed).toEqual([false]);
});
