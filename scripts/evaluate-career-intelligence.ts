/**
 * NW09 — Career Intelligence evaluation over FICTIONAL student profiles.
 *
 * Run with:
 *   npm run ai:evaluate                    # mock provider (free, offline, deterministic)
 *   npm run ai:evaluate -- --provider gemini   # Gemini free tier (needs GEMINI_API_KEY)
 *
 * Every profile in src/lib/career-intelligence/evaluation/profiles.ts is
 * invented. They are run through the REAL pipeline (completeness check,
 * catalogue candidates from the real Nextwise career seed data, minimised
 * prompt, provider, runtime schema validation, claim screening) and checked
 * against invariants that must hold for ANY provider: catalogue-only careers
 * with real ids and titles, no salaries / percentages / guarantees / named
 * institutions, evidence for every career, uncertainty stated, incomplete
 * profiles stopped before any AI call, minors / conflicts / injection flagged.
 *
 * OpenAI is deliberately NOT available here: this command never makes a
 * paid call. Gemini is allowed because the data is fictional ("fictional"
 * data class, enforced by the same data policy the app uses). Never point
 * this at real student data.
 *
 * Writes a JSON summary to qa/nw09-evaluation-<provider>.json and exits
 * non-zero if any check fails.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { config as loadEnv } from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { resolveAiConfig } from "../src/lib/ai/config";
import { createMockProvider } from "../src/lib/ai/providers/mock";
import { createGeminiProvider, type GeminiModelsLike } from "../src/lib/ai/providers/gemini";
import type { AiProvider } from "../src/lib/ai/types";
import { mockCareerAnalyst } from "../src/lib/career-intelligence/mock-analyst";
import { evaluationCatalogue } from "../src/lib/career-intelligence/evaluation/catalogue";
import { EVALUATION_PROFILES } from "../src/lib/career-intelligence/evaluation/profiles";
import { evaluateProfile } from "../src/lib/career-intelligence/evaluation/evaluate";

loadEnv({ path: ".env.local" });

async function main() {
  const arg = process.argv.indexOf("--provider");
  const wanted = arg > -1 ? (process.argv[arg + 1] ?? "mock") : "mock";
  if (wanted !== "mock" && wanted !== "gemini") {
    console.error(`Unsupported provider "${wanted}". This command runs only "mock" or "gemini" (never a paid provider).`);
    process.exit(2);
  }

  const config = resolveAiConfig({ ...process.env, NODE_ENV: "development", AI_PROVIDER: wanted });
  if (config.mode !== wanted) {
    console.error(`Cannot use ${wanted}: ${config.notes.join(" ")}`);
    process.exit(2);
  }

  let provider: AiProvider;
  if (wanted === "gemini") {
    const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
    provider = createGeminiProvider(client as unknown as GeminiModelsLike, config.gemini.model, config.limits.timeoutMs);
  } else {
    provider = createMockProvider(mockCareerAnalyst);
  }

  const catalogue = evaluationCatalogue();
  console.log(`NW09 evaluation — provider: ${provider.name} (${provider.model}); ${EVALUATION_PROFILES.length} fictional profiles; ${catalogue.length} catalogue careers.\n`);

  const results = [];
  for (const profile of EVALUATION_PROFILES) {
    const r = await evaluateProfile(profile, catalogue, { config, provider });
    results.push(r);
    console.log(`${r.passed ? "PASS" : "FAIL"}  ${profile.id.padEnd(26)} ${r.outcome.padEnd(14)} ${r.careers.join("; ")}`);
    for (const c of r.checks.filter((x) => !x.passed)) console.log(`        ✗ ${c.name}${c.detail ? ` — ${c.detail}` : ""}`);
    // Stay well inside free-tier per-minute limits.
    if (wanted === "gemini") await new Promise((res) => setTimeout(res, 4500));
  }

  const failed = results.filter((r) => !r.passed).length;
  const outDir = path.resolve("qa");
  mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `nw09-evaluation-${provider.name}.json`);
  writeFileSync(outFile, JSON.stringify({ provider: provider.name, model: provider.model, runAt: new Date().toISOString(), passed: results.length - failed, failed, results }, null, 2));
  console.log(`\n${results.length - failed}/${results.length} profiles passed. Summary written to ${path.relative(process.cwd(), outFile)}.`);
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error("Evaluation failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
