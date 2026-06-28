import { describe, expect, test } from "bun:test";

import {
  evaluateReleaseIdentity,
  parseCargoPackageFields,
  parseDeferredCapabilityRows
} from "./check-release-identity.mjs";

describe("release identity check", () => {
  test("parses Cargo package fields used by Tauri runtime config", () => {
    expect(parseCargoPackageFields(`
[package]
name = "mineradio-tauri"
version = "0.1.0"
description = "Mineradio Tauri rewrite shell"
license = "GPL-3.0"
`)).toEqual({
      name: "mineradio-tauri",
      version: "0.1.0",
      description: "Mineradio Tauri rewrite shell",
      license: "GPL-3.0"
    });
  });

  test("parses deferred capability rows by capability name and status", () => {
    const rows = parseDeferredCapabilityRows(`
| Capability | Status | 延期原因 | 补齐条件 | 发布前决策 |
| --- | --- | --- | --- | --- |
| Tauri 发布 logo / 最终品牌名 | done | locked | 无 | 见 DECISIONS.md A1/A2 |
`);

    expect(rows.get("Tauri 发布 logo / 最终品牌名")?.status).toBe("done");
  });

  test("fails when release identity drifts from locked migration decisions", () => {
    const result = evaluateReleaseIdentity({
      tauriConfig: {
        productName: "Mineradio",
        version: "0.1.0",
        identifier: "com.mineradio.desktop",
        app: { windows: [{ label: "main", title: "Mineradio" }] },
        bundle: { icon: ["icons/icon.ico"], shortDescription: "x", longDescription: "x" },
        plugins: { updater: { endpoints: ["https://github.com/XxHuberrr/Mineradio/releases/latest/download/latest.json"] } }
      },
      cargoPackage: {
        name: "mineradio-tauri",
        version: "0.1.0",
        description: "Mineradio Tauri rewrite shell",
        license: "GPL-3.0"
      },
      desktopPackage: { name: "@mineradio/desktop", version: "0.1.0" },
      readme: "Mineradio",
      notice: "Mineradio",
      thirdPartyNotices: "Mineradio",
      deferredCapabilities: "| Capability | Status | 延期原因 | 补齐条件 | 发布前决策 |\n| --- | --- | --- | --- | --- |\n| Tauri 发布 logo / 最终品牌名 | deferred | pending | pending | pending |"
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("tauri.conf.json identifier must stay com.mineradio.fork.tauri");
    expect(result.errors).toContain("tauri.conf.json productName must stay Mineradio Tauri Rewrite");
    expect(result.errors).toContain("updater endpoint must point at zzstar101/Mineradio");
    expect(result.errors).toContain("DEFERRED_CAPABILITIES.md must mark Tauri 发布 logo / 最终品牌名 as done");
  });
});
