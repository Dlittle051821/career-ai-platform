import type { AiProvider, AiRawResult, AiStructuredRequest } from "../types";
import { toProviderError } from "./errors";

/**
 * NW09 — OpenAI adapter (Responses API, verified against the installed
 * `openai` SDK 7.x types: responses.create with `instructions`, `input`,
 * `text.format` = strict `json_schema`, `max_output_tokens`, `store`).
 *
 * SERVER-ONLY and DISABLED BY DEFAULT: get-provider.ts only constructs this
 * when AI_PROVIDER=openai, OPENAI_API_KEY is set AND AI_OPENAI_APPROVED is
 * exactly "true" (config.ts). `store: false` — requests are stateless.
 * SDK retries are off (maxRetries: 0); run.ts owns the retry policy.
 *
 * The client is injected (a structural subset of the SDK) so this adapter is
 * unit-tested without a network or a key.
 */
export interface OpenAiResponsesLike {
  responses: {
    create(params: Record<string, unknown>, options?: { signal?: AbortSignal }): Promise<OpenAiResponseLike>;
  };
}

export interface OpenAiResponseLike {
  status?: string;
  output_text?: string;
  incomplete_details?: { reason?: string } | null;
  output?: Array<{ type?: string; content?: Array<{ type?: string; refusal?: string; text?: string }> }>;
  usage?: { input_tokens?: number; output_tokens?: number } | null;
  model?: string;
}

export function createOpenAiProvider(client: OpenAiResponsesLike, model: string): AiProvider {
  return {
    name: "openai",
    model,
    async generate(request: AiStructuredRequest, { signal }): Promise<AiRawResult> {
      let res: OpenAiResponseLike;
      try {
        res = await client.responses.create(
          {
            model,
            instructions: request.instructions,
            input: request.input,
            text: { format: { type: "json_schema", name: request.schemaName, schema: request.jsonSchema, strict: true } },
            max_output_tokens: request.maxOutputTokens,
            store: false,
            reasoning: { effort: "low" },
          },
          { signal },
        );
      } catch (error) {
        throw toProviderError(error, "OpenAI");
      }
      const usage = res.usage ? { inputTokens: res.usage.input_tokens ?? 0, outputTokens: res.usage.output_tokens ?? 0 } : null;
      const usedModel = res.model ?? model;
      const refusal = res.output?.flatMap((o) => o.content ?? []).find((c) => c.type === "refusal");
      if (refusal) return { status: "refused", reason: "The model declined to answer.", usage, model: usedModel };
      if (res.status === "incomplete") return { status: "incomplete", reason: res.incomplete_details?.reason ?? "incomplete", usage, model: usedModel };
      if (res.status && res.status !== "completed") return { status: "incomplete", reason: `status ${res.status}`, usage, model: usedModel };
      return { status: "ok", text: res.output_text ?? "", usage, model: usedModel };
    },
  };
}
