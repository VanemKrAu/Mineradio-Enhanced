import { describe, expect, test } from "bun:test";

import {
  evaluateAppDataPolicy,
  extractAppDataPolicy
} from "./check-app-data-policy.mjs";

describe("app data identity policy check", () => {
  test("extracts Tauri identity and path policy text", () => {
    const policy = extractAppDataPolicy({
      tauriConfig: {
        productName: "Mineradio Tauri Rewrite",
        identifier: "com.mineradio.fork.tauri",
        bundle: {
          windows: { nsis: { startMenuFolder: "Mineradio Tauri Rewrite" } }
        },
        plugins: {
          updater: {
            endpoints: ["https://github.com/zzstar101/Mineradio/releases/latest/download/latest.json"]
          }
        }
      },
      pathsRust: "default_app_data_dir_from_base(base).join(\"Mineradio Tauri Rewrite\")"
    });

    expect(policy.productName).toBe("Mineradio Tauri Rewrite");
    expect(policy.identifier).toBe("com.mineradio.fork.tauri");
    expect(policy.pathsRust).toContain("Mineradio Tauri Rewrite");
  });

  test("fails when Tauri runtime can fall back to the old Electron app data identity", () => {
    const result = evaluateAppDataPolicy({
      productName: "Mineradio",
      identifier: "com.mineradio.desktop",
      startMenuFolder: "Mineradio",
      updaterEndpoints: ["https://github.com/XxHuberrr/Mineradio/releases/latest/download/latest.json"],
      pathsRust: ".join(\"Mineradio\").join(\"logs\")"
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("Tauri productName must stay Mineradio Tauri Rewrite");
    expect(result.errors).toContain("Tauri identifier must stay com.mineradio.fork.tauri");
    expect(result.errors).toContain("NSIS startMenuFolder must stay Mineradio Tauri Rewrite");
    expect(result.errors).toContain("updater endpoint must stay on zzstar101/Mineradio");
    expect(result.errors).toContain("Rust app data fallback must use Mineradio Tauri Rewrite");
    expect(result.errors).toContain("Rust app data fallback must not use the legacy bare Mineradio directory");
  });
});
