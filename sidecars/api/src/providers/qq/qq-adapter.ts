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

const ACTION = "license-review";

export const qqAdapter: ProviderAdapter = {
  id: "qq",
  async search(): Promise<Track[]> {
    throw new ProviderNotImplementedError("qq", ACTION);
  },
  async songUrl(): Promise<SongUrlResult> {
    throw new ProviderNotImplementedError("qq", ACTION);
  },
  async lyric(): Promise<LyricPayload> {
    throw new ProviderNotImplementedError("qq", ACTION);
  },
  async playlistList(): Promise<PlaylistSummary[]> {
    throw new ProviderNotImplementedError("qq", ACTION);
  },
  async playlistDetail(): Promise<PlaylistDetail> {
    throw new ProviderNotImplementedError("qq", ACTION);
  },
  async loginStatus(): Promise<ProviderLoginStatus> {
    throw new ProviderNotImplementedError("qq", ACTION);
  },
  async logout(): Promise<void> {
    throw new ProviderNotImplementedError("qq", ACTION);
  }
};