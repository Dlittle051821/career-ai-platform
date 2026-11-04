import "server-only";
import { rpcRowId } from "@/lib/supabase/rpc-result";
import { createClient } from "../server";
import { getCurrentAdmin, requireAdminPermission } from "../admin-auth";
import { recordAuditLog } from "./audit";
import { getStudentProfileSnapshotForAdmin } from "./student-profile";
import { getCareersForMatching } from "../careers";
import { classifyPurchaseEntitlements } from "@/lib/products/entitlements";
import { isFictionalStudent, type AiConfig } from "@/lib/ai/config";
import type { CareerIntelligenceGateway, ReserveResult } from "@/lib/career-intelligence/service";
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
 * (supabase/migrations-proposed/NW09_ai_career_intelligence.sql and NW07's
 * staff_create_recommendation_draft). No service-role key is used anywhere.
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
  return Boolean(error?.code && ["42P01", "42883", "PGRST202", "PGRST205"].includes(error.code));
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

    async reserveRun(a): Promise<ReserveResult> {
      const supabase = await createClient();
      const { data, error } = await supabase.rpc("staff_reserve_ai_generation_run", {
        p_student_user_id: a.studentUserId,
        p_idempotency_key: a.idempotencyKey,
        p_provider: a.provider,
        p_model: a.model,
        p_prompt_version: a.promptVersion,
        p_report_schema_version: a.reportSchemaVersion,
        p_data_class: a.dataClass,
        p_consent_confirmed: a.consentConfirmed,
        p_worst_case_cost_usd: a.worstCaseCostUsd,
        p_limit_staff_daily: a.limits.perStaffDaily,
        p_limit_student_daily: a.limits.perStudentDaily,
        p_limit_global_daily: a.limits.globalDaily,
        p_monthly_budget_usd: a.limits.monthlyBudgetUsd,
        p_regenerates_run_id: a.regeneratesRunId,
        p_regeneration_reason: a.regenerationReason,
      });
      if (error) {
        if (isMissingObject(error)) throw new CareerIntelligenceUnavailableError();
        logDbError("staff_reserve_ai_generation_run", error);
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
      const { error } = await supabase.rpc("staff_complete_ai_generation_run", {
        p_run_id: runId,
        p_status: c.status,
        p_reason: c.reason,
        p_model: c.model,
        p_input_tokens: c.inputTokens,
        p_output_tokens: c.outputTokens,
        p_estimated_cost_usd: c.estimatedCostUsd,
        p_attempts: c.attempts,
        p_latency_ms: c.latencyMs,
        p_report: (c.report as unknown as Json) ?? null,
      });
      if (error) logDbError("staff_complete_ai_generation_run", error);
    },

    async createDraft({ studentUserId, title, content }) {
      const supabase = await createClient();
      const { data, error } = await supabase.rpc("staff_create_recommendation_draft", {
        p_student_user_id: studentUserId,
        p_title: title,
        p_recommendation_type: "career",
        p_content: content as unknown as Json,
      });
      // staff_create_recommendation_draft() returns ONE row → PostgREST sends an object, not an array.
      const id = rpcRowId(data);
      if (error || !id) {
        if (isMissingObject(error)) throw new CareerIntelligenceUnavailableError();
        logDbError("staff_create_recommendation_draft", error);
        throw new Error("The draft could not be created.");
      }
      return id;
    },

    async linkDraft(runId, draftId) {
      const supabase = await createClient();
      const { error } = await supabase.rpc("staff_link_ai_generation_run_draft", { p_run_id: runId, p_draft_id: draftId });
      if (error) logDbError("staff_link_ai_generation_run_draft", error);
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
