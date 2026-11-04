import type { AiConfig } from "./config";
import type { AiProviderName, AiUsage } from "./types";

/**
 * NW09 — usage-cost ESTIMATES (USD). Rates are per 1M tokens and are a
 * configuration value, not a fact: confirm against the provider's official
 * pricing page before relying on them, or set AI_COST_INPUT_PER_MTOK /
 * AI_COST_OUTPUT_PER_MTOK to override. The mock and the Gemini free tier
 * cost nothing; their usage is still recorded. Every figure produced here is
 * labelled "estimated" wherever it is stored or shown.
 */
export const MODEL_RATES_USD_PER_MTOK: Record<string, { input: number; output: number }> = {
  // OpenAI standard rates from a third-party pricing table updated 31 Oct 2026
  // (morphllm.com/openai-api-pricing); OpenAI's own page could not be checked
  // from the build environment. VERIFY before enabling paid calls.
  "gpt-5-mini": { input: 0.25, output: 2.0 },
  "gpt-5-nano": { input: 0.05, output: 0.4 },
  "gpt-5.4-mini": { input: 0.75, output: 4.5 },
  "gpt-5.4-nano": { input: 0.2, output: 1.25 },
};

/** Conservative fallback for an unlisted paid model — deliberately high so budgets trip early rather than late. */
const UNKNOWN_PAID_RATE = { input: 5, output: 30 };

export function estimateCostUsd(provider: AiProviderName, model: string, usage: AiUsage | null, config: Pick<AiConfig, "costOverride">): number {
  if (!usage) return 0;
  if (provider === "mock" || provider === "gemini") return 0;
  const rate = config.costOverride ? { input: config.costOverride.inputPerMTok, output: config.costOverride.outputPerMTok } : (MODEL_RATES_USD_PER_MTOK[model] ?? UNKNOWN_PAID_RATE);
  const cost = (usage.inputTokens * rate.input + usage.outputTokens * rate.output) / 1_000_000;
  return Math.round(cost * 1_000_000) / 1_000_000;
}

/** Worst-case cost of one request before it is sent (all input + the full output allowance) — used for budget pre-checks. */
export function worstCaseCostUsd(provider: AiProviderName, model: string, inputChars: number, maxOutputTokens: number, config: Pick<AiConfig, "costOverride">): number {
  return estimateCostUsd(provider, model, { inputTokens: Math.ceil(inputChars / 3), outputTokens: maxOutputTokens }, config);
}
