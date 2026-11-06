import "server-only";
import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";
import { resolveAiConfig, type AiConfig } from "./config";
import { createGeminiProvider } from "./providers/gemini";
import { createMockProvider, type MockAnalyst } from "./providers/mock";
import { createOpenAiProvider, type OpenAiResponsesLike } from "./providers/openai";
import type { AiProvider } from "./types";
import { OPENAI_OFFICIAL_BASE_URL } from "./providers/openai";

/**
 * NW09 — the one place real provider clients are constructed. SERVER-ONLY
 * (the "server-only" import makes any client-component import a build
 * error). Returns null when AI is disabled. Keys are read here from
 * process.env and passed straight into the SDK client — never logged,
 * stored, returned or sent to a browser.
 */
export function getAiConfig(): AiConfig {
  return resolveAiConfig(process.env);
}

export function getAiProvider(config: AiConfig, mockAnalyst: MockAnalyst): AiProvider | null {
  switch (config.mode) {
    case "mock":
      return createMockProvider(mockAnalyst);
    case "gemini": {
      const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      return createGeminiProvider(client as unknown as Parameters<typeof createGeminiProvider>[0], config.gemini.model, config.limits.timeoutMs);
    }
    case "openai": {
      // Official endpoint pinned explicitly (the SDK would otherwise honour an OPENAI_BASE_URL
      // environment variable); SDK retries off — run.ts owns the bounded retry policy.
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY!, baseURL: OPENAI_OFFICIAL_BASE_URL, maxRetries: 0, timeout: config.limits.timeoutMs });
      return createOpenAiProvider(client as unknown as OpenAiResponsesLike, config.openai.model, { reasoningEffort: config.openai.reasoningEffort });
    }
    default:
      return null;
  }
}
