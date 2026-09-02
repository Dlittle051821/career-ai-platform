/**
 * Milestone 11-B — Discovery Session booking + Counsellor Workspace types.
 *
 * `DISCOVERY_SESSION` is deliberately the only session type this milestone
 * defines (supabase/migrations/0013_..._and_recommendation_readiness.sql
 * PART 2's session_type CHECK constraint enforces the same thing at the
 * database level) — a real general-purpose counselling scheduler is out of
 * scope; this is purpose-built for the Assisted Onboarding flow's free
 * first conversation only.
 */

export const DISCOVERY_SESSION_TYPES = ["DISCOVERY_SESSION"] as const;
export type DiscoverySessionType = (typeof DISCOVERY_SESSION_TYPES)[number];

export const DISCOVERY_SESSION_STATUSES = ["requested", "scheduled", "completed", "cancelled", "no_show"] as const;
export type DiscoverySessionStatus = (typeof DISCOVERY_SESSION_STATUSES)[number];

export const DISCOVERY_SESSION_STATUS_LABELS: Record<DiscoverySessionStatus, string> = {
  requested: "Requested",
  scheduled: "Scheduled",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No-show",
};

export const DISCOVERY_SESSION_CONTACT_METHODS = ["phone", "video", "whatsapp"] as const;
export type DiscoverySessionContactMethod = (typeof DISCOVERY_SESSION_CONTACT_METHODS)[number];

export interface DiscoverySession {
  id: string;
  studentUserId: string;
  studentName: string | null;
  studentEmail: string | null;
  sessionType: DiscoverySessionType;
  status: DiscoverySessionStatus;
  assignedCounsellorId: string | null;
  assignedCounsellorName: string | null;
  preferredContactMethod: DiscoverySessionContactMethod | null;
  preferredTimeRange: string | null;
  preferredLanguage: string | null;
  studentNotes: string | null;
  scheduledAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Milestone 11-B2 — the Discovery Session Counsellor Workspace, sections
 * A-J. Every jsonb section below is a plain, optional-field bag rather than
 * a required, fully-typed record — a counsellor fills in what came up in
 * the conversation, not every field every time (spec: structured, not a
 * rigid mandatory form). Section content is intentionally NOT surfaced to
 * the student directly (src/types/database.ts's DiscoverySessionWorkspaceRow
 * comment / the migration's own RLS policies keep it staff-only) — anything
 * that should reach the student's real profile goes through the explicit
 * "apply to profile" write path in M11-C1, which also stamps provenance.
 */
export interface StudentBasicsSection {
  preferredName?: string;
  currentCity?: string;
  currentEducationStage?: string;
  languageSpokenAtHome?: string;
  howTheyHeardAboutUs?: string;
}

export interface AcademicsSection {
  currentInstitution?: string;
  board?: string;
  recentScoreSummary?: string;
  strongSubjects?: string[];
  weakSubjects?: string[];
  backlogsOrGaps?: string;
}

export interface InterestsSection {
  statedInterests?: string[];
  observedInterests?: string[];
  extracurriculars?: string;
}

export interface GoalsSection {
  statedGoal?: string;
  clarityLevel?: "clear" | "some_ideas" | "not_sure";
  shortTermGoal?: string;
  longTermGoal?: string;
}

export interface BudgetFinancialSection {
  statedBudgetBand?: string;
  fundingSource?: string;
  loanOpenness?: string;
  notes?: string;
}

export interface ParentSponsorInputSection {
  parentPresent?: boolean;
  parentExpectations?: string;
  parentConcerns?: string;
  sponsorName?: string;
}

export interface StudentUncertaintySection {
  primaryUncertainty?: string;
  optionsBeingConsidered?: string[];
  emotionalReadiness?: "low" | "medium" | "high";
}

export type RecommendationTypeForReadiness = "career" | "course" | "college" | "pathway";

export interface RecommendationReadinessNotesSection {
  counsellorAssessment?: Partial<Record<RecommendationTypeForReadiness, string>>;
}

export interface DiscoverySessionWorkspace {
  sessionId: string;
  studentBasics: StudentBasicsSection;
  academics: AcademicsSection;
  interests: InterestsSection;
  goals: GoalsSection;
  budgetFinancial: BudgetFinancialSection;
  parentSponsorInput: ParentSponsorInputSection;
  studentUncertainty: StudentUncertaintySection;
  counsellorNotes: string | null;
  recommendationReadinessNotes: RecommendationReadinessNotesSection;
  missingInformation: string[];
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}
