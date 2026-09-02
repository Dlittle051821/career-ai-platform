import type { AdminRole } from "@/types/admin";
import { ADMIN_ROLES } from "@/types/admin";

/**
 * The centralized role-permission mapping the Milestone 7 spec asks for.
 *
 * This is the APPLICATION-LEVEL source of truth — it drives what the admin
 * shell shows/hides (module links, buttons) and what a server action
 * checks before it touches the database. It is deliberately NOT the only
 * enforcement layer: every table this maps to also has its own RLS
 * policies in supabase/migrations/0004_admin_system.sql that enforce the
 * same boundaries independently, keyed on role (not on this permission
 * string list) via current_admin_role()/is_admin_role(). If this file and
 * the RLS policies ever disagree, RLS wins — hiding a button here is a UX
 * nicety, not the security boundary (spec: "Hiding navigation links is not
 * authorization"). See docs/admin-system-guide.md §2 for the full mapping
 * table cross-referencing every permission below to its RLS policy.
 */
export const ADMIN_PERMISSIONS = [
  "dashboard:read",
  "students:read",
  "students:write",
  "universities:read",
  "universities:write",
  "courses:read",
  "courses:write",
  "applications:read",
  "applications:write",
  "leads:read",
  "leads:write",
  "payments:read",
  "payments:write",
  "agreements:read",
  "agreements:write",
  "counsellors:read",
  "counsellors:write",
  "analytics:read",
  "content:read",
  "content:write",
  "audit:read",
  "roles:manage",
  "invoices:read",
  "invoices:write",
  "refunds:read",
  "refunds:write",
  "payment-events:read",
  "billing-settings:read",
  "billing-settings:write",
  // Milestone 9 (global university/course data platform) — deliberately
  // separate from "universities:read"/"courses:read"/"universities:write"/
  // "courses:write" above (which gate the base M7 record CRUD and now also
  // gate the M9 extended fields on those same tables — RLS restricts what a
  // content_editor can actually publish regardless of this permission map,
  // see supabase/migrations/0006_global_university_course_data.sql PART 2).
  // These four gate the NEW admin-only modules (import pipeline, duplicate
  // review, data-quality dashboard, source/provenance listing) — spec:
  // "import operations require authorized admin role", so content_editor
  // deliberately does not get education-imports:write below.
  "education-imports:read",
  "education-imports:write",
  "education-duplicates:read",
  "education-duplicates:write",
  "education-data-quality:read",
  "education-sources:read",
  // Milestone 10 (NextWise Pricing & Offers) — deliberately its own
  // permission pair, not folded into "content:*": pricing:write changes
  // MONEY (plan prices, offer discounts), so it follows the same
  // super_admin/admin/finance-only write pattern as "invoices:write"/
  // "billing-settings:write" above, not content_editor's pattern. Spec:
  // "Content managers must not modify financial values unless explicitly
  // authorized" — this migration does not authorize content_editor here.
  "pricing:read",
  "pricing:write",
  // Trusted Global Course Search — its own permission pair, not folded
  // into "education-*:read"/write above: this module manages a set of
  // curated links to EXTERNAL government/institutional portals (which
  // domains/URLs are trusted enough to redirect a student to), a
  // meaningfully different kind of authority than curating NextWise's own
  // internal course catalogue. super_admin/admin get write; analyst gets
  // read-only for reporting (click counts, search-gap queue).
  "trusted-portals:read",
  "trusted-portals:write",
  // Milestone 11-B — Assisted Onboarding Revision. Its own permission pair
  // rather than folded into "leads:*" or "counsellors:*": a Discovery
  // Session is a student-initiated booking on an existing account, a
  // meaningfully different object than a pre-registration CRM lead or the
  // counsellor directory itself. Granted to counsellor (they are the ones
  // who actually run these sessions), unlike leads:write's broader set.
  "discovery-sessions:read",
  "discovery-sessions:write",
  // Milestone 11-C1 — Profile Completeness + Counsellor Verification. A
  // separate pair from "students:*": marking a Student Digital Profile
  // section's provenance is a narrower, additive-metadata-only action (see
  // src/lib/supabase/admin/profile-provenance.ts) — it never touches
  // admin_student_meta or any student_* table the way students:write's
  // updateStudentMeta()/recordAuditLog() surface does, so it gets its own
  // permission rather than reusing (or widening) students:write, which
  // counsellor deliberately does not hold.
  "profile-verification:read",
  "profile-verification:write",
  // Milestone 11-C2 — Recommendation Readiness + Dashboard Integration. Its
  // own pair rather than reusing "profile-verification:*": verifying a
  // recommendation TYPE's readiness (src/lib/supabase/admin/
  // recommendation-readiness.ts) writes to a different table
  // (student_recommendation_verifications) with a materially different RLS
  // write constraint — verified_by_counsellor_id is NOT NULL there, so only
  // a linked counsellor can ever write a row at all, unlike profile section
  // provenance where a plain admin can record COUNSELLOR_ENTERED.
  "recommendation-readiness:read",
  "recommendation-readiness:write",
] as const;

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

const ALL_READ: AdminPermission[] = ADMIN_PERMISSIONS.filter((p) => p.endsWith(":read")) as AdminPermission[];

/**
 * super_admin gets every permission, including roles:manage (the only role
 * that can grant/revoke other admins — enforced at the database level too,
 * see admin_roles RLS in 0004_admin_system.sql). Every other role's list
 * below matches the spec's per-role examples directly.
 */
export const ROLE_PERMISSIONS: Record<AdminRole, readonly AdminPermission[]> = {
  super_admin: ADMIN_PERMISSIONS,
  admin: [
    "dashboard:read",
    "students:read",
    "students:write",
    "universities:read",
    "universities:write",
    "courses:read",
    "courses:write",
    "applications:read",
    "applications:write",
    "leads:read",
    "leads:write",
    "payments:read",
    "agreements:read",
    "agreements:write",
    "counsellors:read",
    "counsellors:write",
    "analytics:read",
    "content:read",
    "audit:read",
    // Deliberately no "roles:manage" — an admin can manage operational
    // records but cannot grant themselves or anyone else a role. Enforced
    // at the database level regardless: admin_roles has no INSERT/UPDATE
    // policy for anything but super_admin.
    // Milestone 8 (payments/billing) — admin gets full operational access:
    "invoices:read",
    "invoices:write",
    "refunds:read",
    "refunds:write",
    "payment-events:read",
    "billing-settings:read",
    "billing-settings:write",
    // Milestone 9 — admin gets full operational access to the global
    // education data platform's admin-only modules.
    "education-imports:read",
    "education-imports:write",
    "education-duplicates:read",
    "education-duplicates:write",
    "education-data-quality:read",
    "education-sources:read",
    // Milestone 10 — admin gets full pricing/offers management.
    "pricing:read",
    "pricing:write",
    // Trusted Global Course Search — admin gets full provider/mapping
    // management.
    "trusted-portals:read",
    "trusted-portals:write",
    // Milestone 11-B — admin gets full Discovery Session management.
    "discovery-sessions:read",
    "discovery-sessions:write",
    // Milestone 11-C1 — admin gets full profile-provenance management.
    "profile-verification:read",
    "profile-verification:write",
    // Milestone 11-C2 — admin gets full recommendation-readiness management.
    "recommendation-readiness:read",
    "recommendation-readiness:write",
  ],
  counsellor: [
    "dashboard:read",
    "students:read",
    "leads:read",
    "leads:write",
    "applications:read",
    "applications:write",
    "agreements:read",
    // M8: counsellors can see (their own scoped) invoices for context when
    // helping a student, but never create/void invoices or touch refunds.
    "invoices:read",
    // Milestone 10: deliberately NO "pricing:*" at all — spec: "Counsellors
    // must not modify pricing." A counsellor does not even get read access
    // to draft/unpublished pricing here; they see the same
    // published-and-active plans any signed-in student sees, via the
    // public-scoped RLS policy, not this admin permission.
    // Milestone 11-B — counsellors run Discovery Sessions themselves; RLS
    // (0013 PART 2) further scopes what they can actually see/update to
    // unassigned sessions plus their own, same "app permission is UX, RLS
    // is the boundary" split as every other module here.
    "discovery-sessions:read",
    "discovery-sessions:write",
    // Milestone 11-C1 — counsellors are the ones who actually verify a
    // student's profile sections; RLS (0013 PART 4 as widened by 0014)
    // further scopes which students' sections they can touch.
    "profile-verification:read",
    "profile-verification:write",
    // Milestone 11-C2 — counsellors are the only role that can actually
    // write a recommendation verification at all (verified_by_counsellor_id
    // is NOT NULL); RLS (0013 PART 5 as widened by 0014) further scopes
    // which students they can verify.
    "recommendation-readiness:read",
    "recommendation-readiness:write",
  ],
  finance: [
    "dashboard:read",
    "payments:read",
    "payments:write",
    "applications:read",
    "analytics:read",
    // M8: finance is the primary operational role for the new billing
    // system — same invoice/refund/billing-settings access as admin, on
    // top of its existing legacy payments:read/write.
    "invoices:read",
    "invoices:write",
    "refunds:read",
    "refunds:write",
    "payment-events:read",
    "billing-settings:read",
    "billing-settings:write",
    // Milestone 10 — finance is explicitly named in the spec as authorized
    // to change monetary values, alongside super_admin/admin.
    "pricing:read",
    "pricing:write",
  ],
  content_editor: [
    "dashboard:read",
    "content:read",
    "content:write",
    // Milestone 9 — content_editor can browse and draft global education
    // data. RLS is the real boundary on what they can WRITE (draft/
    // in_review only, and never a publish/archive transition — see
    // supabase/migrations/0006_global_university_course_data.sql); this
    // permission map only needs to let them past the app-layer gate at all.
    "universities:read",
    "universities:write",
    "courses:read",
    "courses:write",
  ],
  analyst: [
    "dashboard:read",
    "students:read",
    "leads:read",
    "applications:read",
    "payments:read",
    "analytics:read",
    "agreements:read",
    // M8: analyst is read-only across the board, including the new
    // billing model.
    "invoices:read",
    "refunds:read",
    // Milestone 9 — analyst is read-only here too, mirroring the pattern
    // above.
    "education-imports:read",
    "education-duplicates:read",
    "education-data-quality:read",
    "education-sources:read",
    // Milestone 10 — analyst is read-only here too, for revenue/conversion reporting.
    "pricing:read",
    // Trusted Global Course Search — analyst is read-only here too, for
    // click-count/search-gap reporting.
    "trusted-portals:read",
    // Milestone 11-C1 — analyst is read-only here too, for reporting.
    // (Deliberately NOT "discovery-sessions:read": that table's RLS read
    // policy — 0013 PART 2 — was never extended to 'analyst', so granting
    // the app permission without the matching RLS grant would just show an
    // always-empty list; out of scope to widen here.)
    "profile-verification:read",
    // Milestone 11-C2 — analyst is read-only here too. Unlike discovery-
    // sessions above, student_recommendation_verifications' RLS read policy
    // (0013 PART 5) DOES include 'analyst' directly, so this one is safe to
    // grant.
    "recommendation-readiness:read",
  ],
};

export function hasPermission(role: AdminRole | null | undefined, permission: AdminPermission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function hasAnyPermission(role: AdminRole | null | undefined, permissions: AdminPermission[]): boolean {
  return permissions.some((p) => hasPermission(role, p));
}

/** True for any real admin role — used for reference-data reads every module needs regardless of specific permission (mirrors is_any_admin() in SQL). */
export function isKnownAdminRole(value: string | null | undefined): value is AdminRole {
  return !!value && (ADMIN_ROLES as readonly string[]).includes(value);
}

/** Every permission a role does NOT have — used by admin-shell nav to decide which module links to render at all. */
export function permittedReadModules(role: AdminRole | null | undefined): AdminPermission[] {
  return ALL_READ.filter((p) => hasPermission(role, p));
}
