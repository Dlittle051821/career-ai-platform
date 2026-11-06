import type { AiProvider, AiRawResult, AiStructuredRequest, AiUsage } from "../types";
import { toProviderError } from "./errors";

/**
 * NW09 / NW09.2 — OpenAI adapter: the official OpenAI Node SDK, Responses
 * API (`client.responses.create`), verified against the installed `openai`
 * 7.x types and OpenAI's Structured Outputs and reasoning guides
 * (developers.openai.com, checked 6 Nov 2026).
 *
 * Request:
 *   - `instructions` (our trusted system text) + `input` (the JSON data);
 *   - `text.format` = strict `json_schema` (Structured Outputs);
 *   - `max_output_tokens` — a hard ceiling (reasoning tokens count toward it);
 *   - `store: false` — stateless, nothing retained for later retrieval;
 *   - `reasoning.effort` — configurable (AI_OPENAI_REASONING_EFFORT);
 *   - NO `tools` (so no web search, file search or other paid tools can run),
 *     `parallel_tool_calls: false`, `truncation: "disabled"` (the request
 *     fails rather than silently dropping input).
 *
 * Response handling:
 *   - a `refusal` content part → "refused";
 *   - `status: "incomplete"` (e.g. max_output_tokens) → "incomplete";
 *   - any other non-"completed" status → "incomplete";
 *   - the model that ANSWERED must be the configured model (or a dated
 *     snapshot of it, e.g. "gpt-6.1-terra-2026-10-26"); anything else is
 *     treated as incomplete ("model_mismatch") — no silent model switch;
 *   - usage (input / cached input / output / reasoning tokens) and the
 *     response id are returned for the ledger.
 *
 * SERVER-ONLY and DISABLED BY DEFAULT: get-provider.ts only constructs this
 * when AI_PROVIDER=openai, OPENAI_API_KEY is set, AI_OPENAI_MODEL is set
 * explicitly AND AI_OPENAI_APPROVED is exactly "true" (config.ts). SDK
 * retries are off (maxRetries: 0); run.ts owns the (bounded) retry policy.
 *
 * The client is injected (a structural subset of the SDK) so this adapter
 * is unit-tested without a network or a key.
 */
/** The official OpenAI API endpoint — pinned, never configurable (the SDK would otherwise honour OPENAI_BASE_URL). */
export const OPENAI_OFFICIAL_BASE_URL = "https://api.openai.com/v1";

export interface OpenAiResponsesLike {
  responses: {
    create(params: Record<string, unknown>, options?: { signal?: AbortSignal; maxRetries?: number }): Promise<OpenAiResponseLike>;
  };
}

export interface OpenAiResponseLike {
  id?: string;
  status?: string;
  output_text?: string;
  incomplete_details?: { reason?: string } | null;
  error?: { code?: string; message?: string } | null;
  output?: Array<{ type?: string; content?: Array<{ type?: string; refusal?: string; text?: string }> }>;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    input_tokens_details?: { cached_tokens?: number } | null;
    output_tokens_details?: { reasoning_tokens?: number } | null;
  } | null;
  model?: string;
}

export type OpenAiReasoningEffort = "none" | "low" | "medium" | "high";

export interface OpenAiProviderOptions {
  reasoningEffort?: OpenAiReasoningEffort;
}

/** The exact request body sent to the Responses API (exported for tests and the pilot's dry run). */
export function buildOpenAiRequest(request: AiStructuredRequest, model: string, options: OpenAiProviderOptions = {}): Record<string, unknown> {
  return {
    model,
    instructions: request.instructions,
    input: request.input,
    text: { format: { type: "json_schema", name: request.schemaName, schema: request.jsonSchema, strict: true } },
    max_output_tokens: request.maxOutputTokens,
    store: false,
    reasoning: { effort: options.reasoningEffort ?? "low" },
    parallel_tool_calls: false,
    truncation: "disabled",
  };
}

/** Does the model that answered match the configured one? Exact id, or a dated snapshot of it. */
export function isSameModel(configured: string, answered: string | undefined): boolean {
  if (!answered) return true; // not reported: we only know what we asked for
  if (answered === configured) return true;
  return answered.startsWith(`${configured}-`) && /^\d{4}-\d{2}-\d{2}$/.test(answered.slice(configured.length + 1));
}

function usageOf(res: OpenAiResponseLike): AiUsage | null {
  if (!res.usage) return null;
  return {
    inputTokens: res.usage.input_tokens ?? 0,
    outputTokens: res.usage.output_tokens ?? 0,
    cachedInputTokens: res.usage.input_tokens_details?.cached_tokens ?? 0,
    reasoningTokens: res.usage.output_tokens_details?.reasoning_tokens ?? 0,
  };
}

/** The assistant message text (joined output_text parts), falling back to the SDK's convenience field. */
function messageText(res: OpenAiResponseLike): string {
  const parts = (res.output ?? []).filter((o) => o.type === "message").flatMap((o) => o.content ?? []);
  const text = parts.filter((c) => c.type === "output_text" && typeof c.text === "string").map((c) => c.text as string);
  return text.length > 0 ? text.join("") : (res.output_text ?? "");
}

export function createOpenAiProvider(client: OpenAiResponsesLike, model: string, options: OpenAiProviderOptions = {}): AiProvider {
  return {
    name: "openai",
    model,
    async generate(request: AiStructuredRequest, { signal }): Promise<AiRawResult> {
      let res: OpenAiResponseLike;
      try {
        res = await client.responses.create(buildOpenAiRequest(request, model, options), { signal, maxRetries: 0 });
      } catch (error) {
        throw toProviderError(error, "OpenAI");
      }
      const usage = usageOf(res);
      const usedModel = res.model ?? model;
      const responseId = typeof res.id === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(res.id) ? res.id : null;
      const base = { usage, model: usedModel, responseId };
      if (!isSameModel(model, res.model)) return { status: "incomplete", reason: "model_mismatch", ...base };
      const refusal = (res.output ?? []).flatMap((o) => o.content ?? []).find((c) => c.type === "refusal");
      if (refusal) return { status: "refused", reason: "The model declined to answer.", ...base };
      if (res.status === "incomplete") return { status: "incomplete", reason: res.incomplete_details?.reason ?? "incomplete", ...base };
      if (res.status && res.status !== "completed") return { status: "incomplete", reason: `status ${res.status}`, ...base };
      return { status: "ok", text: messageText(res), ...base };
    },
  };
}
