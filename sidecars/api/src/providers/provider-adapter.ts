import type {
  Track,
  PlaylistSummary,
  PlaylistDetail,
  LyricPayload,
  ProviderId
} from "@mineradio/shared";

export type ProviderLoginStatus = {
  provider: ProviderId;
  loggedIn: boolean;
  nickname?: string;
  avatarUrl?: string;
  userId?: string;
};

export type SongUrlResult = { url: string; proxied: boolean };

export interface ProviderAdapter {
  readonly id: ProviderId;
  search(query: { keyword: string; limit: number }): Promise<Track[]>;
  songUrl(track: Track): Promise<SongUrlResult>;
  lyric(track: Track): Promise<LyricPayload>;
  playlistList(): Promise<PlaylistSummary[]>;
  playlistDetail(id: string): Promise<PlaylistDetail>;
  loginStatus(): Promise<ProviderLoginStatus>;
  logout(): Promise<void>;
}

export class ProviderNotImplementedError extends Error {
  readonly code: "NOT_IMPLEMENTED" = "NOT_IMPLEMENTED";
  readonly provider: ProviderId;
  readonly retryable: false = false;
  readonly action: string;
  constructor(provider: ProviderId, action: string, message?: string) {
    super(message ?? `provider ${provider} not implemented (action: ${action})`);
    this.name = "ProviderNotImplementedError";
    this.provider = provider;
    this.action = action;
  }
}