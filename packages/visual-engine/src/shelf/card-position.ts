import type { ShelfLayoutProfile } from "./shelf-layout-profile";
import { smoothstep01 } from "./reveal";

export const SHELF_VISIBLE_RADIUS = 5;
export const SHELF_MAX_RENDER = SHELF_VISIBLE_RADIUS * 2 + 1;

export type CardLayoutMode = "side" | "stage";

export interface CardLayoutInput {
	index: number;
	centerSmooth: number;
	mode: CardLayoutMode;
	profile: ShelfLayoutProfile;
	fx?: {
		shelfPane?: string;
	};
	revealRaw: number;
	paneRaw: number;
	absD: number;
	paneSwitchDir?: number;
	pulse?: number;
	breathPulse?: number;
	lift?: number;
	detailOpen?: boolean;
}

export interface CardLayoutOutput {
	x: number;
	y: number;
	z: number;
	scale: number;
	opacity: number;
	rotationY: number;
	renderOrder: number;
}

export function computeCardLayout(input: CardLayoutInput): CardLayoutOutput {
	const delta = input.index - input.centerSmooth;
	const absD = input.absD;
	const reveal = smoothstep01(input.revealRaw);
	const paneEase = 1 - smoothstep01(input.paneRaw);
	const paneSwitchDir = input.paneSwitchDir ?? 0;
	const pulse = input.pulse ?? 0;
	const breathPulse = input.breathPulse ?? 0;
	const lift = input.lift ?? 0;
	const detailOpen = input.detailOpen ?? false;

	const sideLayer = Math.max(
		0,
		SHELF_VISIBLE_RADIUS + 1 - Math.min(absD, SHELF_VISIBLE_RADIUS + 1),
	);
	const renderOrder = 60 + Math.round(sideLayer * 10) + Math.round(lift * 70);

	if (input.mode === "stage") {
		const s = input.profile.stage;
		const pxStage =
			s.stageX + delta * s.stageXStep + paneEase * paneSwitchDir * 0.80;
		const pyStage = s.stageY;
		const pzStage =
			(absD < 0.5 ? s.stageZ : s.stageZ - Math.min(2.0, absD) * 0.55) -
			paneEase * 0.28;
		const scaleS =
			(absD < 0.5 ? 1.20 : Math.max(0.45, 1.0 - absD * 0.22)) *
			(1 + pulse * 0.060) *
			s.stageScale;
		const opacityS = absD < 0.5 ? 1.0 : Math.max(0.18, 1.0 - absD * 0.32);
		return {
			x: pxStage,
			y: pyStage,
			z: pzStage,
			scale: scaleS,
			opacity: opacityS,
			rotationY: -delta * 0.22,
			renderOrder,
		};
	}

	const layout = input.profile.side;
	const entry = (1 - reveal) * (0.82 + absD * 0.075);

	let px =
		layout.sideX +
		absD * layout.sideXStep -
		(detailOpen ? layout.sideDetailShift : 0) +
		entry * layout.sideEntryX;
	let py =
		(layout.sideY || 0) -
		delta * layout.sideYStep +
		(1 - reveal) * (delta < 0 ? -0.18 : 0.18);
	let pz = layout.sideZ - absD * layout.sideZStep - (1 - reveal) * 0.20;

	px += paneEase * paneSwitchDir * 0.60;
	py += paneEase * (delta < 0 ? -0.16 : 0.16);
	pz -= paneEase * 0.22;

	if (lift > 0.001) {
		px -= lift * 0.145;
		py += lift * 0.105;
		pz += lift * 0.220;
	}

	const baseScale = absD < 0.5 ? 1.12 : Math.max(0.55, 1.04 - absD * 0.14);
	const scale =
		baseScale *
		(0.88 + reveal * 0.12) *
		(1 + pulse * 0.056 + breathPulse * 0.026 + lift * 0.075) *
		layout.sideScale;

	const rotationY = layout.sideRotY + (1 - reveal) * 0.16;

	const opacity = absD < 0.5 ? 1.0 : Math.max(0.22, 1.0 - absD * 0.30);

	return { x: px, y: py, z: pz, scale, opacity, rotationY, renderOrder };
}