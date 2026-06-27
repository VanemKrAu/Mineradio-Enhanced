import type {
  Track,
  PlaylistSummary,
  PlaylistDetail,
  LyricPayload
} from "@mineradio/shared";
import {
  ProviderNotImplementedError,
  type ProviderAdapter,
  type ProviderLoginStatus,
  type SongUrlResult
} from "../provider-adapter";

const ACTION = "provider-pending";

export const neteaseAdapter: ProviderAdapter = {
  id: "netease",
  async search(): Promise<Track[]> {
    throw new ProviderNotImplementedError("netease", ACTION);
  },
  async songUrl(): Promise<SongUrlResult> {
    throw new ProviderNotImplementedError("netease", ACTION);
  },
  async lyric(): Promise<LyricPayload> {
    throw new ProviderNotImplementedError("netease", ACTION);
  },
  async playlistList(): Promise<PlaylistSummary[]> {
    throw new ProviderNotImplementedError("netease", ACTION);
  },
  async playlistDetail(): Promise<PlaylistDetail> {
    throw new ProviderNotImplementedError("netease", ACTION);
  },
  async loginStatus(): Promise<ProviderLoginStatus> {
    throw new ProviderNotImplementedError("netease", ACTION);
  },
  async logout(): Promise<void> {
    throw new ProviderNotImplementedError("netease", ACTION);
  }
};