import { expect, test } from "bun:test";
import {
  createDesktopLyricsPushState,
  desktopLyricsPayloadKey,
  desktopLyricsPushInterval,
  shouldPushDesktopLyricsPayload,
} from "./desktop-lyrics-push";

test("desktopLyricsPushInterval mirrors baseline frame-rate clamp", () => {
  expectClose(desktopLyricsPushInterval(24), 1000 / 24);
  expectClose(desktopLyricsPushInterval(30), 1000 / 30);
  expectClose(desktopLyricsPushInterval(60), 1000 / 60);
  expectClose(desktopLyricsPushInterval(120), 1000 / 120);
  expect(desktopLyricsPushInterval(0)).toBe(8);
  expectClose(desktopLyricsPushInterval(999), 1000 / 120);
});

test("desktopLyricsPayloadKey follows baseline coarse progress and visual knob identity", () => {
  const base = {
    enabled: true,
    text: "line",
    progress: 0.5012,
    size: 1,
    opacity: 0.92,
    y: 0.76,
    clickThrough: true,
    cinema: true,
    highlightFollow: false,
    frameRate: 60,
    colors: {
      primary: "#fff",
      secondary: "#9fe7ff",
      highlight: "#fff",
      glow: "rgba(159,231,255,.7)",
    },
    motion: {
      lyricGlow: true,
      lyricGlowBeat: false,
      lyricGlowStrength: 0.347,
      highBloom: 0,
      beatGlow: 0,
      beatPulse: 0,
      bass: 0,
    },
  };

  expect(desktopLyricsPayloadKey(base)).toContain("line|501|");
  expect(
    desktopLyricsPayloadKey({
      ...base,
      progress: 0.5014,
    }),
  ).toBe(desktopLyricsPayloadKey(base));
  expect(
    desktopLyricsPayloadKey({
      ...base,
      text: "next",
    }),
  ).not.toBe(desktopLyricsPayloadKey(base));
});

test("shouldPushDesktopLyricsPayload throttles by fps and suppresses duplicate keys for 900ms", () => {
  const state = createDesktopLyricsPushState();
  const payload = {
    enabled: true,
    text: "line",
    progress: 0.2,
    frameRate: 60,
  };

  expect(shouldPushDesktopLyricsPayload(state, payload, 1000, false)).toBe(true);
  expect(shouldPushDesktopLyricsPayload(state, payload, 1008, false)).toBe(false);
  expect(shouldPushDesktopLyricsPayload(state, payload, 1040, false)).toBe(false);
  expect(
    shouldPushDesktopLyricsPayload(
      state,
      { ...payload, progress: 0.24 },
      1041,
      false,
    ),
  ).toBe(true);
  expect(shouldPushDesktopLyricsPayload(state, payload, 1100, true)).toBe(true);
});

function expectClose(actual: number, expected: number): void {
  expect(Math.abs(actual - expected)).toBeLessThan(0.00001);
}
