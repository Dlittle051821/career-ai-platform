import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * NW05.7 — Counsellor Verification security regression guard.
 *
 * NW05.1's audit found the counsellor-verification backend already
 * secure: a student has no RLS path to write `student_profile_section_
 * provenance` or `student_recommendation_verifications` themselves, and
 * no student-facing component reads or shows the counsellor's private
 * internal note. This static source-text audit exists to keep that true
 * — a regression here (someone loosening an RLS policy, or a UI component
 * growing a write path) is exactly the kind of P0 this milestone's brief
 * calls out ("students must not set verified = true or equivalent
 * approval fields themselves").
 *
 * Same "no React Testing Library/jsdom in this project" static source-
 * text convention as every other `*-reference-audit.test.ts` /
 * `*-migration-security.test.ts` file in this codebase.
 */

const ROOT = path.resolve(__dirname, "../../..");
function read(relPath: string): string {
  return readFileSync(path.join(ROOT, relPath), "utf8");
}

describe("student_profile_section_provenance — no student write path", () => {
  const migration = read("supabase/migrations/0013_assisted_onboarding_and_recommendation_readiness.sql");

  it("has exactly one write ('for all') policy on the table, and it is NOT the student-read policy", () => {
    const tableSection = migration.slice(migration.indexOf("PART 4 —"), migration.indexOf("PART 5 —"));
    const studentReadPolicy = tableSection.match(/create policy "Students can read their own section provenance"[\s\S]*?;/);
    expect(studentReadPolicy).not.toBeNull();
    expect(studentReadPolicy![0]).toContain("for select");
    expect(studentReadPolicy![0]).not.toMatch(/for (all|insert|update)/);

    const writePolicy = tableSection.match(/create policy "Admins\/assigned counsellor can write section provenance"[\s\S]*?;\n/);
    expect(writePolicy).not.toBeNull();
    // The write policy's USING/WITH CHECK clauses must gate on an admin/
    // counsellor role check, never merely on the row belonging to the
    // caller (which would let a student write their own row).
    expect(writePolicy![0]).toContain("is_admin_role(array['super_admin', 'admin']");
    expect(writePolicy![0]).not.toMatch(/using\s*\(\s*student_user_id\s*=\s*auth\.uid\(\)\s*\)/);
  });

  it("documents, in its own source, that no student insert/update policy exists", () => {
    expect(migration).toContain("Deliberately no student INSERT/UPDATE policy anywhere");
  });
});

describe("student_recommendation_verifications — no student write path", () => {
  const migration = read("supabase/migrations/0013_assisted_onboarding_and_recommendation_readiness.sql");
  const tableSection = migration.slice(migration.indexOf("PART 5 —"), migration.indexOf("PART 6 —"));

  it("has exactly one write ('for all') policy, gated on an admin/counsellor role and the real counsellor's own id", () => {
    const studentReadPolicy = tableSection.match(/create policy "Students can read their own recommendation verifications"[\s\S]*?;/);
    expect(studentReadPolicy).not.toBeNull();
    expect(studentReadPolicy![0]).toContain("for select");
    expect(studentReadPolicy![0]).not.toMatch(/for (all|insert|update)/);

    const writePolicy = tableSection.match(/create policy "Admins\/assigned counsellor can write recommendation verifications"[\s\S]*?;\n/);
    expect(writePolicy).not.toBeNull();
    expect(writePolicy![0]).toContain("verified_by_counsellor_id = public.current_counsellor_id()");
    expect(writePolicy![0]).not.toMatch(/using\s*\(\s*student_user_id\s*=\s*auth\.uid\(\)\s*\)/);
  });
});

describe("student_mark_section_self_entered() (NW05.3, proposed) — downgrade-only, never self-verification", () => {
  const migration = read("supabase/migrations-proposed/NW05_student_mark_section_self_entered.sql");

  it("is scoped to the caller's own row via auth.uid(), never a parameter", () => {
    expect(migration).toContain("v_uid := auth.uid();");
    expect(migration).toMatch(/where\s+student_user_id\s*=\s*v_uid/);
    // The function's only parameter is the section key — never a student id.
    expect(migration).toContain("student_mark_section_self_entered(p_section_key text)");
    expect(migration).not.toMatch(/p_student_user_id|p_student_id/);
  });

  it("only ever SETS provenance to the literal 'SELF_ENTERED' — never COUNSELLOR_ENTERED/COUNSELLOR_VERIFIED", () => {
    const setClause = migration.match(/set\s+provenance\s*=\s*'[^']*'/);
    expect(setClause).not.toBeNull();
    expect(setClause![0]).toBe("set provenance = 'SELF_ENTERED'");
    // COUNSELLOR_ENTERED/COUNSELLOR_VERIFIED may only appear in the WHERE
    // clause's `provenance in (...)` guard (reading the current value),
    // never after a `set provenance =`/`:=` assignment anywhere in the file.
    expect(migration).not.toMatch(/(set\s+provenance\s*=|provenance\s*:=)\s*'COUNSELLOR/);
  });

  it("is granted only to authenticated, revoked from public", () => {
    expect(migration).toContain("revoke all on function public.student_mark_section_self_entered(text) from public;");
    expect(migration).toContain("grant execute on function public.student_mark_section_self_entered(text) to authenticated;");
  });
});

describe("student-profile-actions.ts — the client can never pass a provenance value to the downgrade RPC", () => {
  const source = read("src/lib/supabase/student-profile-actions.ts");

  it("calls the RPC with only a section key argument, never a provenance/verified field", () => {
    const callSite = source.match(/supabase\.rpc\("student_mark_section_self_entered",\s*\{[^}]*\}\)/);
    expect(callSite).not.toBeNull();
    expect(callSite![0]).toBe('supabase.rpc("student_mark_section_self_entered", { p_section_key: sectionKey })');
  });
});

describe("student-facing provenance UI — read-only, no private note leakage", () => {
  const studentFacingFiles = [
    "src/lib/supabase/profile-provenance.ts",
    "src/components/sections/profile/ProfileCounsellorCard.tsx",
    "src/components/sections/profile/ProvenanceSummaryCard.tsx",
    "src/components/sections/recommendations/ReadinessBadge.tsx",
  ];

  it("never calls a Supabase write method (.insert(/.update(/.upsert(/.delete() on a provenance/verification table)", () => {
    for (const file of studentFacingFiles) {
      const source = read(file);
      expect(source, `${file} should not call .insert(`).not.toMatch(/\.insert\(/);
      expect(source, `${file} should not call .update(`).not.toMatch(/\.update\(/);
      expect(source, `${file} should not call .upsert(`).not.toMatch(/\.upsert\(/);
      expect(source, `${file} should not call .delete(`).not.toMatch(/\.delete\(/);
    }
  });

  it("the student-facing read function always nulls out the counsellor's private note", () => {
    const source = read("src/lib/supabase/profile-provenance.ts");
    expect(source).toMatch(/note:\s*null,?\s*\/\/ internal staff note — never shown to the student/);
  });
});
