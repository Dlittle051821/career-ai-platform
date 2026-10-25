/**
 * NW06 — Student Action Required task system. Pure, framework-free
 * taxonomy and classification logic — no Supabase import, same
 * "pure logic lives in src/lib/applications/, I/O lives in
 * src/lib/supabase/<domain>/" convention as application-lifecycle.ts/
 * application-documents.ts (Milestones 16/17). See
 * supabase/migrations-proposed/NW06_application_tasks.sql for the backing
 * schema and docs/milestones/NW06/NW06_01_EXISTING_SYSTEM_AUDIT.md §2.6/§2.7
 * for why this exists.
 */

export const APPLICATION_TASK_TYPES = [
  "document_upload",
  "document_replacement",
  "application_review",
  "application_correction",
  "external_payment",
  "information_request",
  "other_approved_action",
] as const;

export type ApplicationTaskType = (typeof APPLICATION_TASK_TYPES)[number];

export function isApplicationTaskType(value: string): value is ApplicationTaskType {
  return (APPLICATION_TASK_TYPES as readonly string[]).includes(value);
}

export const APPLICATION_TASK_TYPE_LABELS: Record<ApplicationTaskType, string> = {
  document_upload: "Upload a document",
  document_replacement: "Replace a document",
  application_review: "Review your application",
  application_correction: "Make a correction",
  external_payment: "Pay a fee directly to the university",
  information_request: "Provide information",
  other_approved_action: "Complete an action",
};

export const APPLICATION_TASK_STATUSES = ["open", "in_progress", "student_completed", "verified_complete", "cancelled"] as const;

export type ApplicationTaskStatus = (typeof APPLICATION_TASK_STATUSES)[number];

export function isApplicationTaskStatus(value: string): value is ApplicationTaskStatus {
  return (APPLICATION_TASK_STATUSES as readonly string[]).includes(value);
}

export const APPLICATION_TASK_STATUS_LABELS: Record<ApplicationTaskStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  student_completed: "Marked done — awaiting verification",
  verified_complete: "Verified complete",
  cancelled: "Cancelled",
};

/** The fixed staff-side transition table, restated here in pure TS purely for UI purposes (which status buttons to show) — the DATABASE-AUTHORITATIVE copy lives in staff_update_application_task_status() (NW06_application_tasks.sql PART 5); this is never trusted as the security boundary, only as a UI convenience so an impossible button is never rendered. */
export function getAllowedStaffTaskTransitions(currentStatus: ApplicationTaskStatus): ApplicationTaskStatus[] {
  switch (currentStatus) {
    case "open":
      return ["in_progress", "cancelled"];
    case "in_progress":
      return ["open", "cancelled"];
    case "student_completed":
      return ["verified_complete", "open", "in_progress", "cancelled"];
    case "verified_complete":
    case "cancelled":
      return [];
  }
}

/** True for a status a student may still act on (complete, or amend before verification) — open/in_progress/student_completed. False for the two terminal states. */
export function isApplicationTaskOpenForStudent(status: ApplicationTaskStatus): boolean {
  return status === "open" || status === "in_progress" || status === "student_completed";
}

/** True only for a status that should count toward "you have something to do right now" badges/tiles — deliberately excludes student_completed (the student already acted; it is now waiting on staff, not on them) as well as both terminal states. */
export function isApplicationTaskActionableByStudent(status: ApplicationTaskStatus): boolean {
  return status === "open" || status === "in_progress";
}

export interface ApplicationTaskDueSummary {
  task: {
    id: string;
    status: ApplicationTaskStatus;
    dueDate: string | null;
  };
}

/** True when a still-open task's due date has passed. Never computed for a closed/verified/cancelled task — a date is only "overdue" if something is genuinely still outstanding against it. Pure (caller supplies `now` for testability). */
export function isApplicationTaskOverdue(status: ApplicationTaskStatus, dueDate: string | null, now: Date = new Date()): boolean {
  if (!dueDate) return false;
  if (!isApplicationTaskActionableByStudent(status)) return false;
  return new Date(dueDate).getTime() < now.getTime();
}

export interface ApplicationTaskSummaryInput {
  id: string;
  status: ApplicationTaskStatus;
  dueDate: string | null;
}

export interface ApplicationTaskCounts {
  actionableCount: number;
  overdueCount: number;
  awaitingVerificationCount: number;
}

/**
 * Pure tally used by the Abroad Application Dashboard's "Action required"
 * tile and panel (NW06.2) — counts across however many tasks the caller
 * passes in (typically the output of get_my_open_application_tasks(),
 * already scoped to the caller's own applications). Never fabricates a
 * count for a task type/status this module does not recognize.
 */
export function summarizeApplicationTasks(tasks: readonly ApplicationTaskSummaryInput[], now: Date = new Date()): ApplicationTaskCounts {
  let actionableCount = 0;
  let overdueCount = 0;
  let awaitingVerificationCount = 0;
  for (const task of tasks) {
    if (isApplicationTaskActionableByStudent(task.status)) {
      actionableCount += 1;
      if (isApplicationTaskOverdue(task.status, task.dueDate, now)) overdueCount += 1;
    } else if (task.status === "student_completed") {
      awaitingVerificationCount += 1;
    }
  }
  return { actionableCount, overdueCount, awaitingVerificationCount };
}
