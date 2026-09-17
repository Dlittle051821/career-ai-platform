import type { ApplicationStage, StudentApplicationAction } from "@/types/admin";

/**
 * Milestone 16 — Student Application Workflow. Pure, framework-free
 * business logic for the application lifecycle — no Supabase import, same
 * "pure logic lives in src/lib/<domain>/, I/O lives in
 * src/lib/supabase/<domain>/" split every prior milestone in this codebase
 * uses (src/lib/payments/, src/lib/admin/, etc.). Every function here is
 * directly unit-testable without mocking anything — see
 * application-lifecycle.test.ts.
 */

// ---------------------------------------------------------------------------
// Student self-service actions
// ---------------------------------------------------------------------------

interface StudentActionDefinition {
  /** The exact source stages this action is offered from — kept in lockstep with (a strict subset of) student_advance_application()'s own hardcoded from-stage sets in 0017_student_application_workflow.sql, and with APPLICATION_STAGE_TRANSITIONS in src/lib/admin/status.ts. */
  fromStages: readonly ApplicationStage[];
  toStage: ApplicationStage;
  /** The verb shown on the action's button. */
  buttonLabel: string;
  /** Whether this action should be confirmed before firing (irreversible or semantically significant). */
  requiresConfirmation: boolean;
}

export const STUDENT_APPLICATION_ACTIONS: Record<StudentApplicationAction, StudentActionDefinition> = {
  start_preparing: {
    fromStages: ["inquiry"],
    toStage: "preparing",
    buttonLabel: "Start preparing",
    requiresConfirmation: false,
  },
  mark_ready_to_submit: {
    fromStages: ["preparing"],
    toStage: "ready_to_submit",
    buttonLabel: "Mark ready to submit",
    requiresConfirmation: false,
  },
  submit: {
    fromStages: ["ready_to_submit"],
    toStage: "submitted",
    buttonLabel: "Mark as submitted",
    requiresConfirmation: true,
  },
  withdraw: {
    fromStages: ["inquiry", "preparing", "ready_to_submit", "submitted", "under_review", "interview"],
    toStage: "withdrawn",
    buttonLabel: "Withdraw application",
    requiresConfirmation: true,
  },
};

/** Every action a student may take from a given stage — usually zero or one "advance" action plus "withdraw", never more. */
export function getAvailableStudentActions(stage: ApplicationStage): StudentApplicationAction[] {
  return (Object.keys(STUDENT_APPLICATION_ACTIONS) as StudentApplicationAction[]).filter((action) =>
    STUDENT_APPLICATION_ACTIONS[action].fromStages.includes(stage)
  );
}

// ---------------------------------------------------------------------------
// Next action (spec §14) — deliberately local to the application detail
// context, never wired into the dashboard-level Next Best Action
// architecture (src/lib/dashboard/next-best-action.ts), which stays
// untouched by this milestone.
// ---------------------------------------------------------------------------

export interface ApplicationNextAction {
  label: string;
  /** The one primary student action this next-step corresponds to, when there is one to take right now. Null for a purely informational next step (e.g. "wait for the university"). */
  action: StudentApplicationAction | null;
}

/**
 * A short, honest description of what happens next — never claims a stage
 * this application hasn't actually reached, and never invents progress a
 * real status doesn't support (spec §14/§49).
 */
export function getApplicationNextAction(stage: ApplicationStage): ApplicationNextAction {
  switch (stage) {
    case "inquiry":
      return { label: "Continue preparing", action: "start_preparing" };
    case "preparing":
      return { label: "Mark ready when your application is complete", action: "mark_ready_to_submit" };
    case "ready_to_submit":
      return { label: "Mark as submitted once you've applied", action: "submit" };
    case "submitted":
      return { label: "Wait for the university to review your application", action: null };
    case "under_review":
      return { label: "Wait for the university's decision", action: null };
    case "interview":
      return { label: "Prepare for your interview", action: null };
    case "decision_pending":
      return { label: "A decision is expected soon", action: null };
    case "offer_received":
      return { label: "Review your offer", action: null };
    case "enrolled":
      return { label: "Application closed — you're enrolled", action: null };
    case "rejected":
      return { label: "Application closed", action: null };
    case "withdrawn":
      return { label: "Application withdrawn", action: null };
  }
}

// ---------------------------------------------------------------------------
// Progress / timeline (spec §10) — discrete stage state, never a fabricated
// completion percentage.
// ---------------------------------------------------------------------------

export type ProgressStageState = "complete" | "current" | "upcoming";

export interface ApplicationProgressStage {
  key: "started" | "preparing" | "submitted" | "under_review" | "decision";
  label: string;
  state: ProgressStageState;
}

const PROGRESS_ORDER: ApplicationProgressStage["key"][] = ["started", "preparing", "submitted", "under_review", "decision"];

/** Maps every real ApplicationStage onto one of the five honest, discrete progress milestones above. */
function progressIndexForStage(stage: ApplicationStage): number {
  switch (stage) {
    case "inquiry":
      return 0;
    case "preparing":
    case "ready_to_submit":
      return 1;
    case "submitted":
      return 2;
    case "under_review":
    case "interview":
      return 3;
    case "decision_pending":
    case "offer_received":
    case "enrolled":
    case "rejected":
      return 4;
    case "withdrawn":
      // Withdrawn has no honest position on a forward-moving progress bar —
      // callers should check isTerminalWithoutProgress() and render a
      // dedicated "Withdrawn" state instead of this stage list at all.
      return -1;
  }
}

/** True for a stage whose history must never be presented as if it still had a place on the forward-moving progress bar — never overwritten, just displayed differently (spec §10/§28). */
export function isTerminalWithoutProgress(stage: ApplicationStage): boolean {
  return stage === "withdrawn";
}

const PROGRESS_LABELS: Record<ApplicationProgressStage["key"], string> = {
  started: "Started",
  preparing: "Preparing",
  submitted: "Submitted",
  under_review: "Under review",
  decision: "Decision",
};

/**
 * The five-stage honest progress bar for a non-withdrawn application.
 * Everything at or before the application's current position is
 * 'complete', its own position is 'current' (unless the application has
 * reached a final decision, in which case 'decision' itself reads
 * 'complete' rather than merely 'current' — a decision has actually been
 * reached, not merely arrived at), and everything after is 'upcoming'.
 */
export function getApplicationProgressStages(stage: ApplicationStage): ApplicationProgressStage[] {
  const index = progressIndexForStage(stage);
  const isFinalDecision = stage === "offer_received" || stage === "rejected" || stage === "enrolled";
  return PROGRESS_ORDER.map((key, i) => {
    let state: ProgressStageState;
    if (index < 0) {
      state = "upcoming";
    } else if (i < index) {
      state = "complete";
    } else if (i === index) {
      state = key === "decision" && isFinalDecision ? "complete" : "current";
    } else {
      state = "upcoming";
    }
    return { key, label: PROGRESS_LABELS[key], state };
  });
}

// ---------------------------------------------------------------------------
// Dashboard grouping (spec §8) — Active / Submitted / Decision / Closed.
// ---------------------------------------------------------------------------

export type ApplicationBucket = "active" | "submitted" | "decision" | "closed";

export const APPLICATION_BUCKET_LABELS: Record<ApplicationBucket, string> = {
  active: "Active",
  submitted: "Submitted",
  decision: "Decision",
  closed: "Closed",
};

export function getApplicationBucket(stage: ApplicationStage): ApplicationBucket {
  switch (stage) {
    case "inquiry":
    case "preparing":
    case "ready_to_submit":
      return "active";
    case "submitted":
    case "under_review":
    case "interview":
      return "submitted";
    case "decision_pending":
    case "offer_received":
      return "decision";
    case "enrolled":
    case "rejected":
    case "withdrawn":
      return "closed";
  }
}

// ---------------------------------------------------------------------------
// Deadlines (spec §15/§16) — real data only, never a guessed date.
// ---------------------------------------------------------------------------

export interface CourseIntakeDeadlineInput {
  intakeName: string;
  priorityDeadline: string | null;
  finalDeadline: string | null;
  internationalDeadline: string | null;
}

export interface ResolvedApplicationDeadline {
  label: string;
  date: string;
}

/**
 * Picks the single most relevant real deadline off a linked course_intakes
 * row — final_deadline first (the hard cutoff), then international_deadline
 * (relevant for most of this platform's students), then priority_deadline
 * (soft/best-effort). Returns null (never a guessed date) when no intake is
 * linked or the intake itself has no deadline fields populated — callers
 * must render "Deadline not available" for null, never fabricate one.
 */
export function resolveApplicationDeadline(intake: CourseIntakeDeadlineInput | null): ResolvedApplicationDeadline | null {
  if (!intake) return null;
  if (intake.finalDeadline) return { label: `${intake.intakeName} — final deadline`, date: intake.finalDeadline };
  if (intake.internationalDeadline) return { label: `${intake.intakeName} — international deadline`, date: intake.internationalDeadline };
  if (intake.priorityDeadline) return { label: `${intake.intakeName} — priority deadline`, date: intake.priorityDeadline };
  return null;
}
