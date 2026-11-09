import "server-only";
import { createClient } from "../server";
import { getCurrentAdmin, requireAdminPermission } from "../admin-auth";
import { getServiceRoleClient, isServiceRoleConfigured } from "../service-role";
import { recordAuditLog } from "./audit";
import { getStudentProfileSnapshotForAdmin } from "./student-profile";
import { getCareersForMatching } from "../careers";
import { getSectionProvenanceMap } from "./profile-provenance";
import { classifyPurchaseEntitlements } from "@/lib/products/entitlements";
import { isFictionalStudent, type AiConfig } from "@/lib/ai/config";
import type { CareerIntelligenceGateway, ConsentStatus, ReserveResult } from "@/lib/career-intelligence/service";
import { CareerIntelligenceReportSchema, type CareerIntelligenceReport } from "@/lib/career-intelligence/schema";
import type { Json } from "@/types/database";
import type { PricingCategory, PricingPurchase } from "@/types/pricing";

/**
 * NW09 — Supabase implementation of CareerIntelligenceGateway, plus the
 * staff-only reads the Counsellor Studio shows.
 *
 * Every read runs with the caller's own session (RLS applies: admins see
 * everything, a counsellor only students they have case access to). Every
 * write is an RPC that re-validates the caller in the database
 * (supabase/migrations-proposed/nw-f01-s3/02_nw09_2_replacement.sql).
 * No service-role key is used anywhere in this gateway.
 *
 * Database errors are logged WITHOUT request content (no profile data, no
 * prompt, no model output) and surfaced as a generic message.
 */
function logDbError(context: string, error: { code?: string; message?: string } | null) {
  console.error(`[admin/career-intelligence] ${context}: ${error?.code ?? "error"}`);
}

export class CareerIntelligenceUnavailableError extends Error {
  constructor() {
    super("AI Career Intelligence is not available yet — its database changes (NW07 and NW09 migrations) have not been applied.");
    this.name = "CareerIntelligenceUnavailableError";
  }
}

/** PostgREST/Postgres codes meaning "this table/function does not exist" (migration not applied). */
function isMissingObject(error: { code?: string } | null): boolean {
  return Boolean(error?.code && ["42P01", "42883", "42703", "PGRST202", "PGRST204", "PGRST205"].includes(error.code));
}

type ConsentRow = {
  id: string;
  consenting_party: string;
  method: string;
  evidence_reference: string;
  given_on: string;
  recorded_by: string | null;
  recorded_at: string;
  withdrawn_at: string | null;
};

const CONSENT_PARTIES = ["student", "parent_guardian", "student_and_parent_guardian"] as const;

/**
 * NW09.2 — the student's AI-processing consent as recorded in the consent
 * register (never a form checkbox). "unavailable" when the register does not
 * exist yet (NW09.2 migration not applied) or cannot be read: callers treat
 * that exactly like "missing" — no analysis.
 */
export async function readConsentStatus(studentUserId: string): Promise<ConsentStatus> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("student_ai_processing_consents")
    .select("id, consenting_party, method, evidence_reference, given_on, recorded_by, recorded_at, withdrawn_at")
    .eq("student_user_id", studentUserId)
    .eq("scope", "career_intelligence")
    .order("recorded_at", { ascending: false })
    .limit(5);
  if (error) {
    if (!isMissingObject(error)) logDbError("readConsentStatus", error);
    return { status: "unavailable" };
  }
  const rows = (data ?? []) as unknown as ConsentRow[];
  const active = rows.find((r) => r.withdrawn_at === null);
  if (active) {
    const party = CONSENT_PARTIES.find((p) => p === active.consenting_party);
    if (!party) return { status: "unavailable" };
    let recordedByName: string | null = null;
    if (active.recorded_by) {
      const { data: c } = await supabase.from("counsellors").select("display_name").eq("user_id", active.recorded_by).maybeSingle();
      recordedByName = (c?.display_name as string | null | undefined) ?? null;
    }
    return {
      status: "valid",
      consentId: active.id,
      consentingParty: party,
      method: active.method,
      evidenceReference: active.evidence_reference,
      givenOn: active.given_on,
      recordedAt: active.recorded_at,
      recordedByName,
    };
  }
  const latest = rows[0];
  if (latest?.withdrawn_at) return { status: "withdrawn", withdrawnAt: latest.withdrawn_at };
  return { status: "missing" };
}

export function createCareerIntelligenceGateway(config: AiConfig): CareerIntelligenceGateway {
  return {
    async getStaff() {
      const admin = await getCurrentAdmin();
      return admin ? { userId: admin.userId, role: admin.role } : null;
    },

    async hasCaseAccess(studentUserId) {
      const supabase = await createClient();
      const { data, error } = await supabase.rpc("counsellor_has_case_access", { p_student_user_id: studentUserId });
      if (error) {
        logDbError("counsellor_has_case_access", error);
        return false;
      }
      return data === true;
    },

    async classifyStudentData(studentUserId) {
      if (config.isProduction || config.fictional.studentIds.length === 0) return "real_student";
      const supabase = await createClient();
      const { data, error } = await supabase.from("profiles").select("email").eq("id", studentUserId).maybeSingle();
      if (error) {
        logDbError("classifyStudentData", error);
        return "real_student";
      }
      return isFictionalStudent(config, studentUserId, (data?.email as string | null) ?? null) ? "fictional" : "real_student";
    },

    async hasPaidCareerEntitlement(studentUserId) {
      // Same rule as the student's own entitlement check (NW05.6): a purchase
      // counts only when its plan is a Career category AND its invoice is 'paid'.
      const supabase = await createClient();
      const { data: purchases, error } = await supabase.from("pricing_purchases").select("id, plan_id, invoice_id").eq("student_user_id", studentUserId);
      if (error) {
        logDbError("hasPaidCareerEntitlement (pricing_purchases)", error);
        return null;
      }
      const rows = purchases ?? [];
      const planIds = Array.from(new Set(rows.map((r) => r.plan_id).filter((x): x is string => Boolean(x))));
      const invoiceIds = Array.from(new Set(rows.map((r) => r.invoice_id).filter((x): x is string => Boolean(x))));
      if (planIds.length === 0 || invoiceIds.length === 0) return false;
      const [plans, invoices] = await Promise.all([
        supabase.from("pricing_plans").select("id, category").in("id", planIds),
        supabase.from("invoices").select("id, status").in("id", invoiceIds),
      ]);
      if (plans.error || invoices.error) {
        logDbError("hasPaidCareerEntitlement (plans/invoices)", plans.error ?? invoices.error);
        return null;
      }
      const categoryByPlanId = new Map<string, PricingCategory>((plans.data ?? []).map((p) => [p.id as string, p.category as PricingCategory]));
      const paid = new Set<string>((invoices.data ?? []).filter((i) => i.status === "paid").map((i) => i.id as string));
      // The classifier reads only planId and invoiceId.
      const minimal = rows.map((r) => ({ id: r.id, planId: r.plan_id, invoiceId: r.invoice_id }) as unknown as PricingPurchase);
      return classifyPurchaseEntitlements(minimal, categoryByPlanId, paid).hasCareerEntitlement;
    },

    async loadSnapshot(studentUserId) {
      try {
        return await getStudentProfileSnapshotForAdmin(studentUserId);
      } catch {
        return null;
      }
    },

    loadCatalogue: () => getCareersForMatching(),

    async loadProvenance(studentUserId) {
      try {
        const map = await getSectionProvenanceMap(studentUserId);
        const out: Partial<Record<keyof typeof map, (typeof map)[keyof typeof map]["provenance"]>> = {};
        for (const [key, value] of Object.entries(map) as [keyof typeof map, (typeof map)[keyof typeof map]][]) out[key] = value.provenance;
        return out;
      } catch {
        return null;
      }
    },

    getConsent: (studentUserId) => readConsentStatus(studentUserId),

    async reserveRun(a): Promise<ReserveResult> {
      // Without the trusted finalization path a provider call could never be
      // persisted, so refuse before any tokens are spent (CC-16, F1).
      if (!isServiceRoleConfigured()) {
        return { kind: "denied", reason: "AI analysis is not configured on this server (trusted finalization unavailable)." };
      }
      const supabase = await createClient();
      const { data, error } = await supabase.rpc("staff_reserve_ai_generation_run_v2", {
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
        p_paid_max_runs: a.paid.maxRuns,
        p_paid_total_budget_usd: a.paid.totalBudgetUsd,
        p_regenerates_run_id: a.regeneratesRunId,
        p_regeneration_reason: a.regenerationReason,
      });
      if (error) {
        if (isMissingObject(error)) throw new CareerIntelligenceUnavailableError();
        logDbError("staff_reserve_ai_generation_run_v2", error);
        return { kind: "denied", reason: "The analysis could not be reserved. Please try again." };
      }
      const row = (data ?? [])[0];
      if (!row) return { kind: "denied", reason: "The analysis could not be reserved. Please try again." };
      if (row.outcome === "duplicate" && row.run_id) return { kind: "duplicate", runId: row.run_id, status: row.existing_status ?? "unknown", draftId: row.existing_draft_id };
      if (row.outcome === "reserved" && row.run_id) return { kind: "reserved", runId: row.run_id };
      return { kind: "denied", reason: row.denial_reason ?? "Limit reached." };
    },

    async completeRun(runId, c) {
      const supabase = await createClient();
      const { error } = await supabase.rpc("staff_complete_ai_generation_run_v2", {
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
      if (error) {
        logDbError("staff_complete_ai_generation_run_v2", error);
        throw new Error("The AI outcome could not be recorded. Do not retry the provider call.");
      }
    },

    async finalizeRun(a) {
      // CC-16 (F1): AI results are submitted only by this trusted server, with
      // the service-role key, on behalf of the staff user authenticated from
      // their own session here — never a client-supplied identity. The RPC
      // re-checks that user's role, case access, run ownership and consent.
      const admin = await getCurrentAdmin();
      if (!admin) throw new Error("The AI result could not be confirmed. Do not retry the provider call.");
      const trusted = getServiceRoleClient();
      if (!trusted) throw new CareerIntelligenceUnavailableError();
      const { data, error } = await trusted.rpc("staff_finalize_ai_generation_run", {
        p_requester_user_id: admin.userId,
        p_run_id: a.runId, p_student_user_id: a.studentUserId,
        p_consent_id: a.consentId, p_report: a.report as unknown as Json,
        p_draft_content: a.content as unknown as Json,
        p_usage: a.usage as unknown as Json,
      });
      if (error) {
        if (isMissingObject(error)) throw new CareerIntelligenceUnavailableError();
        logDbError("staff_finalize_ai_generation_run", error);
        throw new Error("The AI result could not be confirmed. Do not retry the provider call.");
      }
      const row = data as { outcome?: string; draft_id?: string } | null;
      if ((row?.outcome === "finalized" || row?.outcome === "duplicate") && typeof row.draft_id === "string" && row.draft_id) {
        return { kind: row.outcome, draftId: row.draft_id };
      }
      if (row?.outcome === "consent_withdrawn" || row?.outcome === "failed") return { kind: row.outcome };
      throw new Error("The AI result could not be confirmed. Do not retry the provider call.");
    },

    async audit(action, studentUserId, context) {
      await recordAuditLog({ action, entityType: "student", entityId: studentUserId, entityLabel: "AI career analysis", context });
    },
  };
}

// ---------------------------------------------------------------------------
// Staff-only reads for the Counsellor Studio
// ---------------------------------------------------------------------------

export interface AiGenerationRunSummary {
  id: string;
  status: string;
  reason: string | null;
  provider: string;
  model: string;
  dataClass: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  attempts: number;
  draftId: string | null;
  requestedBy: string | null;
  regeneratesRunId: string | null;
  regenerationReason: string | null;
  createdAt: string;
  completedAt: string | null;
  hasReport: boolean;
}

export type AiRunsResult = { available: true; runs: AiGenerationRunSummary[] } | { available: false };

const RUN_COLUMNS =
  "id, status, reason, provider, model, data_class, input_tokens, output_tokens, estimated_cost_usd, attempts, draft_id, requested_by, regenerates_run_id, regeneration_reason, created_at, completed_at, report_purged_at, report_schema_version";

type RunRow = {
  id: string;
  status: string;
  reason: string | null;
  provider: string;
  model: string;
  data_class: string;
  input_tokens: number;
  output_tokens: number;
  estimated_cost_usd: number;
  attempts: number;
  draft_id: string | null;
  requested_by: string | null;
  regenerates_run_id: string | null;
  regeneration_reason: string | null;
  created_at: string;
  completed_at: string | null;
  report_purged_at: string | null;
};

function toSummary(r: RunRow): AiGenerationRunSummary {
  return {
    id: r.id,
    status: r.status,
    reason: r.reason,
    provider: r.provider,
    model: r.model,
    dataClass: r.data_class,
    inputTokens: r.input_tokens,
    outputTokens: r.output_tokens,
    estimatedCostUsd: Number(r.estimated_cost_usd),
    attempts: r.attempts,
    draftId: r.draft_id,
    requestedBy: r.requested_by,
    regeneratesRunId: r.regenerates_run_id,
    regenerationReason: r.regeneration_reason,
    createdAt: r.created_at,
    completedAt: r.completed_at,
    hasReport: r.status === "succeeded" && !r.report_purged_at,
  };
}

/** The AI analyses requested for one student (newest first). RLS limits a counsellor to students they have case access to. */
export async function listAiRunsForStudent(studentUserId: string): Promise<AiRunsResult> {
  await requireAdminPermission("career-intelligence:generate");
  const supabase = await createClient();
  const { data, error } = await supabase.from("ai_generation_runs").select(RUN_COLUMNS).eq("student_user_id", studentUserId).order("created_at", { ascending: false }).limit(20);
  if (error) {
    if (isMissingObject(error)) return { available: false };
    logDbError("listAiRunsForStudent", error);
    return { available: true, runs: [] };
  }
  return { available: true, runs: ((data ?? []) as unknown as RunRow[]).map(toSummary) };
}

/**
 * The staff-only analysis behind an AI-assisted draft (evidence, engine
 * bands, uncertainties, counsellor flags) — for the reviewer on the draft
 * page. Re-validated against the versioned schema: anything that no longer
 * parses (e.g. a future schema version) is not shown as if it were valid.
 */
export async function getAiAnalysisForDraft(draftId: string): Promise<{ run: AiGenerationRunSummary; report: CareerIntelligenceReport | null } | null> {
  await requireAdminPermission("career-intelligence:generate");
  const supabase = await createClient();
  const { data, error } = await supabase.from("ai_generation_runs").select(`${RUN_COLUMNS}, report`).eq("draft_id", draftId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error) {
    if (!isMissingObject(error)) logDbError("getAiAnalysisForDraft", error);
    return null;
  }
  if (!data) return null;
  const row = data as unknown as RunRow & { report: unknown };
  const parsed = CareerIntelligenceReportSchema.safeParse(row.report);
  return { run: toSummary(row), report: parsed.success ? parsed.data : null };
}

// ---------------------------------------------------------------------------
// NW09.2 — Counsellor Studio AI workspace: provider evidence, usage summary,
// the latest analysis, and the consent register (record / withdraw).
// ---------------------------------------------------------------------------

export interface AiRunEvidence {
  cachedInputTokens: number;
  reasoningTokens: number;
  providerResponseId: string | null;
  latencyMs: number;
  promptVersion: string;
  reportSchemaVersion: string;
}

const RUN_EVIDENCE_COLUMNS = "latency_ms, prompt_version, report_schema_version, cached_input_tokens, reasoning_tokens, provider_response_id";
const RUN_EVIDENCE_COLUMNS_NW09 = "latency_ms, prompt_version, report_schema_version";

type RunEvidenceRow = {
  latency_ms: number;
  prompt_version: string;
  report_schema_version: string;
  cached_input_tokens?: number;
  reasoning_tokens?: number;
  provider_response_id?: string | null;
};

function toEvidence(r: RunEvidenceRow): AiRunEvidence {
  return {
    cachedInputTokens: r.cached_input_tokens ?? 0,
    reasoningTokens: r.reasoning_tokens ?? 0,
    providerResponseId: r.provider_response_id ?? null,
    latencyMs: r.latency_ms,
    promptVersion: r.prompt_version,
    reportSchemaVersion: r.report_schema_version,
  };
}

export type LatestAnalysis = {
  run: AiGenerationRunSummary;
  evidence: AiRunEvidence;
  /** null when the stored report no longer validates (e.g. purged, or an unknown schema version). */
  report: CareerIntelligenceReport | null;
};

/**
 * The newest SUCCESSFUL analysis for a student, with its stored report
 * re-validated against the versioned schema. Reads NW09.2's evidence
 * columns when they exist; falls back to NW09's columns when the NW09.2
 * migration has not been applied (cached/reasoning tokens then show 0 and
 * the response id as not recorded — never invented).
 */
export async function getLatestAiAnalysisForStudent(studentUserId: string): Promise<LatestAnalysis | null> {
  await requireAdminPermission("career-intelligence:generate");
  const supabase = await createClient();
  const query = (cols: string) =>
    supabase
      .from("ai_generation_runs")
      .select(`${RUN_COLUMNS}, ${cols}, report`)
      .eq("student_user_id", studentUserId)
      .eq("status", "succeeded")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
  let { data, error } = await query(RUN_EVIDENCE_COLUMNS);
  if (error && error.code === "42703") ({ data, error } = await query(RUN_EVIDENCE_COLUMNS_NW09));
  if (error) {
    if (!isMissingObject(error)) logDbError("getLatestAiAnalysisForStudent", error);
    return null;
  }
  if (!data) return null;
  const row = data as unknown as RunRow & RunEvidenceRow & { report: unknown };
  const parsed = CareerIntelligenceReportSchema.safeParse(row.report);
  return { run: toSummary(row), evidence: toEvidence(row), report: parsed.success ? parsed.data : null };
}

export type AiUsageSummary =
  | {
      available: true;
      staffToday: number;
      globalToday: number;
      monthCostUsd: number;
      paidRunsTotal: number;
      paidCostTotalUsd: number;
      /** Database ceilings (the effective limit is the LOWER of these and the app's configured value). */
      db: {
        perStaffDaily: number;
        perStudentDaily: number;
        globalDaily: number;
        monthlyBudgetUsd: number;
        paidMaxRuns: number;
        paidTotalBudgetUsd: number;
        realStudentProcessingApproved: boolean;
      };
    }
  | { available: false };

/** Aggregate AI usage counters (no student data) — from staff_get_ai_usage_summary() (NW09.2). */
export async function getAiUsageSummary(): Promise<AiUsageSummary> {
  await requireAdminPermission("career-intelligence:generate");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("staff_get_ai_usage_summary");
  if (error) {
    if (!isMissingObject(error)) logDbError("staff_get_ai_usage_summary", error);
    return { available: false };
  }
  const r = (data ?? [])[0];
  if (!r) return { available: false };
  return {
    available: true,
    staffToday: Number(r.staff_today),
    globalToday: Number(r.global_today),
    monthCostUsd: Number(r.month_cost_usd),
    paidRunsTotal: Number(r.paid_runs_total),
    paidCostTotalUsd: Number(r.paid_cost_total_usd),
    db: {
      perStaffDaily: Number(r.per_staff_daily),
      perStudentDaily: Number(r.per_student_daily),
      globalDaily: Number(r.global_daily),
      monthlyBudgetUsd: Number(r.monthly_budget_usd),
      paidMaxRuns: Number(r.paid_max_runs),
      paidTotalBudgetUsd: Number(r.paid_total_budget_usd),
      realStudentProcessingApproved: r.real_student_processing_approved === true,
    },
  };
}

export const CONSENT_METHODS = ["signed_consent_form", "recorded_meeting", "written_confirmation", "fictional_test_account"] as const;
export type ConsentMethod = (typeof CONSENT_METHODS)[number];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Record a student's consent to AI-assisted processing. The form must name
 * WHO consented, HOW, an evidence reference and the date it was given — a
 * checkbox is not consent. "fictional_test_account" is accepted only for a
 * listed development test account. Authorisation is re-checked inside
 * staff_record_ai_processing_consent().
 */
export async function recordAiProcessingConsent(studentUserId: string, formData: FormData, config: AiConfig): Promise<void> {
  await requireAdminPermission("career-intelligence:generate");
  const party = String(formData.get("consentingParty") ?? "");
  const method = String(formData.get("method") ?? "");
  const evidence = String(formData.get("evidenceReference") ?? "").trim();
  const givenOn = String(formData.get("givenOn") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  if (!CONSENT_PARTIES.some((p) => p === party)) throw new Error("Select who gave consent.");
  if (!CONSENT_METHODS.some((m) => m === method)) throw new Error("Select how consent was given.");
  if (evidence.length < 3 || evidence.length > 200) throw new Error("Enter an evidence reference (3–200 characters), e.g. the signed form's document number.");
  if (!ISO_DATE.test(givenOn) || givenOn > new Date().toISOString().slice(0, 10)) throw new Error("Enter the date consent was given (not in the future).");
  if (notes.length > 500) throw new Error("Notes must be 500 characters or fewer.");
  if (method === "fictional_test_account") {
    const dataClass = await createCareerIntelligenceGateway(config).classifyStudentData(studentUserId);
    if (dataClass !== "fictional") throw new Error("“Fictional test account” can only be used for a listed development test account.");
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("staff_record_ai_processing_consent", {
    p_student_user_id: studentUserId,
    p_consenting_party: party,
    p_method: method,
    p_evidence_reference: evidence,
    p_given_on: givenOn,
    p_notes: notes || null,
  });
  if (error) {
    if (isMissingObject(error)) throw new CareerIntelligenceUnavailableError();
    logDbError("staff_record_ai_processing_consent", error);
    throw new Error(error.message?.includes("already recorded") ? "An active consent is already recorded for this student." : "The consent could not be recorded.");
  }
  await recordAuditLog({ action: "ai_consent.recorded", entityType: "student", entityId: studentUserId, entityLabel: "AI processing consent", context: { method, consentingParty: party } });
}

/** Withdraw the active consent (a reason is required). Further analyses are then blocked until a new consent is recorded. */
export async function withdrawAiProcessingConsent(studentUserId: string, consentId: string, formData: FormData): Promise<void> {
  await requireAdminPermission("career-intelligence:generate");
  const reason = String(formData.get("reason") ?? "").trim();
  if (reason.length < 3 || reason.length > 500) throw new Error("Give a reason for the withdrawal (3–500 characters).");
  const supabase = await createClient();
  const { error } = await supabase.rpc("staff_withdraw_ai_processing_consent", { p_consent_id: consentId, p_reason: reason });
  if (error) {
    if (isMissingObject(error)) throw new CareerIntelligenceUnavailableError();
    logDbError("staff_withdraw_ai_processing_consent", error);
    throw new Error("The consent could not be withdrawn.");
  }
  await recordAuditLog({ action: "ai_consent.withdrawn", entityType: "student", entityId: studentUserId, entityLabel: "AI processing consent", context: {} });
}
