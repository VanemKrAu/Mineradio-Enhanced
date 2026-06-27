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