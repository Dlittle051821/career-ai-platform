import { AiProviderError, type AiErrorKind } from "../types";

/**
 * Map any SDK/transport error to an AiProviderError WITHOUT copying the
 * provider's message (it can echo request content). Only the HTTP status,
 * the error class name and the provider's machine-readable error `code` /
 * `type` are inspected.
 *
 * OpenAI (official error-code guide, checked 6 Nov 2026): a 429 can mean a
 * transient rate limit OR a billing condition. Billing conditions carry a
 * code such as credit_balance_exhausted, organization_spend_limit_exceeded,
 * project_spend_limit_exceeded or organization_usage_limit_exceeded, and/or
 * the broader type insufficient_quota — "retrying billing, spend, or quota
 * errors won't restore API access", so they map to the non-retryable
 * "billing" kind. A missing model is 404 model_not_found.
 */
const BILLING_CODES = new Set([
  "insufficient_quota",
  "credit_balance_exhausted",
  "organization_spend_limit_exceeded",
  "project_spend_limit_exceeded",
  "organization_usage_limit_exceeded",
  "billing_hard_limit_reached",
  "billing_not_active",
]);

function str(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 && value.length <= 120 ? value : null;
}

export function toProviderError(error: unknown, provider: string): AiProviderError {
  if (error instanceof AiProviderError) return error;
  const e = error as { name?: string; status?: number; code?: unknown; type?: unknown; requestID?: unknown; error?: { code?: unknown; type?: unknown } } | null;
  const name = e?.name ?? "";
  const status = typeof e?.status === "number" ? e.status : null;
  const code = str(e?.code) ?? str(e?.error?.code);
  const type = str(e?.type) ?? str(e?.error?.type);
  const requestId = str(e?.requestID);
  let kind: AiErrorKind = "unknown";
  if (name === "AbortError" || name === "TimeoutError" || /Timeout/i.test(name) || code === "ETIMEDOUT") kind = "timeout";
  else if ((code && BILLING_CODES.has(code)) || (type && BILLING_CODES.has(type))) kind = "billing";
  else if (code === "model_not_found" || (status === 404 && /model/i.test(String(e?.error?.code ?? "")))) kind = "model_unavailable";
  else if (status === 429) kind = "rate_limited";
  else if (status === 401) kind = "auth";
  else if (status === 403) kind = code && /model/i.test(code) ? "model_unavailable" : "auth";
  else if (status === 404) kind = "model_unavailable";
  else if (status === 400 || status === 422) kind = "bad_request";
  else if (status !== null && status >= 500) kind = "unavailable";
  else if (/Connection/i.test(name) || code === "ECONNRESET" || code === "ENOTFOUND" || code === "ECONNREFUSED") kind = "unavailable";
  const detail = [kind, status ? `HTTP ${status}` : null, code && code !== kind ? code : null].filter(Boolean).join(", ");
  return new AiProviderError(kind, `${provider} request failed (${detail}).`, { status, requestId });
}
