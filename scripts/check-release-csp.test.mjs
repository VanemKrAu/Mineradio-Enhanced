import { describe, expect, test } from "bun:test";

import {
  evaluateReleaseCspPolicy,
  extractReleaseCspPolicy,
  parseCspDirectives
} from "./check-release-csp.mjs";

describe("release CSP policy check", () => {
  test("parses CSP directives into source lists", () => {
    const directives = parseCspDirectives("default-src 'self'; connect-src 'self' http://127.0.0.1:*; img-src 'self' data: blob:");

    expect(directives.get("default-src")).toEqual(["'self'"]);
    expect(directives.get("connect-src")).toEqual(["'self'", "http://127.0.0.1:*"]);
    expect(directives.get("img-src")).toEqual(["'self'", "data:", "blob:"]);
  });

  test("extracts the configured Tauri app CSP", () => {
    const policy = extractReleaseCspPolicy({
      app: {
        security: {
          csp: "default-src 'self'; object-src 'none';",
          devCsp: "default-src 'self' http://127.0.0.1:5173"
        }
      }
    });

    expect(policy.csp).toBe("default-src 'self'; object-src 'none';");
    expect(policy.devCsp).toBe("default-src 'self' http://127.0.0.1:5173");
  });

  test("fails when release CSP remains unset or too loose", () => {
    const result = evaluateReleaseCspPolicy({ csp: null });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("app.security.csp must be a non-empty release CSP string");
  });

  test("requires sidecar-only network/media/image allowances and blocks unsafe sources", () => {
    const result = evaluateReleaseCspPolicy({
      csp: [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self'",
        "img-src 'self' data: blob: http://127.0.0.1:*",
        "media-src 'self' http://127.0.0.1:* blob:",
        "connect-src 'self' http://127.0.0.1:*",
        "object-src 'none'",
        "base-uri 'none'",
        "frame-ancestors 'none'"
      ].join("; ")
    });

    expect(result).toEqual({ ok: true, errors: [] });
  });
});
