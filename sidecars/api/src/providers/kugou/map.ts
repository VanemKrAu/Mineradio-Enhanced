//! Map Kugou API response shapes to @mineradio/shared types.

import type {
  Track, PlaylistSummary, LyricPayload, SongUrlResult,
} from "@mineradio/shared";
import type { KugouSearchResult, KugouPlaylistSummary, KugouPlaylistTrack } from "./kugou-client";

const PROVIDER = "kugou" as const;

export function mapKugouSearchToTrack(src: KugouSearchResult): Track {
  return {
    provider: PROVIDER,
    id: src.hash,
    sourceId: src.hash,
    hash: src.hash,
    title: src.name,
    artists: src.artists.length > 0 ? src.artists : src.artist ? [src.artist] : [],
    album: src.album,
    coverUrl: src.cover,
    duration: src.duration,
    albumAudioId: src.albumAudioId,
    albumId: src.albumId,
  };
}

export function mapKugouPlaylistToSummary(src: KugouPlaylistSummary): PlaylistSummary {
  return {
    provider: PROVIDER,
    id: src.id,
    name: src.name,
    cover: src.cover,
    trackCount: src.trackCount,
    creator: src.creator,
  };
}

export function mapKugouPlaylistTrackToTrack(src: KugouPlaylistTrack): Track {
  return {
    provider: PROVIDER,
    id: src.hash,
    sourceId: src.hash,
    hash: src.hash,
    title: src.name,
    artists: src.artist ? [src.artist] : [],
    album: src.album,
    coverUrl: src.cover,
    duration: src.duration,
    albumAudioId: src.albumAudioId,
    albumId: src.albumId,
    qualityHashes: src.qualityHashes,
    fileid: src.fileid,
  };
}

export function mapKugouSongUrl(
  urlResult: { url: string; playable: boolean; level: string; quality: string; br: number },
  requestedQuality?: string
): SongUrlResult {
  return {
    url: urlResult.url,
    playable: urlResult.playable,
    level: urlResult.level,
    quality: urlResult.quality || requestedQuality || "standard",
    br: urlResult.br,
    trial: false,
  };
}

export function mapKugouLyric(
  lyricResult: { lyric: string; tlyric?: string }
): LyricPayload {
  return {
    provider: PROVIDER,
    trackId: "",
    lines: [],
    hasTranslation: !!lyricResult.tlyric,
    isWordByWord: false,
    rawLrc: lyricResult.lyric,
    rawTLrc: lyricResult.tlyric || "",
  };
}

export function mapKugouQualityPreference(
  rawQuality?: string
): string | undefined {
  if (!rawQuality) return undefined;
  switch (rawQuality) {
    case "jymaster": return "masterhash";
    case "hires": return "hrhash";
    case "lossless": return "sqhash";
    case "exhigh": return "320hash";
    case "standard": return "128hash";
    default: return "320hash";
  }
}
