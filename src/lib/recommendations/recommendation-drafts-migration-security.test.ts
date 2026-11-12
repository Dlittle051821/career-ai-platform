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
// CC-26: normalise line endings — the worktree is checked out with CRLF on Windows and the
// assertions below match multi-line SQL text written with "\n".
const sql = readFileSync(MIGRATION_PATH, "utf8").replace(/\r\n/g, "\n");

function sliceFunctionBody(functionSignature: string): string {
  const start = sql.indexOf(functionSignature);
  expect(start).toBeGreaterThan(-1);
  const end = sql.indexOf("\n$$;", start);
  expect(end).toBeGreaterThan(start);
  return sql.slice(start, end);
}

/**
 * CC-26 — PART 1 was rewritten. The original PART 1 granted case access to a
 * counsellor through ANY Discovery Session assignment, including an
 * unapproved self-claim (reproduced as a P0 on a QA-like database in CC-26).
 * The tests below replace the five "widens … discovery_sessions" assertions,
 * which asserted that insecure rule, with assertions of the approval-gated
 * rule and of the caseload-only fallback used when cc25/0023 is absent.
 * The executable proof is scripts/security/cc26-security-closure.db.test.mjs.
 */
const part1Start = sql.indexOf("do $nw07$\n");
const part1End = sql.indexOf("end\n$nw07$;", part1Start);
const part1 = sql.slice(part1Start, part1End);
const executable = sql
  .split("\n")
  .filter((line) => !line.trimStart().startsWith("--"))
  .join("\n");

function caseAccessDefinitions(): string[] {
  return part1.match(/create or replace function public\.counsellor_has_case_access\(p_student_user_id uuid\)[\s\S]*?\$fn\$\s*\n\s*\$sql\$/g) ?? [];
}
function policy(name: string): string {
  const start = part1.indexOf(`create policy "${name}"`);
  expect(start).toBeGreaterThan(-1);
  return part1.slice(start, part1.indexOf("$sql$", start));
}

describe("PART 1 — counsellor case access (CC-26: approval-gated, never an unapproved session)", () => {
  it("no executable statement in the file grants access through a raw discovery_sessions assignment", () => {
    expect(part1Start).toBeGreaterThan(-1);
    expect(part1End).toBeGreaterThan(part1Start);
    expect(executable).not.toMatch(/discovery_sessions ds/);
    expect(executable).not.toMatch(/ds\.assigned_counsellor_id/);
  });

  it("without cc25/0023 PART 1 takes the caseload-only branch and changes no policy", () => {
    const fallbackStart = part1.indexOf("if to_regprocedure('public.counsellor_has_active_session_for_student(uuid)') is null then");
    const fallbackEnd = part1.indexOf("return;", fallbackStart);
    expect(fallbackStart).toBeGreaterThan(-1);
    const fallback = part1.slice(fallbackStart, fallbackEnd);
    expect(fallback).toMatch(/create or replace function public\.counsellor_has_case_access/);
    expect(fallback).not.toMatch(/create policy|drop policy|counsellor_has_active_session_for_student\(p_/);
  });

  it("profiles SELECT stays the 0004 caseload-only rule (identity only through the CC-25 RPC)", () => {
    const body = policy("Admins/assigned counsellor can read student profiles (m7)");
    expect(body).toMatch(/m\.student_user_id = profiles\.id and m\.assigned_counsellor_id = public\.current_counsellor_id\(\)/);
    expect(body).not.toMatch(/discovery_sessions|counsellor_has_case_access|counsellor_has_active_session_for_student/);
  });

  it("the 11-table student_* loop requires counsellor_has_case_access for every table", () => {
    const start = part1.indexOf("foreach v_table in array array[");
    const end = part1.indexOf("end loop;", start);
    const body = part1.slice(start, end);
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
    expect(body).toMatch(/public\.counsellor_has_case_access\(%1\$I\.user_id\)/);
    expect(body).not.toMatch(/discovery_sessions/);
  });

  it("admin_student_meta SELECT requires case access; its INSERT/UPDATE policies are untouched by this file", () => {
    expect(policy("Admins/assigned counsellor can read student meta")).toMatch(/public\.counsellor_has_case_access\(admin_student_meta\.student_user_id\)/);
    expect(sql).not.toMatch(/create policy[^;]*on public\.admin_student_meta for (update|insert)/);
  });

  it("admin_student_notes SELECT and INSERT require case access; INSERT still stamps the author", () => {
    expect(policy("Admins/assigned counsellor can read student notes")).toMatch(/public\.counsellor_has_case_access\(admin_student_notes\.student_user_id\)/);
    const insertBody = policy("Admins/assigned counsellor can add student notes");
    expect(insertBody).toMatch(/public\.counsellor_has_case_access\(admin_student_notes\.student_user_id\)/);
    expect(insertBody).toMatch(/author_user_id = auth\.uid\(\)/);
  });

  it("counsellor_has_case_access: STABLE SECURITY DEFINER, pinned search_path, caseload OR admin-approved active session", () => {
    const defs = caseAccessDefinitions();
    expect(defs.length).toBe(2); // caseload-only fallback, then the approval-gated rule
    for (const body of defs) {
      expect(body).toMatch(/security definer/);
      expect(body).toMatch(/stable/);
      expect(body).toMatch(/set search_path = pg_catalog, public, pg_temp/);
      expect(body).toMatch(/auth\.uid\(\) is not null/);
      expect(body).toMatch(/admin_student_meta m/);
      expect(body).not.toMatch(/discovery_sessions/);
    }
    expect(defs[0]).not.toMatch(/counsellor_has_active_session_for_student/);
    expect(defs[1]).toMatch(/public\.counsellor_has_active_session_for_student\(p_student_user_id\)/);
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
    const escaped = fn.replace(/[().]/g, "\\$&");
    if (fn === "counsellor_has_case_access(uuid)") {
      // CC-26: stricter — PUBLIC, anon and service_role all revoked (Supabase grants anon directly).
      expect(sql).toMatch(new RegExp(`revoke all on function public\\.${escaped} from public, anon, service_role`));
    } else {
      expect(sql).toMatch(new RegExp(`revoke execute on function public\\.${escaped} from public`));
    }
    expect(sql).toMatch(new RegExp(`grant execute on function public\\.${escaped} to authenticated`));
  });
});
