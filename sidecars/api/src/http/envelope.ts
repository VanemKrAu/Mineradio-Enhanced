import type { ApiResponse } from "@mineradio/shared";

export type JsonBody = ApiResponse<unknown> | { ok: true };

export function ok<T>(data: T): ApiResponse<T> {
  return { ok: true, data };
}

export function fail(opts: {
  code: string;
  message: string;
  provider?: string;
  retryable: boolean;
  action?: string;
}): ApiResponse<never> {
  return {
    ok: false,
    error: {
      code: opts.code,
      message: opts.message,
      provider: opts.provider,
      retryable: opts.retryable,
      action: opts.action
    }
  };
}

export function json(body: JsonBody, status = 200): Response {
  return Response.json(body, { status });
}