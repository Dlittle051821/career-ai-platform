/**
 * Milestone 11-C1 — pure, framework-free business rules for setting a
 * Student Digital Profile section's provenance. Same "pure src/lib/<domain>
 * vs I/O src/lib/supabase/<domain>" split as every other domain in this
 * codebase. Defense-in-depth: the database independently enforces the rule
 * that matters most for correctness (student_profile_section_provenance_
 * verified_consistency — COUNSELLOR_VERIFIED requires verified_by_
 * counsellor_id/verified_at to both be set, supabase/migrations/0013_..._
 * and_recommendation_readiness.sql PART 4) — a bug here can produce a worse
 * error message; it can never produce an invalid database state.
 */

import { PROFILE_SECTION_KEYS, PROVENANCE_VALUES, type ProfileSectionKey, type ProvenanceValue } from "@/types/profile-provenance";

export type RuleResult = { ok: true } | { ok: false; reason: string };

function fail(reason: string): RuleResult {
  return { ok: false, reason };
}
const OK: RuleResult = { ok: true };

export interface SetSectionProvenanceInput {
  hasPermission: boolean;
  sectionKey: string;
  provenance: string;
  hasCounsellorId: boolean;
}

export function validateSetSectionProvenance(input: SetSectionProvenanceInput): RuleResult {
  if (!input.hasPermission) return fail("You do not have permission to update profile section provenance.");
  if (!(PROFILE_SECTION_KEYS as readonly string[]).includes(input.sectionKey)) {
    return fail(`"${input.sectionKey}" is not a recognized profile section.`);
  }
  if (!(PROVENANCE_VALUES as readonly string[]).includes(input.provenance)) {
    return fail(`"${input.provenance}" is not a recognized provenance value.`);
  }
  // A student can never be recorded as marking their own profile "self-
  // entered" — that is the absence of a row, never a written value — and
  // SYSTEM_DERIVED is reserved for a future automated-inference feature
  // (see 0013's table comment); nothing writes it today.
  if (input.provenance === "SELF_ENTERED" || input.provenance === "SYSTEM_DERIVED") {
    return fail(`A counsellor action can only record COUNSELLOR_ENTERED or COUNSELLOR_VERIFIED — "${input.provenance}" is set automatically, never chosen.`);
  }
  if (input.provenance === "COUNSELLOR_VERIFIED" && !input.hasCounsellorId) {
    return fail("Only a counsellor account (not a super_admin/admin without a linked counsellor record) can verify a section.");
  }
  return OK;
}

export function isProfileSectionKey(value: string): value is ProfileSectionKey {
  return (PROFILE_SECTION_KEYS as readonly string[]).includes(value);
}

export function isProvenanceValue(value: string): value is ProvenanceValue {
  return (PROVENANCE_VALUES as readonly string[]).includes(value);
}
