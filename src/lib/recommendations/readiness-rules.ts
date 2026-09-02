/**
 * Milestone 11-C2 — pure, framework-free business rules for a counsellor's
 * explicit recommendation-readiness verification. Same "pure src/lib/<domain>
 * vs I/O src/lib/supabase/<domain>" split as every other domain in this
 * codebase. Defense-in-depth: `student_recommendation_verifications.
 * verified_by_counsellor_id` is a NOT NULL column (supabase/migrations/0013
 * PART 5) — unlike profile section provenance, ONLY a linked counsellor
 * account can ever write this row at all, never a super_admin/admin without
 * one. A bug here can produce a worse error message; it can never produce an
 * invalid database state.
 */

import { RECOMMENDATION_TYPES, type RecommendationType } from "@/types/recommendation-readiness";

export type RuleResult = { ok: true } | { ok: false; reason: string };

function fail(reason: string): RuleResult {
  return { ok: false, reason };
}
const OK: RuleResult = { ok: true };

export interface SetRecommendationVerificationInput {
  hasPermission: boolean;
  recommendationType: string;
  hasCounsellorId: boolean;
}

export function validateSetRecommendationVerification(input: SetRecommendationVerificationInput): RuleResult {
  if (!input.hasPermission) return fail("You do not have permission to verify recommendation readiness.");
  if (!isRecommendationType(input.recommendationType)) {
    return fail(`"${input.recommendationType}" is not a recognized recommendation type.`);
  }
  if (!input.hasCounsellorId) {
    return fail("Only a counsellor account (not a super_admin/admin without a linked counsellor record) can verify recommendation readiness.");
  }
  return OK;
}

export interface ClearRecommendationVerificationInput {
  hasPermission: boolean;
  recommendationType: string;
}

export function validateClearRecommendationVerification(input: ClearRecommendationVerificationInput): RuleResult {
  if (!input.hasPermission) return fail("You do not have permission to change recommendation readiness.");
  if (!isRecommendationType(input.recommendationType)) {
    return fail(`"${input.recommendationType}" is not a recognized recommendation type.`);
  }
  return OK;
}

export function isRecommendationType(value: string): value is RecommendationType {
  return (RECOMMENDATION_TYPES as readonly string[]).includes(value);
}
