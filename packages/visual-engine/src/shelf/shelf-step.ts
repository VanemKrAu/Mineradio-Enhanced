import type { FrameContext } from "../runtime/frame-context";
import type { RenderStepSlot } from "../runtime/render-step-slot";
import type { ShelfManager } from "./shelf-animate";
import type { ShelfMode, ShelfPresence } from "./shelf-state";

export interface ShelfStepOptions {
	getShelfMode?: () => string | null | undefined;
	getShelfPresence?: () => string | null | undefined;
	getSplashActive?: () => boolean;
}

export function createShelfStep(manager: ShelfManager, opts: ShelfStepOptions = {}): (ctx: FrameContext) => void {
	return (ctx: FrameContext) => {
		manager.setMode(normalizeShelfMode(opts.getShelfMode?.()));
		manager.setShelfPresence(normalizeShelfPresence(opts.getShelfPresence?.()));
		manager.setAppRevealed(!opts.getSplashActive?.());
		manager.update(ctx);
	};
}

export const SHELF_RENDER_STEP_SLOT: RenderStepSlot = "shelf" as const;

function normalizeShelfMode(value: string | null | undefined): ShelfMode {
	return value === "stage" || value === "off" ? value : "side";
}

function normalizeShelfPresence(value: string | null | undefined): ShelfPresence {
	return value === "auto" ? "auto" : "always";
}
