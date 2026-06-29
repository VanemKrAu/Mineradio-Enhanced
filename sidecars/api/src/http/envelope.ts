import type { ApiError, ApiResponse } from "@mineradio/shared";

export type JsonBody = ApiResponse<unknown> | { ok: true };

const SIDECAR_CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,DELETE,OPTIONS",
  "access-control-allow-headers": "content-type,authorization,range",
  "access-control-expose-headers": "content-length,content-range,accept-ranges,content-type",
  "access-control-max-age": "86400"
} satisfies HeadersInit;

export function ok<T>(data: T): ApiResponse<T> {
  return { ok: true, data };
}

export function fail(opts: ApiError): ApiResponse<never> {
  return {
    ok: false,
    error: opts
  };
}

export function json(body: JsonBody, status = 200): Response {
  return Response.json(body, {
    status,
    headers: SIDECAR_CORS_HEADERS
  });
}

export function corsPreflight(): Response {
  return new Response(null, {
    status: 204,
    headers: SIDECAR_CORS_HEADERS
  });
}
