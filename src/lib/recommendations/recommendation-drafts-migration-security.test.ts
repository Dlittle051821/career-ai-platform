import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * NW07.6/NW07.1 — static-SQL-text regression guard for
 * supabase/migrations-proposed/NW07_counsellor_studio_foundation.sql
 * (PROPOSED, not yet applied to any database — same "no live Postgres
 * connection in this project's Vitest setup, so RLS/RPC correctness is
 * verified against the actual migration text" convention as
 * application-tasks-migration-security.test.ts).
 *
 * Covers PART 1 (the counsellor case-access widening) and PART 2 (the
 * Recommendation Workflow's RPC-only write boundary, the self-approval
 * prevention rule, the fixed status-transition guards, and the student-safe
 * RETURNS TABLE shapes of the two student-facing functions).
 */

const MIGRATION_PATH = path.resolve(process.cwd(), "supabase/migrations-proposed/NW07_counsellor_studio_foundation.sql");
const sql = readFileSync(MIGRATION_PATH, "utf8");

function sliceFunctionBody(functionSignature: string): string {
  const start = sql.indexOf(functionSignature);
  expect(start).toBeGreaterThan(-1);
  const end = sql.indexOf("\n$$;", start);
  expect(end).toBeGreaterThan(start);
  return sql.slice(start, end);
}

describe("PART 1 — counsellor case-access widening", () => {
  it("widens profiles SELECT to include the discovery_sessions basis alongside admin_student_meta", () => {
    const start = sql.indexOf('create policy "Admins/assigned counsellor can read student profiles (m7)"');
    const end = sql.indexOf(");", start);
    const body = sql.slice(start, end);
    expect(body).toMatch(/admin_student_meta m/);
    expect(body).toMatch(/discovery_sessions ds/);
    expect(body).toMatch(/ds\.assigned_counsellor_id = public\.current_counsellor_id\(\)/);
  });

  it("widens the 11-table student_* loop to include the discovery_sessions basis", () => {
    const start = sql.indexOf("foreach t in array array[");
    const end = sql.indexOf("end $$;", start);
    const body = sql.slice(start, end);
    for (const table of [
      "student_profiles",
      "student_education",
      "student_subject_strengths",
      "student_interests",
      "student_skills",
      "student_work_preferences",
      "student_career_priorities",
      "student_career_goals",
      "student_study_preferences",
      "student_funding_preferences",
      "student_experience",
    ]) {
      expect(body).toMatch(new RegExp(`'${table}'`));
    }
    expect(body).toMatch(/discovery_sessions ds/);
    expect(body).toMatch(/ds\.student_user_id = %1\$s\.user_id/);
  });

  it("widens admin_student_meta SELECT but leaves its INSERT/UPDATE policies untouched by this file", () => {
    const start = sql.indexOf('create policy "Admins/assigned counsellor can read student meta"');
    const end = sql.indexOf(";", start);
    const body = sql.slice(start, end);
    expect(body).toMatch(/discovery_sessions ds/);
    // This file must not contain a new admin_student_meta UPDATE/INSERT
    // policy — the deliberate asymmetry documented in PART 1's header.
    expect(sql).not.toMatch(/create policy[^;]*on public\.admin_student_meta for (update|insert)/);
  });

  it("widens admin_student_notes SELECT and INSERT with the same dual basis", () => {
    const selectStart = sql.indexOf('create policy "Admins/assigned counsellor can read student notes"');
    const selectEnd = sql.indexOf(");", selectStart);
    expect(sql.slice(selectStart, selectEnd)).toMatch(/discovery_sessions ds/);

    const insertStart = sql.indexOf('create policy "Admins/assigned counsellor can add student notes"');
    const insertEnd = sql.indexOf(");", insertStart);
    const insertBody = sql.slice(insertStart, insertEnd);
    expect(insertBody).toMatch(/discovery_sessions ds/);
    expect(insertBody).toMatch(/author_user_id = auth\.uid\(\)/);
  });

  it("counsellor_has_case_access is STABLE/SECURITY DEFINER and checks both bases", () => {
    const body = sliceFunctionBody("create or replace function public.counsellor_has_case_access(p_student_user_id uuid)");
    expect(body).toMatch(/security definer/);
    expect(body).toMatch(/stable/);
    expect(body).toMatch(/admin_student_meta m/);
    expect(body).toMatch(/discovery_sessions ds/);
  });
});

describe("PART 2 — recommendation_drafts/recommendation_draft_versions table shape", () => {
  const start = sql.indexOf("create table if not exists public.recommendation_drafts");
  const end = sql.indexOf("create index if not exists recommendation_drafts_student_idx", start);
  const body = sql.slice(start, end);

  it("status is CHECK-constrained to exactly the six controlled values", () => {
    expect(body).toMatch(
      /status in \(\s*\n\s*'draft', 'submitted_for_review', 'changes_requested', 'approved', 'released_to_student', 'archived'\s*\n\s*\)/
    );
  });

  it("recommendation_type is CHECK-constrained to the four known types, or null", () => {
    expect(body).toMatch(/recommendation_type is null or recommendation_type in \('career', 'course', 'college', 'pathway'\)/);
  });

  it("[safety invariant] a released draft must carry its release AND approval provenance", () => {
    expect(body).toMatch(/recommendation_drafts_released_consistency/);
    expect(body).toMatch(/status = 'released_to_student' and released_at is not null and released_by is not null and approved_at is not null and approved_by is not null/);
  });

  it("[safety invariant] an approved or released draft must carry its approval provenance", () => {
    expect(body).toMatch(/recommendation_drafts_approved_consistency/);
  });

  it("has ZERO insert/update/delete RLS policy — RPC-only for every role including super_admin/admin", () => {
    const tableSectionEnd = sql.indexOf("create table if not exists public.recommendation_draft_versions");
    const section = sql.slice(start, tableSectionEnd);
    expect(section).not.toMatch(/for (insert|update|delete)\s+to authenticated/);
  });
});

describe("recommendation_draft_versions — immutable version history", () => {
  const start = sql.indexOf("create table if not exists public.recommendation_draft_versions");
  const end = sql.indexOf("alter table public.recommendation_drafts\n  add constraint", start);
  const body = sql.slice(start, end);

  it("version_number is unique per draft and must be >= 1", () => {
    expect(body).toMatch(/recommendation_draft_versions_number_check check \(version_number >= 1\)/);
    expect(body).toMatch(/recommendation_draft_versions_unique_number unique \(draft_id, version_number\)/);
  });

  it("content must be a jsonb object", () => {
    expect(body).toMatch(/jsonb_typeof\(content\) = 'object'/);
  });

  it("has ZERO insert/update/delete RLS policy — append-only, RPC-only", () => {
    const sectionEnd = sql.indexOf("staff_create_recommendation_draft(", start);
    const section = sql.slice(start, sectionEnd);
    expect(section).not.toMatch(/for (insert|update|delete)\s+to authenticated/);
  });
});

describe("staff_create_recommendation_draft — authorization + atomicity", () => {
  const body = sliceFunctionBody("create or replace function public.staff_create_recommendation_draft(");

  it("is SECURITY DEFINER with a locked search_path", () => {
    expect(body).toMatch(/security definer/);
    expect(body).toMatch(/set search_path = public/);
  });

  it("re-checks admin role OR counsellor dual-basis case access directly — never trusts another table's RLS", () => {
    expect(body).toMatch(/is_admin_role\(array\['super_admin', 'admin'\]\)/);
    expect(body).toMatch(/counsellor_has_case_access\(p_student_user_id\)/);
  });

  it("inserts the draft AND its first version, then points current_version_id at it", () => {
    expect(body).toMatch(/insert into public\.recommendation_drafts/);
    expect(body).toMatch(/insert into public\.recommendation_draft_versions/);
    expect(body).toMatch(/update public\.recommendation_drafts set current_version_id = v_version\.id/);
  });
});

describe("staff_update_recommendation_draft_content — lock-then-validate, draft/changes_requested only", () => {
  const body = sliceFunctionBody("create or replace function public.staff_update_recommendation_draft_content(");

  it("locks the row before validating (for update appears before the status check)", () => {
    const lockIndex = body.indexOf("for update");
    const statusCheckIndex = body.indexOf("not in ('draft', 'changes_requested')");
    expect(lockIndex).toBeGreaterThan(-1);
    expect(statusCheckIndex).toBeGreaterThan(lockIndex);
  });

  it("only accepts draft or changes_requested — never submitted_for_review/approved/released/archived", () => {
    expect(body).toMatch(/v_draft\.status not in \('draft', 'changes_requested'\)/);
  });

  it("creates a NEW version row rather than mutating an existing one", () => {
    expect(body).toMatch(/insert into public\.recommendation_draft_versions \(draft_id, version_number, content, authored_by\)/);
    expect(body).not.toMatch(/update public\.recommendation_draft_versions/);
  });
});

describe("staff_review_recommendation_draft — the approval gate", () => {
  const body = sliceFunctionBody("create or replace function public.staff_review_recommendation_draft(");

  it("[SELF-APPROVAL PREVENTION] raises if the caller is the draft's own author, with no role-based exception, before the authorization check", () => {
    const selfCheckIndex = body.indexOf("v_draft.created_by = auth.uid()");
    const authCheckIndex = body.indexOf("is_admin_role(array['super_admin', 'admin'])");
    expect(selfCheckIndex).toBeGreaterThan(-1);
    expect(authCheckIndex).toBeGreaterThan(-1);
    // The self-authorship raise must appear BEFORE the role-based
    // authorization branch — it is never short-circuited by being an
    // admin or a case-assigned counsellor.
    expect(selfCheckIndex).toBeLessThan(authCheckIndex);
    expect(body).toMatch(/raise exception 'A recommendation draft cannot be reviewed by its own author\.'/);
  });

  it("only transitions FROM submitted_for_review", () => {
    expect(body).toMatch(/v_draft\.status <> 'submitted_for_review'/);
  });

  it("requires non-empty review_notes when requesting changes", () => {
    expect(body).toMatch(/p_decision = 'request_changes' and \(p_review_notes is null or length\(trim\(p_review_notes\)\) = 0\)/);
  });

  it("approve sets BOTH reviewed_at/by AND approved_at/by in the same statement", () => {
    const approveBranchStart = body.indexOf("if p_decision = 'approve' then");
    const approveBranchEnd = body.indexOf("else", approveBranchStart);
    const approveBranch = body.slice(approveBranchStart, approveBranchEnd);
    expect(approveBranch).toMatch(/reviewed_at = now\(\), reviewed_by = auth\.uid\(\)/);
    expect(approveBranch).toMatch(/approved_at = now\(\), approved_by = auth\.uid\(\)/);
    expect(approveBranch).toMatch(/status = 'approved'/);
  });
});

describe("staff_release_recommendation_draft — only an approved draft can ever be released", () => {
  const body = sliceFunctionBody("create or replace function public.staff_release_recommendation_draft(");

  it("only transitions FROM approved", () => {
    expect(body).toMatch(/v_draft\.status <> 'approved'/);
  });

  it("sets released_at/released_by in the same statement as the status change", () => {
    expect(body).toMatch(/set status = 'released_to_student', released_at = now\(\), released_by = auth\.uid\(\)/);
  });
});

describe("Student-facing reads — zero internal-column leakage", () => {
  it("get_my_recommendation_reports() excludes review_notes/created_by/reviewed_by/approved_by/released_by/archived_by from its own RETURNS TABLE", () => {
    const start = sql.indexOf("create or replace function public.get_my_recommendation_reports()");
    const returnsStart = sql.indexOf("returns table (", start);
    const returnsEnd = sql.indexOf(")", returnsStart);
    const shape = sql.slice(returnsStart, returnsEnd);
    for (const forbidden of ["review_notes", "created_by", "reviewed_by", "approved_by", "released_by", "archived_by", "author_counsellor_id", "submitted_by"]) {
      expect(shape).not.toMatch(new RegExp(forbidden));
    }
  });

  it("get_my_recommendation_reports() is scoped to the caller's own released rows only", () => {
    const body = sliceFunctionBody("create or replace function public.get_my_recommendation_reports()");
    expect(body).toMatch(/d\.student_user_id = auth\.uid\(\) and d\.status = 'released_to_student'/);
  });

  it("get_my_recommendation_report_content() excludes every internal column from its own RETURNS TABLE", () => {
    const start = sql.indexOf("create or replace function public.get_my_recommendation_report_content(p_draft_id uuid)");
    const returnsStart = sql.indexOf("returns table (", start);
    const returnsEnd = sql.indexOf(")", returnsStart);
    const shape = sql.slice(returnsStart, returnsEnd);
    for (const forbidden of ["review_notes", "created_by", "reviewed_by", "approved_by", "released_by", "archived_by"]) {
      expect(shape).not.toMatch(new RegExp(forbidden));
    }
  });

  it("get_my_recommendation_report_content() is scoped to the caller's own released rows only, joined to the CURRENT version", () => {
    const body = sliceFunctionBody("create or replace function public.get_my_recommendation_report_content(p_draft_id uuid)");
    expect(body).toMatch(/d\.student_user_id = auth\.uid\(\) and d\.status = 'released_to_student' and d\.id = p_draft_id/);
    expect(body).toMatch(/join public\.recommendation_draft_versions v on v\.id = d\.current_version_id/);
  });
});

describe('anon revoke convention — every new function revokes from public, grants only to authenticated', () => {
  const functions = [
    "counsellor_has_case_access(uuid)",
    "staff_create_recommendation_draft(uuid, text, text, jsonb)",
    "staff_update_recommendation_draft_content(uuid, jsonb)",
    "staff_submit_recommendation_draft_for_review(uuid)",
    "staff_review_recommendation_draft(uuid, text, text)",
    "staff_release_recommendation_draft(uuid)",
    "staff_withdraw_recommendation_draft(uuid)",
    "staff_archive_recommendation_draft(uuid)",
    "get_my_recommendation_reports()",
    "get_my_recommendation_report_content(uuid)",
  ];

  it.each(functions)("%s has a matching revoke-from-public and grant-to-authenticated", (fn) => {
    expect(sql).toMatch(new RegExp(`revoke execute on function public\\.${fn.replace(/[().]/g, "\\$&")} from public`));
    expect(sql).toMatch(new RegExp(`grant execute on function public\\.${fn.replace(/[().]/g, "\\$&")} to authenticated`));
  });
});
