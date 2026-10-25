import "server-only";
import { createClient } from "../server";
import { requireAdminPermission } from "../admin-auth";
import { recordAuditLog } from "./audit";
import { AdminValidationError } from "@/lib/admin/form-state";
import { trackEvent } from "../analytics/track";
import type { Json } from "@/types/database";
import {
  isRecommendationDraftStatus,
  isRecommendationDraftType,
  type RecommendationDraftContent,
  type RecommendationDraftStatus,
} from "@/lib/recommendations/drafts";

/**
 * NW07.6 — Recommendation Workflow, staff-facing orchestration. Every
 * mutation goes through one of the SECURITY DEFINER RPCs in
 * supabase/migrations-proposed/NW07_counsellor_studio_foundation.sql PART 2
 * — this module does no authorization or status-transition logic of its
 * own beyond a clean, early `AdminValidationError` for an obviously bad
 * input (same "don't duplicate the RPC's own rules here" discipline
 * src/lib/supabase/admin/application-tasks.ts already established). Reads
 * go through this table's own RLS directly (one SELECT policy, staff-only)
 * — never through an RPC, since staff are allowed to see every internal
 * column including review_notes. Gated by the `recommendation-drafts:read`/
 * `write` permission pair (src/lib/admin/permissions.ts).
 */

function logDbError(context: string, error: unknown) {
  console.error(`[admin/recommendation-drafts] ${context}:`, error);
}

export interface AdminRecommendationDraft {
  id: string;
  studentUserId: string;
  recommendationType: string | null;
  title: string;
  status: RecommendationDraftStatus | string;
  currentVersionId: string | null;
  createdBy: string;
  authorCounsellorId: string | null;
  submittedAt: string | null;
  submittedBy: string | null;
  /** STAFF-ONLY. Never returned to a student. */
  reviewNotes: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  releasedAt: string | null;
  releasedBy: string | null;
  archivedAt: string | null;
  archivedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

interface AdminRecommendationDraftRow {
  id: string;
  student_user_id: string;
  recommendation_type: string | null;
  title: string;
  status: string;
  current_version_id: string | null;
  created_by: string;
  author_counsellor_id: string | null;
  submitted_at: string | null;
  submitted_by: string | null;
  review_notes: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  approved_at: string | null;
  approved_by: string | null;
  released_at: string | null;
  released_by: string | null;
  archived_at: string | null;
  archived_by: string | null;
  created_at: string;
  updated_at: string;
}

function toAdminRecommendationDraft(row: AdminRecommendationDraftRow): AdminRecommendationDraft {
  return {
    id: row.id,
    studentUserId: row.student_user_id,
    recommendationType: row.recommendation_type,
    title: row.title,
    status: row.status,
    currentVersionId: row.current_version_id,
    createdBy: row.created_by,
    authorCounsellorId: row.author_counsellor_id,
    submittedAt: row.submitted_at,
    submittedBy: row.submitted_by,
    reviewNotes: row.review_notes,
    reviewedAt: row.reviewed_at,
    reviewedBy: row.reviewed_by,
    approvedAt: row.approved_at,
    approvedBy: row.approved_by,
    releasedAt: row.released_at,
    releasedBy: row.released_by,
    archivedAt: row.archived_at,
    archivedBy: row.archived_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Every recommendation draft for one student, newest first. RLS further scopes a counsellor to their own-authored drafts plus any case they have dual-basis access to, regardless of this permission check succeeding. */
export async function listRecommendationDraftsForStudent(studentUserId: string): Promise<AdminRecommendationDraft[]> {
  await requireAdminPermission("recommendation-drafts:read");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recommendation_drafts")
    .select("*")
    .eq("student_user_id", studentUserId)
    .order("created_at", { ascending: false });
  if (error) {
    logDbError("listRecommendationDraftsForStudent", error);
    return [];
  }
  return ((data ?? []) as AdminRecommendationDraftRow[]).map(toAdminRecommendationDraft);
}

/**
 * Every recommendation draft visible to the caller across every student —
 * used by the Counsellor Studio dashboard's "Recommendation Drafts" panel.
 * No `student_user_id` filter: RLS alone decides which rows come back (a
 * counsellor's own-authored drafts plus every case they have access to; an
 * admin sees everything) — exactly the same "this query never needs to
 * filter for scope itself" pattern `listDiscoverySessions()` already uses.
 */
export async function listMyRecommendationDrafts(): Promise<AdminRecommendationDraft[]> {
  await requireAdminPermission("recommendation-drafts:read");
  const supabase = await createClient();
  const { data, error } = await supabase.from("recommendation_drafts").select("*").order("updated_at", { ascending: false });
  if (error) {
    logDbError("listMyRecommendationDrafts", error);
    return [];
  }
  return ((data ?? []) as AdminRecommendationDraftRow[]).map(toAdminRecommendationDraft);
}

export interface AdminRecommendationDraftWithStudent extends AdminRecommendationDraft {
  studentName: string | null;
  studentEmail: string | null;
}

/**
 * NW07.6 UI — the same drafts listMyRecommendationDrafts() returns, enriched
 * with the student's display name/email for the "Recommendations" queue
 * page (which has no per-student context to borrow a name from, unlike the
 * Student Case Workspace). A thin, read-only lookup over `profiles` — same
 * per-module name-map convention as buildStudentNameMap() in
 * discovery-sessions.ts — not a second source of truth for student identity.
 */
export async function listMyRecommendationDraftsWithStudentNames(): Promise<AdminRecommendationDraftWithStudent[]> {
  const drafts = await listMyRecommendationDrafts();
  if (drafts.length === 0) return [];
  const supabase = await createClient();
  const uniqueIds = Array.from(new Set(drafts.map((d) => d.studentUserId)));
  const { data, error } = await supabase.from("profiles").select("id, full_name, email").in("id", uniqueIds);
  if (error) logDbError("listMyRecommendationDraftsWithStudentNames", error);
  const nameMap = new Map((data ?? []).map((p) => [p.id, { name: p.full_name as string | null, email: p.email as string | null }]));
  return drafts.map((d) => ({
    ...d,
    studentName: nameMap.get(d.studentUserId)?.name ?? null,
    studentEmail: nameMap.get(d.studentUserId)?.email ?? null,
  }));
}

export async function getRecommendationDraftById(draftId: string): Promise<AdminRecommendationDraft | null> {
  await requireAdminPermission("recommendation-drafts:read");
  const supabase = await createClient();
  const { data, error } = await supabase.from("recommendation_drafts").select("*").eq("id", draftId).maybeSingle();
  if (error) {
    logDbError("getRecommendationDraftById", error);
    return null;
  }
  return data ? toAdminRecommendationDraft(data as AdminRecommendationDraftRow) : null;
}

/** Single-draft sibling of listMyRecommendationDraftsWithStudentNames() — for the Recommendation Review page's header, which has no other source for the student's display name. */
export async function getRecommendationDraftWithStudentNameById(draftId: string): Promise<AdminRecommendationDraftWithStudent | null> {
  const draft = await getRecommendationDraftById(draftId);
  if (!draft) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").select("full_name, email").eq("id", draft.studentUserId).maybeSingle();
  if (error) logDbError("getRecommendationDraftWithStudentNameById", error);
  return { ...draft, studentName: data?.full_name ?? null, studentEmail: data?.email ?? null };
}

export interface RecommendationDraftVersion {
  id: string;
  draftId: string;
  versionNumber: number;
  content: RecommendationDraftContent;
  authoredBy: string | null;
  createdAt: string;
}

/** Full version history for one draft, oldest first — the audit trail the brief requires. RLS-scoped exactly like the parent draft. */
export async function listRecommendationDraftVersions(draftId: string): Promise<RecommendationDraftVersion[]> {
  await requireAdminPermission("recommendation-drafts:read");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recommendation_draft_versions")
    .select("*")
    .eq("draft_id", draftId)
    .order("version_number", { ascending: true });
  if (error) {
    logDbError("listRecommendationDraftVersions", error);
    return [];
  }
  return (data ?? []).map((row) => ({
    id: row.id,
    draftId: row.draft_id,
    versionNumber: row.version_number,
    content: (row.content as RecommendationDraftContent) ?? {},
    authoredBy: row.authored_by,
    createdAt: row.created_at,
  }));
}

function parseContentForm(formData: FormData): RecommendationDraftContent {
  function str(key: string): string | undefined {
    const value = String(formData.get(key) ?? "").trim();
    return value || undefined;
  }
  return {
    summary: str("summary"),
    careerGuidance: str("careerGuidance"),
    courseGuidance: str("courseGuidance"),
    collegeGuidance: str("collegeGuidance"),
    pathwayGuidance: str("pathwayGuidance"),
    counsellorRationale: str("counsellorRationale"),
  };
}

export interface CreateRecommendationDraftInput {
  studentUserId: string;
  title: string;
  recommendationType?: string | null;
}

/** Creates a new draft (and its first version) from a form. Delegates authorization/case-access checks entirely to staff_create_recommendation_draft(). */
export async function createRecommendationDraft(input: CreateRecommendationDraftInput, formData: FormData): Promise<string> {
  const admin = await requireAdminPermission("recommendation-drafts:write");

  const title = input.title.trim();
  if (!title) throw new AdminValidationError("A title is required.");
  if (input.recommendationType && !isRecommendationDraftType(input.recommendationType)) {
    throw new AdminValidationError("This recommendation type is not recognized.");
  }

  const content = parseContentForm(formData);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("staff_create_recommendation_draft", {
    p_student_user_id: input.studentUserId,
    p_title: title,
    p_recommendation_type: input.recommendationType ?? null,
    p_content: content as unknown as Json,
  });
  if (error) {
    logDbError("createRecommendationDraft", error);
    throw new AdminValidationError(error.message || "We couldn't create this recommendation draft. Please try again.");
  }

  const createdId = (data ?? [])[0]?.id as string | undefined;
  if (!createdId) throw new Error("Recommendation draft was not created.");

  await recordAuditLog({
    action: "Recommendation draft created",
    entityType: "student",
    entityId: input.studentUserId,
    entityLabel: `recommendation draft "${title}"`,
    context: { draftId: createdId, actorRole: admin.role },
  });

  return createdId;
}

/** Saves a new content version — only while the draft is draft/changes_requested, enforced by staff_update_recommendation_draft_content() itself. */
export async function updateRecommendationDraftContent(draftId: string, formData: FormData): Promise<void> {
  const admin = await requireAdminPermission("recommendation-drafts:write");
  const content = parseContentForm(formData);

  const supabase = await createClient();
  const { error } = await supabase.rpc("staff_update_recommendation_draft_content", { p_draft_id: draftId, p_content: content as unknown as Json });
  if (error) {
    logDbError("updateRecommendationDraftContent", error);
    throw new AdminValidationError(error.message || "We couldn't save this draft. Please try again.");
  }

  await recordAuditLog({
    action: "Recommendation draft content updated",
    entityType: "recommendation_draft",
    entityId: draftId,
    entityLabel: `recommendation draft ${draftId}`,
    context: { draftId, actorRole: admin.role },
  });
}

export async function submitRecommendationDraftForReview(draftId: string): Promise<void> {
  const admin = await requireAdminPermission("recommendation-drafts:write");
  const supabase = await createClient();
  const { error } = await supabase.rpc("staff_submit_recommendation_draft_for_review", { p_draft_id: draftId });
  if (error) {
    logDbError("submitRecommendationDraftForReview", error);
    throw new AdminValidationError(error.message || "We couldn't submit this draft for review. Please try again.");
  }
  await recordAuditLog({
    action: "Recommendation draft submitted for review",
    entityType: "recommendation_draft",
    entityId: draftId,
    entityLabel: `recommendation draft ${draftId}`,
    context: { draftId, actorRole: admin.role },
  });
}

/**
 * Approves or requests changes. SELF-APPROVAL PREVENTION is enforced by
 * staff_review_recommendation_draft() itself (raises if the caller is the
 * draft's own author) — this function relays that error as-is, exactly the
 * same "relay as-is" discipline updateApplicationTaskStatus() uses.
 */
export async function reviewRecommendationDraft(draftId: string, decision: "approve" | "request_changes", reviewNotes?: string | null): Promise<void> {
  const admin = await requireAdminPermission("recommendation-drafts:write");
  if (decision === "request_changes" && !reviewNotes?.trim()) {
    throw new AdminValidationError("Review notes are required when requesting changes.");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("staff_review_recommendation_draft", {
    p_draft_id: draftId,
    p_decision: decision,
    p_review_notes: reviewNotes ?? null,
  });
  if (error) {
    logDbError("reviewRecommendationDraft", error);
    throw new AdminValidationError(error.message || "We couldn't record this review. Please try again.");
  }

  await recordAuditLog({
    action: decision === "approve" ? "Recommendation draft approved" : "Recommendation draft sent back for changes",
    entityType: "recommendation_draft",
    entityId: draftId,
    entityLabel: `recommendation draft ${draftId}`,
    context: { draftId, decision, actorRole: admin.role },
  });
}

export async function releaseRecommendationDraft(draftId: string): Promise<void> {
  const admin = await requireAdminPermission("recommendation-drafts:write");
  const supabase = await createClient();
  const { error } = await supabase.rpc("staff_release_recommendation_draft", { p_draft_id: draftId });
  if (error) {
    logDbError("releaseRecommendationDraft", error);
    throw new AdminValidationError(error.message || "We couldn't release this report. Please try again.");
  }
  await recordAuditLog({
    action: "Recommendation report released to student",
    entityType: "recommendation_draft",
    entityId: draftId,
    entityLabel: `recommendation draft ${draftId}`,
    context: { draftId, actorRole: admin.role },
  });
  void trackEvent({
    eventName: "recommendation_readiness_changed",
    source: "counsellor_studio_recommendation_workflow",
    feature: "recommendations",
    entityType: "recommendation_draft",
    entityId: draftId,
    properties: { status: "released_to_student" },
  });
}

export async function withdrawRecommendationDraft(draftId: string): Promise<void> {
  const admin = await requireAdminPermission("recommendation-drafts:write");
  const supabase = await createClient();
  const { error } = await supabase.rpc("staff_withdraw_recommendation_draft", { p_draft_id: draftId });
  if (error) {
    logDbError("withdrawRecommendationDraft", error);
    throw new AdminValidationError(error.message || "We couldn't withdraw this draft. Please try again.");
  }
  await recordAuditLog({
    action: "Recommendation draft withdrawn from review",
    entityType: "recommendation_draft",
    entityId: draftId,
    entityLabel: `recommendation draft ${draftId}`,
    context: { draftId, actorRole: admin.role },
  });
}

export async function archiveRecommendationDraft(draftId: string): Promise<void> {
  const admin = await requireAdminPermission("recommendation-drafts:write");
  const supabase = await createClient();
  const { error } = await supabase.rpc("staff_archive_recommendation_draft", { p_draft_id: draftId });
  if (error) {
    logDbError("archiveRecommendationDraft", error);
    throw new AdminValidationError(error.message || "We couldn't archive this draft. Please try again.");
  }
  await recordAuditLog({
    action: "Recommendation draft archived",
    entityType: "recommendation_draft",
    entityId: draftId,
    entityLabel: `recommendation draft ${draftId}`,
    context: { draftId, actorRole: admin.role },
  });
}

export function assertRecommendationDraftStatus(value: string): RecommendationDraftStatus {
  if (!isRecommendationDraftStatus(value)) throw new AdminValidationError("This recommendation draft status is not recognized.");
  return value;
}
