import type { CareerMatchProfile } from "@/types/career";
import type { StudentProfileSnapshot } from "@/types/student-profile";
import type { AdminRole } from "@/types/admin";
import { hasPermission } from "@/lib/admin/permissions";
import type { AiConfig } from "@/lib/ai/config";
import { activeModel } from "@/lib/ai/config";
import { worstCaseCostUsd } from "@/lib/ai/cost";
import type { AiDataClass, AiProvider, AiProviderName } from "@/lib/ai/types";
import { checkDataPolicy } from "@/lib/ai/data-policy";
import type { RecommendationDraftContent } from "@/lib/recommendations/drafts";
import { generateCareerIntelligence, prepareAnalysis, type PipelineOutcome } from "./pipeline";
import { PROMPT_VERSION, REPORT_SCHEMA_VERSION, type CareerIntelligenceReport } from "./schema";
import type { ProfileSectionKey, ProvenanceValue } from "@/types/profile-provenance";

/**
 * NW09 — the authorised "request an AI-assisted first draft" use case.
 *
 * Order of checks (each fails closed, and nothing reaches a provider unless
 * all pass):
 *  1. signed-in staff with the career-intelligence:generate permission
 *     (never a student — students have no route to this at all);
 *  2. case access: admins by role, counsellors only for students they are
 *     assigned to (counsellor_has_case_access — checked explicitly, never
 *     inferred from an empty RLS read);
 *  3. the student holds a PAID career entitlement (Verified/paid plan) —
 *     unknown counts as no (fictional development accounts are exempt);
 *  4. a RECORDED, valid AI-processing consent exists for the student
 *     (NW09.2 — student_ai_processing_consents: who consented, how, the
 *     evidence reference, who recorded it; not withdrawn). A checkbox in the
 *     request form is NOT consent and is no longer accepted as such;
 *  4b. real students + the paid provider: BOTH the application flag
 *     (AI_REAL_STUDENT_DATA_APPROVED) and the database flag
 *     (ai_usage_settings.real_student_processing_approved, super-admin only)
 *     must be set — until the privacy review is complete only fictional QA
 *     students can be analysed by OpenAI;
 *  5. AI is enabled and the data policy allows this provider to see this
 *     student's data (Gemini: fictional test accounts only);
 *  6. the profile is complete enough and the catalogue yields candidates
 *     (deterministic — checks 1–6 cost nothing and record no AI run);
 *  7. budget, rate limits, all-time paid-pilot caps, one-analysis-at-a-time
 *     per student, and idempotency — reserved atomically in the ledger
 *     (staff_reserve_ai_generation_run_v2) BEFORE the call; a repeated
 *     request with the same key returns the original run instead of calling
 *     again.
 *
 * A provider failure is recorded truthfully (billing / auth / model access /
 * rate limit / timeout …) and NEVER falls back to the mock provider: no
 * draft is created from a failed or invalid answer.
 *
 * The result becomes a NW07 recommendation DRAFT (status "draft") — never
 * approved or released automatically. Everything else (edit → submit →
 * independent approval → release) is the unchanged NW07 workflow.
 *
 * All I/O is behind CareerIntelligenceGateway, implemented with Supabase in
 * src/lib/supabase/admin/career-intelligence.ts and with an in-memory fake
 * in tests.
 */
export interface StaffContext {
  userId: string;
  role: AdminRole;
}

export type ReserveResult =
  | { kind: "reserved"; runId: string }
  | { kind: "duplicate"; runId: string; status: string; draftId: string | null }
  | { kind: "denied"; reason: string };

export interface RunCompletion {
  status: "failed" | "refused" | "invalid_output" | "blocked";
  reason: string | null;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number;
  reasoningTokens?: number;
  providerResponseId?: string | null;
  estimatedCostUsd: number;
  attempts: number;
  latencyMs: number;
  report: null;
}

/** NW09.2 — the student's recorded AI-processing consent, as the database holds it. */
export type ConsentStatus =
  | {
      status: "valid";
      consentId: string;
      consentingParty: "student" | "parent_guardian" | "student_and_parent_guardian";
      method: string;
      evidenceReference: string;
      givenOn: string;
      recordedAt: string;
      recordedByName: string | null;
    }
  | { status: "missing" }
  | { status: "withdrawn"; withdrawnAt: string }
  /** The consent register does not exist yet (NW09.2 migration not applied) or could not be read. */
  | { status: "unavailable" };

export type FinalizeResult =
  | { kind: "finalized"; draftId: string }
  | { kind: "duplicate"; draftId: string }
  | { kind: "consent_withdrawn" }
  | { kind: "failed" };

export interface CareerIntelligenceGateway {
  getStaff(): Promise<StaffContext | null>;
  hasCaseAccess(studentUserId: string): Promise<boolean>;
  /** null = could not be determined (treated as "no"). */
  hasPaidCareerEntitlement(studentUserId: string): Promise<boolean | null>;
  loadSnapshot(studentUserId: string): Promise<StudentProfileSnapshot | null>;
  loadCatalogue(): Promise<CareerMatchProfile[]>;
  /** NW09.2 — section provenance (null = could not be read). */
  loadProvenance(studentUserId: string): Promise<Partial<Record<ProfileSectionKey, ProvenanceValue>> | null>;
  /** NW09.2 — recorded AI-processing consent. */
  getConsent(studentUserId: string): Promise<ConsentStatus>;
  /** "fictional" only for a listed development test account (see isFictionalStudent); otherwise "real_student". */
  classifyStudentData(studentUserId: string): Promise<AiDataClass>;
  reserveRun(args: {
    studentUserId: string;
    idempotencyKey: string;
    provider: AiProviderName;
    model: string;
    promptVersion: string;
    reportSchemaVersion: string;
    dataClass: AiDataClass;
    worstCaseCostUsd: number;
    limits: AiConfig["limits"];
    paid: AiConfig["paid"];
    consentId: string;
    regeneratesRunId: string | null;
    regenerationReason: string | null;
  }): Promise<ReserveResult>;
  completeRun(runId: string, completion: RunCompletion): Promise<void>;
  /** One database transaction: consent, draft/version, report, link and audit. */
  finalizeRun(args: {
    runId: string;
    studentUserId: string;
    consentId: string;
    content: RecommendationDraftContent;
    report: CareerIntelligenceReport;
    usage: Omit<RunCompletion, "status" | "reason" | "report">;
  }): Promise<FinalizeResult>;
  audit(action: string, studentUserId: string, context: Record<string, unknown>): Promise<void>;
}

export interface RequestInput {
  studentUserId: string;
  idempotencyKey: string;
  regeneratesRunId?: string | null;
  regenerationReason?: string | null;
}

export type RequestOutcome =
  | { kind: "draft_created"; runId: string; draftId: string; report: CareerIntelligenceReport }
  | { kind: "duplicate"; runId: string; draftId: string | null; status: string }
  | { kind: "not_authorised"; reason: string }
  | { kind: "not_entitled"; reason: string }
  | { kind: "needs_consent"; reason: string }
  | { kind: "real_student_not_approved"; reason: string }
  | { kind: "invalid_request"; reason: string }
  | { kind: "limit_reached"; reason: string }
  | { kind: "not_generated"; runId: string | null; outcome: Exclude<PipelineOutcome, { kind: "ok" }> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IDEMPOTENCY = /^[A-Za-z0-9_-]{16,80}$/;

export function validateRequest(input: RequestInput): string | null {
  if (!UUID.test(input.studentUserId)) return "Invalid student reference.";
  if (!IDEMPOTENCY.test(input.idempotencyKey)) return "Invalid request token — reload the page and try again.";
  if (input.regeneratesRunId != null && !UUID.test(input.regeneratesRunId)) return "Invalid previous-analysis reference.";
  if (input.regeneratesRunId) {
    const reason = (input.regenerationReason ?? "").trim();
    if (reason.length < 10 || reason.length > 500) return "Please give a reason (10–500 characters) for regenerating the analysis.";
  }
  return null;
}

export async function requestCareerAnalysis(input: RequestInput, gw: CareerIntelligenceGateway, deps: { config: AiConfig; provider: AiProvider | null; now?: () => Date }): Promise<RequestOutcome> {
  const invalid = validateRequest(input);
  if (invalid) return { kind: "invalid_request", reason: invalid };

  // 1–2. Who is asking, and may they see this student?
  const staff = await gw.getStaff();
  if (!staff || !hasPermission(staff.role, "career-intelligence:generate")) return { kind: "not_authorised", reason: "Only authorised counsellors and admins can request an AI analysis." };
  const isAdmin = staff.role === "super_admin" || staff.role === "admin";
  if (!isAdmin && !(await gw.hasCaseAccess(input.studentUserId))) return { kind: "not_authorised", reason: "You are not assigned to this student." };

  // Which data class is this student? Real unless it is a listed fictional test account (development only).
  const dataClass = await gw.classifyStudentData(input.studentUserId);

  // 3. Paid personalised guidance needs a paid Career entitlement (unknown = no). Fictional development accounts are exempt.
  if (dataClass === "real_student") {
    const entitled = await gw.hasPaidCareerEntitlement(input.studentUserId);
    if (entitled !== true) return { kind: "not_entitled", reason: "AI-assisted reports are part of the paid Career guidance plans. This student has no active paid Career plan (or it could not be confirmed)." };
  }
  // 4. A RECORDED, valid AI-processing consent (never a checkbox).
  const consent = await gw.getConsent(input.studentUserId);
  if (consent.status !== "valid") {
    return {
      kind: "needs_consent",
      reason:
        consent.status === "withdrawn"
          ? "The student's consent to AI-assisted processing has been withdrawn. No analysis can be run unless new consent is recorded."
          : consent.status === "unavailable"
            ? "The AI-processing consent register is not available (the NW09.2 database change has not been applied). No analysis can be run."
            : "No AI-processing consent is recorded for this student. Record the student's (or parent's/guardian's) consent, with its evidence, before requesting an analysis.",
    };
  }

  // 5. Is AI available, and may this provider see this data? Checked BEFORE anything is reserved or sent.
  if (deps.config.mode === "disabled" || !deps.provider) return { kind: "not_generated", runId: null, outcome: { kind: "disabled", reason: deps.config.notes[0] ?? "AI is disabled." } };
  const policy = checkDataPolicy(deps.config.mode, dataClass);
  if (!policy.allowed) return { kind: "not_generated", runId: null, outcome: { kind: "policy_blocked", reason: policy.reason } };
  // 4b. Real students and the paid provider: privacy review must be complete (app flag here; database flag in the reserve RPC).
  if (deps.config.mode === "openai" && dataClass === "real_student" && !deps.config.realStudentDataApproved) {
    return {
      kind: "real_student_not_approved",
      reason: "Real student data is not yet approved for OpenAI processing (privacy review pending). Only fictional QA students can be analysed in this pilot.",
    };
  }

  // 6. Profile completeness and catalogue candidates — deterministic, free, no AI.
  const [snapshot, catalogue, provenance] = await Promise.all([gw.loadSnapshot(input.studentUserId), gw.loadCatalogue(), gw.loadProvenance(input.studentUserId)]);
  if (!snapshot) return { kind: "not_authorised", reason: "The student's profile could not be loaded with your access." };
  const { assessment, candidates } = prepareAnalysis({ snapshot, catalogue });
  if (!assessment.ready) return { kind: "not_generated", runId: null, outcome: { kind: "needs_profile", assessment } };
  if (candidates.length === 0) return { kind: "not_generated", runId: null, outcome: { kind: "no_candidates", assessment } };

  // 7. Reserve: rate limits, monthly budget and idempotency, atomically, BEFORE the provider call.
  const model = activeModel(deps.config) ?? "none";
  const reserve = await gw.reserveRun({
    studentUserId: input.studentUserId,
    idempotencyKey: input.idempotencyKey,
    provider: deps.config.mode,
    model,
    promptVersion: PROMPT_VERSION,
    reportSchemaVersion: REPORT_SCHEMA_VERSION,
    dataClass,
    worstCaseCostUsd: worstCaseCostUsd(deps.config.mode, model, deps.config.limits.maxInputChars, deps.config.limits.maxOutputTokens, deps.config),
    limits: deps.config.limits,
    paid: deps.config.paid,
    consentId: consent.consentId,
    regeneratesRunId: input.regeneratesRunId ?? null,
    regenerationReason: input.regenerationReason?.trim() || null,
  });
  if (reserve.kind === "duplicate") return { kind: "duplicate", runId: reserve.runId, draftId: reserve.draftId, status: reserve.status };
  if (reserve.kind === "denied") return { kind: "limit_reached", reason: reserve.reason };

  // 8. Generate (validated, screened), then record the outcome — success or not.
  let outcome: PipelineOutcome;
  try {
    outcome = await generateCareerIntelligence({ studentUserId: input.studentUserId, snapshot, catalogue, dataClass, provenance }, { config: deps.config, provider: deps.provider, now: deps.now });
  } catch {
    outcome = { kind: "failed", status: "failed", reason: "The analysis could not be completed.", usage: null, estimatedCostUsd: 0, attempts: 0, model };
  }

  if (outcome.kind !== "ok") {
    const completion: RunCompletion =
      outcome.kind === "failed"
        ? {
            status: outcome.status === "refused" || outcome.status === "invalid_output" ? outcome.status : "failed",
            reason: `${outcome.status}${outcome.errorKind ? ` (${outcome.errorKind})` : ""}: ${outcome.reason}`,
            model: outcome.model,
            inputTokens: outcome.usage?.inputTokens ?? 0,
            outputTokens: outcome.usage?.outputTokens ?? 0,
            cachedInputTokens: outcome.usage?.cachedInputTokens ?? 0,
            reasoningTokens: outcome.usage?.reasoningTokens ?? 0,
            providerResponseId: outcome.responseId ?? null,
            estimatedCostUsd: outcome.estimatedCostUsd,
            attempts: outcome.attempts,
            latencyMs: Math.max(0, Math.round(outcome.latencyMs ?? 0)),
            report: null,
          }
        : { status: deps.config.mode === "openai" ? "failed" : "blocked", reason: outcome.kind, model, inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0, attempts: 0, latencyMs: 0, report: null };
    await gw.completeRun(reserve.runId, completion);
    await gw.audit("AI career analysis not generated", input.studentUserId, {
      runId: reserve.runId,
      outcome: outcome.kind,
      ...(outcome.kind === "failed" ? { status: outcome.status, errorKind: outcome.errorKind ?? null } : {}),
    });
    return { kind: "not_generated", runId: reserve.runId, outcome };
  }

  // Provider I/O is outside PostgreSQL. Only the finalization RPC may persist
  // a successful result; its lock is shared with consent withdrawal.
  const usage = {
    model: outcome.model,
    inputTokens: outcome.usage?.inputTokens ?? 0,
    outputTokens: outcome.usage?.outputTokens ?? 0,
    cachedInputTokens: outcome.usage?.cachedInputTokens ?? 0,
    reasoningTokens: outcome.usage?.reasoningTokens ?? 0,
    providerResponseId: outcome.report.generation.providerResponseId,
    estimatedCostUsd: outcome.estimatedCostUsd,
    attempts: outcome.attempts,
    latencyMs: outcome.report.generation.latencyMs,
  };
  // No application consent recheck can authorize persistence. The RPC must
  // revalidate the exact reservation consent after acquiring its database lock.
  // A transport error can mean COMMIT succeeded: never overwrite the result or
  // retry the provider. Reconcile/retry finalization with the same run ID.
  const finalized = await gw.finalizeRun({
    runId: reserve.runId, studentUserId: input.studentUserId,
    consentId: consent.consentId, content: outcome.draftContent,
    report: outcome.report, usage,
  });
  if (finalized.kind === "consent_withdrawn") {
    return { kind: "needs_consent", reason: "AI-processing consent changed during generation. No report draft was stored." };
  }
  if (finalized.kind === "failed") {
    return {
      kind: "not_generated", runId: reserve.runId,
      outcome: { kind: "failed", status: "failed", reason: "The analysis result could not be saved. No new report draft was stored.", usage: outcome.usage, estimatedCostUsd: outcome.estimatedCostUsd, attempts: outcome.attempts, model: outcome.model },
    };
  }
  if (finalized.kind === "duplicate") {
    return { kind: "duplicate", runId: reserve.runId, draftId: finalized.draftId, status: "succeeded" };
  }
  return { kind: "draft_created", runId: reserve.runId, draftId: finalized.draftId, report: outcome.report };
}
