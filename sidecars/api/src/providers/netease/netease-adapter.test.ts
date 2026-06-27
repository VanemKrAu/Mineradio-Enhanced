import { expect, test } from "bun:test";
import { ProviderNotImplementedError } from "../provider-adapter";
import { neteaseAdapter } from "./netease-adapter";
import type { Track } from "@mineradio/shared";

const fixture: Track = {
  provider: "netease",
  id: "1",
  sourceId: "1",
  title: "t",
  artists: [],
  album: "",
  coverUrl: "",
  qualityHints: [],
  playableState: "unknown"
};

const calls: Array<{ name: string; call: () => Promise<unknown> }> = [
  { name: "search", call: () => neteaseAdapter.search({ keyword: "k", limit: 10 }) },
  { name: "songUrl", call: () => neteaseAdapter.songUrl(fixture) },
  { name: "lyric", call: () => neteaseAdapter.lyric(fixture) },
  { name: "playlistList", call: () => neteaseAdapter.playlistList() },
  { name: "playlistDetail", call: () => neteaseAdapter.playlistDetail("1") },
  { name: "loginStatus", call: () => neteaseAdapter.loginStatus() },
  { name: "logout", call: () => neteaseAdapter.logout() }
];

for (const m of calls) {
  test(`netease ${m.name} throws NOT_IMPLEMENTED with action provider-pending`, async () => {
    let caught: unknown;
    try {
      await m.call();
      caught = null;
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ProviderNotImplementedError);
    const e = caught as ProviderNotImplementedError;
    expect(e.code).toBe("NOT_IMPLEMENTED");
    expect(e.provider).toBe("netease");
    expect(e.retryable).toBe(false);
    expect(e.action).toBe("provider-pending");
  });
}