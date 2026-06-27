import type { FrameContext } from "../runtime/frame-context";
import type { RenderStepSlot } from "../runtime/render-step-slot";
import type { ShelfManager } from "./shelf-animate";

export function createShelfStep(manager: ShelfManager): (ctx: FrameContext) => void {
	return (ctx: FrameContext) => {
		manager.update(ctx);
	};
}

export const SHELF_RENDER_STEP_SLOT: RenderStepSlot = "shelf" as const;