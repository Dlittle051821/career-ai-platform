import "server-only";
import { createClient } from "../server";
import { requireAdminPermission } from "../admin-auth";
import { AdminValidationError } from "@/lib/admin/form-state";
import { isApplicationChecklistItemKey, type ApplicationChecklistItemKey, type ManualChecklistItemState } from "@/lib/applications/application-checklist";
import { recordAuditLog } from "./audit";

/**
 * Milestone 18 — the four manually-toggled operational checklist items
 * (see src/lib/applications/application-checklist.ts for the derived-item
 * logic and the full "why only four are stored" reasoning). Reads/writes
 * public.application_checklist_items directly under its own RLS policies
 * (0020_application_processing_workspace.sql PART 4) — same "this table has
 * its own admin/counsellor RLS SELECT/INSERT/UPDATE policy, so this file
 * reads/writes it directly rather than through an RPC" posture as
 * src/lib/supabase/admin/application-documents.ts's read path, not the
 * student-facing "RPC is the entire boundary" posture (this table has no
 * student access at all, so that distinction does not apply here either
 * way).
 */

function logDbError(context: string, error: unknown) {
  console.error(`[admin/application-checklist] ${context}:`, error);
}

interface ChecklistItemRow {
  item_key: string;
  completed_at: string | null;
}

/**
 * Every stored checklist row for one application — an item with no row at
 * all is simply absent from this list (never a placeholder row), and the
 * caller (getApplicationChecklistView() in the pure logic module) treats a
 * missing key as "pending". Requires `application-documents:review` — the
 * same M18 workspace-access boundary as document review — never the
 * broader `applications:read` alone.
 */
export async function getApplicationChecklistItems(applicationId: string): Promise<ManualChecklistItemState[]> {
  await requireAdminPermission("application-documents:review");
  const supabase = await createClient();

  const { data, error } = await supabase.from("application_checklist_items").select("item_key, completed_at").eq("application_id", applicationId);
  if (error) {
    logDbError("getApplicationChecklistItems", error);
    return [];
  }

  return ((data ?? []) as ChecklistItemRow[])
    .filter((row) => isApplicationChecklistItemKey(row.item_key))
    .map((row) => ({ key: row.item_key as ApplicationChecklistItemKey, completedAt: row.completed_at }));
}

/**
 * Marks one checklist item complete or incomplete for one application. A
 * single upsert on the (application_id, item_key) unique constraint
 * (0020 PART 4) — never a separate exists-then-insert-or-update round trip
 * — so two staff toggling the same item at nearly the same time converge on
 * one final row rather than racing a duplicate insert. completed_by/
 * completed_at are always server-derived (the caller's own auth.uid()/now()
 * via the RLS WITH CHECK, never a client-supplied value) — this function
 * itself never accepts either as a parameter.
 */
export async function toggleApplicationChecklistItem(applicationId: string, itemKey: string, completed: boolean): Promise<void> {
  const admin = await requireAdminPermission("application-documents:review");

  if (!isApplicationChecklistItemKey(itemKey)) {
    throw new AdminValidationError("This checklist item is not recognized.");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("application_checklist_items").upsert(
    {
      application_id: applicationId,
      item_key: itemKey,
      completed_at: completed ? new Date().toISOString() : null,
      completed_by: completed ? admin.userId : null,
    },
    { onConflict: "application_id,item_key" }
  );

  if (error) {
    logDbError("toggleApplicationChecklistItem", error);
    throw new Error("We couldn't update this checklist item. Please try again.");
  }

  await recordAuditLog({
    action: completed ? "Checklist item completed" : "Checklist item reopened",
    entityType: "application",
    entityId: applicationId,
    entityLabel: `checklist item ${itemKey} on application ${applicationId}`,
    context: { itemKey, completed, actorRole: admin.role },
  });
}
