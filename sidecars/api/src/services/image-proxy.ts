import { fail, json } from "../http/envelope";

export type ImageProxyRequest = {
  target: string;
  request: Request;
};

export type ImageProxy = (input: ImageProxyRequest) => Promise<Response>;

export type ImageProxyDeps = {
  fetch?: (request: Request) => Promise<Response>;
};

const upstreamResponseHeaders = [
  "content-type",
  "content-length",
  "cache-control",
  "etag",
  "last-modified"
];

const COVER_PROXY_USER_AGENT =
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export function createImageProxy(deps: ImageProxyDeps = {}): ImageProxy {
  const fetcher = deps.fetch ?? fetch;

  return async function proxyImage(input: ImageProxyRequest): Promise<Response> {
    const parsed = parseTargetUrl(input.target);
    if (!parsed.ok) {
      return badRequest(parsed.message);
    }

    let upstream: Response;
    try {
      upstream = await fetcher(new Request(parsed.url, {
        method: "GET",
        headers: coverRequestHeadersFor(parsed.url)
      }));
    } catch {
      return upstreamFailure("upstream image request failed");
    }

    if (!upstream.ok) {
      return upstreamFailure(`upstream image request returned ${upstream.status}`);
    }
    if (!isImageResponse(upstream)) {
      return upstreamFailure("upstream image request returned non-image content");
    }

    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeadersFrom(upstream)
    });
  };
}

export const resolveImageProxy = createImageProxy();

function parseTargetUrl(target: string): { ok: true; url: string } | { ok: false; message: string } {
  if (!target.trim()) {
    return { ok: false, message: "url required" };
  }

  try {
    const url = new URL(target);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return { ok: false, message: "url must use http or https" };
    }
    return { ok: true, url: url.toString() };
  } catch {
    return { ok: false, message: "invalid url" };
  }
}

function isImageResponse(upstream: Response): boolean {
  const contentType = upstream.headers.get("content-type") ?? "";
  return /^image\//i.test(contentType);
}

function responseHeadersFrom(upstream: Response): Headers {
  const headers = new Headers({
    "access-control-allow-origin": "*",
    "cross-origin-resource-policy": "cross-origin"
  });
  for (const header of upstreamResponseHeaders) {
    const value = upstream.headers.get(header);
    if (value !== null) {
      headers.set(header, value);
    }
  }
  return headers;
}

function coverRequestHeadersFor(target: string): Headers {
  const headers = new Headers({
    "user-agent": COVER_PROXY_USER_AGENT,
    "referer": refererForCoverUrl(target)
  });
  return headers;
}

function refererForCoverUrl(target: string): string {
  try {
    const host = new URL(target).hostname.toLowerCase();
    if (host.includes("qq.com") || host.includes("qpic.cn") || host.includes("gtimg.cn")) {
      return "https://y.qq.com/";
    }
  } catch {
  }
  return "https://music.163.com/";
}

function badRequest(message: string): Response {
  return json(
    fail({
      code: "BAD_REQUEST",
      message,
      retryable: false
    }),
    400
  );
}

function upstreamFailure(message: string): Response {
  return json(
    fail({
      code: "UPSTREAM_IMAGE_PROXY",
      message,
      retryable: true
    }),
    502
  );
}
