/**
 * NW09.2 — OpenAI LIVE PILOT (QA only, fictional adult student only).
 *
 *   Preflight (no OpenAI call, no cost, no writes):
 *     npx tsx --conditions=react-server scripts/dev/nw09-openai-pilot.ts --qa --key-from-clipboard
 *
 *   Live test (exactly ONE paid OpenAI request, after a typed confirmation):
 *     npx tsx --conditions=react-server scripts/dev/nw09-openai-pilot.ts --qa --key-from-clipboard --live-api-test
 *
 * Normally run through scripts\nw09\Run-NW09OpenAiLiveTest.ps1 (PowerShell 5.1).
 *
 * WHAT IT DOES — the same path the Counsellor Studio's Generate button takes:
 *   requestCareerAnalysis() (src/lib/career-intelligence/service.ts) with a
 *   gateway that calls the SAME RPCs as the app's Supabase gateway, signed in
 *   as the QA counsellor (one-time magic-link session; no password touched):
 *   role + case access → recorded consent → data policy → profile/candidates
 *   → staff_reserve_ai_generation_run_v2 (database pilot caps: 5 runs / $2
 *   all-time, one in progress per student) → ONE OpenAI Responses API call
 *   → Zod validation + claim screening + catalogue verification →
 *   staff_complete_ai_generation_run_v2 → staff_create_recommendation_draft
 *   → link. The result is an ordinary NW07 DRAFT; nothing is submitted,
 *   approved or released.
 *
 * SAFETY
 *   - Target is identified by PROJECT REF, never by name: only the QA project
 *     (ynwzijulzksmrcwdhudv) is accepted; the production ref is refused.
 *   - The student must be a seeded fictional QA account (test marker + listed
 *     in AI_FICTIONAL_STUDENT_IDS + a fictional e-mail domain) and an adult.
 *   - The OpenAI key is read from .env.local by the SDK constructor only; it
 *     is never printed, logged, written or sent anywhere except api.openai.com.
 *   - The Supabase service key (clipboard / hidden prompt) is used ONLY to mint
 *     the counsellor's magic-link session; every write runs as the counsellor
 *     through RLS-guarded RPCs. It is never saved.
 *   - At most one paid call per invocation (attempts forced to 1, no retry).
 *   - Two independent budget locks: the database pilot caps, and a local
 *     ledger (.nw09-pilot/ledger.json) refusing a 6th call or > $2.00.
 *   - Output tokens are bounded (AI_MAX_OUTPUT_TOKENS, max 6000).
 *   - A failure is reported as a failure, with its category. There is no
 *     fallback to the mock provider.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { config as loadEnv } from "dotenv";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { isFictionalStudent, RECOMMENDED_OPENAI_MODEL, resolveAiConfig, type AiConfig } from "../../src/lib/ai/config";
import { getAiProvider } from "../../src/lib/ai/get-provider";
import { worstCaseCostUsd } from "../../src/lib/ai/cost";
import { mockCareerAnalyst } from "../../src/lib/career-intelligence/mock-analyst";
import { prepareAnalysis } from "../../src/lib/career-intelligence/pipeline";
import { describeOutcome } from "../../src/lib/career-intelligence/messages";
import { CareerIntelligenceReportSchema } from "../../src/lib/career-intelligence/schema";
import { requestCareerAnalysis, type CareerIntelligenceGateway, type ConsentStatus, type ReserveResult } from "../../src/lib/career-intelligence/service";
import { fetchStudentProfileSnapshotByUserId } from "../../src/lib/supabase/student-profile";
import { getCareersForMatching } from "../../src/lib/supabase/careers";
import { rpcRowId } from "../../src/lib/supabase/rpc-result";
import type { ProfileSectionKey, ProvenanceValue } from "../../src/types/profile-provenance";
import type { Database, Json } from "../../src/types/database";
import { checkKeyFormat, ClipboardError, normaliseKey, takeKeyFromClipboard, verifyKeyWithProject } from "./supabase-key-input";
import { KNOWN_PRODUCTION_REFS, QA_PROJECT_REF, checkQaTarget, refFromSupabaseUrl } from "./qa-db/qa-project";

loadEnv({ path: ".env.local" });

const COUNSELLOR_EMAIL = "qa-counsellor@nextwise.test";
const DEFAULT_STUDENT_EMAIL = "qa-student@nextwise.test";
const TEST_MARKER = "nw09-qa-test-account";
const PILOT_MAX_CALLS = 5;
const PILOT_MAX_USD = 2.0;
const CONFIRM_PHRASE = "RUN 1 PAID CALL";
const PILOT_DIR = path.resolve(".nw09-pilot");
const LEDGER = path.join(PILOT_DIR, "ledger.json");

const argv = process.argv.slice(2);
const args = new Set(argv);
const LIVE = args.has("--live-api-test");

function argValue(name: string): string | undefined {
  const eq = argv.find((a) => a.startsWith(`${name}=`));
  if (eq) return eq.slice(name.length + 1);
  const i = argv.indexOf(name);
  return i > -1 ? argv[i + 1] : undefined;
}

function fail(message: string): never {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}
const ok = (m: string) => console.log(`✓ ${m}`);
const info = (m: string) => console.log(`  ${m}`);

// ─── Local ledger (second, independent budget lock) ─────────────────────────

type LedgerEntry = { at: string; status: "started" | "succeeded" | "failed" | "not_called"; model: string; worstCaseUsd: number; estimatedUsd: number | null; inputTokens: number; outputTokens: number; responseId: string | null; outcome: string };
function readLedger(): LedgerEntry[] {
  if (!existsSync(LEDGER)) return [];
  try {
    const parsed = JSON.parse(readFileSync(LEDGER, "utf8")) as { entries?: LedgerEntry[] };
    return Array.isArray(parsed.entries) ? parsed.entries : [];
  } catch {
    fail(`The local pilot ledger ${LEDGER} is unreadable. Do not delete it to get around the budget — inspect it first.`);
  }
}
function writeLedger(entries: LedgerEntry[]) {
  mkdirSync(PILOT_DIR, { recursive: true });
  writeFileSync(LEDGER, `${JSON.stringify({ note: "NW09.2 OpenAI pilot — local budget ledger. Counts every paid attempt (a started-but-unfinished attempt counts at its worst case). Do not edit.", limits: { calls: PILOT_MAX_CALLS, usd: PILOT_MAX_USD }, entries }, null, 2)}\n`);
}
/** Calls that may have been billed: everything except entries that never reached the provider. */
function ledgerTotals(entries: LedgerEntry[]) {
  const billed = entries.filter((e) => e.status !== "not_called");
  return { calls: billed.length, usd: billed.reduce((s, e) => s + (e.estimatedUsd ?? e.worstCaseUsd), 0) };
}

// ─── Target and environment ─────────────────────────────────────────────────

function assertQaTarget(): string {
  if (!args.has("--qa")) fail("Add --qa to confirm the target is the Nextwise-Development-QA project.");
  if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV) fail("Refusing: a production/Vercel environment flag is set. Run this only on your PC against QA.");
  const ref = refFromSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const target = checkQaTarget(ref);
  if (!target.ok) fail(target.reason);
  if (ref !== QA_PROJECT_REF || KNOWN_PRODUCTION_REFS.includes(ref)) fail("Refusing: not the QA project.");
  const linked = path.resolve("supabase/.temp/linked-project.json");
  if (existsSync(linked)) {
    try {
      const l = JSON.parse(readFileSync(linked, "utf8")) as { ref?: string };
      if (l.ref && KNOWN_PRODUCTION_REFS.includes(l.ref)) info("! Note: the Supabase CLI on this PC is linked to PRODUCTION. This script does not use the CLI. Never run `supabase db push` here.");
    } catch {
      /* the URL check above is authoritative */
    }
  }
  return ref;
}

function checkAiConfig(): AiConfig {
  const config = resolveAiConfig(process.env);
  if (config.isProduction) fail("Refusing: NODE_ENV=production.");
  if (config.mode !== "openai") fail(`AI is not in OpenAI mode (mode: ${config.mode}). ${config.notes.join(" ")} Set OPENAI_API_KEY, AI_PROVIDER=openai, AI_OPENAI_MODEL and AI_OPENAI_APPROVED=true in .env.local (see the NW09.2 setup guide).`);
  if (config.realStudentDataApproved) fail("Refusing: AI_REAL_STUDENT_DATA_APPROVED=true is set. The pilot runs only with real-student processing OFF.");
  ok(`AI provider: OpenAI · model ${config.openai.model} · reasoning effort ${config.openai.reasoningEffort} · key present (not shown)`);
  if (config.openai.model !== RECOMMENDED_OPENAI_MODEL) info(`! The configured model is not the verified pilot model (${RECOMMENDED_OPENAI_MODEL}). Its pricing may be unverified; the cost estimate then uses a conservative fallback rate.`);
  info(`Bounded: max output tokens ${config.limits.maxOutputTokens}, input ≤ ${config.limits.maxInputChars} chars, timeout ${config.limits.timeoutMs / 1000}s, attempts forced to 1 for this pilot.`);
  return config;
}

function waitForEnter(message: string): Promise<void> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(message, () => {
      rl.close();
      resolve();
    });
  });
}
function ask(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (a) => {
      rl.close();
      resolve(a.trim());
    });
  });
}
function promptHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const internal = rl as unknown as { _writeToOutput: (s: string) => void };
    internal._writeToOutput = (s: string) => {
      if (s.includes(question)) process.stdout.write(question);
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer.trim());
    });
  });
}

/** The QA service key — used ONLY to mint the QA counsellor's one-time session below. Never saved or printed. */
async function obtainServiceKey(ref: string): Promise<string> {
  let key: string;
  if (args.has("--key-from-clipboard")) {
    await waitForEnter("Copy the QA service_role / sb_secret_ key from Supabase (QA project!), then press ENTER. ");
    try {
      const taken = takeKeyFromClipboard();
      key = taken.key;
      console.log(taken.cleared ? "✓ Key read from the clipboard; clipboard cleared." : "! Key read, but clearing the clipboard could not be confirmed — clear it manually (and Win+V history).");
    } catch (error) {
      fail(error instanceof ClipboardError ? error.message : "Could not read the clipboard.");
    }
  } else {
    key = normaliseKey(process.env.SUPABASE_SERVICE_ROLE_KEY);
    if (!key) key = normaliseKey(await promptHidden("QA service-role key (hidden, not saved): "));
  }
  const format = checkKeyFormat(key, ref);
  if (!format.ok) fail(format.reason);
  const auth = await verifyKeyWithProject(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", key);
  if (!auth.ok) fail(auth.reason);
  ok(`Supabase key accepted by QA project ${ref} (used only to open the counsellor's session).`);
  return key;
}

async function findUserByEmail(admin: SupabaseClient, email: string): Promise<User | null> {
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) fail(`Could not list Auth users (${error.status ?? ""} ${error.code ?? error.name}).`);
    const hit = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (hit) return hit;
    if (data.users.length < 200) return null;
  }
  return null;
}

async function counsellorSession(admin: SupabaseClient, email: string): Promise<SupabaseClient<Database>> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  if (!publishable) fail("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or _ANON_KEY) is not set in .env.local.");
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const tokenHash = data?.properties?.hashed_token;
  if (error || !tokenHash) fail(`Could not open a session for ${email}.`);
  const client = createClient<Database>(url, publishable, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error: verifyError } = await client.auth.verifyOtp({ type: "magiclink", token_hash: tokenHash });
  if (verifyError) fail(`Could not open a session for ${email}.`);
  return client;
}

// ─── Gateway: the same RPCs as src/lib/supabase/admin/career-intelligence.ts ─

function scriptGateway(db: SupabaseClient<Database>, counsellorUserId: string, studentUserId: string): CareerIntelligenceGateway {
  const server = db as unknown as Parameters<typeof fetchStudentProfileSnapshotByUserId>[0];
  return {
    async getStaff() {
      const { data } = await db.from("admin_roles").select("role").eq("user_id", counsellorUserId).maybeSingle();
      return data?.role ? { userId: counsellorUserId, role: data.role as "counsellor" } : null;
    },
    async hasCaseAccess(id) {
      const { data, error } = await db.rpc("counsellor_has_case_access", { p_student_user_id: id });
      return !error && data === true;
    },
    // Only fictional students reach this script (checked before), so entitlement is never consulted.
    hasPaidCareerEntitlement: async () => false,
    classifyStudentData: async (id) => (id === studentUserId ? "fictional" : "real_student"),
    loadSnapshot: async (id) => fetchStudentProfileSnapshotByUserId(server, id).catch(() => null),
    loadCatalogue: () => getCareersForMatching(server),
    async loadProvenance(id) {
      const { data, error } = await db.from("student_profile_section_provenance").select("section_key, provenance").eq("student_user_id", id);
      if (error) return null;
      const out: Partial<Record<ProfileSectionKey, ProvenanceValue>> = {};
      for (const r of data ?? []) out[r.section_key as ProfileSectionKey] = r.provenance as ProvenanceValue;
      return out;
    },
    async getConsent(id): Promise<ConsentStatus> {
      const { data, error } = await db
        .from("student_ai_processing_consents")
        .select("id, consenting_party, method, evidence_reference, given_on, recorded_at, withdrawn_at")
        .eq("student_user_id", id)
        .eq("scope", "career_intelligence")
        .order("recorded_at", { ascending: false })
        .limit(5);
      if (error) return { status: "unavailable" };
      const active = (data ?? []).find((r) => r.withdrawn_at === null);
      if (active) {
        return {
          status: "valid",
          consentId: active.id,
          consentingParty: active.consenting_party as "student",
          method: active.method,
          evidenceReference: active.evidence_reference,
          givenOn: active.given_on,
          recordedAt: active.recorded_at,
          recordedByName: null,
        };
      }
      const latest = (data ?? [])[0];
      return latest?.withdrawn_at ? { status: "withdrawn", withdrawnAt: latest.withdrawn_at } : { status: "missing" };
    },
    async reserveRun(a): Promise<ReserveResult> {
      const { data, error } = await db.rpc("staff_reserve_ai_generation_run_v2", {
        p_student_user_id: a.studentUserId,
        p_idempotency_key: a.idempotencyKey,
        p_provider: a.provider,
        p_model: a.model,
        p_prompt_version: a.promptVersion,
        p_report_schema_version: a.reportSchemaVersion,
        p_data_class: a.dataClass,
        p_consent_id: a.consentId,
        p_worst_case_cost_usd: a.worstCaseCostUsd,
        p_limit_staff_daily: a.limits.perStaffDaily,
        p_limit_student_daily: a.limits.perStudentDaily,
        p_limit_global_daily: a.limits.globalDaily,
        p_monthly_budget_usd: a.limits.monthlyBudgetUsd,
        p_paid_max_runs: Math.min(a.paid.maxRuns, PILOT_MAX_CALLS),
        p_paid_total_budget_usd: Math.min(a.paid.totalBudgetUsd, PILOT_MAX_USD),
        p_regenerates_run_id: a.regeneratesRunId,
        p_regeneration_reason: a.regenerationReason,
      });
      if (error) return { kind: "denied", reason: `The reservation was refused by the database (${error.code ?? "error"}: ${error.message}).` };
      const row = (data ?? [])[0];
      if (!row) return { kind: "denied", reason: "The reservation returned no row." };
      if (row.outcome === "duplicate" && row.run_id) return { kind: "duplicate", runId: row.run_id, status: row.existing_status ?? "unknown", draftId: row.existing_draft_id };
      if (row.outcome === "reserved" && row.run_id) return { kind: "reserved", runId: row.run_id };
      return { kind: "denied", reason: row.denial_reason ?? "Limit reached." };
    },
    async completeRun(runId, c) {
      const { error } = await db.rpc("staff_complete_ai_generation_run_v2", {
        p_run_id: runId,
        p_status: c.status,
        p_reason: c.reason,
        p_model: c.model,
        p_input_tokens: c.inputTokens,
        p_output_tokens: c.outputTokens,
        p_cached_input_tokens: c.cachedInputTokens ?? 0,
        p_reasoning_tokens: c.reasoningTokens ?? 0,
        p_estimated_cost_usd: c.estimatedCostUsd,
        p_attempts: c.attempts,
        p_latency_ms: c.latencyMs,
        p_provider_response_id: c.providerResponseId ?? null,
        p_report: (c.report as unknown as Json) ?? null,
      });
      if (error) console.error(`! Recording the run outcome failed (${error.code ?? "error"}). The run stays "reserved" and expires after 15 minutes; it still counts toward the pilot cap.`);
    },
    async createDraft({ studentUserId: id, title, content }) {
      const { data, error } = await db.rpc("staff_create_recommendation_draft", { p_student_user_id: id, p_title: title, p_recommendation_type: "career", p_content: content as unknown as Json });
      const draftId = rpcRowId(data);
      if (error || !draftId) throw new Error(`The draft could not be created (${error?.code ?? "no id"}).`);
      return draftId;
    },
    async linkDraft(runId, draftId) {
      const { error } = await db.rpc("staff_link_ai_generation_run_draft", { p_run_id: runId, p_draft_id: draftId });
      if (error) console.error(`! Linking the run to its draft failed (${error.code ?? "error"}).`);
    },
    async audit(action, id, context) {
      await db.rpc("record_admin_audit_log", { p_action: action, p_entity_type: "student", p_entity_id: id, p_summary: `${action} (NW09.2 QA live pilot script)`, p_changes: null, p_context: { ...context, source: "nw09-openai-pilot" } as unknown as Json });
    },
  };
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\nNW09.2 OpenAI pilot — ${LIVE ? "LIVE API TEST (one paid request)" : "PREFLIGHT ONLY (no OpenAI call)"}\n`);
  const ref = assertQaTarget();
  ok(`Target: Supabase project ${ref} (Nextwise-Development-QA). Production (${KNOWN_PRODUCTION_REFS.join(", ")}) is refused.`);
  const config = checkAiConfig();
  const pilotConfig: AiConfig = { ...config, limits: { ...config.limits, maxAttempts: 1 } };

  const entries = readLedger();
  const totals = ledgerTotals(entries);
  const worstCase = worstCaseCostUsd("openai", config.openai.model, config.limits.maxInputChars, config.limits.maxOutputTokens, config);
  ok(`Local ledger: ${totals.calls} of ${PILOT_MAX_CALLS} calls used · est. $${totals.usd.toFixed(4)} of $${PILOT_MAX_USD.toFixed(2)} · worst case of the next call $${worstCase.toFixed(4)}`);
  if (totals.calls >= PILOT_MAX_CALLS) fail(`The pilot's ${PILOT_MAX_CALLS}-call limit has been reached (local ledger). Stop here and report.`);
  if (totals.usd + worstCase > PILOT_MAX_USD) fail(`The next call could exceed the $${PILOT_MAX_USD.toFixed(2)} pilot budget (local ledger). Stop here and report.`);

  const serviceKey = await obtainServiceKey(ref);
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const studentEmail = (argValue("--student") ?? DEFAULT_STUDENT_EMAIL).toLowerCase();
  const [counsellorUser, studentUser] = await Promise.all([findUserByEmail(admin, COUNSELLOR_EMAIL), findUserByEmail(admin, studentEmail)]);
  if (!counsellorUser || (counsellorUser.app_metadata as Record<string, unknown> | undefined)?.test_account !== TEST_MARKER) fail(`${COUNSELLOR_EMAIL} is not a seeded QA test account. Run: npm run dev:test-counsellor -- --qa --key-from-clipboard`);
  if (!studentUser || (studentUser.app_metadata as Record<string, unknown> | undefined)?.test_account !== TEST_MARKER) fail(`${studentEmail} is not a seeded fictional QA test account.`);
  if (!isFictionalStudent(config, studentUser.id, studentUser.email ?? null)) fail(`${studentEmail} is not listed in AI_FICTIONAL_STUDENT_IDS (or its e-mail domain is not a fictional test domain). Only fictional students may be used.`);
  ok(`Student: ${studentEmail} — seeded fictional QA account.`);

  const db = await counsellorSession(admin, COUNSELLOR_EMAIL);
  ok(`Signed in as ${COUNSELLOR_EMAIL} (one-time session; every write below runs as the counsellor through RLS).`);
  const gw = scriptGateway(db, counsellorUser.id, studentUser.id);

  // Read-only preflight through the same gateway.
  const snapshot = await gw.loadSnapshot(studentUser.id);
  if (!snapshot) fail("The student's profile could not be read as the counsellor (assignment / RLS).");
  const dob = snapshot.profile.dateOfBirth ? Date.parse(snapshot.profile.dateOfBirth) : NaN;
  if (!Number.isFinite(dob) || (Date.now() - dob) / (365.25 * 86400000) < 18) fail("The pilot student must be an ADULT (date of birth on the fictional profile, 18+).");
  const catalogue = await gw.loadCatalogue();
  const prepared = prepareAnalysis({ snapshot, catalogue });
  if (!prepared.assessment.ready) fail(`The fictional profile is not ready: missing ${prepared.assessment.missing.join(", ")}.`);
  if (prepared.candidates.length === 0) fail("No catalogue candidates for this profile (is the career catalogue seeded in QA?).");
  ok(`Profile ready · ${prepared.candidates.length} catalogue candidates (of ${catalogue.length} careers).`);
  const consent = await gw.getConsent(studentUser.id);
  if (consent.status === "unavailable") fail("The consent register is not available — apply NW09_2_openai_live_pilot.sql to QA first, then run the readiness check.");
  if (consent.status !== "valid") fail(`No valid recorded consent for the student (${consent.status}). Record it in the Counsellor Studio AI workspace (method: "Fictional test account").`);
  ok(`Consent recorded: ${consent.method} · evidence ${consent.evidenceReference} · given ${consent.givenOn}.`);
  const { data: usage, error: usageError } = await db.rpc("staff_get_ai_usage_summary");
  if (usageError || !usage?.[0]) fail(`The usage summary RPC failed (${usageError?.code ?? "no row"}) — NW09.2 not applied?`);
  const u = usage[0];
  ok(`Database pilot totals: ${u.paid_runs_total} of ${Math.min(u.paid_max_runs, PILOT_MAX_CALLS)} paid analyses · est. $${Number(u.paid_cost_total_usd).toFixed(4)} of $${Math.min(Number(u.paid_total_budget_usd), PILOT_MAX_USD).toFixed(2)} · real-student processing approved in DB: ${u.real_student_processing_approved ? "YES (unexpected for the pilot)" : "no"}`);
  if (u.paid_runs_total >= Math.min(u.paid_max_runs, PILOT_MAX_CALLS)) fail("The database pilot cap on analyses has been reached. Stop here and report.");

  if (!LIVE) {
    console.log("\nPREFLIGHT PASSED — nothing was sent to OpenAI and nothing was written.");
    console.log("To run the single paid live test, re-run with -LiveApiTest (PowerShell) / --live-api-test.\n");
    return;
  }

  console.log(`\nAbout to send ONE request to OpenAI (${config.openai.model}). Worst-case cost ≈ $${worstCase.toFixed(4)}. Nothing is retried.`);
  const typed = await ask(`Type "${CONFIRM_PHRASE}" to continue: `);
  if (typed !== CONFIRM_PHRASE) fail("Not confirmed. No request was sent.");

  const provider = getAiProvider(pilotConfig, mockCareerAnalyst);
  if (!provider || provider.name !== "openai") fail("The OpenAI provider could not be constructed. No request was sent.");

  const started: LedgerEntry = { at: new Date().toISOString(), status: "started", model: config.openai.model, worstCaseUsd: worstCase, estimatedUsd: null, inputTokens: 0, outputTokens: 0, responseId: null, outcome: "started" };
  writeLedger([...entries, started]);
  const idempotencyKey = `nw092pilot${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`.slice(0, 40).padEnd(16, "0");
  const t0 = Date.now();
  const outcome = await requestCareerAnalysis({ studentUserId: studentUser.id, idempotencyKey }, gw, { config: pilotConfig, provider });
  const seconds = ((Date.now() - t0) / 1000).toFixed(1);
  const ui = describeOutcome(outcome);

  const reachedProvider = outcome.kind === "draft_created" || (outcome.kind === "not_generated" && outcome.runId !== null && outcome.outcome.kind === "failed");
  const finish = (patch: Partial<LedgerEntry>) => writeLedger([...entries, { ...started, ...patch }]);
  const evidence: Record<string, unknown> = { at: started.at, target: ref, provider: "openai", configuredModel: config.openai.model, outcome: outcome.kind, seconds: Number(seconds) };

  console.log("\n──────── RESULT ────────");
  if (outcome.kind === "draft_created") {
    const g = outcome.report.generation;
    const schemaValid = CareerIntelligenceReportSchema.safeParse(outcome.report).success;
    const catalogueIds = new Set(catalogue.map((c) => c.id));
    const allInCatalogue = outcome.report.careers.every((c) => catalogueIds.has(c.careerId));
    finish({ status: "succeeded", estimatedUsd: g.estimatedCostUsd, inputTokens: g.inputTokens, outputTokens: g.outputTokens, responseId: g.providerResponseId, outcome: "draft_created" });
    Object.assign(evidence, { answeredModel: g.model, responseId: g.providerResponseId, tokens: { input: g.inputTokens, output: g.outputTokens, cached: g.cachedInputTokens, reasoning: g.reasoningTokens }, estimatedCostUsd: g.estimatedCostUsd, attempts: g.attempts, latencyMs: g.latencyMs, schemaVersion: outcome.report.schemaVersion, schemaValid, careers: outcome.report.careers.map((c) => ({ careerId: c.careerId, title: c.title })), allCareersInCatalogue: allInCatalogue, runId: outcome.runId, draftId: outcome.draftId });
    ok("Status: SUCCEEDED — a real OpenAI response was received, validated and saved as a DRAFT.");
    info(`Provider / model answered: openai / ${g.model}`);
    info(`Response id: ${g.providerResponseId ?? "(not returned)"}`);
    info(`Tokens: ${g.inputTokens} in (${g.cachedInputTokens} cached) · ${g.outputTokens} out (${g.reasoningTokens} reasoning) · attempts ${g.attempts} · ${seconds}s`);
    info(`Estimated cost: $${g.estimatedCostUsd.toFixed(6)} (estimate — the OpenAI dashboard is authoritative)`);
    info(`Schema ${outcome.report.schemaVersion}: ${schemaValid ? "valid" : "INVALID"} · careers ${outcome.report.careers.length}, all from the catalogue: ${allInCatalogue ? "yes" : "NO"}`);
    for (const c of outcome.report.careers) info(`  - ${c.title}`);
    info(`Ledger run: ${outcome.runId} · Draft: ${outcome.draftId} (status: draft — not submitted, approved or released)`);
    info(`Open: http://localhost:3000/counsellor/students/${studentUser.id}/ai-career-intelligence`);
  } else {
    const failed = outcome.kind === "not_generated" && outcome.outcome.kind === "failed" ? outcome.outcome : null;
    finish({
      status: reachedProvider ? "failed" : "not_called",
      estimatedUsd: failed ? failed.estimatedCostUsd : reachedProvider ? null : 0,
      inputTokens: failed?.usage?.inputTokens ?? 0,
      outputTokens: failed?.usage?.outputTokens ?? 0,
      responseId: failed?.responseId ?? null,
      outcome: failed ? `${failed.status}${failed.errorKind ? ` (${failed.errorKind})` : ""}` : outcome.kind,
    });
    Object.assign(evidence, { failure: failed ? { status: failed.status, errorKind: failed.errorKind ?? null, attempts: failed.attempts, tokens: failed.usage, responseId: failed.responseId ?? null } : null, message: ui.error });
    console.log(`✗ Status: NOT GENERATED (${outcome.kind}${failed ? ` · ${failed.status}${failed.errorKind ? ` · ${failed.errorKind}` : ""}` : ""})`);
    info(ui.error ?? "");
    info(reachedProvider ? "The request reached OpenAI and may have been billed; it is counted in both ledgers." : "No request was sent to OpenAI; nothing was billed.");
  }
  mkdirSync(PILOT_DIR, { recursive: true });
  const evidencePath = path.join(PILOT_DIR, `evidence-${started.at.replace(/[:.]/g, "-")}.json`);
  writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(`\nEvidence (no key, no profile content): ${evidencePath}`);
  const after = ledgerTotals(readLedger());
  console.log(`Local ledger now: ${after.calls} of ${PILOT_MAX_CALLS} calls · est. $${after.usd.toFixed(4)} of $${PILOT_MAX_USD.toFixed(2)}\n`);
  process.exit(outcome.kind === "draft_created" ? 0 : 2);
}

main().catch((error: unknown) => {
  // Never print an error object wholesale (it could carry request details); name + message only, without any key.
  const message = error instanceof Error ? `${error.name}: ${error.message}` : "unknown error";
  console.error(`\n✗ Pilot aborted: ${message.replace(/sk-[A-Za-z0-9_-]{8,}/g, "sk-…")}\n`);
  process.exit(1);
});
