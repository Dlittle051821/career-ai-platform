import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Regression guard for 0014_discovery_session_counsellor_scope.sql — the
 * M11-B2 fix widening student_profile_section_provenance/student_
 * recommendation_verifications' counsellor RLS scope to also accept a
 * counsellor via discovery_sessions.assigned_counsellor_id, not only via
 * admin_student_meta (which a counsellor can never self-assign into — see
 * this migration's own header comment for the full "why").
 */

const MIGRATION_PATH = path.resolve(process.cwd(), "supabase/migrations/0014_discovery_session_counsellor_scope.sql");
const sql = readFileSync(MIGRATION_PATH, "utf8");

describe("0014_discovery_session_counsellor_scope.sql — security invariants (M11-B2)", () => {
  it("does not create or alter any table — RLS policy changes only", () => {
    expect(sql).not.toMatch(/create table/i);
    expect(sql).not.toMatch(/alter table public\.\w+ add column/i);
  });

  it("every widened policy still requires last_updated_by/verified_by_counsellor_id to be the caller — never lets a counsellor write as someone else", () => {
    expect(sql).toMatch(/with check \(\s*last_updated_by = auth\.uid\(\)/);
    expect(sql).toMatch(/with check \(\s*verified_by_counsellor_id = public\.current_counsellor_id\(\)/);
  });

  it("every widened policy ORs in a discovery_sessions.assigned_counsellor_id check alongside the existing admin_student_meta check, never replacing it", () => {
    const occurrences = sql.match(/m\.assigned_counsellor_id = public\.current_counsellor_id\(\)/g) ?? [];
    const dsOccurrences = sql.match(/ds\.assigned_counsellor_id = public\.current_counsellor_id\(\)/g) ?? [];
    // 4 policies (2 tables x read+write), each referencing the admin_student_meta
    // check once per USING/WITH CHECK clause it appears in.
    expect(occurrences.length).toBeGreaterThanOrEqual(4);
    expect(dsOccurrences.length).toBeGreaterThanOrEqual(4);
  });

  it("students still have no read/write access granted by this file — it only ever says public.is_admin_role(...) or a counsellor-scoped exists()", () => {
    expect(sql).not.toMatch(/student_user_id = auth\.uid\(\)/);
  });

  it("super_admin/admin retain full, unconditional access in every rewritten policy", () => {
    const matches = sql.match(/public\.is_admin_role\(array\['super_admin', 'admin'(?:, 'analyst')?\]\)/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(4);
  });
});
