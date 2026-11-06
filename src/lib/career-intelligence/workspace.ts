import type { AiConfig } from "@/lib/ai/config";
import type { AiDataClass, AiProviderName } from "@/lib/ai/types";
import { activeModel } from "@/lib/ai/config";
import { checkDataPolicy } from "@/lib/ai/data-policy";
import type { RecommendationDraftStatus } from "@/lib/recommendations/drafts";
import type { ConsentStatus } from "./service";
import { MATCH_BAND_LABELS, EVIDENCE_LEVEL_LABELS } from "@/lib/recommendations";
import { ACADEMIC_LEVEL_LABELS, SUITABILITY_LABELS, type CareerIntelligenceReport } from "./schema";
import type { StudentProfileSnapshot } from "@/types/student-profile";
import {
  BUDGET_BAND_OPTIONS,
  CAREER_PRIORITY_OPTIONS,
  CURRENT_STATUS_OPTIONS,
  EDUCATION_LEVEL_OPTIONS,
  FUNDING_SOURCE_OPTIONS,
  INTEREST_OPTIONS,
  SUBJECT_OPTIONS,
  TECHNICAL_SKILL_OPTIONS,
  TRANSFERABLE_SKILL_OPTIONS,
  labelFor,
} from "@/data/profile-options";

/**
 * NW09.2 — pure view-model logic for the Counsellor Studio "AI Career
 * Intelligence" workspace. No I/O: every value shown in the workspace is
 * derived here from data the page has read (configuration, the consent
 * register, the entitlement check, the usage RPC, the run ledger, the NW07
 * draft) — never from fixed display values. If a fact is not known, the
 * workspace says so instead of showing a plausible-looking number.
 *
 * The gates mirror (they do not replace) the server-side checks in
 * requestCareerAnalysis() and staff_reserve_ai_generation_run_v2(): a gate
 * shown as passed here is still re-checked on the server and in the database.
 */

export type GateState = "pass" | "fail" | "unknown";
export type GateKey = "provider" | "consent" | "entitlement" | "data_policy" | "usage" | "profile" | "database";

export interface Gate {
  key: GateKey;
  label: string;
  state: GateState;
  detail: string;
}

/** Effective counters/limits as the database will apply them: LOWER of app config and ai_usage_settings. */
export interface UsageView {
  available: boolean;
  staffToday: number | null;
  staffLimit: number;
  studentToday: number | null;
  studentLimit: number;
  globalToday: number | null;
  globalLimit: number;
  monthCostUsd: number | null;
  monthBudgetUsd: number;
  paidRunsTotal: number | null;
  paidMaxRuns: number;
  paidCostTotalUsd: number | null;
  paidBudgetUsd: number;
  dbRealStudentApproved: boolean | null;
}

export interface UsageInput {
  available: boolean;
  staffToday?: number;
  globalToday?: number;
  monthCostUsd?: number;
  paidRunsTotal?: number;
  paidCostTotalUsd?: number;
  db?: {
    perStaffDaily: number;
    perStudentDaily: number;
    globalDaily: number;
    monthlyBudgetUsd: number;
    paidMaxRuns: number;
    paidTotalBudgetUsd: number;
    realStudentProcessingApproved: boolean;
  };
}

export function buildUsageView(config: AiConfig, usage: UsageInput, studentToday: number | null): UsageView {
  const db = usage.available ? usage.db : undefined;
  const lower = (app: number, dbValue: number | undefined) => (dbValue === undefined ? app : Math.min(app, dbValue));
  return {
    available: Boolean(usage.available && db),
    staffToday: usage.available ? (usage.staffToday ?? null) : null,
    staffLimit: lower(config.limits.perStaffDaily, db?.perStaffDaily),
    studentToday,
    studentLimit: lower(config.limits.perStudentDaily, db?.perStudentDaily),
    globalToday: usage.available ? (usage.globalToday ?? null) : null,
    globalLimit: lower(config.limits.globalDaily, db?.globalDaily),
    monthCostUsd: usage.available ? (usage.monthCostUsd ?? null) : null,
    monthBudgetUsd: lower(config.limits.monthlyBudgetUsd, db?.monthlyBudgetUsd),
    paidRunsTotal: usage.available ? (usage.paidRunsTotal ?? null) : null,
    paidMaxRuns: lower(config.paid.maxRuns, db?.paidMaxRuns),
    paidCostTotalUsd: usage.available ? (usage.paidCostTotalUsd ?? null) : null,
    paidBudgetUsd: lower(config.paid.totalBudgetUsd, db?.paidTotalBudgetUsd),
    dbRealStudentApproved: db ? db.realStudentProcessingApproved : null,
  };
}

export const CONSENT_PARTY_LABELS: Record<string, string> = {
  student: "Student",
  parent_guardian: "Parent / guardian",
  student_and_parent_guardian: "Student and parent / guardian",
};

export const CONSENT_METHOD_LABELS: Record<string, string> = {
  signed_consent_form: "Signed consent form",
  recorded_meeting: "Recorded meeting",
  written_confirmation: "Written confirmation",
  fictional_test_account: "Fictional test account (development only)",
};

export function formatDate(iso: string): string {
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** Estimated cost: 4 decimals under $0.01 so a real (small) figure is never rounded to $0.00. */
export function formatUsd(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "Not available";
  return value < 0.01 ? `$${value.toFixed(4)}` : `$${value.toFixed(2)}`;
}

export function formatCount(value: number | null): string {
  return value === null ? "Not available" : value.toLocaleString("en-IN");
}

export interface GateInput {
  config: AiConfig;
  dataClass: AiDataClass;
  consent: ConsentStatus;
  entitlement: boolean | null;
  usage: UsageView;
  databaseAvailable: boolean;
  profileReady: boolean;
  profileMissing: string[];
  candidateCount: number;
}

export function providerLabel(config: AiConfig): string {
  switch (config.mode) {
    case "openai":
      return `OpenAI · ${config.openai.model}`;
    case "gemini":
      return `Gemini free tier · ${config.gemini.model}`;
    case "mock":
      return "Mock provider (development)";
    default:
      return "AI is off";
  }
}

/** Label for a COMPLETED run — "Live GPT" only when the ledger says the run went to OpenAI. */
export function runProviderLabel(provider: AiProviderName | string, model: string): string {
  if (provider === "openai") return `OpenAI — Live GPT · ${model}`;
  if (provider === "gemini") return `Gemini free tier · ${model} (fictional data only)`;
  if (provider === "mock") return "Mock provider — not a real AI analysis";
  return `${provider} · ${model}`;
}

export function computeGates(i: GateInput): Gate[] {
  const gates: Gate[] = [];
  const isPaid = i.config.mode === "openai";

  gates.push(
    i.config.mode === "disabled"
      ? { key: "provider", label: "Provider", state: "fail", detail: i.config.notes[0] ?? "AI is switched off." }
      : { key: "provider", label: "Provider", state: "pass", detail: `${providerLabel(i.config)}${isPaid ? " (paid, approved)" : ""}` },
  );

  gates.push(
    i.databaseAvailable
      ? { key: "database", label: "Database", state: "pass", detail: "AI ledger and consent register are available." }
      : { key: "database", label: "Database", state: "fail", detail: "The NW07, NW09 and NW09.2 database changes are not all applied." },
  );

  switch (i.consent.status) {
    case "valid":
      gates.push({
        key: "consent",
        label: "Consent",
        state: "pass",
        detail: `${CONSENT_METHOD_LABELS[i.consent.method] ?? i.consent.method} · given ${formatDate(i.consent.givenOn)} by ${CONSENT_PARTY_LABELS[i.consent.consentingParty] ?? i.consent.consentingParty}`,
      });
      break;
    case "withdrawn":
      gates.push({ key: "consent", label: "Consent", state: "fail", detail: `Withdrawn on ${formatDate(i.consent.withdrawnAt)}. Record a new consent to continue.` });
      break;
    case "missing":
      gates.push({ key: "consent", label: "Consent", state: "fail", detail: "No consent recorded. Record who consented, how, and the evidence reference." });
      break;
    default:
      gates.push({ key: "consent", label: "Consent", state: "unknown", detail: "The consent register is not available (NW09.2 database changes not applied)." });
  }

  if (i.dataClass === "fictional") {
    gates.push({ key: "entitlement", label: "Entitlement", state: "pass", detail: "Not required — fictional test account." });
  } else if (i.entitlement === true) {
    gates.push({ key: "entitlement", label: "Entitlement", state: "pass", detail: "Paid Career plan confirmed (invoice paid)." });
  } else if (i.entitlement === false) {
    gates.push({ key: "entitlement", label: "Entitlement", state: "fail", detail: "No paid Career plan on record." });
  } else {
    gates.push({ key: "entitlement", label: "Entitlement", state: "unknown", detail: "The entitlement could not be confirmed." });
  }

  const policy = checkDataPolicy(i.config.mode, i.dataClass);
  if (!policy.allowed) {
    gates.push({ key: "data_policy", label: "Data policy", state: "fail", detail: policy.reason });
  } else if (isPaid && i.dataClass === "real_student" && !(i.config.realStudentDataApproved && i.usage.dbRealStudentApproved === true)) {
    gates.push({ key: "data_policy", label: "Data policy", state: "fail", detail: "Real student data is not yet approved for OpenAI (privacy review pending)." });
  } else {
    gates.push({ key: "data_policy", label: "Data policy", state: "pass", detail: i.dataClass === "fictional" ? "Fictional test student." : "Real student — processing approved." });
  }

  gates.push(usageGate(i.usage, isPaid));

  if (!i.profileReady) {
    gates.push({ key: "profile", label: "Profile", state: "fail", detail: i.profileMissing.length > 0 ? `Missing: ${i.profileMissing.join(", ")}.` : "Not enough information yet." });
  } else if (i.candidateCount === 0) {
    gates.push({ key: "profile", label: "Profile", state: "fail", detail: "No catalogue career matches this profile with enough evidence yet." });
  } else {
    gates.push({ key: "profile", label: "Profile", state: "pass", detail: `Ready · ${i.candidateCount} catalogue ${i.candidateCount === 1 ? "match" : "matches"} to explain.` });
  }
  return gates;
}

function usageGate(u: UsageView, isPaid: boolean): Gate {
  if (!u.available) return { key: "usage", label: "Usage", state: "unknown", detail: "Usage counters are not available (NW09.2 database changes not applied)." };
  if (u.staffToday !== null && u.staffToday >= u.staffLimit) return { key: "usage", label: "Usage", state: "fail", detail: "You have reached today's limit of AI analyses." };
  if (u.studentToday !== null && u.studentToday >= u.studentLimit) return { key: "usage", label: "Usage", state: "fail", detail: "This student has reached today's limit." };
  if (u.globalToday !== null && u.globalToday >= u.globalLimit) return { key: "usage", label: "Usage", state: "fail", detail: "The organisation's daily limit has been reached." };
  if (u.monthCostUsd !== null && u.monthCostUsd >= u.monthBudgetUsd) return { key: "usage", label: "Usage", state: "fail", detail: "This month's AI budget is used up." };
  if (isPaid && u.paidRunsTotal !== null && u.paidRunsTotal >= u.paidMaxRuns) return { key: "usage", label: "Usage", state: "fail", detail: "The paid pilot's analysis limit has been reached." };
  if (isPaid && u.paidCostTotalUsd !== null && u.paidCostTotalUsd >= u.paidBudgetUsd) return { key: "usage", label: "Usage", state: "fail", detail: "The paid pilot budget is used up." };
  return {
    key: "usage",
    label: "Usage",
    state: "pass",
    detail: isPaid ? `Pilot: ${formatCount(u.paidRunsTotal)} of ${u.paidMaxRuns} analyses · ${formatUsd(u.paidCostTotalUsd)} of ${formatUsd(u.paidBudgetUsd)}` : `Today: ${formatCount(u.staffToday)} of ${u.staffLimit}`,
  };
}

/** The Generate button is enabled only when EVERY gate passes ("unknown" counts as not passed). */
export function generateDisabledReason(gates: Gate[]): string | null {
  const blocking = gates.find((g) => g.state !== "pass");
  return blocking ? `${blocking.label}: ${blocking.detail}` : null;
}

export type StepState = "done" | "current" | "pending" | "attention";
export interface WorkflowStep {
  key: string;
  label: string;
  state: StepState;
  detail: string | null;
}

export interface WorkflowInput {
  profileReady: boolean;
  consentValid: boolean;
  analysis: { createdAt: string } | null;
  draft: { status: RecommendationDraftStatus | string; submittedAt: string | null; approvedAt: string | null; releasedAt: string | null; reviewNotes?: string | null } | null;
}

/** Workflow derived from real state: profile → consent → AI analysis → counsellor edit → review → approval → release. */
export function workflowSteps(w: WorkflowInput): WorkflowStep[] {
  const status = w.draft?.status ?? null;
  const reached = (s: string[]) => status !== null && s.includes(status);
  const steps: WorkflowStep[] = [
    { key: "profile", label: "Profile ready", state: w.profileReady ? "done" : "current", detail: null },
    { key: "consent", label: "Consent recorded", state: w.consentValid ? "done" : w.profileReady ? "current" : "pending", detail: null },
    {
      key: "analysis",
      label: "AI analysis generated",
      state: w.analysis ? "done" : w.profileReady && w.consentValid ? "current" : "pending",
      detail: w.analysis ? formatDateTime(w.analysis.createdAt) : null,
    },
    {
      key: "edit",
      label: "Counsellor review & edit",
      state: status === "changes_requested" ? "attention" : status === "draft" ? "current" : reached(["submitted_for_review", "approved", "released_to_student"]) ? "done" : "pending",
      detail: status === "changes_requested" ? "Changes requested by the reviewer" : null,
    },
    {
      key: "submitted",
      label: "Submitted for review",
      state: status === "submitted_for_review" ? "current" : reached(["approved", "released_to_student"]) ? "done" : "pending",
      detail: w.draft?.submittedAt ? formatDateTime(w.draft.submittedAt) : null,
    },
    {
      key: "approved",
      label: "Independent approval",
      state: status === "approved" ? "done" : status === "released_to_student" ? "done" : "pending",
      detail: w.draft?.approvedAt ? formatDateTime(w.draft.approvedAt) : null,
    },
    {
      key: "released",
      label: "Released to student",
      state: status === "released_to_student" ? "done" : status === "approved" ? "current" : "pending",
      detail: w.draft?.releasedAt ? formatDateTime(w.draft.releasedAt) : null,
    },
  ];
  return steps;
}

/** The configured model shown on the provider bar (null when AI is off). */
export function configuredModel(config: AiConfig): string | null {
  return activeModel(config);
}

// ---------------------------------------------------------------------------
// View models built from stored data (report + ledger row, profile snapshot).
// ---------------------------------------------------------------------------


export interface AnalysisCareerView {
  careerId: string;
  slug: string;
  title: string;
  familyName: string;
  matchBandLabel: string;
  evidenceLabel: string;
  suitabilityLabel: string;
  fitExplanation: string;
  supportingEvidence: string[];
  skillsDemonstrated: string[];
  skillGaps: string[];
  unmetRequirements: string[];
  tradeOffs: string[];
  reasonsItMayNotSuit: string[];
  educationPathways: string[];
  catalogueEducationRoutes: string[];
  nextActions: string[];
  assumptionsToVerify: string[];
}

export interface AnalysisView {
  providerLabel: string;
  isLiveOpenAi: boolean;
  generatedAt: string;
  tokens: { input: number; output: number; cached: number; reasoning: number };
  costLabel: string;
  responseIdRecorded: boolean;
  schemaVersion: string;
  outcome: "recommendations" | "insufficient_data";
  overview: string;
  interpretation: { academicBackground: string; strengths: string[]; interests: string[]; motivations: string[]; priorities: string[]; uncertainties: string[]; financialConsiderations: string } | null;
  careers: AnalysisCareerView[];
  comparison: { summary: string; points: Array<{ careerId: string; title: string; distinctiveStrength: string; mainConcern: string }> } | null;
  academicDirection: { levelLabel: string; fields: string[]; rationale: string; toVerify: string[] } | null;
  developmentPlan: { shortTerm: Array<{ action: string; timeframe: string }>; longTerm: Array<{ action: string; timeframe: string }> } | null;
  missingInformation: string[];
  followUpQuestions: string[];
  uncertainties: string[];
  observations: string[];
  flags: string[];
}

export interface LedgerRunForView {
  provider: string;
  model: string;
  createdAt: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  cachedInputTokens: number;
  reasoningTokens: number;
  providerResponseId: string | null;
}

/** Token, cost, provider and model come from the LEDGER row (what was billed/recorded), not from text inside the report. */
export function buildAnalysisView(run: LedgerRunForView, report: CareerIntelligenceReport): AnalysisView {
  return {
    providerLabel: runProviderLabel(run.provider, run.model),
    isLiveOpenAi: run.provider === "openai",
    generatedAt: formatDateTime(run.createdAt),
    tokens: { input: run.inputTokens, output: run.outputTokens, cached: run.cachedInputTokens, reasoning: run.reasoningTokens },
    costLabel: formatUsd(run.estimatedCostUsd),
    responseIdRecorded: Boolean(run.providerResponseId),
    schemaVersion: report.schemaVersion,
    outcome: report.outcome,
    overview: report.overview,
    interpretation: report.profileInterpretation,
    careers: report.careers.map((c) => ({
      careerId: c.careerId,
      slug: c.slug,
      title: c.title,
      familyName: c.familyName,
      matchBandLabel: MATCH_BAND_LABELS[c.matchBand],
      evidenceLabel: EVIDENCE_LEVEL_LABELS[c.evidenceLevel],
      suitabilityLabel: SUITABILITY_LABELS[c.suitability],
      fitExplanation: c.fitExplanation,
      supportingEvidence: c.supportingEvidence,
      skillsDemonstrated: c.skillsDemonstrated,
      skillGaps: c.skillGaps,
      unmetRequirements: c.unmetRequirements,
      tradeOffs: c.tradeOffs,
      reasonsItMayNotSuit: c.reasonsItMayNotSuit,
      educationPathways: c.educationPathways,
      catalogueEducationRoutes: c.catalogueEducationRoutes,
      nextActions: c.nextActions,
      assumptionsToVerify: c.assumptionsToVerify,
    })),
    comparison: report.careerComparison,
    academicDirection: report.academicDirection
      ? { levelLabel: ACADEMIC_LEVEL_LABELS[report.academicDirection.recommendedLevel], fields: report.academicDirection.fields, rationale: report.academicDirection.rationale, toVerify: report.academicDirection.toVerify }
      : null,
    developmentPlan: report.developmentPlan,
    missingInformation: report.missingInformation,
    followUpQuestions: report.followUpQuestions,
    uncertainties: report.uncertainties,
    observations: report.counsellorObservations,
    flags: report.counsellorFlags.map((f) => f.note),
  };
}

/** A minimal, non-identifying snapshot for the workspace (no date of birth, gender, contact details or free text). */
export function buildSnapshotRows(s: StudentProfileSnapshot | null): Array<{ label: string; value: string }> {
  if (!s) return [];
  const rows: Array<{ label: string; value: string }> = [];
  const top = <T,>(items: T[], score: (x: T) => number, label: (x: T) => string, n = 3) =>
    [...items]
      .sort((a, b) => score(b) - score(a))
      .slice(0, n)
      .map(label)
      .join(", ");
  if (s.profile.currentStatus) rows.push({ label: "Current stage", value: labelFor(CURRENT_STATUS_OPTIONS, s.profile.currentStatus) });
  const edu = [...s.education].sort((a, b) => (b.endYear ?? b.startYear ?? 0) - (a.endYear ?? a.startYear ?? 0))[0];
  if (edu) rows.push({ label: "Latest education", value: [labelFor(EDUCATION_LEVEL_OPTIONS, edu.educationLevel), edu.fieldOfStudy].filter(Boolean).join(" · ") });
  if (s.subjectStrengths.length > 0) rows.push({ label: "Strongest subjects", value: top(s.subjectStrengths, (x) => x.rating, (x) => labelFor(SUBJECT_OPTIONS, x.subjectKey)) });
  if (s.interests.length > 0) rows.push({ label: "Top interests", value: top(s.interests, (x) => x.strength ?? 0, (x) => labelFor(INTEREST_OPTIONS, x.interestKey)) });
  if (s.skills.length > 0) {
    const order = { advanced: 3, intermediate: 2, beginner: 1 } as const;
    rows.push({ label: "Key skills", value: top(s.skills, (x) => order[x.level], (x) => labelFor([...TECHNICAL_SKILL_OPTIONS, ...TRANSFERABLE_SKILL_OPTIONS], x.skillKey), 4) });
  }
  if (s.careerPriorities.length > 0) rows.push({ label: "Career priorities", value: top(s.careerPriorities, (x) => x.rating, (x) => labelFor(CAREER_PRIORITY_OPTIONS, x.priorityKey)) });
  const budget = s.fundingPreferences?.budgetBand;
  const funding = s.fundingPreferences?.fundingSource;
  if (budget || funding) rows.push({ label: "Budget & funding", value: [budget ? labelFor(BUDGET_BAND_OPTIONS, budget) : null, funding ? labelFor(FUNDING_SOURCE_OPTIONS, funding) : null].filter(Boolean).join(" · ") });
  if (s.studyPreferences?.studyAbroad) rows.push({ label: "Open to studying abroad", value: s.studyPreferences.studyAbroad === "yes" ? "Yes" : s.studyPreferences.studyAbroad === "no" ? "No" : "Maybe" });
  return rows;
}
