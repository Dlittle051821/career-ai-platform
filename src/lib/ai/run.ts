import { z } from "zod";
import { AiProviderError, type AiErrorKind, type AiProvider, type AiStructuredRequest, type AiUsage } from "./types";

/**
 * NW09 — runs ONE structured request against a provider with a hard
 * timeout, a bounded number of attempts, and runtime validation of the
 * answer. Model output is never trusted: it must parse as JSON and pass the
 * Zod schema, or the run fails. Retries happen only for transient provider
 * failures (rate limit / unavailable — never a timeout, which may already
 * have been billed) and, once, for an answer that did not validate — unless
 * `retryInvalidOutput` is false (NW09.2: always false for the paid provider,
 * so a malformed answer never triggers a second paid call). Refusals,
 * billing, auth, model-access and request errors are never retried.
 * A failure NEVER falls back to another provider (no silent mock answer).
 */
export type RunResult<T> =
  | { status: "ok"; data: T; usage: AiUsage | null; model: string; attempts: number; latencyMs: number; responseId: string | null }
  | {
      status: "refused" | "incomplete" | "invalid_output" | "failed";
      reason: string;
      errorKind?: AiErrorKind;
      usage: AiUsage | null;
      model: string;
      attempts: number;
      latencyMs: number;
      responseId: string | null;
    };

export interface RunOptions {
  timeoutMs: number;
  maxAttempts: number;
  /** Retry once when the answer is not valid JSON / does not match the schema (default true). */
  retryInvalidOutput?: boolean;
  /** Injected for tests (no real waiting). */
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function addUsage(a: AiUsage | null, b: AiUsage | null): AiUsage | null {
  if (!a) return b;
  if (!b) return a;
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cachedInputTokens: (a.cachedInputTokens ?? 0) + (b.cachedInputTokens ?? 0),
    reasoningTokens: (a.reasoningTokens ?? 0) + (b.reasoningTokens ?? 0),
  };
}

export async function runStructured<T>(provider: AiProvider, request: AiStructuredRequest, schema: z.ZodType<T>, options: RunOptions): Promise<RunResult<T>> {
  const sleep = options.sleep ?? defaultSleep;
  const now = options.now ?? Date.now;
  const started = now();
  let usage: AiUsage | null = null;
  let model = provider.model;
  let responseId: string | null = null;
  let validationRetried = options.retryInvalidOutput === false;
  let last: RunResult<T> | null = null;

  for (let attempt = 1; attempt <= options.maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs);
    try {
      const raw = await provider.generate(request, { signal: controller.signal });
      usage = addUsage(usage, raw.usage);
      model = raw.model;
      responseId = raw.responseId ?? responseId;
      if (raw.status === "refused") return { status: "refused", reason: raw.reason, usage, model, attempts: attempt, latencyMs: now() - started, responseId };
      if (raw.status === "incomplete") return { status: "incomplete", reason: raw.reason, usage, model, attempts: attempt, latencyMs: now() - started, responseId };
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw.text);
      } catch {
        last = { status: "invalid_output", reason: "The answer was not valid JSON.", usage, model, attempts: attempt, latencyMs: now() - started, responseId };
        if (!validationRetried && attempt < options.maxAttempts) {
          validationRetried = true;
          continue;
        }
        return last;
      }
      const result = schema.safeParse(parsed);
      if (result.success) return { status: "ok", data: result.data, usage, model, attempts: attempt, latencyMs: now() - started, responseId };
      const where = result.error.issues
        .slice(0, 3)
        .map((i) => i.path.join(".") || "(root)")
        .join(", ");
      last = { status: "invalid_output", reason: `The answer did not match the report schema (at ${where}).`, usage, model, attempts: attempt, latencyMs: now() - started, responseId };
      if (!validationRetried && attempt < options.maxAttempts) {
        validationRetried = true;
        continue;
      }
      return last;
    } catch (error) {
      const e = error instanceof AiProviderError ? error : new AiProviderError(controller.signal.aborted ? "timeout" : "unknown", "Provider call failed.");
      const kind: AiErrorKind = controller.signal.aborted ? "timeout" : e.kind;
      last = { status: "failed", reason: kind === "timeout" ? "The AI provider did not respond in time." : e.message, errorKind: kind, usage, model, attempts: attempt, latencyMs: now() - started, responseId };
      // A timeout is never retried: the provider may already have processed (and billed) the request.
      const retryable = kind !== "timeout" && e.retryable;
      if (!retryable || attempt >= options.maxAttempts) return last;
      await sleep(Math.min(4000, 600 * 2 ** (attempt - 1)));
    } finally {
      clearTimeout(timer);
    }
  }
  return last ?? { status: "failed", reason: "No attempt was made.", usage, model, attempts: 0, latencyMs: now() - started, responseId };
}
