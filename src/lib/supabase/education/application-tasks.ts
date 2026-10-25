import "server-only";
import { createClient } from "../server";
import type { EducationActionResult } from "./saved-items";
import { isApplicationTaskType, isApplicationTaskStatus, type ApplicationTaskType, type ApplicationTaskStatus } from "@/lib/applications/application-tasks";

/**
 * NW06 — Student Action Required. Student-facing orchestration for reading
 * and completing tasks on the student's OWN application(s). Every read/write
 * goes through one of the three SECURITY DEFINER RPCs in
 * supabase/migrations-proposed/NW06_application_tasks.sql
 * (get_my_application_tasks/get_my_open_application_tasks/student_complete_
 * application_task) — this file never reads or writes `application_tasks`
 * directly, matching application-documents.ts's own "zero direct student
 * RLS access" convention.
 */

function logDbError(context: string, error: unknown) {
  console.error(`[education/application-tasks] ${context}:`, error);
}

type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

async function requireUserId(supabase: ServerSupabase): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");
  return user.id;
}

export interface MyApplicationTask {
  id: string;
  taskType: ApplicationTaskType | string;
  status: ApplicationTaskStatus | string;
  title: string;
  description: string | null;
  dueDate: string | null;
  relatedDocumentType: string | null;
  externalPaymentAmountMinorUnits: number | null;
  externalPaymentCurrency: string | null;
  externalPaymentPayee: string | null;
  externalPaymentInstructions: string | null;
  externalPaymentReference: string | null;
  studentNote: string | null;
  studentCompletedAt: string | null;
  evidenceDocumentId: string | null;
  verifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface MyApplicationTaskRow {
  id: string;
  task_type: string;
  status: string;
  title: string;
  description: string | null;
  due_date: string | null;
  related_document_type: string | null;
  external_payment_amount_minor_units: number | null;
  external_payment_currency: string | null;
  external_payment_payee: string | null;
  external_payment_instructions: string | null;
  external_payment_reference: string | null;
  student_note: string | null;
  student_completed_at: string | null;
  evidence_document_id: string | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

function toMyApplicationTask(row: MyApplicationTaskRow): MyApplicationTask {
  return {
    id: row.id,
    taskType: row.task_type,
    status: row.status,
    title: row.title,
    description: row.description,
    dueDate: row.due_date,
    relatedDocumentType: row.related_document_type,
    externalPaymentAmountMinorUnits: row.external_payment_amount_minor_units,
    externalPaymentCurrency: row.external_payment_currency,
    externalPaymentPayee: row.external_payment_payee,
    externalPaymentInstructions: row.external_payment_instructions,
    externalPaymentReference: row.external_payment_reference,
    studentNote: row.student_note,
    studentCompletedAt: row.student_completed_at,
    evidenceDocumentId: row.evidence_document_id,
    verifiedAt: row.verified_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * The logged-in student's own tasks for one of their own applications.
 * Returns `[]` (never throws) for a logged-out caller, an application id
 * that isn't the caller's, or any RPC error — matching listMyApplicationDocuments()'s
 * own fail-closed convention.
 */
export async function listMyApplicationTasks(applicationId: string): Promise<MyApplicationTask[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase.rpc("get_my_application_tasks", { p_application_id: applicationId });
  if (error) {
    logDbError("listMyApplicationTasks", error);
    return [];
  }

  return ((data ?? []) as unknown as MyApplicationTaskRow[]).map(toMyApplicationTask);
}

export interface MyOpenApplicationTaskSummary {
  id: string;
  applicationId: string;
  taskType: ApplicationTaskType | string;
  status: ApplicationTaskStatus | string;
  title: string;
  dueDate: string | null;
  externalPaymentAmountMinorUnits: number | null;
  externalPaymentCurrency: string | null;
  createdAt: string;
}

interface MyOpenApplicationTaskRow {
  id: string;
  application_id: string;
  task_type: string;
  status: string;
  title: string;
  due_date: string | null;
  external_payment_amount_minor_units: number | null;
  external_payment_currency: string | null;
  created_at: string;
}

/**
 * The logged-in student's own NOT-YET-CLOSED tasks across EVERY one of
 * their own applications at once — the single read the Abroad Application
 * Dashboard's (NW06.2) "Action required" panel/tile needs, instead of one
 * round trip per application. Returns `[]` on any failure, matching every
 * other read function in this module.
 */
export async function listMyOpenApplicationTasks(): Promise<MyOpenApplicationTaskSummary[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase.rpc("get_my_open_application_tasks");
  if (error) {
    logDbError("listMyOpenApplicationTasks", error);
    return [];
  }

  return ((data ?? []) as unknown as MyOpenApplicationTaskRow[]).map((row) => ({
    id: row.id,
    applicationId: row.application_id,
    taskType: row.task_type,
    status: row.status,
    title: row.title,
    dueDate: row.due_date,
    externalPaymentAmountMinorUnits: row.external_payment_amount_minor_units,
    externalPaymentCurrency: row.external_payment_currency,
    createdAt: row.created_at,
  }));
}

/**
 * Marks one of the student's own tasks complete — including, for an
 * `external_payment` task, acknowledging that the student paid the named
 * third party directly. This is a SELF-REPORT ONLY: it can never move a
 * task to `verified_complete` (only staff can, via
 * staff_update_application_task_status()) and is never presented to the
 * student as proof of anything beyond "I have told Nextwise I did this".
 */
export async function completeMyApplicationTask(
  taskId: string,
  options: { note?: string; evidenceDocumentId?: string | null } = {}
): Promise<EducationActionResult> {
  const supabase = await createClient();
  try {
    await requireUserId(supabase);
  } catch {
    return { success: false, error: "You need to be logged in to update a task." };
  }

  const { error } = await supabase.rpc("student_complete_application_task", {
    p_task_id: taskId,
    p_student_note: options.note ?? null,
    p_evidence_document_id: options.evidenceDocumentId ?? null,
  });
  if (error) {
    logDbError("completeMyApplicationTask", error);
    return { success: false, error: error.message || "We couldn't update this task. Please try again." };
  }
  return { success: true };
}

export { isApplicationTaskType, isApplicationTaskStatus };
