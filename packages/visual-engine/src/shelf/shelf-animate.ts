import type * as THREE from "three";
import type { FrameContext } from "../runtime/frame-context";
import { computeBreathPulse } from "./breath";
import {
	createShelfState,
	type ShelfMode,
	type ShelfPane,
	type ShelfState,
} from "./shelf-state";

export interface ShelfItem {
	type?: string;
	title?: string;
	sub?: string;
	cover?: string;
	tag?: string;
	playlistId?: string;
	podcastKey?: string;
	queueIndex?: number;
	provider?: string;
}

export interface ShelfManagerOptions {
	scene?: THREE.Scene | null;
	group?: THREE.Group | null;
	now?: () => number;
}

export interface ShelfSnapshot {
	centerIdx: number;
	centerSmooth: number;
	mode: ShelfMode;
	shelfPane: ShelfPane;
	shelfVisibility: number;
	openCardIdx: number;
	breathPulse: number;
}

export interface ShelfManager {
	getState(): ShelfState;
	setData(items: ShelfItem[], opts?: { asyncBuild?: boolean }): void;
	getData(): ShelfItem[];
	update(ctx: FrameContext): void;
	setMode(mode: ShelfMode): void;
	getMode(): ShelfMode;
	setSelectedIdx(idx: number): void;
	getSelectedIdx(): number;
	setShelfPane(pane: ShelfPane): void;
	getShelfPane(): ShelfPane;
	setShelfVisibility(v: number): void;
	getShelfVisibility(): number;
	schedulePaneSwitch(dir: number): void;
	openDetail(idx: number, opts?: { playlistId?: string; title?: string }): void;
	closeDetail(opts?: { immediate?: boolean }): void;
	getSnapshot(): ShelfSnapshot;
	dispose(): void;
}

export function createShelfManager(opts: ShelfManagerOptions): ShelfManager {
	const state: ShelfState = createShelfState();
	const scene: THREE.Scene | null = opts.scene ?? null;
	let group: THREE.Group | null = opts.group ?? null;
	const data: ShelfItem[] = [];
	let breathPulseLast = 0;
	let lastFrameNow = 0;
	const nowFn =
		opts.now ??
		(() => (typeof performance !== "undefined" ? performance.now() : Date.now()));

	return {
		getState() {
			return state;
		},
		setData(items) {
			data.length = 0;
			for (const it of items) data.push(it);
			state.lastSig = `${items.length}::${state.shelfPane}`;
			if (state.selectedIdx >= items.length) state.selectedIdx = -1;
		},
		getData() {
			return data;
		},
		update(ctx) {
			if (lastFrameNow === 0) lastFrameNow = ctx.now;
			const dtMs = Math.max(0, ctx.now - lastFrameNow);
			lastFrameNow = ctx.now;

			state.centerSmooth += (state.centerTarget - state.centerSmooth) * 0.16;
			if (Math.abs(state.centerSmooth - state.centerTarget) < 0.001) {
				state.centerSmooth = state.centerTarget;
			}

			breathPulseLast = computeBreathPulse(
				ctx.uniforms.uTime.value,
				0,
				state.shelfVisibility,
			);

			if (dtMs > 0) {
				const pulseBucket = Math.round(
					(ctx.uniforms.uBass.value + ctx.uniforms.uBeat.value * 0.85) * 10,
				);
				if (
					pulseBucket !== state.lastCardPulseBucket ||
					ctx.uniforms.uTime.value - state.lastCardRedrawAt > 1.35
				) {
					state.lastCardPulseBucket = pulseBucket;
					state.lastCardRedrawAt = ctx.uniforms.uTime.value;
				}
				if (ctx.uniforms.uTime.value - state.lastUpdate > 0.8) {
					state.lastUpdate = ctx.uniforms.uTime.value;
				}
			}

			if (group) {
				group.visible =
					state.shelfVisibility > 0 &&
					data.length > 0 &&
					state.mode !== "off";
			}

			void nowFn;
		},
		setMode(mode) {
			state.mode = mode;
		},
		getMode() {
			return state.mode;
		},
		setSelectedIdx(idx) {
			state.selectedIdx = idx;
		},
		getSelectedIdx() {
			return state.selectedIdx;
		},
		setShelfPane(pane) {
			if (pane === state.shelfPane) return;
			const remembered = Math.max(0, Math.round(state.centerTarget));
			state.paneMemory[state.shelfPane] = remembered;
			state.shelfPane = pane;
		},
		getShelfPane() {
			return state.shelfPane;
		},
		setShelfVisibility(v) {
			state.shelfVisibility = v;
		},
		getShelfVisibility() {
			return state.shelfVisibility;
		},
		schedulePaneSwitch(dir) {
			state.paneSwitchDir = dir < 0 ? -1 : 1;
		},
		openDetail(idx) {
			state.openCardIdx = idx;
		},
		closeDetail() {
			state.openCardIdx = -1;
		},
		getSnapshot() {
			return {
				centerIdx: state.centerIdx,
				centerSmooth: state.centerSmooth,
				mode: state.mode,
				shelfPane: state.shelfPane,
				shelfVisibility: state.shelfVisibility,
				openCardIdx: state.openCardIdx,
				breathPulse: breathPulseLast,
			};
		},
		dispose() {
			if (group && scene) {
				scene.remove(group);
			}
			group = null;
		},
	};
}