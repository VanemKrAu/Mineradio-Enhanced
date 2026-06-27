import { fail } from "../http/envelope";
import type { ApiResponse } from "@mineradio/shared";

export function resolveAudioProxy(url: string): ApiResponse<never> {
  return fail({
    code: "NOT_IMPLEMENTED",
    message: url ? `audio proxy not implemented for ${url}` : "audio proxy not implemented",
    retryable: false,
    action: "provider-pending"
  });
}