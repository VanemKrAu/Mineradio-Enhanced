import type { PlaylistSummary, Track } from "@mineradio/shared";
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

function providerTag(provider: PlaylistSummary["provider"]): string {
	return provider === "netease" ? "网易云" : "QQ 音乐";
}

function playlistSub(trackCount: number | undefined): string {
	if (typeof trackCount !== "number") return "";
	return `${trackCount} 首`;
}

export function mapPlaylistsToShelfItems(playlists: PlaylistSummary[]): ShelfItem[] {
	return playlists
		.filter((playlist) => playlist.id && playlist.name)
		.map((playlist) => ({
			type: "playlist",
			title: playlist.name,
			sub: playlistSub(playlist.trackCount),
			cover: playlist.coverUrl,
			tag: providerTag(playlist.provider),
			playlistId: playlist.id,
			provider: playlist.provider,
		}));
}

export function resolveShelfItems(input: {
	playlists: PlaylistSummary[];
	queue: Track[];
	currentTrack: Track | null;
}): ShelfItem[] {
	const playlistItems = mapPlaylistsToShelfItems(input.playlists);
	return playlistItems.length > 0 ? playlistItems : mapQueueToShelfItems(input.queue, input.currentTrack);
}
