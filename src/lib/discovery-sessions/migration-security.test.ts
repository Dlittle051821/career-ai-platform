import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Regression guard for
 * 0013_assisted_onboarding_and_recommendation_readiness.sql's
 * security-relevant invariants — mirrors src/lib/stamping/migration-
 * security.test.ts / src/lib/signatures/migration-security.test.ts exactly
 * (a static check against the actual migration SQL text, not a live
 * Postgres connection — this project has no database in its Vitest setup).
 */

const MIGRATION_PATH = path.resolve(
  process.cwd(),
  "supabase/migrations/0013_assisted_onboarding_and_recommendation_readiness.sql"
);
const sql = readFileSync(MIGRATION_PATH, "utf8");

describe("0013_assisted_onboarding_and_recommendation_readiness.sql — security invariants (M11-B/C)", () => {
  it("does not redefine any pre-existing table from earlier migrations", () => {
    expect(sql).not.toMatch(/create table if not exists public\.student_profiles /);
    expect(sql).not.toMatch(/create table if not exists public\.counsellors/);
    expect(sql).not.toMatch(/create table if not exists public\.admin_student_meta/);
  });

  it("student_profiles gains onboarding_path via ADD COLUMN IF NOT EXISTS, never a destructive change", () => {
    expect(sql).toMatch(/alter table public\.student_profiles add column if not exists onboarding_path text;/);
    expect(sql).toMatch(/alter table public\.student_profiles add column if not exists onboarding_path_chosen_at timestamptz;/);
    expect(sql).not.toMatch(/alter table public\.student_profiles drop column/);
  });

  it("every new table has row level security enabled", () => {
    for (const table of [
      "discovery_sessions",
      "discovery_session_workspace",
      "student_profile_section_provenance",
      "student_recommendation_verifications",
    ]) {
      expect(sql).toMatch(new RegExp(`alter table public\\.${table} enable row level security;`));
    }
  });

  it("discovery_sessions.session_type is locked to DISCOVERY_SESSION only", () => {
    expect(sql).toMatch(/constraint discovery_sessions_session_type_check check \(session_type in \('DISCOVERY_SESSION'\)\)/);
  });

  it("students can insert their own discovery_sessions row only as student_user_id = auth.uid(), unassigned and status='requested'", () => {
    const start = sql.indexOf('create policy "Students can book their own discovery sessions"');
    expect(start).toBeGreaterThan(-1);
    const end = sql.indexOf(";", start);
    const policy = sql.slice(start, end);
    expect(policy).toMatch(/student_user_id = auth\.uid\(\)/);
    expect(policy).toMatch(/status = 'requested'/);
    expect(policy).toMatch(/assigned_counsellor_id is null/);
  });

  it("students have no UPDATE or DELETE policy on discovery_sessions", () => {
    const start = sql.indexOf("PART 2 — discovery_sessions");
    const end = sql.indexOf("PART 3 —", start);
    const section = sql.slice(start, end);
    expect(section).not.toMatch(/create policy "Students[^"]*"\s*\n\s*on public\.discovery_sessions for (update|delete)/);
  });

  it("discovery_session_workspace is never readable via a student-scoped policy — staff-only", () => {
    const start = sql.indexOf("PART 3 — discovery_session_workspace");
    const end = sql.indexOf("PART 4 —", start);
    const section = sql.slice(start, end);
    expect(section).not.toMatch(/using \(\s*student_user_id = auth\.uid\(\)/);
    expect(section).toMatch(/public\.is_admin_role\(array\['super_admin', 'admin'\]\)/);
  });

  it("student_profile_section_provenance: students get SELECT only, never INSERT/UPDATE/DELETE", () => {
    const start = sql.indexOf("PART 4 — student_profile_section_provenance");
    const end = sql.indexOf("PART 5 —", start);
    const section = sql.slice(start, end);
    expect(section).toMatch(/create policy "Students can read their own section provenance"[\s\S]*?for select to authenticated/);
    expect(section).not.toMatch(/create policy "Students[^"]*"\s*\n\s*on public\.student_profile_section_provenance for (insert|update|all)/);
  });

  it("student_profile_section_provenance enforces COUNSELLOR_VERIFIED requires verified_by_counsellor_id and verified_at", () => {
    expect(sql).toMatch(
      /constraint student_profile_section_provenance_verified_consistency check \(\s*\(provenance = 'COUNSELLOR_VERIFIED' and verified_by_counsellor_id is not null and verified_at is not null\)\s*or \(provenance <> 'COUNSELLOR_VERIFIED'\)\s*\)/
    );
  });

  it("student_profile_section_provenance write policy is scoped to admin/super_admin or the student's assigned counsellor via admin_student_meta", () => {
    const start = sql.indexOf('create policy "Admins/assigned counsellor can write section provenance"');
    expect(start).toBeGreaterThan(-1);
    const end = sql.indexOf("drop trigger if exists set_student_profile_section_provenance_updated_at", start);
    const policy = sql.slice(start, end);
    expect(policy).toMatch(/last_updated_by = auth\.uid\(\)/);
    expect(policy).toMatch(/admin_student_meta m/);
    expect(policy).toMatch(/m\.assigned_counsellor_id = public\.current_counsellor_id\(\)/);
  });

  it("student_recommendation_verifications.recommendation_type is restricted to career/course/college/pathway", () => {
    expect(sql).toMatch(
      /constraint student_recommendation_verifications_type_check\s*\n\s*check \(recommendation_type in \('career', 'course', 'college', 'pathway'\)\)/
    );
  });

  it("student_recommendation_verifications write policy forces verified_by_counsellor_id = the caller's own counsellor id", () => {
    const start = sql.indexOf('create policy "Admins/assigned counsellor can write recommendation verifications"');
    expect(start).toBeGreaterThan(-1);
    const end = sql.indexOf("-- No updated_at trigger", start);
    const policy = sql.slice(start, end);
    expect(policy).toMatch(/verified_by_counsellor_id = public\.current_counsellor_id\(\)/);
  });

  it("students have no write policy at all on student_recommendation_verifications", () => {
    const start = sql.indexOf("PART 5 — student_recommendation_verifications");
    const end = sql.indexOf("PART 6 —", start);
    const section = sql.slice(start, end);
    expect(section).not.toMatch(/create policy "Students[^"]*"\s*\n\s*on public\.student_recommendation_verifications for (insert|update|all)/);
  });
});
