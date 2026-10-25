import "server-only";
import { createClient } from "../server";
import { requireAdminPermission } from "../admin-auth";
import { recordAuditLog } from "./audit";
import { AdminValidationError } from "@/lib/admin/form-state";
import {
  isApplicationTaskType,
  isApplicationTaskStatus,
  type ApplicationTaskType,
  type ApplicationTaskStatus,
} from "@/lib/applications/application-tasks";

/**
 * NW06 — Student Action Required. Staff-facing orchestration. Every
 * read/write goes through one of the three SECURITY DEFINER RPCs in
 * supabase/migrations-proposed/NW06_application_tasks.sql
 * (staff_create_application_task/staff_update_application_task_status), or
 * a plain RLS-scoped SELECT for listing (this table's RLS, PART 3 of that
 * migration, already grants staff the right rows — the same "staff reads
 * through RLS directly, staff writes through an RPC because the write is a
 * state machine" split application_documents/application_submissions
 * already use). Gated by the new `application-tasks:read`/`write`
 * permission pair (src/lib/admin/permissions.ts).
 */

function logDbError(context: string, error: unknown) {
  console.error(`[admin/application-tasks] ${context}:`, error);
}

export interface AdminApplicationTask {
  id: string;
  applicationId: string;
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
  /** STAFF-ONLY. */
  staffNote: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface AdminApplicationTaskRow {
  id: string;
  application_id: string;
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
  staff_note: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

function toAdminApplicationTask(row: AdminApplicationTaskRow): AdminApplicationTask {
  return {
    id: row.id,
    applicationId: row.application_id,
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
    staffNote: row.staff_note,
    cancelledAt: row.cancelled_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Every task on one application, newest first. Requires `application-tasks:read`; RLS further scopes a counsellor to only their own assigned applications regardless of this permission check succeeding. */
export async function listApplicationTasks(applicationId: string): Promise<AdminApplicationTask[]> {
  await requireAdminPermission("application-tasks:read");
  const supabase = await createClient();

  const { data, error } = await supabase.from("application_tasks").select("*").eq("application_id", applicationId).order("created_at", { ascending: false });
  if (error) {
    logDbError("listApplicationTasks", error);
    return [];
  }
  return ((data ?? []) as AdminApplicationTaskRow[]).map(toAdminApplicationTask);
}

export interface CreateApplicationTaskInput {
  applicationId: string;
  taskType: string;
  title: string;
  description?: string | null;
  dueDate?: string | null;
  relatedDocumentType?: string | null;
  externalPaymentAmountMinorUnits?: number | null;
  externalPaymentCurrency?: string | null;
  externalPaymentPayee?: string | null;
  externalPaymentInstructions?: string | null;
  externalPaymentReference?: string | null;
}

/**
 * Creates a new task on an application. Delegates every validation rule
 * (title length, type-specific required fields, authorization/assignment)
 * to `staff_create_application_task()` — this function does no validation
 * of its own beyond the task-type/title presence check needed to give a
 * clean `AdminValidationError` before round-tripping to the database, by
 * the same "don't duplicate the RPC's own rules here" discipline
 * `toggleApplicationChecklistItem()` already uses.
 */
export async function createApplicationTask(input: CreateApplicationTaskInput): Promise<void> {
  const admin = await requireAdminPermission("application-tasks:write");

  if (!isApplicationTaskType(input.taskType)) {
    throw new AdminValidationError("This task type is not recognized.");
  }
  if (!input.title.trim()) {
    throw new AdminValidationError("A task title is required.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("staff_create_application_task", {
    p_application_id: input.applicationId,
    p_task_type: input.taskType,
    p_title: input.title,
    p_description: input.description ?? null,
    p_due_date: input.dueDate ?? null,
    p_related_document_type: input.relatedDocumentType ?? null,
    p_external_payment_amount_minor_units: input.externalPaymentAmountMinorUnits ?? null,
    p_external_payment_currency: input.externalPaymentCurrency ?? null,
    p_external_payment_payee: input.externalPaymentPayee ?? null,
    p_external_payment_instructions: input.externalPaymentInstructions ?? null,
    p_external_payment_reference: input.externalPaymentReference ?? null,
  });
  if (error) {
    logDbError("createApplicationTask", error);
    throw new AdminValidationError(error.message || "We couldn't create this task. Please try again.");
  }

  const createdId = (data ?? [])[0]?.id ?? null;
  await recordAuditLog({
    action: "Task created",
    entityType: "application",
    entityId: input.applicationId,
    entityLabel: `task "${input.title}" on application ${input.applicationId}`,
    context: { taskId: createdId, taskType: input.taskType, actorRole: admin.role },
  });
}

/**
 * Moves a task to a new status (reviewing it, verifying a student's
 * self-reported completion — including an external-payment acknowledgement
 * — reopening it, or cancelling it). Every transition rule and every
 * server-derived timestamp lives in `staff_update_application_task_status()`
 * — this function relays its errors as-is (they are already safe, honest,
 * user-facing text, same "relay as-is" discipline `advanceMyApplication()`
 * uses for its own RPC).
 */
export async function updateApplicationTaskStatus(taskId: string, status: string, staffNote?: string | null): Promise<void> {
  const admin = await requireAdminPermission("application-tasks:write");

  if (!isApplicationTaskStatus(status)) {
    throw new AdminValidationError("This task status is not recognized.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("staff_update_application_task_status", {
    p_task_id: taskId,
    p_status: status,
    p_staff_note: staffNote ?? null,
  });
  if (error) {
    logDbError("updateApplicationTaskStatus", error);
    throw new AdminValidationError(error.message || "We couldn't update this task. Please try again.");
  }

  const applicationId = (data ?? [])[0]?.application_id ?? null;
  await recordAuditLog({
    action: `Task status changed to "${status}"`,
    entityType: "application",
    entityId: applicationId ?? taskId,
    entityLabel: `task ${taskId}`,
    context: { taskId, status, actorRole: admin.role },
  });
}
