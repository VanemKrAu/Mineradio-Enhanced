import { type ReactElement } from "react";
import { PlayerConsoleHost } from "../../visual/PlayerConsoleHost";
import type { PlaybackMode } from "../../stores/playback-store";
import type { ShelfCameraMode, ShelfMode, ShelfPresence } from "../../stores/shelf-store";
import type { PlaybackQuality, Track } from "@mineradio/shared";

export interface BottomControlsHostProps {
	visible: boolean;
	onReveal: () => void;
	onTogglePlay?: () => void;
	onPrevious?: () => void;
	onNext?: () => void;
	onModeChange?: (mode: PlaybackMode) => void;
	onQueue?: () => void;
	onLyrics?: () => void;
	onLyricSourceChange?: (mode: "original" | "custom") => void;
	onOpenCustomLyrics?: () => void;
	onCollectCurrent?: () => void;
	onClose?: () => void;
	onNotice?: (message: string) => void;
	onSeek?: (positionMs: number) => void;
	onVolumeChange?: (volume: number) => void;
	onToggleMute?: () => void;
	onQualityChange?: (quality: PlaybackQuality) => void;
	onShelfModeChange?: (mode: ShelfMode) => void;
	onShelfCameraModeChange?: (mode: ShelfCameraMode) => void;
	onShelfPresenceChange?: (presence: ShelfPresence) => void;
	onShelfShowPodcastsChange?: (show: boolean) => void;
	onShelfMergeCollectionsChange?: (merge: boolean) => void;
	onPlayQueueIndex?: (index: number) => void;
	onRemoveQueueIndex?: (index: number) => void;
	onInsertQueueNext?: (index: number) => void;
	onMinimize?: () => void;
	onToggleMaximize?: () => void;
	onToggleFullscreen?: () => void;
	mode?: PlaybackMode;
	isPlaying?: boolean;
	currentTitle?: string;
	currentArtist?: string;
	currentCoverUrl?: string;
	queue?: Track[];
	currentTrack?: Track | null;
	miniQueueOpen?: boolean;
	positionMs?: number;
	durationMs?: number | null;
	volume?: number;
	muted?: boolean;
	playbackQuality?: PlaybackQuality;
	shelfMode?: ShelfMode;
	shelfCameraMode?: ShelfCameraMode;
	shelfPresence?: ShelfPresence;
	shelfShowPodcasts?: boolean;
	shelfMergeCollections?: boolean;
	lyricSourceMode?: "original" | "custom";
	hasCustomLyric?: boolean;
}

export function BottomControlsHost(props: BottomControlsHostProps): ReactElement {
	return (
		<>
			<button
				id="bottom-handle"
				className={props.visible ? "active" : ""}
				type="button"
				onClick={props.onReveal}
				onPointerEnter={props.onReveal}
				aria-label="展开播放器控制台"
				title="展开播放器控制台"
			>
				<span />
			</button>
			<PlayerConsoleHost
				visible={props.visible}
				onReveal={props.onReveal}
				onTogglePlay={props.onTogglePlay}
				onPrevious={props.onPrevious}
				onNext={props.onNext}
				onModeChange={props.onModeChange}
				onQueue={props.onQueue}
				onLyrics={props.onLyrics}
				onLyricSourceChange={props.onLyricSourceChange}
				onOpenCustomLyrics={props.onOpenCustomLyrics}
				onCollectCurrent={props.onCollectCurrent}
				onClose={props.onClose}
				onNotice={props.onNotice}
				onSeek={props.onSeek}
				onVolumeChange={props.onVolumeChange}
				onToggleMute={props.onToggleMute}
				onQualityChange={props.onQualityChange}
				onShelfModeChange={props.onShelfModeChange}
				onShelfCameraModeChange={props.onShelfCameraModeChange}
				onShelfPresenceChange={props.onShelfPresenceChange}
				onShelfShowPodcastsChange={props.onShelfShowPodcastsChange}
				onShelfMergeCollectionsChange={props.onShelfMergeCollectionsChange}
				onPlayQueueIndex={props.onPlayQueueIndex}
				onRemoveQueueIndex={props.onRemoveQueueIndex}
				onInsertQueueNext={props.onInsertQueueNext}
				onMinimize={props.onMinimize}
				onToggleMaximize={props.onToggleMaximize}
				onToggleFullscreen={props.onToggleFullscreen}
				mode={props.mode}
				isPlaying={props.isPlaying}
				currentTitle={props.currentTitle}
				currentArtist={props.currentArtist}
				currentCoverUrl={props.currentCoverUrl}
				queue={props.queue}
				currentTrack={props.currentTrack}
				miniQueueOpen={props.miniQueueOpen}
				positionMs={props.positionMs}
				durationMs={props.durationMs}
				volume={props.volume}
				muted={props.muted}
				playbackQuality={props.playbackQuality}
				shelfMode={props.shelfMode}
				shelfCameraMode={props.shelfCameraMode}
				shelfPresence={props.shelfPresence}
				shelfShowPodcasts={props.shelfShowPodcasts}
				shelfMergeCollections={props.shelfMergeCollections}
				lyricSourceMode={props.lyricSourceMode}
				hasCustomLyric={props.hasCustomLyric}
			/>
		</>
	);
}
