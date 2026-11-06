import type { AiConfig } from "./config";
import type { AiProviderName, AiUsage } from "./types";

/**
 * NW09 — usage-cost ESTIMATES (USD). Rates are per 1M tokens and are a
 * configuration value, not a fact: confirm against the provider's official
 * pricing page before relying on them, or set AI_COST_INPUT_PER_MTOK /
 * AI_COST_OUTPUT_PER_MTOK to override. The mock and the Gemini free tier
 * cost nothing; their usage is still recorded. Every figure produced here is
 * labelled "estimated" wherever it is stored or shown. The authoritative
 * figure is always the OpenAI usage dashboard.
 */
export interface ModelRate {
  input: number;
  output: number;
  /** Price of input tokens served from the prompt cache. */
  cachedInput?: number;
  /**
   * Price of writing uncached input to the prompt cache, where the model
   * bills cache writes. Used as the price of uncached input when present, so
   * the estimate is an UPPER bound (budgets trip early rather than late).
   */
  cacheWrite?: number;
  verified: string;
}

export const MODEL_RATES_USD_PER_MTOK: Record<string, ModelRate> = {
  // OFFICIAL — developers.openai.com/api/docs/pricing and the GPT-6.1 Terra
  // model page, checked 6 Nov 2026 (Standard tier, 30-minute cache writes).
  "gpt-6.1-terra": { input: 1.0, cachedInput: 0.05, cacheWrite: 1.25, output: 5.0, verified: "official pricing page, 2026-11-06" },
  // From a third-party pricing table (31 Oct 2026) — NOT verified against OpenAI.
  "gpt-5-mini": { input: 0.25, output: 2.0, verified: "third-party table, unverified" },
  "gpt-5-nano": { input: 0.05, output: 0.4, verified: "third-party table, unverified" },
  "gpt-5.4-mini": { input: 0.75, output: 4.5, verified: "third-party table, unverified" },
  "gpt-5.4-nano": { input: 0.2, output: 1.25, verified: "third-party table, unverified" },
};

/** Conservative fallback for an unlisted paid model — deliberately high so budgets trip early rather than late. */
const UNKNOWN_PAID_RATE: ModelRate = { input: 5, output: 30, verified: "conservative fallback" };

/** The rate table entry for a model id, accepting a dated snapshot id (e.g. "gpt-6.1-terra-2026-10-26"). */
export function rateFor(model: string, config: Pick<AiConfig, "costOverride">): ModelRate {
  if (config.costOverride) return { input: config.costOverride.inputPerMTok, output: config.costOverride.outputPerMTok, verified: "AI_COST_* override" };
  const base = MODEL_RATES_USD_PER_MTOK[model] ?? MODEL_RATES_USD_PER_MTOK[model.replace(/-\d{4}-\d{2}-\d{2}$/, "")];
  return base ?? UNKNOWN_PAID_RATE;
}

export function estimateCostUsd(provider: AiProviderName, model: string, usage: AiUsage | null, config: Pick<AiConfig, "costOverride">): number {
  if (!usage) return 0;
  if (provider === "mock" || provider === "gemini") return 0;
  const rate = rateFor(model, config);
  const cached = Math.min(usage.cachedInputTokens ?? 0, usage.inputTokens);
  const uncached = usage.inputTokens - cached;
  const inputCost = uncached * (rate.cacheWrite ?? rate.input) + cached * (rate.cachedInput ?? rate.input);
  const cost = (inputCost + usage.outputTokens * rate.output) / 1_000_000;
  return Math.round(cost * 1_000_000) / 1_000_000;
}

/** Worst-case cost of one request before it is sent (all input uncached + the full output allowance) — used for budget pre-checks. */
export function worstCaseCostUsd(provider: AiProviderName, model: string, inputChars: number, maxOutputTokens: number, config: Pick<AiConfig, "costOverride">): number {
  return estimateCostUsd(provider, model, { inputTokens: Math.ceil(inputChars / 3), outputTokens: maxOutputTokens }, config);
}
