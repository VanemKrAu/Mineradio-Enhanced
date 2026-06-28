import { useCallback, useEffect, useMemo, useRef, type ReactElement, type RefObject } from "react";
import type { LyricPayload, LyricLine as SharedLyricLine, PlaylistSummary, Track } from "@mineradio/shared";
import {
	type FxState,
	type LyricLine as VisualLyricLine,
	type ShelfItem,
	type ShelfOpenDetailContentPayload,
	type StageLyricsLifecycle,
} from "@mineradio/visual-engine";
import { useVisualEngine } from "./useVisualEngine";
import type { ShelfDetailRowClickPayload } from "./shelf-pointer-interactions";
import type { ShelfDetailContentListWriter } from "./shelf-detail-data";
import { PlayerController } from "../audio/player-controller";
import { resolveShelfItems } from "./shelf-items";
import { isWallpaperSafeShelfPreset } from "./shelf-focus-zone";

export interface VisualEngineHostProps {
	audioElementRef: RefObject<HTMLAudioElement | null>;
	controllerRef: RefObject<PlayerController | null>;
	lyricsPayload: LyricPayload | null;
	positionMs: number;
	isPlaying: boolean;
	queue?: Track[];
	playlists?: PlaylistSummary[];
	currentTrack?: Track | null;
	currentCoverUrl?: string | null;
	sidecarBaseUrl?: string | null;
	coverResolution?: number;
	fxDefaults?: Partial<FxState>;
	splashActive?: boolean;
	homeActive?: boolean;
	onShelfPlayQueueIndex?: (index: number) => void;
	onShelfDetailRowClick?: (payload: ShelfDetailRowClickPayload) => void;
	onShelfOpenDetailContent?: (payload: ShelfOpenDetailContentPayload, writer: ShelfDetailContentListWriter) => void;
}

function mapLyricPayload(payload: LyricPayload | null): VisualLyricLine[] {
	if (!payload || !Array.isArray(payload.lines)) return [];
	return payload.lines.map((line: SharedLyricLine): VisualLyricLine => ({
		t: Math.max(0, line.timeMs) / 1000,
		text: line.text ?? "",
	}));
}

export function resolveRuntimeShelfMode(
	defaultMode: string | null | undefined,
	runtimeOverride: string | null | undefined,
): string {
	if (runtimeOverride && (!defaultMode || defaultMode === "off")) return runtimeOverride;
	return defaultMode ?? "side";
}

export function syncRuntimeShelfModeOverride(
	previousDefaultRef: { current: string | undefined },
	runtimeOverrideRef: { current: string | null },
	defaultMode: string | undefined,
): void {
	if (previousDefaultRef.current !== defaultMode) {
		runtimeOverrideRef.current = null;
		previousDefaultRef.current = defaultMode;
	}
}

export function resolveVisualCoverUrl(currentCoverUrl: string | null | undefined, currentTrack: Track | null | undefined): string {
	return currentCoverUrl ?? currentTrack?.coverUrl ?? "";
}

export function resolveVisualCoverUrlForSidecar(coverUrl: string, sidecarBaseUrl: string | null | undefined): string {
	if (!coverUrl) return "";
	if (/^data:image\//i.test(coverUrl) || /^blob:/i.test(coverUrl)) return coverUrl;
	if (!/^https?:\/\//i.test(coverUrl)) return "";
	const base = String(sidecarBaseUrl ?? "").replace(/\/$/, "");
	if (!base) return coverUrl;
	const params = new URLSearchParams({ url: coverUrl });
	return `${base}/image-proxy?${params.toString()}`;
}

export function VisualEngineHost(props: VisualEngineHostProps): ReactElement {
	const hostRef = useRef<HTMLDivElement | null>(null);
	const positionRef = useRef<number>(props.positionMs);
	const isPlayingRef = useRef<boolean>(props.isPlaying);
	const lyricLinesRef = useRef<VisualLyricLine[]>(mapLyricPayload(props.lyricsPayload));
	const shelfItemsRef = useRef<ShelfItem[]>([]);
	const shelfItemsVersionRef = useRef<number>(0);
	const coverUrlRef = useRef<string>(resolveVisualCoverUrlForSidecar(resolveVisualCoverUrl(props.currentCoverUrl, props.currentTrack), props.sidecarBaseUrl));
	const coverUrlVersionRef = useRef<number>(0);
	const splashActiveRef = useRef<boolean>(props.splashActive ?? false);
	const homeActiveRef = useRef<boolean>(props.homeActive ?? false);
	const shelfModeRef = useRef<string>(props.fxDefaults?.shelf ?? "side");
	const runtimeShelfModeOverrideRef = useRef<string | null>(null);
	const previousDefaultShelfModeRef = useRef<string | undefined>(props.fxDefaults?.shelf);
	const shelfCameraModeRef = useRef<string>(props.fxDefaults?.shelfCameraMode ?? "static");
	const shelfPresenceRef = useRef<string>(props.fxDefaults?.shelfPresence ?? "always");
	const wallpaperSafeRef = useRef<boolean>(isWallpaperSafeShelfPreset(props.fxDefaults?.preset));
	const onShelfPlayQueueIndexRef = useRef<((index: number) => void) | undefined>(props.onShelfPlayQueueIndex);
	const onShelfDetailRowClickRef = useRef<((payload: ShelfDetailRowClickPayload) => void) | undefined>(props.onShelfDetailRowClick);
	const onShelfOpenDetailContentRef = useRef<((payload: ShelfOpenDetailContentPayload, writer: ShelfDetailContentListWriter) => void) | undefined>(props.onShelfOpenDetailContent);
	const lifecycleRef = useRef<StageLyricsLifecycle | null>(null);

	positionRef.current = props.positionMs;
	isPlayingRef.current = props.isPlaying;
	splashActiveRef.current = props.splashActive ?? false;
	homeActiveRef.current = props.homeActive ?? false;
	syncRuntimeShelfModeOverride(
		previousDefaultShelfModeRef,
		runtimeShelfModeOverrideRef,
		props.fxDefaults?.shelf,
	);
	shelfModeRef.current = resolveRuntimeShelfMode(props.fxDefaults?.shelf, runtimeShelfModeOverrideRef.current);
	shelfCameraModeRef.current = props.fxDefaults?.shelfCameraMode ?? "static";
	shelfPresenceRef.current = props.fxDefaults?.shelfPresence ?? "always";
	wallpaperSafeRef.current = isWallpaperSafeShelfPreset(props.fxDefaults?.preset);
	onShelfPlayQueueIndexRef.current = props.onShelfPlayQueueIndex;
	onShelfDetailRowClickRef.current = props.onShelfDetailRowClick;
	onShelfOpenDetailContentRef.current = props.onShelfOpenDetailContent;
	const nextCoverUrl = resolveVisualCoverUrlForSidecar(
		resolveVisualCoverUrl(props.currentCoverUrl, props.currentTrack),
		props.sidecarBaseUrl,
	);
	if (coverUrlRef.current !== nextCoverUrl) {
		coverUrlRef.current = nextCoverUrl;
		coverUrlVersionRef.current += 1;
	}

	const handleShelfModeChange = useCallback((mode: "side") => {
		runtimeShelfModeOverrideRef.current = mode;
		shelfModeRef.current = mode;
	}, []);

	const nextShelfItems = useMemo(
		() => resolveShelfItems({
			playlists: props.playlists ?? [],
			queue: props.queue ?? [],
			currentTrack: props.currentTrack ?? null,
		}),
		[props.playlists, props.queue, props.currentTrack],
	);

	useEffect(() => {
		shelfItemsRef.current = nextShelfItems;
		shelfItemsVersionRef.current += 1;
	}, [nextShelfItems]);

	useEffect(() => {
		lyricLinesRef.current = mapLyricPayload(props.lyricsPayload);
		const lifecycle = lifecycleRef.current;
		if (lifecycle) {
			try {
				lifecycle.setLyricLines(lyricLinesRef.current);
			} catch {
			}
		}
	}, [props.lyricsPayload]);

	useVisualEngine({
		hostRef,
		audioElementRef: props.audioElementRef,
		positionRef,
		isPlayingRef,
		lyricLinesRef,
		shelfItemsRef,
		shelfItemsVersionRef,
		coverUrlRef,
		coverUrlVersionRef,
		splashActiveRef,
		homeActiveRef,
		shelfModeRef,
		shelfCameraModeRef,
		shelfPresenceRef,
		wallpaperSafeRef,
		onShelfPlayQueueIndexRef,
		onShelfDetailRowClickRef,
		onShelfOpenDetailContentRef,
		lifecycleRef,
		coverResolution: props.coverResolution ?? 1.55,
		fxDefaults: props.fxDefaults,
		onShelfModeChange: handleShelfModeChange,
	});

	return <div id="visual-host" className="visual-host" ref={hostRef} />;
}
