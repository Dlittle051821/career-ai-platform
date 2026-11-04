/**
 * NW09 — AI configuration, read from SERVER-SIDE environment variables only.
 *
 * Nothing here is NEXT_PUBLIC_: keys and provider choice never reach a
 * browser bundle. Every value is optional; with nothing set the system is
 * "mock" in development/test and "disabled" in production — the app always
 * runs, and production never calls a model until someone deliberately
 * configures and approves it.
 *
 * Pure (takes an env object), so the resolution rules are unit-tested.
 *
 *   AI_PROVIDER            disabled | mock | gemini | openai
 *   GEMINI_API_KEY         Gemini free tier — DEVELOPMENT + FICTIONAL DATA ONLY
 *   AI_GEMINI_MODEL        default gemini-3.5-flash-lite (confirm the id in Google AI Studio)
 *   AI_FICTIONAL_STUDENT_IDS     comma-separated user ids of FICTIONAL test students
 *                                (development only; ignored in production)
 *   AI_FICTIONAL_EMAIL_DOMAINS   default "example.com,example.test,nextwise.test" — a listed
 *                                student must ALSO have an e-mail at one of these domains
 *   OPENAI_API_KEY         OpenAI (paid)
 *   AI_OPENAI_MODEL        default gpt-5-mini
 *   AI_OPENAI_APPROVED     must be exactly "true" before any paid call is made
 *   AI_MAX_OUTPUT_TOKENS   default 2500   (hard cap 6000)
 *   AI_MAX_INPUT_CHARS     default 24000  (hard cap 60000)
 *   AI_TIMEOUT_MS          default 45000  (hard cap 120000)
 *   AI_MAX_ATTEMPTS        default 2      (hard cap 3)
 *   AI_LIMIT_PER_STAFF_DAILY    default 20
 *   AI_LIMIT_PER_STUDENT_DAILY  default 3
 *   AI_LIMIT_GLOBAL_DAILY       default 100
 *   AI_MONTHLY_BUDGET_USD       default 25
 *   AI_COST_INPUT_PER_MTOK / AI_COST_OUTPUT_PER_MTOK   optional rate override (USD per 1M tokens)
 */
import { AI_PROVIDER_NAMES, type AiProviderName } from "./types";

export type AiMode = "disabled" | AiProviderName;

export interface AiLimits {
  maxOutputTokens: number;
  maxInputChars: number;
  timeoutMs: number;
  maxAttempts: number;
  perStaffDaily: number;
  perStudentDaily: number;
  globalDaily: number;
  monthlyBudgetUsd: number;
}

export interface AiConfig {
  /** The provider that will actually be used (after every safety rule). */
  mode: AiMode;
  /** What was requested in AI_PROVIDER (for the status panel). */
  requested: string;
  /** Why `mode` differs from `requested`, or why it is disabled. Never contains a key. */
  notes: string[];
  isProduction: boolean;
  gemini: { configured: boolean; model: string };
  openai: { configured: boolean; approved: boolean; model: string };
  limits: AiLimits;
  costOverride: { inputPerMTok: number; outputPerMTok: number } | null;
  /** Development-only allowlist of fictional test students (empty in production). */
  fictional: { studentIds: string[]; emailDomains: string[] };
}

type Env = Record<string, string | undefined>;

export const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash-lite";
export const DEFAULT_OPENAI_MODEL = "gpt-5-mini";

function int(env: Env, key: string, fallback: number, min: number, max: number): number {
  const raw = env[key];
  if (raw === undefined || raw.trim() === "") return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function num(env: Env, key: string): number | null {
  const raw = env[key];
  if (raw === undefined || raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** A model id is a short token like "gpt-5-mini"; anything else is ignored (never interpolated into a request otherwise). */
function model(env: Env, key: string, fallback: string): string {
  const raw = (env[key] ?? "").trim();
  return /^[A-Za-z0-9._:-]{2,64}$/.test(raw) ? raw : fallback;
}

export function resolveAiConfig(env: Env = process.env): AiConfig {
  const isProduction = env.NODE_ENV === "production";
  const requestedRaw = (env.AI_PROVIDER ?? "").trim().toLowerCase();
  const requested = requestedRaw || (isProduction ? "disabled" : "mock");
  const notes: string[] = [];

  const gemini = { configured: Boolean(env.GEMINI_API_KEY?.trim()), model: model(env, "AI_GEMINI_MODEL", DEFAULT_GEMINI_MODEL) };
  const openai = {
    configured: Boolean(env.OPENAI_API_KEY?.trim()),
    approved: env.AI_OPENAI_APPROVED === "true",
    model: model(env, "AI_OPENAI_MODEL", DEFAULT_OPENAI_MODEL),
  };

  let mode: AiMode = "disabled";
  if (requested === "disabled") {
    notes.push("AI is switched off (AI_PROVIDER=disabled).");
  } else if (!(AI_PROVIDER_NAMES as readonly string[]).includes(requested)) {
    notes.push(`Unknown AI_PROVIDER "${requested.slice(0, 20)}" — AI is disabled.`);
  } else if (requested === "mock") {
    if (isProduction) notes.push("The mock provider is never used in production — AI is disabled.");
    else mode = "mock";
  } else if (requested === "gemini") {
    if (isProduction) notes.push("Gemini (free tier) is for development with fictional data only — it is never used in production. AI is disabled.");
    else if (!gemini.configured) notes.push("GEMINI_API_KEY is not set — AI is disabled.");
    else mode = "gemini";
  } else if (requested === "openai") {
    if (!openai.configured) notes.push("OPENAI_API_KEY is not set — AI is disabled.");
    else if (!openai.approved) notes.push("OpenAI is configured but not approved (AI_OPENAI_APPROVED is not \"true\") — no paid calls are made. AI is disabled.");
    else mode = "openai";
  }

  const limits: AiLimits = {
    maxOutputTokens: int(env, "AI_MAX_OUTPUT_TOKENS", 2500, 256, 6000),
    maxInputChars: int(env, "AI_MAX_INPUT_CHARS", 24000, 2000, 60000),
    timeoutMs: int(env, "AI_TIMEOUT_MS", 45000, 5000, 120000),
    maxAttempts: int(env, "AI_MAX_ATTEMPTS", 2, 1, 3),
    perStaffDaily: int(env, "AI_LIMIT_PER_STAFF_DAILY", 20, 0, 500),
    perStudentDaily: int(env, "AI_LIMIT_PER_STUDENT_DAILY", 3, 0, 50),
    globalDaily: int(env, "AI_LIMIT_GLOBAL_DAILY", 100, 0, 5000),
    monthlyBudgetUsd: Math.min(10000, num(env, "AI_MONTHLY_BUDGET_USD") ?? 25),
  };
  const inOverride = num(env, "AI_COST_INPUT_PER_MTOK");
  const outOverride = num(env, "AI_COST_OUTPUT_PER_MTOK");
  const costOverride = inOverride !== null && outOverride !== null ? { inputPerMTok: inOverride, outputPerMTok: outOverride } : null;

  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const fictional = isProduction
    ? { studentIds: [], emailDomains: [] }
    : {
        studentIds: (env.AI_FICTIONAL_STUDENT_IDS ?? "")
          .split(",")
          .map((x) => x.trim().toLowerCase())
          .filter((x) => UUID.test(x)),
        emailDomains: (env.AI_FICTIONAL_EMAIL_DOMAINS ?? "example.com,example.test,nextwise.test")
          .split(",")
          .map((x) => x.trim().toLowerCase())
          .filter((x) => /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(x)),
      };

  return { mode, requested, notes, isProduction, gemini, openai, limits, costOverride, fictional };
}

/**
 * Is this student a FICTIONAL test account? Development only (always false in
 * production): the id must be listed in AI_FICTIONAL_STUDENT_IDS AND the
 * account's e-mail must be at a fictional test domain. Everything else is
 * "real_student" — the safe default.
 */
export function isFictionalStudent(config: Pick<AiConfig, "isProduction" | "fictional">, studentUserId: string, email: string | null): boolean {
  if (config.isProduction || !email) return false;
  const domain = email.trim().toLowerCase().split("@")[1] ?? "";
  return config.fictional.studentIds.includes(studentUserId.toLowerCase()) && config.fictional.emailDomains.includes(domain);
}

/** The model id that will be used in `mode` (for records and the status panel). */
export function activeModel(config: AiConfig): string | null {
  switch (config.mode) {
    case "mock":
      return "mock-deterministic-v1";
    case "gemini":
      return config.gemini.model;
    case "openai":
      return config.openai.model;
    default:
      return null;
  }
}
