import { ProviderIdSchema, type PlaylistDetail, type ProviderId } from "@mineradio/shared";
import type {
	ShelfContentKind,
	ShelfContentList,
	ShelfContentRow,
	ShelfOpenDetailContentPayload,
} from "@mineradio/visual-engine";

export interface PlaylistDetailClient {
	playlistDetail(provider: ProviderId, id: string): Promise<PlaylistDetail>;
}

export interface ShelfDetailContentListWriter {
	setRowsForToken(token: number, rows: ShelfContentRow[], kind?: ShelfContentKind): void;
	setErrorForToken(token: number, label: string): void;
}

export interface ShelfDetailContentLoaderOptions {
	client: PlaylistDetailClient | null | undefined;
	getContentList: () => ShelfDetailContentListWriter | ShelfContentList | null | undefined;
}

export type ShelfDetailContentLoader = (payload: ShelfOpenDetailContentPayload) => Promise<void>;

export function mapPlaylistDetailToShelfRows(
	detail: PlaylistDetail,
	fallbackProvider: ProviderId,
): ShelfContentRow[] {
	return detail.tracks.map((track) => ({
		id: track.id,
		name: track.title,
		artist: track.artists.length > 0 ? track.artists.join(" / ") : track.album || track.provider || fallbackProvider,
		cover: track.coverUrl,
		provider: track.provider,
		type: track.playableState,
	}));
}

export function createShelfDetailContentLoader(
	options: ShelfDetailContentLoaderOptions,
): ShelfDetailContentLoader {
	return async (payload) => {
		const list = options.getContentList();
		if (!list) return;
		const parsedProvider = ProviderIdSchema.safeParse(payload.provider);
		if (!options.client || !parsedProvider.success || !payload.playlistId) {
			list.setErrorForToken(payload.requestToken, "歌单信息不完整");
			return;
		}

		try {
			const detail = await options.client.playlistDetail(parsedProvider.data, payload.playlistId);
			const rows = mapPlaylistDetailToShelfRows(detail, parsedProvider.data);
			list.setRowsForToken(payload.requestToken, rows, payload.contentKind);
		} catch {
			list.setErrorForToken(payload.requestToken, "歌单加载失败");
		}
	};
}
