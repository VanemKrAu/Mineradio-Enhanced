import { expect, test } from "bun:test";
import { ProviderNotImplementedError } from "../provider-adapter";
import { qqAdapter } from "./qq-adapter";
import type { Track } from "@mineradio/shared";

const fixture: Track = {
  provider: "qq",
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
  { name: "search", call: () => qqAdapter.search({ keyword: "k", limit: 10 }) },
  { name: "songUrl", call: () => qqAdapter.songUrl(fixture) },
  { name: "lyric", call: () => qqAdapter.lyric(fixture) },
  { name: "playlistList", call: () => qqAdapter.playlistList() },
  { name: "playlistDetail", call: () => qqAdapter.playlistDetail("1") },
  { name: "loginStatus", call: () => qqAdapter.loginStatus() },
  { name: "logout", call: () => qqAdapter.logout() }
];

for (const m of calls) {
  test(`qq ${m.name} throws NOT_IMPLEMENTED with action license-review`, async () => {
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
    expect(e.provider).toBe("qq");
    expect(e.retryable).toBe(false);
    expect(e.action).toBe("license-review");
  });
}