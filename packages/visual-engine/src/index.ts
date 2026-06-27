export type VisualEngineSnapshot = {
	preset: string;
	playing: boolean;
};

export type VisualEngine = {
	update(snapshot: VisualEngineSnapshot): void;
	resize(size: { width: number; height: number }): void;
	dispose(): void;
};

export function createVisualEngine(): VisualEngine {
	return {
		update() {},
		resize() {},
		dispose() {},
	};
}

export { createSplashEngine } from "./splash/splash-engine";
export type { SplashEngine, SplashEngineOptions } from "./splash/splash-engine";
export { createSplashWebgl, SPLASH_VERTEX_SHADER, SPLASH_FRAGMENT_SHADER } from "./splash/splash-webgl";
export { createSplashCanvas } from "./splash/splash-canvas";
export { SPLASH_CSS, injectSplashStyle } from "./splash/splash-style";

export { CONTROL_GLASS_CSS, injectControlGlassStyle } from "./control/control-glass-style";
export {
	generateControlGlassDisplacementMap,
	createControlGlassSvg,
	supportsControlGlassSvgFilter,
	CONTROL_GLASS_FILTER_MARKUP,
	CONTROL_GLASS_SVG_ID,
} from "./control/control-glass-svg";
export { attachControlGlassNode } from "./control/control-glass-node";
export type { ControlGlassNodeOptions } from "./control/control-glass-node";
export {
	createControlConsoleMotion,
} from "./control/control-console-motion";
export type {
	GsapLike,
	GsapTweenLike,
	GsapTimelineLike,
	GsapProvider,
	ButtonKind,
	ConsoleMotionRoot,
	ConsoleMotionDeps,
	ControlConsoleMotion,
	ListAnimateOptions,
	CreateControlConsoleMotionOptions,
} from "./control/control-console-motion";

export { createAudioReactivity } from "./audio/audio-reactivity";
export type {
	AudioSnapshot,
	AudioFrameBytes,
	AudioFrameSource,
	BeatHandler,
	AudioReactivityOptions,
	AudioReactivityEngine,
} from "./audio/audio-snapshot";
export { createPeakFollower } from "./audio/peak-followers";
export type { PeakFollower, PeakFollowerParams } from "./audio/peak-followers";
export {
	analyzeMainFrame,
	analyzeBeatFrame,
	beatBandRms,
	DEFAULT_BIN_RANGES,
	DEFAULT_BEAT_BAND_HZ,
} from "./audio/frequency-bands";
export type {
	MainBinRanges,
	MainBandAverages,
	BeatBandHz,
	BeatBandSamples,
} from "./audio/frequency-bands";
export {
	createBeatEngine,
	DEFAULT_BEAT_ENGINE_OPTS,
} from "./audio/beat-engine";
export type {
	BeatSamples,
	BeatEngineFrame,
	BeatEngineOpts,
	BeatEngine,
	BeatOnsetCallback,
	RtStateView,
} from "./audio/beat-engine";