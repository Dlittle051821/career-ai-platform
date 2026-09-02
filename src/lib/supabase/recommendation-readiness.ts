import "server-only";
import { createClient } from "./server";
import { fetchStudentProfileSnapshotByUserId } from "./student-profile";
import { calculateCompletion } from "@/lib/profile/completion";
import { computeAllRecommendationReadiness, type RecommendationVerificationOverride } from "@/lib/recommendations/readiness";
import { RECOMMENDATION_TYPES, type RecommendationType, type RecommendationReadiness } from "@/types/recommendation-readiness";

/**
 * Milestone 11-C2 — student-facing, READ-ONLY Recommendation Readiness for
 * all four types. Not gated by an admin permission — the student_
 * recommendation_verifications RLS policy "Students can read their own
 * recommendation verifications" (0013 PART 5) is the actual boundary, same
 * convention as src/lib/supabase/profile-provenance.ts. The verifying
 * counsellor's name is never resolved here for the same reason as that
 * module (`counsellors` RLS is admin-only) — a student only ever sees
 * COUNSELLOR_VERIFIED plus a date, never a name.
 */
export async function getMyRecommendationReadiness(): Promise<Record<RecommendationType, RecommendationReadiness> | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [snapshot, verificationsRes] = await Promise.all([
    fetchStudentProfileSnapshotByUserId(supabase, user.id),
    supabase.from("student_recommendation_verifications").select("recommendation_type, verified_by_counsellor_id, verified_at, note").eq("student_user_id", user.id),
  ]);

  const overridesByType: Partial<Record<RecommendationType, RecommendationVerificationOverride>> = {};
  for (const row of verificationsRes.data ?? []) {
    if (!(RECOMMENDATION_TYPES as readonly string[]).includes(row.recommendation_type)) continue;
    overridesByType[row.recommendation_type as RecommendationType] = {
      verifiedByCounsellorId: row.verified_by_counsellor_id,
      verifiedByCounsellorName: null,
      verifiedAt: row.verified_at,
      note: null, // internal staff note — never shown to the student
    };
  }

  const completion = calculateCompletion(snapshot);
  return computeAllRecommendationReadiness(completion, overridesByType);
}
