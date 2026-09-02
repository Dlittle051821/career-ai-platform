import "server-only";
import { createClient } from "../server";
import { requireAdminPermission } from "../admin-auth";
import { recordAuditLog } from "./audit";
import { fetchStudentProfileSnapshotByUserId } from "../student-profile";
import { calculateCompletion } from "@/lib/profile/completion";
import { computeAllRecommendationReadiness, type RecommendationVerificationOverride } from "@/lib/recommendations/readiness";
import { validateClearRecommendationVerification, validateSetRecommendationVerification } from "@/lib/recommendations/readiness-rules";
import { AdminValidationError } from "@/lib/admin/form-state";
import { trackEvent } from "../analytics/track";
import { RECOMMENDATION_TYPES, type RecommendationType, type RecommendationReadiness } from "@/types/recommendation-readiness";

function logDbError(context: string, error: unknown) {
  console.error(`[admin/recommendation-readiness] ${context}:`, error);
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

interface VerificationRow {
  recommendation_type: string;
  verified_by_counsellor_id: string;
  verified_at: string;
  note: string | null;
}

async function buildCounsellorNameMap(supabase: Supabase, ids: string[]): Promise<Map<string, string>> {
  const uniqueIds = Array.from(new Set(ids));
  if (uniqueIds.length === 0) return new Map();
  const { data, error } = await supabase.from("counsellors").select("id, display_name").in("id", uniqueIds);
  if (error) {
    logDbError("buildCounsellorNameMap", error);
    return new Map();
  }
  return new Map((data ?? []).map((c) => [c.id, c.display_name]));
}

/**
 * Milestone 11-C2 — all four recommendation types' readiness for one
 * student, computed fresh from their Student Digital Profile plus any
 * stored counsellor verification override. Gated by
 * "recommendation-readiness:read"; RLS (0013 PART 5, widened by 0014) is
 * the independent backstop on which students a counsellor session can
 * actually see overrides for.
 */
export async function getRecommendationReadinessForAdmin(studentUserId: string): Promise<Record<RecommendationType, RecommendationReadiness>> {
  await requireAdminPermission("recommendation-readiness:read");
  const supabase = await createClient();

  const [snapshot, verificationsRes] = await Promise.all([
    fetchStudentProfileSnapshotByUserId(supabase, studentUserId),
    supabase.from("student_recommendation_verifications").select("*").eq("student_user_id", studentUserId),
  ]);
  if (verificationsRes.error) logDbError("getRecommendationReadinessForAdmin", verificationsRes.error);

  const rows = (verificationsRes.data ?? []) as VerificationRow[];
  const counsellorNameById = await buildCounsellorNameMap(supabase, rows.map((r) => r.verified_by_counsellor_id));

  const overridesByType: Partial<Record<RecommendationType, RecommendationVerificationOverride>> = {};
  for (const row of rows) {
    if (!(RECOMMENDATION_TYPES as readonly string[]).includes(row.recommendation_type)) continue;
    overridesByType[row.recommendation_type as RecommendationType] = {
      verifiedByCounsellorId: row.verified_by_counsellor_id,
      verifiedByCounsellorName: counsellorNameById.get(row.verified_by_counsellor_id) ?? null,
      verifiedAt: row.verified_at,
      note: row.note,
    };
  }

  const completion = calculateCompletion(snapshot);
  return computeAllRecommendationReadiness(completion, overridesByType);
}

/**
 * Records a counsellor's explicit COUNSELLOR_VERIFIED override for one
 * recommendation type. `verified_by_counsellor_id` is a NOT NULL column
 * (0013 PART 5) — only a linked counsellor account can ever call this
 * successfully, enforced first by validateSetRecommendationVerification()
 * and independently by the column constraint itself.
 */
export async function setRecommendationVerification(studentUserId: string, formData: FormData): Promise<void> {
  const admin = await requireAdminPermission("recommendation-readiness:write");
  const recommendationType = String(formData.get("recommendationType") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim() || null;

  const check = validateSetRecommendationVerification({
    hasPermission: true,
    recommendationType,
    hasCounsellorId: Boolean(admin.counsellorId),
  });
  if (!check.ok) throw new AdminValidationError(check.reason);

  const supabase = await createClient();
  const { error } = await supabase.from("student_recommendation_verifications").upsert(
    {
      student_user_id: studentUserId,
      recommendation_type: recommendationType,
      verified_by_counsellor_id: admin.counsellorId as string,
      verified_at: new Date().toISOString(),
      note,
    },
    { onConflict: "student_user_id,recommendation_type" }
  );
  if (error) {
    logDbError("setRecommendationVerification", error);
    throw new Error(error.message);
  }

  await recordAuditLog({
    action: "Updated",
    entityType: "student_recommendation_verification",
    entityId: studentUserId,
    entityLabel: `${recommendationType} recommendation readiness`,
    fieldChangeSummaries: [`level: COUNSELLOR_VERIFIED (${recommendationType})`],
    context: { actorRole: admin.role, recommendationType },
  });

  void trackEvent({
    eventName: "recommendation_readiness_changed",
    source: "admin_student_case_workspace",
    feature: "recommendations",
    entityType: "profile",
    entityId: studentUserId,
    properties: { recommendationType, level: "COUNSELLOR_VERIFIED" },
  });
}

/**
 * Removes a counsellor's verification override for one recommendation
 * type — readiness for that type reverts to whatever the pure computation
 * says. Deliberately does NOT require a linked counsellor id (unlike
 * setRecommendationVerification()): undoing a mistaken verification is a
 * corrective action any authorized admin/counsellor should be able to
 * take, not a fresh assertion of professional judgment.
 */
export async function clearRecommendationVerification(studentUserId: string, formData: FormData): Promise<void> {
  const admin = await requireAdminPermission("recommendation-readiness:write");
  const recommendationType = String(formData.get("recommendationType") ?? "").trim();

  const check = validateClearRecommendationVerification({ hasPermission: true, recommendationType });
  if (!check.ok) throw new AdminValidationError(check.reason);

  const supabase = await createClient();
  const { error } = await supabase
    .from("student_recommendation_verifications")
    .delete()
    .eq("student_user_id", studentUserId)
    .eq("recommendation_type", recommendationType);
  if (error) {
    logDbError("clearRecommendationVerification", error);
    throw new Error(error.message);
  }

  await recordAuditLog({
    action: "Updated",
    entityType: "student_recommendation_verification",
    entityId: studentUserId,
    entityLabel: `${recommendationType} recommendation readiness`,
    fieldChangeSummaries: [`verification cleared (${recommendationType})`],
    context: { actorRole: admin.role, recommendationType },
  });

  void trackEvent({
    eventName: "recommendation_readiness_changed",
    source: "admin_student_case_workspace",
    feature: "recommendations",
    entityType: "profile",
    entityId: studentUserId,
    properties: { recommendationType, level: "cleared" },
  });
}
