import { expect, test } from "bun:test";
import { ok, fail, json } from "./envelope";

test("ok returns success envelope wrapping data", () => {
  expect(ok(42)).toEqual({ ok: true, data: 42 });
});

test("fail returns failure envelope with full error shape", () => {
  const e = fail({
    code: "NOT_IMPLEMENTED",
    message: "x",
    provider: "netease",
    retryable: false,
    action: "provider-pending"
  });
  expect(e.ok).toBe(false);
  if (!e.ok) {
    expect(e.error.code).toBe("NOT_IMPLEMENTED");
    expect(e.error.message).toBe("x");
    expect(e.error.provider).toBe("netease");
    expect(e.error.retryable).toBe(false);
    expect(e.error.action).toBe("provider-pending");
  }
});

test("json returns a Response with the given status and body", async () => {
  const r = json(ok("data"), 201);
  expect(r.status).toBe(201);
  const body = await r.json();
  expect(body).toEqual({ ok: true, data: "data" });
});

test("json defaults to 200 status", () => {
  const r = json(ok(null));
  expect(r.status).toBe(200);
});