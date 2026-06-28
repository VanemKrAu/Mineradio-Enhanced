import { expect, test } from "bun:test";
import { buildDiagnostics, pushRecentError } from "./diagnostics";

test("diagnostics payload has version fields, empty recent errors, and no cookie/auth keys", () => {
  const d = buildDiagnostics();
  expect(d.ok).toBe(true);
  expect(typeof d.appVersion).toBe("string");
  expect(typeof d.apiVersion).toBe("string");
  expect(typeof d.schemaVersion).toBe("string");
  expect(Array.isArray(d.recentErrors)).toBe(true);
  const serialized = JSON.stringify(d);
  for (const key of ["cookie", "MUSIC_U", "qm_keyst", "qqmusic_key", "wxskey"]) {
    expect(serialized).not.toContain(key);
  }
});

test("pushRecentError keeps the ring bounded at 20", () => {
  for (let i = 0; i < 30; i++) {
    pushRecentError({ code: "X", index: i });
  }
  const d = buildDiagnostics();
  expect(d.recentErrors.length).toBeLessThanOrEqual(20);
  const serialized = JSON.stringify(d);
  for (const key of ["cookie", "MUSIC_U", "qm_keyst", "qqmusic_key", "wxskey"]) {
    expect(serialized).not.toContain(key);
  }
});

test("diagnostics redacts sensitive recent error fields recursively", () => {
  pushRecentError({
    code: "PROVIDER_LOGIN",
    cookie: "MUSIC_U=netease-secret; __csrf=csrf-secret",
    headers: {
      authorization: "Bearer auth-secret",
      "x-safe": "kept"
    },
    nested: {
      qm_keyst: "qq-secret",
      list: [{ qqmusic_key: "qq-music-secret" }, "safe item"],
      message: "provider failed with wxskey=wechat-secret"
    }
  });

  const serialized = JSON.stringify(buildDiagnostics());
  for (const leaked of [
    "MUSIC_U",
    "netease-secret",
    "__csrf",
    "csrf-secret",
    "authorization",
    "Bearer auth-secret",
    "qm_keyst",
    "qq-secret",
    "qqmusic_key",
    "qq-music-secret",
    "wxskey",
    "wechat-secret"
  ]) {
    expect(serialized).not.toContain(leaked);
  }
  expect(serialized).toContain("x-safe");
  expect(serialized).toContain("kept");
});
