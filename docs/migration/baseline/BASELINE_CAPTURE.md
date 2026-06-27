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

- Test track title:
- Test provider:
- Test track id:
- Cover source:
- Lyric source:
- Visual archive source:
- Local storage state source:

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

## Acceptance

Tauri visual parity work cannot begin until this capture protocol is filled with commit, branch, test track, visual archive, and storage location.
