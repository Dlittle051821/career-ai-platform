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
}

/** Raw, UNVALIDATED provider result. Validation happens one layer up (run.ts). */
export type AiRawResult =
  | { status: "ok"; text: string; usage: AiUsage | null; model: string }
  | { status: "refused"; reason: string; usage: AiUsage | null; model: string }
  | { status: "incomplete"; reason: string; usage: AiUsage | null; model: string };

export interface AiProvider {
  readonly name: AiProviderName;
  readonly model: string;
  /** Throws AiProviderError for transport/provider failures. */
  generate(request: AiStructuredRequest, options: { signal: AbortSignal }): Promise<AiRawResult>;
}

export type AiErrorKind = "timeout" | "rate_limited" | "unavailable" | "auth" | "bad_request" | "unknown";

export class AiProviderError extends Error {
  readonly kind: AiErrorKind;
  readonly retryable: boolean;
  constructor(kind: AiErrorKind, message: string) {
    super(message);
    this.name = "AiProviderError";
    this.kind = kind;
    this.retryable = kind === "timeout" || kind === "rate_limited" || kind === "unavailable";
  }
}
