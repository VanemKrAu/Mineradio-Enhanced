# Updater Release License Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Configure Tauri updater, Windows packaging, release identity, GPL-3.0 notices, dependency license audit, and final release gates.

**Architecture:** Tauri updater replaces Electron patch JSON. Release artifacts use new fork identity, new app id, new repository/channel, and package notices. License gate blocks public release until complete.

**Tech Stack:** Tauri updater, Rust/Tauri bundle, Bun/npm dependency audit, cargo license audit, Markdown notices.

---

## Current Status And Execution Note

This plan is now a subsystem reference, not the current implementation entry point. The latest audit is tracked in `docs/migration/plans/11-final-baseline-parity.md`; new updater, release, installer, and license work must enter through Phase 5 of that plan, or through a smaller child plan derived from it.

Current review findings that must not be treated as complete:

- Updater is detection-only: code-side detection/status plumbing exists, but download/install/restart is still blocked until the updater signature/public-key path is resolved.
- Pubkey/signature gate remains open: `pubkey` is not a completed release signing policy, and signed release assets or an approved manual-update decision are still required.
- NSIS installer policy and manual evidence remain open: install, launch, update path, uninstall, shortcuts, per-user behavior, app id/product name/icon, packaged notices, and new app-data directory behavior need Windows proof.
- License audit is unresolved: required dependency/license rows, QQ reference decisions, GSAP plugin status, transitive notices, and packaged notice inclusion must be closed before public release.

Do not check any capability, release, or license gate from this plan alone. Updater/release/license closure belongs to `11-final-baseline-parity.md` Phase 5 and final sign-off belongs to Phase 6.

## Required Reading

- `docs/migration/EXECUTION_PROTOCOL.md`
- `docs/migration/plans/11-final-baseline-parity.md`
- `docs/migration/LICENSE_GATE.md`
- `docs/migration/CAPABILITY_PARITY_CHECKLIST.md`
- `docs/migration/DEFERRED_CAPABILITIES.md`
- `docs/migration/PRD_TAURI_REWRITE.md`

## Preconditions

- Tauri app builds.
- Capability parity gates are complete or explicitly marked.
- Deferred capabilities have final release decisions.
- `docs/migration/plans/11-final-baseline-parity.md` Phase 5 is being used as the active execution plan.

## Files

- Modify: `apps/desktop/src-tauri/tauri.conf.json`
- Modify: `apps/desktop/src-tauri/src/updater.rs`
- Modify: `apps/web/src/update/`
- Create/modify: `THIRD_PARTY_NOTICES.md`
- Modify: `README.md`
- Modify: `NOTICE.md`
- Modify: `docs/migration/LICENSE_GATE.md`
- Modify: `docs/migration/CAPABILITY_PARITY_CHECKLIST.md`

## Do Not

- Do not use old Electron `latest.yml`.
- Do not migrate old patch JSON.
- Do not release under original Mineradio identity without fork clarity.
- Do not include unreviewed QQ project code.
- Do not publish while `LICENSE_GATE.md` contains unresolved required audit rows.

## Task 1: Tauri Updater

P10.a code-side status: updater detection wiring is complete, but install/download is still blocked by the signature/public-key gate. No Windows install/update/uninstall gate is closed.

Current status remains detection-only. Do not present the updater as release-complete until either signed Tauri updater download/install is proven or an approved manual-update release decision is recorded in Phase 5 of `11-final-baseline-parity.md`.

2026-06-29 release CSP code-side status: `apps/desktop/src-tauri/tauri.conf.json` now uses a release `csp` that permits only self plus `http://127.0.0.1:*` sidecar proxy for network/media/image loading, with `data:`/`blob:` retained only where the migrated visual/image paths require them. `devCsp` separately allows the Vite dev server/HMR path. `npm run release-csp:check` prevents returning release `csp` to `null`, unsafe sources, wildcard sources, or direct external origins. Windows/WebView2 runtime verification remains pending.

- [x] **Step 1: Choose manifest mode**

Use static JSON first for local testing unless a dynamic server is already available.

- [ ] **Step 2: Configure updater**

Configure Tauri updater endpoint, public key/signing as required by selected updater mode.

Code-side endpoint is configured in `apps/desktop/src-tauri/tauri.conf.json` as `https://github.com/zzstar101/Mineradio/releases/latest/download/latest.json`; `pubkey` remains empty, so signed download/install is not complete.

- [ ] **Step 3: React update UI**

React shows:

- checking.
- update available.
- download/install.
- error.
- restart required.

P10.a only added typed updater helpers and a Zustand status reducer. The full user-facing update UI and download/install/restart flow remain pending.

- [ ] **Step 4: Verify local update**

Build lower version and higher version, point manifest to higher version, test detection and update path.

## Task 2: Release Identity

Release identity is not closed by static config alone. Phase 5 must collect Windows installer/manual evidence for app id, product name, shortcuts, per-user install behavior, icon, uninstall behavior, packaged notices, and the new app data directory policy.

- [x] **Step 1: New app id**

Confirm app id does not reuse `com.mineradio.desktop`.

P10.b static evidence: Tauri identifier is `com.mineradio.fork.tauri`; old Electron `package.json` still has `com.mineradio.desktop` only for the retained Electron baseline.

- [ ] **Step 2: New app name**

If public distribution is planned, README and release notes must identify the project as a fork.

P10.b code-side docs: README and NOTICE identify the Tauri mainline as a GPL-3.0 fork/rewrite and state that public release is not complete. This step remains open until real GitHub release notes identify the project as a fork.

- [ ] **Step 3: Data directory**

Confirm Tauri app data directory does not read old Mineradio user directory by default.

P10.b static docs note the new data-directory policy and no old-user-data migration promise. Manual Windows app-data verification remains pending.

## Task 3: License Audit

Current license audit status is unresolved. Do not publish, package for public release, or close `LICENSE_GATE.md` while required audit rows remain `待审核`, unknown, or dependent on unreviewed QQ reference code.

- [ ] **Step 1: Audit npm/Bun dependencies**

Fill dependency license table.

- [ ] **Step 2: Audit Rust crates**

Fill Rust crate license table or generated notice.

- [ ] **Step 3: Audit QQ projects**

For every QQ reference project, fill:

```text
Project, URL, License, Active, Usage, Copy Code?, Risk, Decision
```

- [ ] **Step 4: GSAP check**

Confirm no member-only or closed plugin is bundled.

## Task 4: Notices

- [x] **Step 1: Create `THIRD_PARTY_NOTICES.md`**

List:

- original project and GPL-3.0.
- Tauri.
- Bun.
- React.
- Vite.
- Zustand.
- zod.
- NeteaseCloudMusicApi.
- Three.js.
- GSAP.
- QQ reference projects if used.

- [x] **Step 2: Update README and NOTICE**

State fork status and license.

P10.b code-side done: README, NOTICE, and `THIRD_PARTY_NOTICES.md` updated. Manual gate remains: package artifacts must include notices, release notes must be written, and unresolved license rows must be closed before public release.

## Task 5: Final Gates

Final gate closure belongs to `11-final-baseline-parity.md` Phase 5 and Phase 6. This plan can describe the required gates, but it must not be used to mark them complete without the evidence requested there.

- [ ] **Step 1: Capability parity**

Every item in `CAPABILITY_PARITY_CHECKLIST.md` must be complete or explicitly blocked before public release.

- [ ] **Step 2: Deferred capabilities**

No `deferred` item can remain undecided before public release.

- [ ] **Step 3: License gate**

No required `待审核` or unknown license remains before public release.

## Verification

Run:

```powershell
cargo test
bun test
bun run --filter ./apps/web build
bun run --filter ./apps/desktop tauri build
git diff --check
```

Then manually verify:

```text
install -> launch -> update check -> update install/restart -> uninstall
```

Expected: all checks pass, updater works, notices are complete, no unresolved release gate remains.

## Subagent Prompt Summary

Implement updater/release/license only after the app is otherwise functional. Do not use old Electron patch JSON. Do not publish with unresolved license entries. Verify installer and updater on Windows.
