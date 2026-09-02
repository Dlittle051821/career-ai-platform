import "server-only";
import { createClient } from "../server";
import { requireAdminPermission } from "../admin-auth";
import { recordAuditLog } from "./audit";
import { AdminValidationError } from "@/lib/admin/form-state";
import { validateSaveDiscoverySessionWorkspace } from "@/lib/discovery-sessions/rules";
import { trackEvent } from "../analytics/track";
import type { Json } from "@/types/database";
import type {
  AcademicsSection,
  BudgetFinancialSection,
  DiscoverySessionWorkspace,
  GoalsSection,
  InterestsSection,
  ParentSponsorInputSection,
  RecommendationReadinessNotesSection,
  StudentBasicsSection,
  StudentUncertaintySection,
} from "@/types/discovery-session";

function logDbError(context: string, error: unknown) {
  console.error(`[admin/discovery-session-workspace] ${context}:`, error);
}

interface DiscoverySessionWorkspaceRow {
  session_id: string;
  student_basics: Json;
  academics: Json;
  interests: Json;
  goals: Json;
  budget_financial: Json;
  parent_sponsor_input: Json;
  student_uncertainty: Json;
  counsellor_notes: string | null;
  recommendation_readiness_notes: Json;
  missing_information: string[];
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

function toWorkspace(row: DiscoverySessionWorkspaceRow): DiscoverySessionWorkspace {
  return {
    sessionId: row.session_id,
    studentBasics: (row.student_basics as StudentBasicsSection) ?? {},
    academics: (row.academics as AcademicsSection) ?? {},
    interests: (row.interests as InterestsSection) ?? {},
    goals: (row.goals as GoalsSection) ?? {},
    budgetFinancial: (row.budget_financial as BudgetFinancialSection) ?? {},
    parentSponsorInput: (row.parent_sponsor_input as ParentSponsorInputSection) ?? {},
    studentUncertainty: (row.student_uncertainty as StudentUncertaintySection) ?? {},
    counsellorNotes: row.counsellor_notes,
    recommendationReadinessNotes: (row.recommendation_readiness_notes as RecommendationReadinessNotesSection) ?? {},
    missingInformation: row.missing_information ?? [],
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Returns null when no workspace has been started yet — a real, distinguishable state from "session not found" (callers check the parent discovery_sessions row separately). */
export async function getDiscoverySessionWorkspace(sessionId: string): Promise<DiscoverySessionWorkspace | null> {
  await requireAdminPermission("discovery-sessions:read");
  const supabase = await createClient();
  const { data, error } = await supabase.from("discovery_session_workspace").select("*").eq("session_id", sessionId).maybeSingle();
  if (error) {
    logDbError("getDiscoverySessionWorkspace", error);
    return null;
  }
  return data ? toWorkspace(data) : null;
}

function commaListToArray(value: FormDataEntryValue | null): string[] {
  return String(value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function linesToArray(value: FormDataEntryValue | null): string[] {
  return String(value ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

function str(formData: FormData, key: string): string | undefined {
  const value = String(formData.get(key) ?? "").trim();
  return value || undefined;
}

/**
 * One combined save covering every workspace section (A-J) — a counsellor
 * fills in what came up in the conversation, not every field every time
 * (spec: structured, not a rigid mandatory form), so every field here is
 * optional and an empty section just becomes `{}`. Upserts by session_id;
 * fires discovery_session_started the first time a workspace row is
 * created for a session (never on a later edit).
 */
export async function saveDiscoverySessionWorkspace(
  sessionId: string,
  sessionStatus: string,
  formData: FormData
): Promise<void> {
  const admin = await requireAdminPermission("discovery-sessions:write");
  const check = validateSaveDiscoverySessionWorkspace({
    hasPermission: true,
    sessionExists: true,
    status: sessionStatus as Parameters<typeof validateSaveDiscoverySessionWorkspace>[0]["status"],
  });
  if (!check.ok) throw new AdminValidationError(check.reason);

  const supabase = await createClient();
  const { data: existing } = await supabase.from("discovery_session_workspace").select("session_id").eq("session_id", sessionId).maybeSingle();
  const isFirstSave = !existing;

  const studentBasics: StudentBasicsSection = {
    preferredName: str(formData, "studentBasics.preferredName"),
    currentCity: str(formData, "studentBasics.currentCity"),
    currentEducationStage: str(formData, "studentBasics.currentEducationStage"),
    languageSpokenAtHome: str(formData, "studentBasics.languageSpokenAtHome"),
    howTheyHeardAboutUs: str(formData, "studentBasics.howTheyHeardAboutUs"),
  };

  const academics: AcademicsSection = {
    currentInstitution: str(formData, "academics.currentInstitution"),
    board: str(formData, "academics.board"),
    recentScoreSummary: str(formData, "academics.recentScoreSummary"),
    strongSubjects: commaListToArray(formData.get("academics.strongSubjects")),
    weakSubjects: commaListToArray(formData.get("academics.weakSubjects")),
    backlogsOrGaps: str(formData, "academics.backlogsOrGaps"),
  };

  const interests: InterestsSection = {
    statedInterests: commaListToArray(formData.get("interests.statedInterests")),
    observedInterests: commaListToArray(formData.get("interests.observedInterests")),
    extracurriculars: str(formData, "interests.extracurriculars"),
  };

  const clarityRaw = str(formData, "goals.clarityLevel");
  const goals: GoalsSection = {
    statedGoal: str(formData, "goals.statedGoal"),
    clarityLevel: clarityRaw === "clear" || clarityRaw === "some_ideas" || clarityRaw === "not_sure" ? clarityRaw : undefined,
    shortTermGoal: str(formData, "goals.shortTermGoal"),
    longTermGoal: str(formData, "goals.longTermGoal"),
  };

  const budgetFinancial: BudgetFinancialSection = {
    statedBudgetBand: str(formData, "budgetFinancial.statedBudgetBand"),
    fundingSource: str(formData, "budgetFinancial.fundingSource"),
    loanOpenness: str(formData, "budgetFinancial.loanOpenness"),
    notes: str(formData, "budgetFinancial.notes"),
  };

  const parentSponsorInput: ParentSponsorInputSection = {
    parentPresent: formData.get("parentSponsorInput.parentPresent") === "on",
    parentExpectations: str(formData, "parentSponsorInput.parentExpectations"),
    parentConcerns: str(formData, "parentSponsorInput.parentConcerns"),
    sponsorName: str(formData, "parentSponsorInput.sponsorName"),
  };

  const emotionalReadinessRaw = str(formData, "studentUncertainty.emotionalReadiness");
  const studentUncertainty: StudentUncertaintySection = {
    primaryUncertainty: str(formData, "studentUncertainty.primaryUncertainty"),
    optionsBeingConsidered: commaListToArray(formData.get("studentUncertainty.optionsBeingConsidered")),
    emotionalReadiness:
      emotionalReadinessRaw === "low" || emotionalReadinessRaw === "medium" || emotionalReadinessRaw === "high" ? emotionalReadinessRaw : undefined,
  };

  const recommendationReadinessNotes: RecommendationReadinessNotesSection = {
    counsellorAssessment: {
      career: str(formData, "recommendationReadinessNotes.career"),
      course: str(formData, "recommendationReadinessNotes.course"),
      college: str(formData, "recommendationReadinessNotes.college"),
      pathway: str(formData, "recommendationReadinessNotes.pathway"),
    },
  };

  const counsellorNotes = str(formData, "counsellorNotes") ?? null;
  const missingInformation = linesToArray(formData.get("missingInformation"));

  const { error } = await supabase.from("discovery_session_workspace").upsert(
    {
      session_id: sessionId,
      student_basics: studentBasics as unknown as Json,
      academics: academics as unknown as Json,
      interests: interests as unknown as Json,
      goals: goals as unknown as Json,
      budget_financial: budgetFinancial as unknown as Json,
      parent_sponsor_input: parentSponsorInput as unknown as Json,
      student_uncertainty: studentUncertainty as unknown as Json,
      counsellor_notes: counsellorNotes,
      recommendation_readiness_notes: recommendationReadinessNotes as unknown as Json,
      missing_information: missingInformation,
      updated_by: admin.userId,
    },
    { onConflict: "session_id" }
  );
  if (error) {
    logDbError("saveDiscoverySessionWorkspace", error);
    throw new Error(error.message);
  }

  await recordAuditLog({
    action: isFirstSave ? "Created" : "Updated",
    entityType: "discovery_session",
    entityId: sessionId,
    entityLabel: "Discovery Session Counsellor Workspace",
    context: { actorRole: admin.role, isFirstSave },
  });

  if (isFirstSave) {
    void trackEvent({
      eventName: "discovery_session_started",
      source: "admin_discovery_session_workspace",
      feature: "onboarding",
      entityType: "discovery_session",
      entityId: sessionId,
    });
  }
}
