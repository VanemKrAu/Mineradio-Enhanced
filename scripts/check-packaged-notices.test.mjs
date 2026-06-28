import { describe, expect, test } from "bun:test";

import {
  evaluatePackagedNoticesPolicy,
  extractPackagedNoticesPolicy
} from "./check-packaged-notices.mjs";

describe("packaged notices policy check", () => {
  test("extracts Tauri bundle resources that carry release notices", () => {
    const policy = extractPackagedNoticesPolicy({
      bundle: {
        resources: [
          "../../../LICENSE",
          "../../../NOTICE.md",
          "../../../THIRD_PARTY_NOTICES.md",
          "../../../PRIVACY.md",
          "../../../SECURITY.md"
        ]
      }
    });

    expect(policy.resources).toEqual([
      "../../../LICENSE",
      "../../../NOTICE.md",
      "../../../THIRD_PARTY_NOTICES.md",
      "../../../PRIVACY.md",
      "../../../SECURITY.md"
    ]);
  });

  test("fails when required GPL and notice files are not bundled", () => {
    const result = evaluatePackagedNoticesPolicy({ resources: [] });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("bundle.resources must include ../../../LICENSE");
    expect(result.errors).toContain("bundle.resources must include ../../../NOTICE.md");
    expect(result.errors).toContain("bundle.resources must include ../../../THIRD_PARTY_NOTICES.md");
    expect(result.errors).toContain("bundle.resources must include ../../../PRIVACY.md");
    expect(result.errors).toContain("bundle.resources must include ../../../SECURITY.md");
  });
});
