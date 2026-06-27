# Baseline Capture

## Purpose

This document defines the Electron baseline capture required before Tauri rewrite implementation. Tauri visual and behavior parity is judged against these captures.

## Environment

- Repository commit: `ced5ec61ce5241371da36abd82cbebec2868e92c`
- Baseline tag: `electron-baseline-2026-06-27`
- Capture worktree branch: `codex/tauri-migration`
- App line: Electron baseline
- Window sizes:
  - 1280x720
  - 1920x1080
- Display scale: 100% (`AppliedDPI=96`)
- Detected display: 2560x1600
- Audio device: record during manual capture if relevant
- Network state: record during manual capture with provider login state

## Baseline Data

- Test track title: 待确认；当前仅记录搜索 fixture `遇见`
- Test provider: 待确认；搜索 fixture 当前观察到 Netease (`NE`) 结果
- Test track id: 待确认
- Cover source: 待确认
- Lyric source: 待确认
- Visual archive source: `verification\baseline\2026-06-27-ced5ec61\visual-localstorage-snapshot.json`
- Local storage state source: `verification\baseline\2026-06-27-ced5ec61\visual-localstorage-snapshot.json`
- Search fixture: `遇见` / `All`，见 `docs/migration/baseline/TEST_FIXTURES.2026-06-27.md`
- Baseline artifact directory: `verification\baseline\2026-06-27-ced5ec61`

## Required Screenshots

- Home idle, 1280x720
- Home idle, 1920x1080
- Playback console visible
- Playback console hidden
- Visual console open
- Search results with populated list
- Queue panel open
- 3D shelf open
- 3D shelf detail page
- Desktop lyrics on white background
- Desktop lyrics on black background

## Required Recordings

- Startup animation
- Playback console show/hide
- Track play -> pause -> resume -> next
- Lyric sync during playback
- 3D shelf hover -> scroll -> detail -> play
- Desktop lyrics lock -> unlock -> drag

## Storage Rules

- Store large screenshots and recordings outside git unless explicitly curated.
- Suggested ignored local folder: `verification\baseline\2026-06-27-ced5ec61`.
- Suggested external backup folder: `D:\项目\工作区备份\Mineradio-tauri-baseline-20260627`.
- Commit only this document and small metadata JSON.

## P1 Acceptance

Tauri migration work may proceed past P1 when commit, branch, window sizes, display scale, artifact directory, visual archive source, and code-derived animation spec are recorded.

Current status on 2026-06-27: commit, branch, window sizes, display scale, artifact directory, search fixture, visual archive source, and code-derived animation spec are recorded. Fixed playback test track, cover source, and lyric source remain open. Screenshot/recording gaps are moved to pre-public-release manual parity instead of blocking P1.

Code-derived animation spec: `docs/migration/baseline/BASELINE_ANIMATION_SPEC.md`.

## Public Release Parity Acceptance

Before public release, the Tauri line still needs fixed playback test track metadata, cover source, lyric source, and Windows/WebView2 manual parity evidence for startup animation, true playback, 3D shelf flow, desktop lyrics lock/unlock/drag, and other release gates in `docs/migration/CAPABILITY_PARITY_CHECKLIST.md`.
