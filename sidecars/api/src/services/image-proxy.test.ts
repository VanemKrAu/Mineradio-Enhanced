import { expect, test } from "bun:test";
import { createImageProxy, resolveImageProxy } from "./image-proxy";

async function jsonBody(response: Response): Promise<any> {
  return await response.json();
}

test("image proxy returns BAD_REQUEST envelope when url is missing or invalid", async () => {
  for (const target of ["", "   ", "not-a-url", "file:///C:/cover.jpg", "ftp://example.test/a.jpg"]) {
    const response = await resolveImageProxy({
      target,
      request: new Request("http://127.0.0.1/image-proxy")
    });

    expect(response.status).toBe(400);
    const body = await jsonBody(response);
    expect(body.error.code).toBe("BAD_REQUEST");
    expect(body.error.retryable).toBe(false);
  }
});

test("image proxy streams upstream image and forwards no cookie or auth request headers", async () => {
  let upstreamRequest: Request | undefined;
  const service = createImageProxy({
    fetch: async (request) => {
      upstreamRequest = request;
      return new Response("image-bytes", {
        status: 200,
        headers: {
          "content-type": "image/jpeg",
          "content-length": "11",
          "cache-control": "public, max-age=60",
          etag: '"cover"',
          "last-modified": "Sat, 27 Jun 2026 00:00:00 GMT",
          "set-cookie": "secret=1",
          "x-private": "hidden"
        }
      });
    }
  });

  const response = await service({
    target: "https://img.example.test/cover.jpg",
    request: new Request("http://127.0.0.1/image-proxy", {
      headers: {
        cookie: "session=secret",
        authorization: "Bearer secret",
        "user-agent": "unit-test"
      }
    })
  });

  expect(response.status).toBe(200);
  expect(await response.text()).toBe("image-bytes");
  expect(upstreamRequest?.url).toBe("https://img.example.test/cover.jpg");
  expect(upstreamRequest?.headers.get("cookie")).toBe(null);
  expect(upstreamRequest?.headers.get("authorization")).toBe(null);
  expect(upstreamRequest?.headers.get("user-agent")).toBe("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
  expect(upstreamRequest?.headers.get("referer")).toBe("https://music.163.com/");
  expect(response.headers.get("content-type")).toBe("image/jpeg");
  expect(response.headers.get("content-length")).toBe("11");
  expect(response.headers.get("cache-control")).toBe("public, max-age=60");
  expect(response.headers.get("etag")).toBe('"cover"');
  expect(response.headers.get("last-modified")).toBe("Sat, 27 Jun 2026 00:00:00 GMT");
  expect(response.headers.get("access-control-allow-origin")).toBe("*");
  expect(response.headers.get("cross-origin-resource-policy")).toBe("cross-origin");
  expect(response.headers.get("set-cookie")).toBe(null);
  expect(response.headers.get("x-private")).toBe(null);
});

test("image proxy uses the baseline QQ referer for gtimg and qpic cover hosts", async () => {
  const referers: string[] = [];
  const service = createImageProxy({
    fetch: async (request) => {
      referers.push(request.headers.get("referer") ?? "");
      return new Response("image-bytes", {
        status: 200,
        headers: { "content-type": "image/jpeg" }
      });
    }
  });

  await service({
    target: "https://y.gtimg.cn/music/photo_new/T002.jpg",
    request: new Request("http://127.0.0.1/image-proxy")
  });
  await service({
    target: "https://qpic.cn/cover.jpg",
    request: new Request("http://127.0.0.1/image-proxy")
  });

  expect(referers).toEqual(["https://y.qq.com/", "https://y.qq.com/"]);
});

test("image proxy rejects non-image upstream content", async () => {
  const service = createImageProxy({
    fetch: async () => new Response("html", {
      status: 200,
      headers: { "content-type": "text/html" }
    })
  });

  const response = await service({
    target: "https://img.example.test/cover",
    request: new Request("http://127.0.0.1/image-proxy")
  });

  expect(response.status).toBe(502);
  const body = await jsonBody(response);
  expect(body.error.code).toBe("UPSTREAM_IMAGE_PROXY");
  expect(body.error.retryable).toBe(true);
});
