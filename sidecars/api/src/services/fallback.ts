import { fail } from "../http/envelope";
import type { ApiResponse, ProviderId } from "@mineradio/shared";
import { ProviderNotImplementedError } from "../providers/provider-adapter";

export function normalizeError(provider: ProviderId, err: unknown): ApiResponse<never> {
  if (err instanceof ProviderNotImplementedError) {
    return fail({
      code: err.code,
      message: err.message,
      provider: err.provider,
      retryable: err.retryable,
      action: err.action
    });
  }
  const message = err instanceof Error ? err.message : String(err);
  return fail({
    code: "INTERNAL",
    message,
    provider,
    retryable: true
  });
}