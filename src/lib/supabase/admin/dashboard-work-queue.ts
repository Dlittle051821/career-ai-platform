import "server-only";
import { createClient } from "../server";
import { requireAdminPermission } from "../admin-auth";
import { listApplicationDocumentsForAdminBatch } from "./application-documents";
import { getApplicationChecklistItemsBatch } from "./application-checklist";
import {
  getApplicationDocumentCompleteness,
  getApplicationDocumentReviewCompleteness,
  type ApplicationDocumentType,
} from "@/lib/applications/application-documents";
import { getNextOperationalAction } from "@/lib/applications/next-operational-action";
import { getWorkQueueBucket, type WorkQueueBucket } from "@/lib/applications/application-work-queue";
import type { AdminRole, ApplicationStage } from "@/types/admin";
import { hasPermission } from "@/lib/admin/permissions";

/**
 * UX09 — the admin dashboard's "Applications needing your attention" widget
 * (task Part A, "ADMIN DASHBOARD"). Deliberately narrow: a BOUNDED scan of
 * the most recently updated, non-terminal applications (never an unbounded
 * "all applications" query), batched document/checklist reads (never N+1
 * queries), and `getNextOperationalAction()` reused as-is (never a second
 * rules engine — same explicit instruction as the applications list page).
 *
 * "Needing attention" here means the `needs_action` work-queue bucket
 * specifically (a document to review, a missing document to chase, a
 * checklist item to finish, or a reference to add) — the bucket a
 * counsellor can personally resolve right now, which is the whole point of
 * a dashboard widget. `waiting_on_student`/`awaiting_university` items are
 * deliberately excluded: those are real, but nothing on this DASHBOARD can
 * move them forward faster than opening the application itself already
 * would, so surfacing them here would just be noise competing with the
 * items that genuinely benefit from being seen first.
 */

export interface DashboardWorkQueueApplication {
  id: string;
  studentName: string | null;
  universityName: string | null;
  stage: ApplicationStage;
  bucket: WorkQueueBucket;
  actionLabel: string;
  updatedAt: string;
}

const CANDIDATE_STAGES: readonly ApplicationStage[] = ["inquiry", "preparing", "ready_to_submit", "submitted", "under_review", "interview", "decision_pending"];

interface AppRow {
  id: string;
  student_user_id: string;
  stage: string;
  updated_at: string;
}

function logDbError(context: string, error: unknown) {
  console.error(`[admin/dashboard-work-queue] ${context}:`, error);
}

/**
 * @param role the caller's admin role — a caller without
 *   `application-documents:read` gets an empty list rather than a thrown
 *   error, so the dashboard page can render the rest of the page normally
 *   for finance/analyst/content_editor (same "card/section simply doesn't
 *   appear" posture as every other M18/M19 gated section, see
 *   src/app/admin/applications/[id]/page.tsx).
 * @param limit how many results to return (default 5 — a dashboard widget,
 *   not a second applications list).
 * @param scanLimit the bounded candidate pool size (default 40) — the most
 *   recently updated non-terminal applications are scanned, batched, and
 *   filtered down to `limit`; raising this raises query cost, so it stays a
 *   deliberately small, explicit constant rather than "all applications".
 */
export async function getApplicationsNeedingAttention(role: AdminRole | undefined, limit = 5, scanLimit = 40): Promise<DashboardWorkQueueApplication[]> {
  if (!hasPermission(role, "application-documents:read")) return [];
  await requireAdminPermission("application-documents:read");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("applications")
    .select("id, student_user_id, stage, updated_at")
    .in("stage", CANDIDATE_STAGES)
    .order("updated_at", { ascending: false })
    .limit(scanLimit);

  if (error) {
    logDbError("getApplicationsNeedingAttention", error);
    return [];
  }

  const rows = (data ?? []) as AppRow[];
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const [documentsByApp, checklistByApp, studentNameById] = await Promise.all([
    listApplicationDocumentsForAdminBatch(ids),
    getApplicationChecklistItemsBatch(ids),
    buildStudentNameMap(supabase, rows.map((r) => r.student_user_id)),
  ]);

  const results: DashboardWorkQueueApplication[] = [];
  for (const row of rows) {
    const documents = documentsByApp.get(row.id) ?? [];
    const checklistItems = checklistByApp.get(row.id) ?? [];
    const documentCompleteness = getApplicationDocumentCompleteness(documents.map((d) => ({ documentType: d.documentType as ApplicationDocumentType, originalFilename: d.originalFilename })));
    const documentReviewCompleteness = getApplicationDocumentReviewCompleteness(documents.map((d) => ({ documentType: d.documentType as ApplicationDocumentType, reviewStatus: d.reviewStatus })));
    const nextAction = getNextOperationalAction({
      stage: row.stage as ApplicationStage,
      currentDocuments: documents.map((d) => ({ documentType: d.documentType as ApplicationDocumentType, reviewStatus: d.reviewStatus })),
      documentCompleteness,
      documentReviewCompleteness,
      manualChecklistItems: checklistItems,
    });
    const bucket = getWorkQueueBucket(nextAction.kind);
    if (bucket !== "needs_action") continue;

    results.push({
      id: row.id,
      studentName: studentNameById.get(row.student_user_id) ?? null,
      universityName: null,
      stage: row.stage as ApplicationStage,
      bucket,
      actionLabel: nextAction.label,
      updatedAt: row.updated_at,
    });
    if (results.length >= limit) break;
  }

  return results;
}

async function buildStudentNameMap(supabase: Awaited<ReturnType<typeof createClient>>, ids: string[]): Promise<Map<string, string>> {
  const uniqueIds = Array.from(new Set(ids));
  if (uniqueIds.length === 0) return new Map();
  const { data, error } = await supabase.from("profiles").select("id, full_name").in("id", uniqueIds);
  if (error) {
    logDbError("buildStudentNameMap", error);
    return new Map();
  }
  return new Map((data ?? []).map((p: { id: string; full_name: string | null }) => [p.id, p.full_name ?? "Unnamed student"]));
}
