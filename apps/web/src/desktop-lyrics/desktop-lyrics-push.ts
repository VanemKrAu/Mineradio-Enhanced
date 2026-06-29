export interface DesktopLyricsPushState {
  lastAt: number;
  lastKey: string;
}

export type DesktopLyricsPushPayload = Record<string, unknown>;

export function createDesktopLyricsPushState(): DesktopLyricsPushState {
  return {
    lastAt: Number.NEGATIVE_INFINITY,
    lastKey: "",
  };
}

export function desktopLyricsPushInterval(frameRate: unknown): number {
  const fps = normalizeDesktopLyricsFrameRate(frameRate);
  if (!fps) return 8;
  return Math.max(8, Math.min(42, 1000 / fps));
}

export function shouldPushDesktopLyricsPayload(
  state: DesktopLyricsPushState,
  payload: DesktopLyricsPushPayload,
  now: number,
  force: boolean,
): boolean {
  const timestamp = Number.isFinite(now) ? now : 0;
  if (
    !force &&
    timestamp - state.lastAt < desktopLyricsPushInterval(payload.frameRate)
  ) {
    return false;
  }
  const key = desktopLyricsPayloadKey(payload);
  if (!force && key === state.lastKey && timestamp - state.lastAt < 900) {
    return false;
  }
  state.lastAt = timestamp;
  state.lastKey = key;
  return true;
}

export function desktopLyricsPayloadKey(
  payload: DesktopLyricsPushPayload,
): string {
  const colors = objectValue(payload.colors);
  const motion = objectValue(payload.motion);
  return [
    payload.enabled,
    payload.text,
    Math.round(numberValue(payload.progress) * 1000),
    Math.round(numberValue(payload.progressSpan) * 100),
    payload.playing,
    payload.size,
    payload.opacity,
    payload.y,
    payload.clickThrough,
    payload.cinema,
    payload.highlightFollow,
    normalizeDesktopLyricsFrameRate(payload.frameRate),
    payload.fontFamily,
    payload.fontWeight,
    payload.letterSpacing,
    payload.lineHeight,
    payload.lyricScale,
    payload.feather,
    payload.beatMapKey,
    colors.primary,
    colors.secondary,
    colors.highlight,
    colors.glow,
    motion.lyricGlow,
    motion.lyricGlowBeat,
    Math.round(numberValue(motion.lyricGlowStrength) * 100),
    Math.round(numberValue(motion.highBloom) * 100),
    Math.round(numberValue(motion.beatGlow) * 100),
    Math.round(numberValue(motion.beatPulse) * 100),
    Math.round(numberValue(motion.bass) * 100),
  ].join("|");
}

function normalizeDesktopLyricsFrameRate(value: unknown): number {
  const fps = Number(value);
  if (!Number.isFinite(fps) || fps <= 0) return 0;
  if (fps <= 26) return 24;
  if (fps <= 45) return 30;
  if (fps <= 90) return 60;
  return 120;
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function numberValue(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}
