import { AiProviderError, type AiErrorKind } from "../types";

/**
 * Map any SDK/transport error to an AiProviderError WITHOUT copying the
 * provider's message (it can echo request content). Only the HTTP status
 * and error class name are inspected.
 */
export function toProviderError(error: unknown, provider: string): AiProviderError {
  if (error instanceof AiProviderError) return error;
  const e = error as { name?: string; status?: number; code?: string } | null;
  const name = e?.name ?? "";
  const status = typeof e?.status === "number" ? e.status : null;
  let kind: AiErrorKind = "unknown";
  if (name === "AbortError" || name === "TimeoutError" || /Timeout/i.test(name) || e?.code === "ETIMEDOUT") kind = "timeout";
  else if (status === 429) kind = "rate_limited";
  else if (status === 401 || status === 403) kind = "auth";
  else if (status === 400 || status === 404 || status === 422) kind = "bad_request";
  else if (status !== null && status >= 500) kind = "unavailable";
  else if (/Connection/i.test(name) || e?.code === "ECONNRESET" || e?.code === "ENOTFOUND") kind = "unavailable";
  return new AiProviderError(kind, `${provider} request failed (${kind}${status ? `, HTTP ${status}` : ""}).`);
}
