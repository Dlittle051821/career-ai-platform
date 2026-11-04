import type { AiProvider, AiRawResult, AiStructuredRequest } from "../types";
import { toProviderError } from "./errors";

/**
 * NW09 — Gemini adapter (verified against the installed `@google/genai`
 * 2.x types: models.generateContent with config.systemInstruction,
 * responseMimeType "application/json", responseJsonSchema, maxOutputTokens,
 * abortSignal, httpOptions.timeout; response.text, usageMetadata,
 * promptFeedback.blockReason, candidates[].finishReason).
 *
 * DEVELOPMENT + FICTIONAL DATA ONLY: config.ts never selects Gemini in
 * production, and data-policy.ts refuses any "real_student" request before
 * this adapter is reached. The client is injected so this is unit-tested
 * without a network or a key.
 */
export interface GeminiModelsLike {
  models: {
    generateContent(params: { model: string; contents: string; config: Record<string, unknown> }): Promise<GeminiResponseLike>;
  };
}

export interface GeminiResponseLike {
  text?: string;
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number };
  promptFeedback?: { blockReason?: string };
  candidates?: Array<{ finishReason?: string }>;
  modelVersion?: string;
}

const REFUSAL_REASONS = new Set(["SAFETY", "RECITATION", "BLOCKLIST", "PROHIBITED_CONTENT", "SPII", "IMAGE_SAFETY", "LANGUAGE"]);

export function createGeminiProvider(client: GeminiModelsLike, model: string, timeoutMs: number): AiProvider {
  return {
    name: "gemini",
    model,
    async generate(request: AiStructuredRequest, { signal }): Promise<AiRawResult> {
      let res: GeminiResponseLike;
      try {
        res = await client.models.generateContent({
          model,
          contents: request.input,
          config: {
            systemInstruction: request.instructions,
            responseMimeType: "application/json",
            responseJsonSchema: request.jsonSchema,
            maxOutputTokens: request.maxOutputTokens,
            temperature: 0.2,
            abortSignal: signal,
            httpOptions: { timeout: timeoutMs },
          },
        });
      } catch (error) {
        throw toProviderError(error, "Gemini");
      }
      const m = res.usageMetadata;
      const usage = m ? { inputTokens: m.promptTokenCount ?? 0, outputTokens: (m.candidatesTokenCount ?? 0) + (m.thoughtsTokenCount ?? 0) } : null;
      const usedModel = res.modelVersion ?? model;
      if (res.promptFeedback?.blockReason) return { status: "refused", reason: `Blocked (${res.promptFeedback.blockReason}).`, usage, model: usedModel };
      const finish = res.candidates?.[0]?.finishReason;
      if (finish && REFUSAL_REASONS.has(finish)) return { status: "refused", reason: `Stopped (${finish}).`, usage, model: usedModel };
      if (finish === "MAX_TOKENS") return { status: "incomplete", reason: "max_output_tokens", usage, model: usedModel };
      if (!res.text) return { status: "incomplete", reason: "empty response", usage, model: usedModel };
      return { status: "ok", text: res.text, usage, model: usedModel };
    },
  };
}
