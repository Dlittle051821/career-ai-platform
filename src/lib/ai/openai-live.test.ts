import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { resolveAiConfig } from "./config";
import { estimateCostUsd, rateFor, worstCaseCostUsd } from "./cost";
import { runStructured } from "./run";
import { buildOpenAiRequest, createOpenAiProvider, isSameModel, OPENAI_OFFICIAL_BASE_URL, type OpenAiResponseLike, type OpenAiResponsesLike } from "./providers/openai";
import { toProviderError } from "./providers/errors";
import { AiProviderError, type AiStructuredRequest } from "./types";

/**
 * NW09.2 — the real OpenAI integration, tested WITHOUT network access: the
 * SDK client is replaced by a fake with the same `responses.create` shape.
 * These tests prove what the adapter sends and how it treats every kind of
 * answer and error. They do not prove that a real API call works — that is
 * what the manually authorised live pilot (scripts/dev/nw09-openai-pilot.ts)
 * is for.
 */

const MODEL = "gpt-6.1-terra";
const req = (over: Partial<AiStructuredRequest> = {}): AiStructuredRequest => ({
  task: "career_intelligence",
  instructions: "System rules.",
  input: '{"profile":{}}',
  jsonSchema: { type: "object", properties: { a: { type: "number" } }, required: ["a"], additionalProperties: false },
  schemaName: "career_intelligence_v2",
  payload: {},
  maxOutputTokens: 4000,
  dataClass: "fictional",
  ...over,
});
const signal = () => new AbortController().signal;
const ok = (over: Partial<OpenAiResponseLike> = {}): OpenAiResponseLike => ({
  id: "resp_abc123",
  status: "completed",
  model: MODEL,
  output: [{ type: "message", content: [{ type: "output_text", text: '{"a":1}' }] }],
  usage: { input_tokens: 1200, output_tokens: 800, input_tokens_details: { cached_tokens: 200 }, output_tokens_details: { reasoning_tokens: 300 } },
  ...over,
});
const client = (impl: () => Promise<OpenAiResponseLike>) => {
  const create = vi.fn(impl);
  return { create, c: { responses: { create } } as unknown as OpenAiResponsesLike };
};
const sdkError = (status: number, code?: string, type?: string) => Object.assign(new Error("provider said: student text here"), { status, code, type, error: { code, type } });
const openaiEnv = { NODE_ENV: "production", AI_PROVIDER: "openai", OPENAI_API_KEY: "sk-test-not-real", AI_OPENAI_APPROVED: "true", AI_OPENAI_MODEL: MODEL };

describe("request shape — Responses API, stateless, strict structured output, no tools", () => {
  it("builds exactly the documented body", () => {
    const body = buildOpenAiRequest(req(), MODEL, { reasoningEffort: "low" });
    expect(body).toMatchObject({
      model: MODEL,
      instructions: "System rules.",
      input: '{"profile":{}}',
      max_output_tokens: 4000,
      store: false,
      reasoning: { effort: "low" },
      parallel_tool_calls: false,
      truncation: "disabled",
      text: { format: { type: "json_schema", name: "career_intelligence_v2", strict: true } },
    });
    expect(body).not.toHaveProperty("tools");
    expect(body).not.toHaveProperty("tool_choice");
    expect(body).not.toHaveProperty("previous_response_id");
    expect(body).not.toHaveProperty("background");
  });
  it("calls the SDK once, with the abort signal and SDK retries disabled", async () => {
    const { create, c } = client(async () => ok());
    const s = signal();
    await createOpenAiProvider(c, MODEL).generate(req(), { signal: s });
    expect(create).toHaveBeenCalledTimes(1);
    expect((create.mock.calls[0] as unknown[])[1]).toEqual({ signal: s, maxRetries: 0 });
  });
  it("the client is built against the official endpoint with SDK retries off (source check)", () => {
    const src = readFileSync(join(__dirname, "get-provider.ts"), "utf8");
    expect(OPENAI_OFFICIAL_BASE_URL).toBe("https://api.openai.com/v1");
    expect(src).toMatch(/baseURL:\s*OPENAI_OFFICIAL_BASE_URL/);
    expect(src).toMatch(/maxRetries:\s*0/);
    expect(src).toMatch(/process\.env\.OPENAI_API_KEY/);
    expect(src).toMatch(/^import "server-only";/m);
  });
});

describe("answers — success, refusal, incomplete, wrong model", () => {
  it("returns text, usage (incl. cached and reasoning tokens) and the response id", async () => {
    const { c } = client(async () => ok());
    const r = await createOpenAiProvider(c, MODEL).generate(req(), { signal: signal() });
    expect(r).toMatchObject({ status: "ok", text: '{"a":1}', responseId: "resp_abc123", model: MODEL, usage: { inputTokens: 1200, outputTokens: 800, cachedInputTokens: 200, reasoningTokens: 300 } });
  });
  it("a refusal is reported as refused, never parsed", async () => {
    const { c } = client(async () => ok({ output: [{ type: "message", content: [{ type: "refusal", refusal: "I can't help with that." }] }] }));
    expect((await createOpenAiProvider(c, MODEL).generate(req(), { signal: signal() })).status).toBe("refused");
  });
  it("incomplete (max_output_tokens, content_filter) and non-completed statuses are incomplete", async () => {
    for (const res of [ok({ status: "incomplete", incomplete_details: { reason: "max_output_tokens" } }), ok({ status: "incomplete", incomplete_details: { reason: "content_filter" } }), ok({ status: "failed" })]) {
      const { c } = client(async () => res);
      expect((await createOpenAiProvider(c, MODEL).generate(req(), { signal: signal() })).status).toBe("incomplete");
    }
  });
  it("never silently accepts a different model; dated snapshots of the configured model are the same model", async () => {
    expect(isSameModel(MODEL, MODEL)).toBe(true);
    expect(isSameModel(MODEL, `${MODEL}-2026-10-26`)).toBe(true);
    expect(isSameModel(MODEL, "gpt-6.1-terra-mini")).toBe(false);
    expect(isSameModel(MODEL, "gpt-5-mini")).toBe(false);
    const { c } = client(async () => ok({ model: "gpt-5-mini" }));
    expect(await createOpenAiProvider(c, MODEL).generate(req(), { signal: signal() })).toMatchObject({ status: "incomplete", reason: "model_mismatch" });
  });
  it("a response id that is not a plain token is not stored", async () => {
    const { c } = client(async () => ok({ id: "resp_<script>" }));
    expect((await createOpenAiProvider(c, MODEL).generate(req(), { signal: signal() })).responseId).toBeNull();
  });
});

describe("errors — accurate categories, provider text never copied", () => {
  const cases: Array<[string, unknown, string, boolean]> = [
    ["invalid key (401)", sdkError(401, "invalid_api_key"), "auth", false],
    ["no permission (403)", sdkError(403), "auth", false],
    ["model access denied (403 model)", sdkError(403, "model_not_available"), "model_unavailable", false],
    ["model not found (404)", sdkError(404, "model_not_found"), "model_unavailable", false],
    ["insufficient quota (429)", sdkError(429, "insufficient_quota"), "billing", false],
    ["credits exhausted (429)", sdkError(429, "credit_balance_exhausted"), "billing", false],
    ["project spend limit (429)", sdkError(429, "project_spend_limit_exceeded"), "billing", false],
    ["rate limit (429)", sdkError(429, "rate_limit_exceeded"), "rate_limited", true],
    ["bad request (400)", sdkError(400, "invalid_json_schema"), "bad_request", false],
    ["server error (500)", sdkError(500), "unavailable", true],
    ["overloaded (503)", sdkError(503), "unavailable", true],
  ];
  it.each(cases)("%s", (_name, err, kind, retryable) => {
    const e = toProviderError(err, "OpenAI");
    expect(e).toBeInstanceOf(AiProviderError);
    expect(e.kind).toBe(kind);
    expect(e.retryable).toBe(retryable);
    expect(e.message).not.toContain("student text");
  });
  it("an abort/timeout is a timeout", () => {
    expect(toProviderError(Object.assign(new Error("aborted"), { name: "AbortError" }), "OpenAI").kind).toBe("timeout");
  });
});

describe("runStructured with the OpenAI adapter — bounded, no uncontrolled retries", () => {
  const schema = z.object({ a: z.number() });
  const config = resolveAiConfig(openaiEnv);
  const opts = (over: Record<string, unknown> = {}) => ({ timeoutMs: 1000, maxAttempts: config.limits.maxAttempts, sleep: async () => {}, retryInvalidOutput: false, ...over });

  it("the paid provider is capped at 2 attempts whatever AI_MAX_ATTEMPTS says", () => {
    expect(resolveAiConfig({ ...openaiEnv, AI_MAX_ATTEMPTS: "3" }).limits.maxAttempts).toBe(2);
  });
  it("validates the answer with Zod", async () => {
    const { c } = client(async () => ok());
    expect(await runStructured(createOpenAiProvider(c, MODEL), req(), schema, opts())).toMatchObject({ status: "ok", data: { a: 1 }, responseId: "resp_abc123" });
  });
  it("invalid JSON / wrong shape fails WITHOUT a second paid call", async () => {
    for (const text of ["not json", '{"a":"x"}']) {
      const { create, c } = client(async () => ok({ output: [{ type: "message", content: [{ type: "output_text", text }] }] }));
      const r = await runStructured(createOpenAiProvider(c, MODEL), req(), schema, opts());
      expect(r).toMatchObject({ status: "invalid_output" });
      expect(create).toHaveBeenCalledTimes(1);
    }
  });
  it("billing, auth and model errors are not retried", async () => {
    for (const err of [sdkError(429, "insufficient_quota"), sdkError(401), sdkError(404, "model_not_found")]) {
      const { create, c } = client(async () => {
        throw err;
      });
      const r = await runStructured(createOpenAiProvider(c, MODEL), req(), schema, opts());
      expect(r.status).toBe("failed");
      expect(create).toHaveBeenCalledTimes(1);
    }
  });
  it("a transient rate limit is retried at most once (2 attempts total)", async () => {
    const { create, c } = client(async () => {
      throw sdkError(429, "rate_limit_exceeded");
    });
    const r = await runStructured(createOpenAiProvider(c, MODEL), req(), schema, opts());
    expect(r).toMatchObject({ status: "failed", errorKind: "rate_limited" });
    expect(create).toHaveBeenCalledTimes(2);
  });
  it("a timeout is never retried (the first request may still be billed)", async () => {
    const { create, c } = client(
      () =>
        new Promise<OpenAiResponseLike>((_resolve, reject) => {
          setTimeout(() => reject(Object.assign(new Error("aborted"), { name: "AbortError" })), 50);
        }),
    );
    const r = await runStructured(createOpenAiProvider(c, MODEL), req(), schema, opts({ timeoutMs: 10 }));
    expect(r).toMatchObject({ status: "failed", errorKind: "timeout" });
    expect(create).toHaveBeenCalledTimes(1);
  });
  it("refusals and incomplete answers are not retried", async () => {
    const { create, c } = client(async () => ok({ status: "incomplete", incomplete_details: { reason: "max_output_tokens" } }));
    const r = await runStructured(createOpenAiProvider(c, MODEL), req(), schema, opts());
    expect(r.status).toBe("incomplete");
    expect(create).toHaveBeenCalledTimes(1);
  });
});

describe("configuration — no unverified default model, never enabled automatically", () => {
  it("openai mode requires key, approval AND an explicit model", () => {
    const { AI_OPENAI_MODEL: _m, ...noModel } = openaiEnv;
    expect(resolveAiConfig(noModel).mode).toBe("disabled");
    expect(resolveAiConfig(openaiEnv).mode).toBe("openai");
    expect(resolveAiConfig(openaiEnv).openai.model).toBe(MODEL);
  });
  it("real-student processing and pilot limits are off/conservative by default", () => {
    const c = resolveAiConfig(openaiEnv);
    expect(c.realStudentDataApproved).toBe(false);
    expect(c.paid).toEqual({ maxRuns: 5, totalBudgetUsd: 2 });
    expect(resolveAiConfig({ ...openaiEnv, AI_REAL_STUDENT_DATA_APPROVED: "yes" }).realStudentDataApproved).toBe(false);
  });
  it("the key never appears in the config object", () => {
    expect(JSON.stringify(resolveAiConfig(openaiEnv))).not.toContain("sk-test-not-real");
  });
});

describe("cost — official gpt-6.1-terra rates, conservative estimate", () => {
  const cfg = { costOverride: null };
  it("uses the verified rate card (also for dated snapshots)", () => {
    expect(rateFor(MODEL, cfg)).toMatchObject({ input: 1.0, cachedInput: 0.05, cacheWrite: 1.25, output: 5.0 });
    expect(rateFor(`${MODEL}-2026-10-26`, cfg).output).toBe(5.0);
  });
  it("estimates from real token counts (uncached input priced at the cache-write upper bound)", () => {
    // 1000 uncached × $1.25 + 200 cached × $0.05 + 800 out × $5.00 per MTok
    expect(estimateCostUsd("openai", MODEL, { inputTokens: 1200, outputTokens: 800, cachedInputTokens: 200 }, cfg)).toBeCloseTo((1000 * 1.25 + 200 * 0.05 + 800 * 5) / 1e6, 8);
  });
  it("one worst-case pilot request stays far below the $2 pilot budget", () => {
    const c = resolveAiConfig(openaiEnv);
    expect(worstCaseCostUsd("openai", MODEL, c.limits.maxInputChars, c.limits.maxOutputTokens, c)).toBeLessThan(0.1);
  });
  it("an unlisted model is priced conservatively high", () => {
    expect(rateFor("some-future-model", cfg).output).toBeGreaterThanOrEqual(30);
  });
});
