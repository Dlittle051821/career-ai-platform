import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { resolveAiConfig } from "@/lib/ai/config";
import { createOpenAiProvider, type OpenAiResponseLike, type OpenAiResponsesLike } from "@/lib/ai/providers/openai";
import { evaluationCatalogue } from "./evaluation/catalogue";
import { EVALUATION_PROFILES } from "./evaluation/profiles";
import { PILOT_PROFILE } from "./evaluation/pilot-profile";
import { mockCareerAnalyst } from "./mock-analyst";
import { describeOutcome } from "./messages";
import { prepareAnalysis } from "./pipeline";
import { CareerIntelligenceReportSchema } from "./schema";
import { requestCareerAnalysis, type CareerIntelligenceGateway, type ConsentStatus } from "./service";
import { buildAnalysisView, buildSnapshotRows, buildUsageView, computeGates, formatUsd, generateDisabledReason, runProviderLabel, workflowSteps, type GateInput } from "./workspace";

/**
 * NW09.2 — the OpenAI path end to end through the real service and pipeline,
 * with the SDK client faked (no network, no cost), plus the workspace view
 * logic and static audits of the UI, actions and proposed SQL.
 */

const MODEL = "gpt-6.1-terra";
const STUDENT = "22222222-2222-4222-8222-222222222222";
const KEY = "b".repeat(32);
const catalogue = evaluationCatalogue();
const profile = (id: string) => EVALUATION_PROFILES.find((p) => p.id === id)!.snapshot;
const openaiConfig = (over: Record<string, string> = {}) =>
  resolveAiConfig({ NODE_ENV: "development", AI_PROVIDER: "openai", OPENAI_API_KEY: "sk-test-not-real", AI_OPENAI_APPROVED: "true", AI_OPENAI_MODEL: MODEL, ...over });

const VALID: ConsentStatus = {
  status: "valid",
  consentId: "33333333-3333-4333-8333-333333333333",
  consentingParty: "student",
  method: "fictional_test_account",
  evidenceReference: "QA-PILOT-001",
  givenOn: "2026-11-06",
  recordedAt: "2026-11-06T09:00:00Z",
  recordedByName: null,
};

/** A fake OpenAI client that answers like the real Responses API, using the deterministic analyst for the content. */
function fakeOpenAi(over: (body: Record<string, unknown>) => Partial<OpenAiResponseLike> | Error = () => ({})) {
  const create = vi.fn(async (body: Record<string, unknown>) => {
    const o = over(body);
    if (o instanceof Error) throw o;
    const text = JSON.stringify(mockCareerAnalyst(JSON.parse(String(body.input))));
    return {
      id: "resp_pilot_001",
      status: "completed",
      model: `${MODEL}-2026-10-26`,
      output: [{ type: "message", content: [{ type: "output_text", text }] }],
      usage: { input_tokens: 5000, output_tokens: 2500, input_tokens_details: { cached_tokens: 0 }, output_tokens_details: { reasoning_tokens: 600 } },
      ...o,
    } as OpenAiResponseLike;
  });
  return { create, provider: createOpenAiProvider({ responses: { create } } as unknown as OpenAiResponsesLike, MODEL, { reasoningEffort: "low" }) };
}

function gateway(over: Partial<CareerIntelligenceGateway> = {}) {
  const gw: CareerIntelligenceGateway = {
    getStaff: async () => ({ userId: "staff-1", role: "counsellor" }),
    hasCaseAccess: async () => true,
    classifyStudentData: async () => "fictional",
    hasPaidCareerEntitlement: async () => false,
    loadSnapshot: async () => profile("computer-science"),
    loadCatalogue: async () => catalogue,
    loadProvenance: async () => ({ education: "COUNSELLOR_VERIFIED" }),
    getConsent: async () => VALID,
    reserveRun: vi.fn(async () => ({ kind: "reserved" as const, runId: "run-9" })),
    completeRun: vi.fn(async () => {}),
    finalizeRun: vi.fn(async () => ({ kind: "finalized" as const, draftId: "draft-9" })),
    audit: vi.fn(async () => {}),
    ...over,
  };
  return gw;
}
const input = { studentUserId: STUDENT, idempotencyKey: KEY };

describe("OpenAI through the real service — fictional pilot student", () => {
  it("one paid call → validated v2 report → ordinary NW07 draft; ledger gets tokens, cost and the response id", async () => {
    const { create, provider } = fakeOpenAi();
    const gw = gateway();
    const o = await requestCareerAnalysis(input, gw, { config: openaiConfig(), provider });
    expect(o.kind).toBe("draft_created");
    expect(create).toHaveBeenCalledTimes(1);
    expect((create.mock.calls[0] as unknown[])[0]).toMatchObject({ model: MODEL, store: false, text: { format: { type: "json_schema", strict: true } } });
    expect(gw.reserveRun).toHaveBeenCalledWith(expect.objectContaining({ provider: "openai", model: MODEL, dataClass: "fictional", consentId: VALID.status === "valid" ? VALID.consentId : "", paid: { maxRuns: 5, totalBudgetUsd: 2 } }));
    expect(gw.finalizeRun).toHaveBeenCalledWith(expect.objectContaining({
      runId: "run-9", consentId: VALID.status === "valid" ? VALID.consentId : "",
      usage: expect.objectContaining({ inputTokens: 5000, outputTokens: 2500, reasoningTokens: 600, providerResponseId: "resp_pilot_001", attempts: 1, estimatedCostUsd: expect.any(Number) }),
    }));
    expect(gw.completeRun).not.toHaveBeenCalled();
    if (o.kind !== "draft_created") return;
    expect(CareerIntelligenceReportSchema.safeParse(o.report).success).toBe(true);
    expect(o.report.generation).toMatchObject({ provider: "openai", providerResponseId: "resp_pilot_001" });
    expect(o.report.generation.estimatedCostUsd).toBeGreaterThan(0);
    for (const c of o.report.careers) expect(catalogue.some((k) => k.id === c.careerId)).toBe(true);
    expect(o.report.inputProvenance.find((p) => p.section === "education")?.verification).toBe("verified");
    expect(gw.finalizeRun).toHaveBeenCalledWith(expect.objectContaining({ content: expect.objectContaining({ aiAssisted: true }) }));
    expect(describeOutcome(o).notice).toMatch(/OpenAI analysis complete/);
  });
  it("the pilot profile is a fictional ADULT with enough data for an analysis", () => {
    const dob = PILOT_PROFILE.snapshot.profile.dateOfBirth;
    expect(dob).toBeTruthy();
    const age = (Date.parse("2026-11-06") - Date.parse(dob!)) / (365.25 * 24 * 3600 * 1000);
    expect(age).toBeGreaterThanOrEqual(18);
    const prepared = prepareAnalysis({ snapshot: PILOT_PROFILE.snapshot, catalogue });
    expect(prepared.assessment.ready).toBe(true);
    expect(prepared.candidates.length).toBeGreaterThanOrEqual(3);
  });
});

describe("OpenAI — privacy and entitlement gates (all before any paid call)", () => {
  it("a REAL student is blocked until real-student processing is approved", async () => {
    const { create, provider } = fakeOpenAi();
    const gw = gateway({ classifyStudentData: async () => "real_student", hasPaidCareerEntitlement: async () => true });
    const o = await requestCareerAnalysis(input, gw, { config: openaiConfig(), provider });
    expect(o.kind).toBe("real_student_not_approved");
    expect(gw.reserveRun).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });
  it("with the application flag set, the request reaches the reservation (where the database flag is checked too)", async () => {
    const { provider } = fakeOpenAi();
    const gw = gateway({ classifyStudentData: async () => "real_student", hasPaidCareerEntitlement: async () => true });
    await requestCareerAnalysis(input, gw, { config: openaiConfig({ AI_REAL_STUDENT_DATA_APPROVED: "true" }), provider });
    expect(gw.reserveRun).toHaveBeenCalledWith(expect.objectContaining({ dataClass: "real_student" }));
  });
  it("a real student without a paid Career entitlement is blocked", async () => {
    const { create, provider } = fakeOpenAi();
    const gw = gateway({ classifyStudentData: async () => "real_student", hasPaidCareerEntitlement: async () => false });
    expect((await requestCareerAnalysis(input, gw, { config: openaiConfig({ AI_REAL_STUDENT_DATA_APPROVED: "true" }), provider })).kind).toBe("not_entitled");
    expect(create).not.toHaveBeenCalled();
  });
  it("no recorded consent → blocked, even for a fictional student", async () => {
    const { create, provider } = fakeOpenAi();
    const gw = gateway({ getConsent: async () => ({ status: "missing" }) });
    expect((await requestCareerAnalysis(input, gw, { config: openaiConfig(), provider })).kind).toBe("needs_consent");
    expect(create).not.toHaveBeenCalled();
  });
  it("students and non-staff roles cannot invoke it", async () => {
    const { create, provider } = fakeOpenAi();
    for (const staff of [null, { userId: "f", role: "finance" as const }]) {
      expect((await requestCareerAnalysis(input, gateway({ getStaff: async () => staff }), { config: openaiConfig(), provider })).kind).toBe("not_authorised");
    }
    expect(create).not.toHaveBeenCalled();
  });
  it("a pilot-limit denial from the database stops before the paid call", async () => {
    const { create, provider } = fakeOpenAi();
    const gw = gateway({ reserveRun: vi.fn(async () => ({ kind: "denied" as const, reason: "The paid AI pilot budget would be exceeded." })) });
    expect(await requestCareerAnalysis(input, gw, { config: openaiConfig(), provider })).toMatchObject({ kind: "limit_reached", reason: expect.stringMatching(/pilot budget/) });
    expect(create).not.toHaveBeenCalled();
  });
  it("a duplicate submit returns the original run without a second paid call", async () => {
    const { create, provider } = fakeOpenAi();
    const gw = gateway({ reserveRun: vi.fn(async () => ({ kind: "duplicate" as const, runId: "run-9", status: "succeeded", draftId: "draft-9" })) });
    expect((await requestCareerAnalysis(input, gw, { config: openaiConfig(), provider })).kind).toBe("duplicate");
    expect(create).not.toHaveBeenCalled();
  });
});

describe("OpenAI failures — recorded truthfully, no draft, no mock fallback", () => {
  const err = (status: number, code?: string) => Object.assign(new Error("raw provider message"), { status, code, error: { code } });
  it.each([
    ["billing", err(429, "insufficient_quota"), /billing|credit|quota/i, 1],
    ["auth", err(401, "invalid_api_key"), /key|authori/i, 1],
    ["model_unavailable", err(404, "model_not_found"), /model/i, 1],
    ["rate_limited", err(429, "rate_limit_exceeded"), /busy|rate|try again/i, 2],
  ] as const)("%s", async (kind, e, message, calls) => {
    const { create, provider } = fakeOpenAi(() => e);
    const gw = gateway();
    const o = await requestCareerAnalysis(input, gw, { config: openaiConfig(), provider });
    expect(o).toMatchObject({ kind: "not_generated", outcome: { kind: "failed", errorKind: kind } });
    expect(create).toHaveBeenCalledTimes(calls);
    expect(gw.completeRun).toHaveBeenCalledWith("run-9", expect.objectContaining({ status: "failed", reason: expect.stringContaining(`(${kind})`), report: null }));
    expect(gw.finalizeRun).not.toHaveBeenCalled();
    const ui = describeOutcome(o);
    expect(ui.error).toMatch(message);
    expect(ui.error).not.toContain("raw provider message");
  });
  it("a different model answering is a failure, not a silent switch", async () => {
    const { provider } = fakeOpenAi(() => ({ model: "gpt-5-mini" }));
    const gw = gateway();
    const o = await requestCareerAnalysis(input, gw, { config: openaiConfig(), provider });
    expect(o.kind).toBe("not_generated");
    expect(gw.finalizeRun).not.toHaveBeenCalled();
  });
  it("an answer that is not valid JSON is discarded after ONE paid call", async () => {
    const { create, provider } = fakeOpenAi(() => ({ output: [{ type: "message", content: [{ type: "output_text", text: "Sure! Here are some careers…" }] }] }));
    const gw = gateway();
    const o = await requestCareerAnalysis(input, gw, { config: openaiConfig(), provider });
    expect(o).toMatchObject({ kind: "not_generated", outcome: { kind: "failed", status: "invalid_output" } });
    expect(create).toHaveBeenCalledTimes(1);
    expect(gw.completeRun).toHaveBeenCalledWith("run-9", expect.objectContaining({ status: "invalid_output", inputTokens: 5000, providerResponseId: "resp_pilot_001" }));
  });
});

// ─── Workspace view logic ────────────────────────────────────────────────────

const gateInput = (over: Partial<GateInput> = {}): GateInput => {
  const config = openaiConfig();
  return {
    config,
    dataClass: "fictional",
    consent: VALID,
    entitlement: null,
    usage: buildUsageView(config, { available: true, staffToday: 0, globalToday: 0, monthCostUsd: 0, paidRunsTotal: 1, paidCostTotalUsd: 0.03, db: { perStaffDaily: 20, perStudentDaily: 3, globalDaily: 100, monthlyBudgetUsd: 25, paidMaxRuns: 5, paidTotalBudgetUsd: 2, realStudentProcessingApproved: false } }, 0),
    databaseAvailable: true,
    profileReady: true,
    profileMissing: [],
    candidateCount: 4,
    ...over,
  };
};

describe("workspace gates — the Generate button is enabled only when every check passes", () => {
  it("all pass → enabled", () => {
    expect(generateDisabledReason(computeGates(gateInput()))).toBeNull();
  });
  it.each([
    ["no consent", { consent: { status: "missing" } as ConsentStatus }, /Consent/],
    ["consent register missing", { consent: { status: "unavailable" } as ConsentStatus }, /Consent/],
    ["database not applied", { databaseAvailable: false }, /Database/],
    ["profile not ready", { profileReady: false, profileMissing: ["Interests"] }, /Interests/],
    ["no candidates", { candidateCount: 0 }, /catalogue/],
    ["real student, no entitlement", { dataClass: "real_student" as const, entitlement: false }, /Entitlement/],
    ["real student, entitled, privacy not approved", { dataClass: "real_student" as const, entitlement: true }, /privacy review/],
  ])("%s → disabled", (_n, over, reason) => {
    expect(generateDisabledReason(computeGates(gateInput(over)))).toMatch(reason);
  });
  it("pilot run limit and budget come from the LOWER of app and database settings", () => {
    const config = openaiConfig({ AI_PAID_MAX_RUNS: "50" });
    const u = buildUsageView(config, { available: true, staffToday: 0, globalToday: 0, monthCostUsd: 0, paidRunsTotal: 5, paidCostTotalUsd: 0.1, db: { perStaffDaily: 20, perStudentDaily: 3, globalDaily: 100, monthlyBudgetUsd: 25, paidMaxRuns: 5, paidTotalBudgetUsd: 2, realStudentProcessingApproved: false } }, 0);
    expect(u.paidMaxRuns).toBe(5);
    expect(generateDisabledReason(computeGates(gateInput({ config, usage: u })))).toMatch(/pilot/);
  });
  it("Gemini never for a real student", () => {
    const config = resolveAiConfig({ NODE_ENV: "development", AI_PROVIDER: "gemini", GEMINI_API_KEY: "k" });
    expect(generateDisabledReason(computeGates(gateInput({ config, dataClass: "real_student", entitlement: true })))).toMatch(/Data policy/);
  });
  it("AI off → disabled with the configuration reason", () => {
    const config = resolveAiConfig({ NODE_ENV: "production" });
    expect(generateDisabledReason(computeGates(gateInput({ config })))).toMatch(/^Provider/);
  });
});

describe("workspace — values come from the ledger and the NW07 draft", () => {
  const run = { provider: "openai", model: `${MODEL}-2026-10-26`, createdAt: "2026-11-06T10:00:00Z", inputTokens: 5123, outputTokens: 2456, estimatedCostUsd: 0.018692, cachedInputTokens: 0, reasoningTokens: 610, providerResponseId: "resp_x" };
  it("“Live GPT” appears only for a run the ledger records as OpenAI; the model shown is the ledger's", async () => {
    const { provider } = fakeOpenAi();
    const o = await requestCareerAnalysis(input, gateway(), { config: openaiConfig(), provider });
    if (o.kind !== "draft_created") throw new Error(o.kind);
    const v = buildAnalysisView(run, o.report);
    expect(v.providerLabel).toBe(`OpenAI — Live GPT · ${MODEL}-2026-10-26`);
    expect(v.tokens).toEqual({ input: 5123, output: 2456, cached: 0, reasoning: 610 });
    expect(v.costLabel).toBe("$0.02");
    expect(v.responseIdRecorded).toBe(true);
    expect(buildAnalysisView({ ...run, provider: "mock", model: "mock-deterministic-v1" }, o.report).providerLabel).not.toMatch(/Live|OpenAI/);
    expect(runProviderLabel("gemini", "g")).toMatch(/fictional/);
  });
  it("career cards carry engine bands, never percentages", async () => {
    const { provider } = fakeOpenAi();
    const o = await requestCareerAnalysis(input, gateway(), { config: openaiConfig(), provider });
    if (o.kind !== "draft_created") throw new Error(o.kind);
    const json = JSON.stringify(buildAnalysisView(run, o.report).careers);
    expect(json).not.toMatch(/\d+\s?%/);
  });
  it("small real costs are never rounded to $0.00; unknown values say so", () => {
    expect(formatUsd(0.0042)).toBe("$0.0042");
    expect(formatUsd(null)).toBe("Not available");
  });
  it("workflow steps follow the real draft status", () => {
    const base = { profileReady: true, consentValid: true, analysis: { createdAt: "2026-11-06T10:00:00Z" } };
    const state = (status: string) => Object.fromEntries(workflowSteps({ ...base, draft: { status, submittedAt: null, approvedAt: null, releasedAt: null } }).map((s) => [s.key, s.state]));
    expect(state("draft")).toMatchObject({ analysis: "done", edit: "current", submitted: "pending", approved: "pending", released: "pending" });
    expect(state("submitted_for_review")).toMatchObject({ edit: "done", submitted: "current", approved: "pending" });
    expect(state("changes_requested")).toMatchObject({ edit: "attention" });
    expect(state("approved")).toMatchObject({ approved: "done", released: "current" });
    expect(state("released_to_student")).toMatchObject({ released: "done" });
    expect(Object.fromEntries(workflowSteps({ profileReady: true, consentValid: false, analysis: null, draft: null }).map((s) => [s.key, s.state]))).toMatchObject({ consent: "current", analysis: "pending" });
  });
  it("the profile snapshot shows no date of birth, gender, location or free text", () => {
    const rows = buildSnapshotRows(PILOT_PROFILE.snapshot);
    const text = JSON.stringify(rows);
    expect(rows.length).toBeGreaterThan(3);
    for (const v of [PILOT_PROFILE.snapshot.profile.dateOfBirth, PILOT_PROFILE.snapshot.profile.city, PILOT_PROFILE.snapshot.careerGoals?.dreamReason].filter(Boolean)) expect(text).not.toContain(String(v));
  });
});

// ─── Static audits ───────────────────────────────────────────────────────────

const ROOT = join(__dirname, "..", "..", "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
function walk(dir: string): string[] {
  return readdirSync(join(ROOT, dir)).flatMap((f) => {
    const rel = join(dir, f);
    return statSync(join(ROOT, rel)).isDirectory() ? walk(rel) : [rel];
  });
}

describe("static audit — no secrets in the browser, no hard-coded display values", () => {
  const uiFiles = [...walk("src/components/counsellor/ai"), "src/components/counsellor/CareerIntelligencePanel.tsx", "src/components/counsellor/CareerIntelligenceRequestForm.tsx", "src/app/counsellor/students/[studentId]/ai-career-intelligence/page.tsx"];
  it("no NEXT_PUBLIC AI key or key variable anywhere in src", () => {
    for (const f of walk("src").filter((x) => /\.(ts|tsx)$/.test(x) && !x.endsWith(".test.ts"))) {
      const s = read(f);
      expect(s, f).not.toMatch(/NEXT_PUBLIC_(OPENAI|GEMINI|AI_)/);
      if (!/src\/lib\/ai\/(get-provider|config)\.ts$/.test(f.replace(/\\/g, "/"))) expect(s, relative(ROOT, f)).not.toMatch(/process\.env\.OPENAI_API_KEY/);
    }
  });
  it.each(uiFiles)("%s holds no fixed model name, percentage score, cost or status", (f) => {
    const s = read(f);
    expect(s).not.toMatch(/gpt-\d/i);
    expect(s).not.toMatch(/\d{2}%\s*match/i);
    expect(s).not.toMatch(/\$\d+\.\d{2}(?!\$)/);
    expect(s).not.toMatch(/OPENAI_API_KEY/);
  });
  it("client components never import server-only AI modules", () => {
    for (const f of uiFiles.filter((x) => read(x).startsWith('"use client"'))) {
      expect(read(f), f).not.toMatch(/@\/lib\/ai\/get-provider|@\/lib\/supabase\/admin|server-only/);
    }
  });
  it("consent is never taken from a form checkbox any more", () => {
    expect(read("src/components/counsellor/CareerIntelligenceRequestForm.tsx")).not.toMatch(/aiConsent|<Checkbox/);
    expect(read("src/app/counsellor/students/actions.ts")).not.toMatch(/aiConsent|consentConfirmed/);
  });
});

describe("static audit — proposed NW09.2 SQL", () => {
  const sql = read("supabase/migrations-proposed/NW09_2_openai_live_pilot.sql");
  const body = sql.replace(/^--.*$/gm, "");
  it("fails fast when NW07 / NW09 are missing", () => {
    expect(body).toMatch(/raise exception 'NW09\.2 requires NW07/);
    expect(body).toMatch(/raise exception 'NW09\.2 requires NW09/);
  });
  it("every new function is SECURITY DEFINER with a pinned search_path and EXECUTE revoked from public", () => {
    const fns = [...body.matchAll(/create or replace function public\.(\w+)\(/g)].map((m) => m[1]);
    expect(fns).toEqual(expect.arrayContaining(["staff_record_ai_processing_consent", "staff_withdraw_ai_processing_consent", "staff_reserve_ai_generation_run_v2", "staff_complete_ai_generation_run_v2", "staff_get_ai_usage_summary"]));
    for (const fn of fns) expect(body).toMatch(new RegExp(`revoke execute on function public\\.${fn}\\([^)]*\\) from public`));
    expect((body.match(/security definer/g) ?? []).length).toBe(fns.length);
    expect((body.match(/set search_path = public/g) ?? []).length).toBe(fns.length);
  });
  it("closes the v1 boolean-consent RPCs, adds no student policy, and grants nothing to anon", () => {
    expect(body).toMatch(/revoke execute on function public\.staff_reserve_ai_generation_run\(uuid[^)]*boolean[^)]*\) from authenticated/);
    expect(body).toMatch(/revoke execute on function public\.staff_complete_ai_generation_run\([^)]*\) from authenticated/);
    expect(body).not.toMatch(/to anon/);
    expect(body).not.toMatch(/auth\.uid\(\)\s*=\s*student_user_id/);
    expect(body).toMatch(/enable row level security/);
  });
  it("enforces recorded consent, one analysis in progress, the real-student gate and all-time pilot caps in the reservation", () => {
    expect(body).toMatch(/No valid recorded AI-processing consent/);
    expect(body).toMatch(/fictional-test-account consent cannot cover a real student/);
    expect(body).toMatch(/already in progress/);
    expect(body).toMatch(/real_student_processing_approved is distinct from true/);
    expect(body).toMatch(/least\(coalesce\(p_paid_max_runs, 0\), v_settings\.paid_max_runs\)/);
    expect(body).toMatch(/least\(coalesce\(p_paid_total_budget_usd, 0\), v_settings\.paid_total_budget_usd\)/);
    expect(body).toMatch(/one_active[\s\S]*where withdrawn_at is null/);
  });
  it("defaults: 5 paid runs, $2.00, real-student processing OFF", () => {
    expect(body).toMatch(/paid_max_runs integer not null default 5/);
    expect(body).toMatch(/paid_total_budget_usd numeric\(10, 2\) not null default 2\.00/);
    expect(body).toMatch(/real_student_processing_approved boolean not null default false/);
  });
});

describe("static audit — live pilot scripts", () => {
  const pilot = read("scripts/dev/nw09-openai-pilot.ts");
  const verify = read("scripts/dev/nw09-verify-workflow.ts");
  const appGateway = read("src/lib/supabase/admin/career-intelligence.ts");
  it("the pilot's gateway calls exactly the RPCs the app's gateway calls", () => {
    const rpcs = (s: string) => new Set([...s.matchAll(/\.rpc\("([a-z_0-9]+)"/g)].map((m) => m[1]));
    const app = rpcs(appGateway);
    for (const name of ["counsellor_has_case_access", "staff_reserve_ai_generation_run_v2", "staff_complete_ai_generation_run_v2", "staff_finalize_ai_generation_run"]) {
      expect(app.has(name), name).toBe(true);
      expect(rpcs(pilot).has(name), name).toBe(true);
    }
    expect(pilot).not.toMatch(/staff_reserve_ai_generation_run"/);
    for (const source of [pilot, appGateway]) expect(source).not.toMatch(/\.rpc\("staff_(create_recommendation_draft|link_ai_generation_run_draft)"/);
  });
  it("both scripts accept only the QA project ref and refuse production / Vercel environments", () => {
    for (const s of [pilot, verify]) {
      expect(s).toMatch(/checkQaTarget\(/);
      expect(s).toMatch(/KNOWN_PRODUCTION_REFS/);
      expect(s).toMatch(/process\.env\.VERCEL_ENV/);
      expect(s).toMatch(/--qa/);
    }
  });
  it("the pilot needs --live-api-test AND a typed confirmation, forces one attempt, and keeps a local budget ledger", () => {
    expect(pilot).toMatch(/const LIVE = args\.has\("--live-api-test"\)/);
    expect(pilot).toMatch(/if \(!LIVE\) \{/);
    expect(pilot).toMatch(/CONFIRM_PHRASE = "RUN 1 PAID CALL"/);
    expect(pilot).toMatch(/maxAttempts: 1/);
    expect(pilot).toMatch(/PILOT_MAX_CALLS = 5/);
    expect(pilot).toMatch(/PILOT_MAX_USD = 2\.0/);
    expect(pilot).toMatch(/isFictionalStudent\(/);
  });
  it("neither script prints, logs or writes the OpenAI key", () => {
    for (const s of [pilot, verify]) {
      expect(s).not.toMatch(/console\.(log|error|info)\([^)]*OPENAI_API_KEY/);
      expect(s).not.toMatch(/writeFileSync\([^)]*(OPENAI_API_KEY|serviceKey|apiKey)/);
    }
    expect(verify).not.toMatch(/insert\(|update\(|delete\(|upsert\(|staff_(reserve|complete|create|record|withdraw)/);
  });
});

describe("NW-F01-S4 atomic consent and outcome recording", () => {
  it("withdrawal after the application precheck is decided by finalization; usage is retained there", async () => {
    const { create, provider } = fakeOpenAi();
    const gw = gateway({ getConsent: vi.fn(async () => VALID), finalizeRun: vi.fn(async () => ({ kind: "consent_withdrawn" as const })) });
    const result = await requestCareerAnalysis(input, gw, { config: openaiConfig(), provider });
    expect(result.kind).toBe("needs_consent");
    expect(gw.getConsent).toHaveBeenCalledTimes(1); // precheck cannot authorize persistence
    expect(gw.finalizeRun).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      runId: "run-9", studentUserId: STUDENT, consentId: VALID.status === "valid" ? VALID.consentId : "",
      usage: expect.objectContaining({ inputTokens: 5000, providerResponseId: "resp_pilot_001" }),
    }));
    expect(gw.completeRun).not.toHaveBeenCalled(); expect(create).toHaveBeenCalledTimes(1);
  });
  it("an unknown finalization commit result is never overwritten or reported as success", async () => {
    const { create, provider } = fakeOpenAi();
    const gw = gateway({ finalizeRun: vi.fn(async () => { throw new Error("offline transport failure"); }) });
    await expect(requestCareerAnalysis(input, gw, { config: openaiConfig(), provider })).rejects.toThrow("offline transport failure");
    expect(gw.completeRun).not.toHaveBeenCalled(); expect(create).toHaveBeenCalledTimes(1);
    expect(gw.audit).not.toHaveBeenCalled();
  });
  it("a finalization retry result returns the original draft without recording another success", async () => {
    const { provider } = fakeOpenAi();
    const gw = gateway({ finalizeRun: vi.fn(async () => ({ kind: "duplicate" as const, draftId: "original-draft" })) });
    expect(await requestCareerAnalysis(input, gw, { config: openaiConfig(), provider })).toMatchObject({ kind: "duplicate", draftId: "original-draft" });
    expect(gw.completeRun).not.toHaveBeenCalled(); expect(gw.audit).not.toHaveBeenCalled();
  });
});
