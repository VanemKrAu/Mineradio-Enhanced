import { create } from "zustand";
import type { Track } from "@mineradio/shared";

export type PlaybackMode = "single" | "loop" | "queue" | "shuffle";

export interface PlaybackState {
	currentTrack: Track | null;
	isPlaying: boolean;
	positionMs: number;
	durationMs: number | null;
	mode: PlaybackMode;
	queue: Track[];
	setCurrentTrack: (track: Track | null) => void;
	togglePlay: () => void;
	setPosition: (ms: number) => void;
	setDuration: (ms: number | null) => void;
	setMode: (mode: PlaybackMode) => void;
	enqueue: (track: Track) => void;
	next: () => void;
	clearQueue: () => void;
}

function trackRef(track: Track | null): string {
	return track ? `${track.provider}:${track.id}` : "";
}

export const usePlaybackStore = create<PlaybackState>()((set, get) => ({
	currentTrack: null,
	isPlaying: false,
	positionMs: 0,
	durationMs: null,
	mode: "queue",
	queue: [],
	setCurrentTrack: (track) =>
		set({
			currentTrack: track,
			positionMs: 0,
			durationMs: track?.durationMs ?? null,
		}),
	togglePlay: () => set((s) => ({ isPlaying: !s.isPlaying })),
	setPosition: (ms) => set({ positionMs: ms }),
	setDuration: (ms) => set({ durationMs: ms }),
	setMode: (mode) => set({ mode }),
	enqueue: (track) => set((s) => ({ queue: [...s.queue, track] })),
	clearQueue: () => set({ queue: [] }),
	next: () => {
		const { queue, currentTrack, mode } = get();
		if (queue.length === 0) return;
		const currentRef = trackRef(currentTrack);
		const currentIdx = currentTrack ? queue.findIndex((t) => trackRef(t) === currentRef) : -1;
		let nextIdx: number;
		if (mode === "shuffle") {
			nextIdx = queue.length === 1 ? 0 : Math.floor(Math.random() * queue.length);
		} else if (mode === "single") {
			nextIdx = currentIdx >= 0 ? currentIdx : 0;
		} else {
			nextIdx = (currentIdx + 1) % queue.length;
		}
		const nextTrack = queue[nextIdx] ?? null;
		set({
			currentTrack: nextTrack,
			positionMs: 0,
			durationMs: nextTrack?.durationMs ?? null,
		});
	},
}));