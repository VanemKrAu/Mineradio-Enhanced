import { expect, test } from "bun:test";
import { routeHandler } from "./server";

async function call(path: string, init?: RequestInit): Promise<Response> {
  const req = new Request(`http://127.0.0.1${path}`, init);
  return routeHandler(req);
}

async function body(r: Response): Promise<any> {
  return await r.json();
}

test("GET /health returns 200 with both providers", async () => {
  const r = await call("/health");
  expect(r.status).toBe(200);
  const b = await body(r);
  expect(b.ok).toBe(true);
  expect(b.providers).toEqual(["netease", "qq"]);
});

test("GET unknown path returns 404 NOT_FOUND envelope", async () => {
  const r = await call("/nope");
  expect(r.status).toBe(404);
  const b = await body(r);
  expect(b.ok).toBe(false);
  expect(b.error.code).toBe("NOT_FOUND");
  expect(b.error.retryable).toBe(false);
});

test("GET /providers/unknown/login-status returns 404 NOT_FOUND for unknown provider", async () => {
  const r = await call("/providers/bad/login-status");
  expect(r.status).toBe(404);
  const b = await body(r);
  expect(b.error.code).toBe("NOT_FOUND");
});

test("GET /providers/netease/search without keyword returns 400 BAD_REQUEST", async () => {
  const r = await call("/providers/netease/search");
  expect(r.status).toBe(400);
  const b = await body(r);
  expect(b.error.code).toBe("BAD_REQUEST");
  expect(b.error.provider).toBe("netease");
});

test("GET /providers/netease/search with blank keyword returns 400", async () => {
  const r = await call("/providers/netease/search?keyword=%20%20");
  expect(r.status).toBe(400);
});

test("GET /providers/netease/login-status returns 501 NOT_IMPLEMENTED action provider-pending", async () => {
  const r = await call("/providers/netease/login-status");
  expect(r.status).toBe(501);
  const b = await body(r);
  expect(b.error.code).toBe("NOT_IMPLEMENTED");
  expect(b.error.provider).toBe("netease");
  expect(b.error.action).toBe("provider-pending");
  expect(b.error.retryable).toBe(false);
});

test("GET /providers/qq/login-status returns 501 NOT_IMPLEMENTED action license-review", async () => {
  const r = await call("/providers/qq/login-status");
  expect(r.status).toBe(501);
  const b = await body(r);
  expect(b.error.code).toBe("NOT_IMPLEMENTED");
  expect(b.error.provider).toBe("qq");
  expect(b.error.action).toBe("license-review");
});

test("POST /providers/netease/song-url without body returns 400 BAD_REQUEST", async () => {
  const r = await call("/providers/netease/song-url", { method: "POST" });
  expect(r.status).toBe(400);
  const b = await body(r);
  expect(b.error.code).toBe("BAD_REQUEST");
});

test("POST /providers/netease/song-url invalid JSON returns 400", async () => {
  const r = await call("/providers/netease/song-url", {
    method: "POST",
    body: "not-json"
  });
  expect(r.status).toBe(400);
});

test("POST /providers/netease/song-url valid body returns 501 NOT_IMPLEMENTED", async () => {
  const r = await call("/providers/netease/song-url", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      provider: "netease",
      id: "1",
      sourceId: "1",
      title: "t",
      artists: []
    })
  });
  expect(r.status).toBe(501);
  const b = await body(r);
  expect(b.error.code).toBe("NOT_IMPLEMENTED");
});

test("POST /providers/netease/lyric valid body returns 501 NOT_IMPLEMENTED", async () => {
  const r = await call("/providers/netease/lyric", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      provider: "netease",
      id: "1",
      sourceId: "1",
      title: "t",
      artists: []
    })
  });
  expect(r.status).toBe(501);
});

test("POST /providers/qq/logout returns 501 license-review", async () => {
  const r = await call("/providers/qq/logout", { method: "POST" });
  expect(r.status).toBe(501);
  const b = await body(r);
  expect(b.error.action).toBe("license-review");
});

test("GET /providers/netease/playlists returns 501 NOT_IMPLEMENTED", async () => {
  const r = await call("/providers/netease/playlists");
  expect(r.status).toBe(501);
});

test("GET /providers/netease/playlists/123 returns 501 NOT_IMPLEMENTED", async () => {
  const r = await call("/providers/netease/playlists/123");
  expect(r.status).toBe(501);
});

test("POST /providers/netease/login-status (method mismatch) returns 404", async () => {
  const r = await call("/providers/netease/login-status", { method: "POST" });
  expect(r.status).toBe(404);
});

test("GET /providers/capabilities returns 200 matrix with both providers unavailable", async () => {
  const r = await call("/providers/capabilities");
  expect(r.status).toBe(200);
  const b = await body(r);
  expect(b.ok).toBe(true);
  expect(b.data.providers.length).toBe(2);
  for (const e of b.data.providers) {
    expect(e.available).toBe(false);
  }
});

test("GET /diagnostics returns 200 and contains none of the forbidden cookie/auth keys", async () => {
  const r = await call("/diagnostics");
  expect(r.status).toBe(200);
  const b = await body(r);
  expect(b.ok).toBe(true);
  expect(Array.isArray(b.recentErrors)).toBe(true);
  const serialized = JSON.stringify(b);
  for (const key of ["cookie", "MUSIC_U", "qm_keyst", "qqmusic_key", "wxskey"]) {
    expect(serialized).not.toContain(key);
  }
});

test("GET /audio-proxy returns 501 NOT_IMPLEMENTED", async () => {
  const r = await call("/audio-proxy?url=https://example.com/x.mp3");
  expect(r.status).toBe(501);
  const b = await body(r);
  expect(b.error.code).toBe("NOT_IMPLEMENTED");
});