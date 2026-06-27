import { SHELF_SETTINGS } from "./shelf-settings";

export interface SideProfile {
	sideX: number;
	sideY: number;
	sideXStep: number;
	sideYStep: number;
	sideZ: number;
	sideZStep: number;
	sideEntryX: number;
	sideDetailShift: number;
	sideScale: number;
	sideRotY: number;
	sideRotX: number;
}

export interface StageProfile {
	stageX: number;
	stageXStep: number;
	stageY: number;
	stageZ: number;
	stageScale: number;
}

export interface DetailProfile {
	x: number;
	y: number;
	z: number;
	rx: number;
	ry: number;
	scale: number;
	rowStep: number;
	rowScale: number;
}

export interface ShelfLayoutProfile {
	side: SideProfile;
	stage: StageProfile;
	detail: DetailProfile;
}

export interface ShelfLayoutProfileOverrides {
	portrait?: boolean;
	narrow?: boolean;
	skullSafe?: boolean;
}

function getViewportWidth(): number {
	if (typeof innerWidth === "number") return innerWidth;
	if (typeof window !== "undefined" && typeof window.innerWidth === "number") return window.innerWidth;
	return 1280;
}

function getDefaultLayoutProfileInput(): Required<ShelfLayoutProfileOverrides> {
	const portrait = false;
	const width = getViewportWidth();
	const narrow = !portrait && width < 980;
	return {
		portrait,
		narrow,
		skullSafe: false,
	};
}

export function getDefaultShelfLayoutProfile(
	overrides?: ShelfLayoutProfileOverrides,
): ShelfLayoutProfile {
	const portrait = overrides?.portrait ?? getDefaultLayoutProfileInput().portrait;
	const narrow = overrides?.narrow ?? getDefaultLayoutProfileInput().narrow;
	const skullShelf = overrides?.skullSafe ?? false;

	const detailScale = portrait
		? clampRange(getViewportWidth() / 820, 0.70, 0.86)
		: narrow ? 0.92 : 1.04;
	const ctl = SHELF_SETTINGS;

	const sideX =
		(skullShelf ? (portrait ? 0.22 : (narrow ? 0.46 : 0.76)) : (portrait ? 1.56 : (narrow ? 2.48 : 3.18))) + ctl.x;
	const sideY =
		(skullShelf ? (portrait ? -0.22 : (narrow ? -0.30 : -0.34)) : 0) + ctl.y;
	const sideXStep = skullShelf ? (portrait ? 0.018 : 0.034) : (portrait ? 0.018 : 0.040);
	const sideYStep = skullShelf ? (portrait ? 0.46 : 0.62) : (portrait ? 0.52 : 0.68);
	const sideZ = (skullShelf ? (portrait ? 0.86 : 0.92) : (portrait ? 0.78 : 0.86)) + ctl.z;
	const sideZStep = skullShelf ? (portrait ? 0.108 : 0.158) : (portrait ? 0.118 : 0.170);
	const sideEntryX = skullShelf ? (portrait ? 0.30 : 0.50) : (portrait ? 0.38 : 0.82);
	const sideDetailShift = skullShelf ? 0 : (portrait ? 0.38 : 0.82);
	const sideScale =
		(skullShelf ? (portrait ? 0.84 : (narrow ? 1.04 : 1.22)) : (portrait ? 0.70 : (narrow ? 0.86 : 1))) * ctl.size;
	const sideRotY = (skullShelf ? (portrait ? -0.085 : -0.190) : (portrait ? 0.12 : 0.28)) + ctl.angle;
	const sideRotX = skullShelf ? (portrait ? 0.018 : 0.030) : (portrait ? 0.022 : 0.042);

	const stageX = ctl.x;
	const stageXStep = portrait ? 0.92 : (narrow ? 1.22 : 1.55);
	const stageY = (portrait ? -2.46 : -2.20) + ctl.y;
	const stageZ = (portrait ? 0.84 : 1.0) + ctl.z;
	const stageScale = (portrait ? 0.72 : (narrow ? 0.86 : 1)) * ctl.size;

	const detail: DetailProfile = {
		x:
			(skullShelf
				? (portrait ? 0.16 : (narrow ? 0.40 : 0.64))
				: (portrait ? 0.38 : (narrow ? 0.96 : 1.28))) + ctl.x * 0.62,
		y: (skullShelf ? (portrait ? -0.40 : -0.68) : (portrait ? 0.10 : 0.18)) + ctl.y * 0.55,
		z: (skullShelf ? (portrait ? 1.10 : 1.22) : (portrait ? 1.28 : 1.36)) + ctl.z * 0.45,
		rx: skullShelf ? (portrait ? 0.006 : 0.014) : (portrait ? -0.004 : -0.008),
		ry: (skullShelf ? (portrait ? -0.070 : -0.165) : (portrait ? 0.0 : 0.020)) + ctl.angle * 0.55,
		scale: (skullShelf ? detailScale * (portrait ? 0.88 : 1.02) : detailScale) * ctl.size,
		rowStep: skullShelf ? (portrait ? 0.37 : 0.43) : (portrait ? 0.36 : 0.42),
		rowScale: skullShelf ? (portrait ? 0.90 : 1.02) : (portrait ? 0.88 : (narrow ? 0.96 : 1.00)),
	};

	return {
		side: {
			sideX,
			sideY,
			sideXStep,
			sideYStep,
			sideZ,
			sideZStep,
			sideEntryX,
			sideDetailShift,
			sideScale,
			sideRotY,
			sideRotX,
		},
		stage: { stageX, stageXStep, stageY, stageZ, stageScale },
		detail,
	};
}

function clampRange(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}