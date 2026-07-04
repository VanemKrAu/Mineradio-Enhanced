//! Kugou ProviderAdapter — implements ProviderAdapter interface for Kugou music.

import type {
  ProviderAdapter, ProviderLoginStatus, SongUrlResult,
  PlaybackQuality, PlaylistSummary, PlaylistDetail, LyricPayload, Track,
  SongUrlOptions,
} from "../provider-adapter";
import { ProviderError, ProviderNotImplementedError } from "../provider-adapter";
import * as client from "./kugou-client";
import {
  mapKugouSearchToTrack, mapKugouPlaylistToSummary,
  mapKugouPlaylistTrackToTrack, mapKugouSongUrl, mapKugouLyric,
} from "./map";
import { getProviderCookie } from "../../services/auth-session";

const PROVIDER = "kugou" as const;

function loadCookie(): client.KugouCookie {
  const raw = getProviderCookie(PROVIDER) || "";
  return client.parseKugouCookie(raw);
}

// ── Adapter implementation ────────────────────────────────────────────────

export function createKugouAdapter(): ProviderAdapter {
  return {
    id: PROVIDER,

    async search(query: { keyword: string; limit: number }): Promise<Track[]> {
      const results = await client.kugouSearch(query.keyword, query.limit, loadCookie());
      return results.map(mapKugouSearchToTrack);
    },

    async songUrl(track: Track, opts?: SongUrlOptions): Promise<SongUrlResult> {
      const hash = track.hash || track.id;
      if (!hash) throw new ProviderError(PROVIDER, "MISSING_HASH", "No hash for Kugou track");

      const cookie = loadCookie();
      const quality = opts?.quality;

      try {
        const result = await client.kugouTrackercdnUrl(hash, cookie, quality);
        if (result.playable) return mapKugouSongUrl(result, quality);
      } catch {
        // fallback to gateway v5/url
      }

      // Fallback: try gateway v5/url
      try {
        const data = await client.kugouApiRequest<{
          data?: { url?: string }; error?: { msg?: string }
        }>(
          "/v5/url",
          { hash, appid: 3116 },
          cookie,
          { encryptKey: true }
        );
        if (data?.data?.url) {
          return {
            url: data.data.url,
            playable: true,
            level: quality || "hires",
            quality: quality || "hires",
            br: 999000,
            trial: false,
          };
        }
      } catch {
        // silent
      }

      return { url: "", playable: false, trial: true, level: "", quality: "", br: 0, restriction: { category: "geoblocked", message: "No playable URL", action: "none" } };
    },

    async lyric(track: Track): Promise<LyricPayload> {
      const hash = track.hash || track.id;
      if (!hash) return mapKugouLyric({ lyric: "" });

      try {
        const result = await client.kugouLyric(hash, track.duration || 0);
        return mapKugouLyric(result);
      } catch {
        return mapKugouLyric({ lyric: "" });
      }
    },

    async playlistList(): Promise<PlaylistSummary[]> {
      const cookie = loadCookie();
      if (!cookie.userid) return [];
      const results = await client.kugouUserPlaylists(cookie);
      return results.map(mapKugouPlaylistToSummary);
    },

    async playlistDetail(id: string): Promise<PlaylistDetail> {
      const cookie = loadCookie();
      const tracks = await client.kugouPlaylistTracks(id, cookie);
      return {
        id,
        name: "",
        cover: "",
        trackCount: tracks.length,
        tracks: tracks.map(mapKugouPlaylistTrackToTrack),
      };
    },

    async loginStatus(): Promise<ProviderLoginStatus> {
      const cookie = loadCookie();
      const status = client.kugouLoginStatus(cookie);
      return {
        provider: PROVIDER,
        loggedIn: status.loggedIn,
        nickname: status.nickname,
        avatarUrl: status.avatarUrl,
        userId: status.userId,
        vipType: status.vipType,
        vipLevel: status.vipType > 0 ? "vip" : "none",
      };
    },

    async logout(): Promise<void> {
      // Cookie is cleared by server.ts route handler
    },
  };
}

/** Singleton adapter instance. */
export const kugouAdapter: ProviderAdapter = createKugouAdapter();
