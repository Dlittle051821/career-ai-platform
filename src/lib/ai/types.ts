/**
 * NW09 — provider-independent AI contract.
 *
 * Every provider (mock, Gemini, OpenAI) implements the same single method:
 * produce ONE JSON object for a structured request. Nothing above this layer
 * (the Career Intelligence pipeline, the Counsellor Studio, the Student
 * Studio) knows or cares which provider produced it — the output is always
 * re-validated against the same versioned Zod schema before it is used.
 *
 * Pure types only: no SDK, no Supabase, no Next.js.
 */

export const AI_PROVIDER_NAMES = ["mock", "gemini", "openai"] as const;
export type AiProviderName = (typeof AI_PROVIDER_NAMES)[number];

/**
 * What kind of data a request carries. Enforced by the data policy
 * (data-policy.ts) BEFORE any provider is called:
 *  - "fictional": synthetic evaluation profiles (src/lib/career-intelligence/
 *    evaluation/) — the only class the Gemini free tier may ever receive.
 *  - "real_student": anything derived from a real student record.
 */
export type AiDataClass = "fictional" | "real_student";

export interface AiStructuredRequest {
  /** Stable task name, e.g. "career_intelligence.v1" — recorded, never sent as instructions. */
  task: string;
  /** System-level instructions (ours, trusted). */
  instructions: string;
  /** The data the model works on, serialised as JSON text (untrusted content is only ever inside this). */
  input: string;
  /** JSON Schema the model's output must follow (derived from the Zod schema). */
  jsonSchema: Record<string, unknown>;
  /** Short identifier for the schema (OpenAI requires a name). */
  schemaName: string;
  /** The structured payload behind `input`, for the deterministic mock provider only. */
  payload: unknown;
  maxOutputTokens: number;
  dataClass: AiDataClass;
}

export interface AiUsage {
  inputTokens: number;
  outputTokens: number;
  /** Of inputTokens, how many were served from the provider's prompt cache (when reported). */
  cachedInputTokens?: number;
  /** Of outputTokens, how many were reasoning tokens (when reported). Billed as output. */
  reasoningTokens?: number;
}

/**
 * Raw, UNVALIDATED provider result. Validation happens one layer up (run.ts).
 * `responseId` is the provider's own identifier for the response (OpenAI
 * "resp_…") — recorded as evidence that a real API response was received.
 */
export type AiRawResult =
  | { status: "ok"; text: string; usage: AiUsage | null; model: string; responseId?: string | null }
  | { status: "refused"; reason: string; usage: AiUsage | null; model: string; responseId?: string | null }
  | { status: "incomplete"; reason: string; usage: AiUsage | null; model: string; responseId?: string | null };

export interface AiProvider {
  readonly name: AiProviderName;
  readonly model: string;
  /** Throws AiProviderError for transport/provider failures. */
  generate(request: AiStructuredRequest, options: { signal: AbortSignal }): Promise<AiRawResult>;
}

/**
 * Provider failure categories (NW09.2). Only `rate_limited` and
 * `unavailable` are retryable: a timeout is NOT retried, because the
 * provider may already have processed (and billed) the request; billing,
 * authentication and model-access errors never succeed on a retry.
 *
 *   billing            no credit / spend limit / quota (HTTP 429 with a billing code)
 *   auth               invalid, revoked or unauthorised API key / project (401, 403)
 *   model_unavailable  the configured model does not exist or the project may not use it (404 model_not_found, 403 on the model)
 *   rate_limited       transient request/token rate limit (429 without a billing code)
 *   unavailable        provider 5xx, overload, or the connection failed before a response
 *   timeout            no response within AI_TIMEOUT_MS
 *   bad_request        the request was rejected as malformed (400/422) — a code defect, never retried
 */
export type AiErrorKind = "timeout" | "rate_limited" | "unavailable" | "auth" | "billing" | "model_unavailable" | "bad_request" | "unknown";

export class AiProviderError extends Error {
  readonly kind: AiErrorKind;
  readonly retryable: boolean;
  /** HTTP status, when the provider returned one (never the provider's message — it can echo request content). */
  readonly status: number | null;
  /** The provider's request id (e.g. OpenAI x-request-id), for support tickets. Not secret. */
  readonly requestId: string | null;
  constructor(kind: AiErrorKind, message: string, meta: { status?: number | null; requestId?: string | null } = {}) {
    super(message);
    this.name = "AiProviderError";
    this.kind = kind;
    this.retryable = kind === "rate_limited" || kind === "unavailable";
    this.status = meta.status ?? null;
    this.requestId = meta.requestId ?? null;
  }
}
