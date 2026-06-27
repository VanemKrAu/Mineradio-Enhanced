import { expect, test } from "bun:test";
import { usePlaybackStore } from "./playback-store";
import type { Track } from "@mineradio/shared";

function makeTrack(id: string): Track {
	return {
		provider: "netease",
		id,
		sourceId: id,
		title: id,
		artists: [],
		album: "",
		coverUrl: "",
		qualityHints: [],
		playableState: "unknown",
	};
}

test("setCurrentTrack sets the track and toggles play", () => {
	const store = usePlaybackStore.getState();
	usePlaybackStore.setState({
		currentTrack: null,
		isPlaying: false,
		queue: [],
		positionMs: 0,
		durationMs: null,
		mode: "queue",
	});
	store.setCurrentTrack(makeTrack("a"));
	expect(usePlaybackStore.getState().currentTrack?.id).toBe("a");
	store.togglePlay();
	expect(usePlaybackStore.getState().isPlaying).toBe(true);
});

test("next cycles a two-track queue in queue mode", () => {
	usePlaybackStore.setState({
		currentTrack: null,
		isPlaying: false,
		positionMs: 0,
		durationMs: null,
		mode: "queue",
		queue: [],
	});
	const a = makeTrack("a");
	const b = makeTrack("b");
	usePlaybackStore.getState().enqueue(a);
	usePlaybackStore.getState().enqueue(b);
	usePlaybackStore.getState().setCurrentTrack(a);
	usePlaybackStore.getState().next();
	expect(usePlaybackStore.getState().currentTrack?.id).toBe("b");
	usePlaybackStore.getState().next();
	expect(usePlaybackStore.getState().currentTrack?.id).toBe("a");
});