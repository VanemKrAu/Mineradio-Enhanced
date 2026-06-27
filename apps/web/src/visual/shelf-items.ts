import type { Track } from "@mineradio/shared";
import type { ShelfItem } from "@mineradio/visual-engine";

function trackKey(track: Track | null): string {
	return track ? `${track.provider}:${track.id}` : "";
}

export function mapQueueToShelfItems(queue: Track[], currentTrack: Track | null): ShelfItem[] {
	const currentKey = trackKey(currentTrack);
	return queue.map((track, index) => {
		const artists = track.artists.filter(Boolean).join(" / ");
		return {
			type: "queue",
			title: track.title,
			sub: artists || track.album || "",
			cover: track.coverUrl,
			tag: trackKey(track) === currentKey ? "正在播放" : `#${index + 1}`,
			queueIndex: index,
			provider: track.provider,
		};
	});
}
