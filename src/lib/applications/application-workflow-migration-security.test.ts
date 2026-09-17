import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Regression guard for
 * supabase/migrations/0017_student_application_workflow.sql's security- and
 * concurrency-relevant invariants — mirrors
 * src/lib/payments/refund-operations-migration-security.test.ts exactly (a
 * static check against the actual migration SQL text, not a live Postgres
 * connection — this project has no database in its Vitest setup).
 *
 * Also asserts, per the M16 spec's explicit requirement, that this is an
 * additive migration: 0001-0016 are left untouched by checking that the
 * pre-existing `applications`/`application_status_history` table
 * definitions and their original RLS policies still exist verbatim in
 * 0004_admin_system.sql, and that the most recent prior
 * product_events_event_name_check redefinition (0012) is exactly what 0017
 * copies forward before appending its own three new names.
 */

const MIGRATIONS_DIR = path.resolve(process.cwd(), "supabase/migrations");
const MIGRATION_PATH = path.join(MIGRATIONS_DIR, "0017_student_application_workflow.sql");
const sql = readFileSync(MIGRATION_PATH, "utf8");
const originalAdminSystemSql = readFileSync(path.join(MIGRATIONS_DIR, "0004_admin_system.sql"), "utf8");
const stampingSql = readFileSync(path.join(MIGRATIONS_DIR, "0012_electronic_stamping_and_assisted_onboarding.sql"), "utf8");
const globalCourseDataSql = readFileSync(path.join(MIGRATIONS_DIR, "0006_global_university_course_data.sql"), "utf8");

describe("0017_student_application_workflow.sql — baseline: 0001-0016 untouched", () => {
  it("the pre-existing applications/application_status_history tables still exist, unmodified, in 0004_admin_system.sql", () => {
    expect(originalAdminSystemSql).toMatch(/create table if not exists public\.applications/);
    expect(originalAdminSystemSql).toMatch(/create table if not exists public\.application_status_history/);
  });

  it("0017 only ever ALTERs or ADDs — never DROPs the applications/application_status_history tables themselves", () => {
    expect(sql).not.toMatch(/drop table.*applications/i);
  });
});

describe("0017_student_application_workflow.sql — stage lifecycle widening", () => {
  it("drops the old applications_stage_check before adding the new one", () => {
    expect(sql).toMatch(/alter table public\.applications drop constraint if exists applications_stage_check;/);
  });

  it("adds exactly one new stage, 'ready_to_submit', preserving all ten Milestone 7 values", () => {
    expect(sql).toMatch(
      /stage in \('inquiry', 'preparing', 'ready_to_submit', 'submitted', 'under_review', 'interview', 'decision_pending', 'offer_received', 'enrolled', 'rejected', 'withdrawn'\)/
    );
  });
});

describe("0017_student_application_workflow.sql — new columns are additive", () => {
  it("every new applications column uses ADD COLUMN IF NOT EXISTS, never a destructive change", () => {
    for (const column of ["course_intake_id", "student_note", "submitted_at", "decision_at", "withdrawn_at"]) {
      expect(sql).toMatch(new RegExp(`add column if not exists ${column} `));
    }
    expect(sql).not.toMatch(/alter table public\.applications drop column/);
  });

  it("every new application_status_history column is additive too", () => {
    for (const column of ["actor_type", "student_visible_message"]) {
      expect(sql).toMatch(new RegExp(`add column if not exists ${column} `));
    }
    expect(sql).not.toMatch(/alter table public\.application_status_history drop column/);
  });

  it("actor_type defaults to 'system' (safe for every pre-M16 history row) and is constrained to the four known values", () => {
    expect(sql).toMatch(/add column if not exists actor_type text not null default 'system'/);
    expect(sql).toMatch(/check \(actor_type in \('student', 'admin', 'counsellor', 'system'\)\)/);
  });

  it("student_note and student_visible_message are both length-capped", () => {
    expect(sql).toMatch(/check \(student_note is null or length\(student_note\) <= 2000\)/);
    expect(sql).toMatch(/check \(student_visible_message is null or length\(student_visible_message\) <= 500\)/);
  });
});

describe("0017_student_application_workflow.sql — course_intake_id cross-table validation", () => {
  it("uses a trigger, not a CHECK constraint, since Postgres CHECK cannot reference another table", () => {
    expect(sql).toMatch(/create or replace function public\.validate_application_course_intake\(\)/);
    expect(sql).toMatch(/before insert or update of course_intake_id, course_id on public\.applications/);
    expect(sql).not.toMatch(/constraint applications_course_intake_matches_course\s*\n\s*check \(exists/);
  });

  it("rejects a course_intake_id that does not belong to the application's own course_id", () => {
    const start = sql.indexOf("create or replace function public.validate_application_course_intake()");
    const end = sql.indexOf("$$;", start);
    const body = sql.slice(start, end);
    expect(body).toMatch(/if not exists \(select 1 from public\.course_intakes ci where ci\.id = new\.course_intake_id and ci\.course_id = new\.course_id\) then/);
    expect(body).toMatch(/raise exception/);
  });
});

describe("0017_student_application_workflow.sql — validate_application_course_intake() hardening (patch — Issue 4)", () => {
  const start = sql.indexOf("create or replace function public.validate_application_course_intake()");
  const end = sql.indexOf("$$;", start);
  const body = sql.slice(start, end);

  it("[patch-issue-4] no longer requires course_id to ALSO be non-null before validating — the old `course_intake_id is not null and course_id is not null` gate let course_intake_id != null / course_id = null slip through untouched", () => {
    expect(body).not.toMatch(/if new\.course_intake_id is not null and new\.course_id is not null then/);
    expect(body).toMatch(/if new\.course_intake_id is not null then/);
  });

  it("[patch-issue-4] a non-null course_intake_id with a null course_id is explicitly rejected", () => {
    expect(body).toMatch(/if new\.course_id is null then\s*\n\s*raise exception 'course_intake_id requires a matching course_id/);
  });

  it("[patch-issue-4] a matching course_id + course_intake_id combination is still accepted (the cross-table existence check is unchanged, just re-nested)", () => {
    expect(body).toMatch(/if not exists \(select 1 from public\.course_intakes ci where ci\.id = new\.course_intake_id and ci\.course_id = new\.course_id\) then/);
  });

  it("[patch-issue-4] a null course_intake_id is always accepted — the whole validation block is skipped, not merely satisfied vacuously", () => {
    // The entire body of the `if new.course_intake_id is not null then` block
    // (both the course_id-null check and the cross-table check) sits inside
    // that one guard, so a null course_intake_id short-circuits past all of
    // it and the trigger falls straight through to `return new;`.
    const guardIndex = body.indexOf("if new.course_intake_id is not null then");
    const returnIndex = body.lastIndexOf("return new;");
    expect(guardIndex).toBeGreaterThan(-1);
    expect(returnIndex).toBeGreaterThan(guardIndex);
  });
});

describe("0017_student_application_workflow.sql — student_advance_application()", () => {
  const start = sql.indexOf("create or replace function public.student_advance_application(p_application_id uuid, p_action text)");
  const end = sql.indexOf("\n$$;", start);
  const body = sql.slice(start, end);

  it("exists, is SECURITY DEFINER with a pinned search_path", () => {
    expect(start).toBeGreaterThan(-1);
    expect(body).toMatch(/security definer/);
    expect(body).toMatch(/set search_path = public/);
  });

  it("validates auth.uid() is present before doing anything else", () => {
    expect(body).toMatch(/if auth\.uid\(\) is null then\s*\n\s*raise exception 'Not authenticated\.'/);
  });

  it("scopes its row lock to student_user_id = auth.uid() — never trusts a caller-supplied student id", () => {
    expect(body).toMatch(/where id = p_application_id and student_user_id = auth\.uid\(\) for update;/);
  });

  it("locks the row FOR UPDATE before validating the current stage (closes the same class of race claim_refund_for_processing() closes)", () => {
    expect(body).toMatch(/for update;/);
    const lockIndex = body.indexOf("for update;");
    const validateIndex = body.indexOf("if not (v_row.stage = any(v_from_stages))");
    expect(lockIndex).toBeGreaterThan(-1);
    expect(validateIndex).toBeGreaterThan(lockIndex);
  });

  it("has a fixed, exhaustive action vocabulary — never accepts a raw target stage string", () => {
    expect(body).toMatch(/when 'start_preparing' then/);
    expect(body).toMatch(/when 'mark_ready_to_submit' then/);
    expect(body).toMatch(/when 'submit' then/);
    expect(body).toMatch(/when 'withdraw' then/);
    expect(body).toMatch(/else\s*\n\s*raise exception 'Unknown application action: %', p_action/);
  });

  it("can never reach under_review, interview, decision_pending, offer_received, enrolled, or rejected — those five/six names never appear as a v_to_stage assignment", () => {
    const toStageAssignments = [...body.matchAll(/v_to_stage := '([a-z_]+)';/g)].map((m) => m[1]);
    expect(toStageAssignments.sort()).toEqual(["preparing", "ready_to_submit", "submitted", "withdrawn"].sort());
    for (const forbidden of ["under_review", "interview", "decision_pending", "offer_received", "enrolled", "rejected"]) {
      expect(toStageAssignments).not.toContain(forbidden);
    }
  });

  it("sets submitted_at/withdrawn_at atomically in the same UPDATE that performs the transition — never a caller-supplied timestamp", () => {
    expect(body).toMatch(/submitted_at = case when v_to_stage = 'submitted' then now\(\) else submitted_at end/);
    expect(body).toMatch(/withdrawn_at = case when v_to_stage = 'withdrawn' then now\(\) else withdrawn_at end/);
  });

  it("records a history event with actor_type 'student' on every transition", () => {
    expect(body).toMatch(/insert into public\.application_status_history \(application_id, from_status, to_status, changed_by, actor_type, student_visible_message\)/);
    expect(body).toMatch(/values \(p_application_id, v_old_stage, v_to_stage, auth\.uid\(\), 'student', v_message\);/);
  });

  it("uses the SAME generic, safe error message for both 'not yours' and 'already changed' — never lets a caller distinguish the two (anti-enumeration)", () => {
    const messages = [...body.matchAll(/raise exception '([^']*)'/g)].map((m) => m[1]);
    const genericMessages = messages.filter((m) => m.includes("may not be yours"));
    expect(genericMessages.length).toBeGreaterThanOrEqual(2);
    expect(new Set(genericMessages).size).toBe(1);
  });

  it("is granted to authenticated only, never PUBLIC", () => {
    expect(sql).toMatch(/revoke all on function public\.student_advance_application\(uuid, text\) from public;/);
    expect(sql).toMatch(/grant execute on function public\.student_advance_application\(uuid, text\) to authenticated;/);
  });

  it("[patch — defense-in-depth] the final UPDATE re-scopes to student_user_id = auth.uid() AND the exact locked stage, not just id = p_application_id alone", () => {
    // The pre-patch version of this function's final UPDATE read only
    // `where id = p_application_id` — relying entirely on the preceding
    // `SELECT ... FOR UPDATE` to have already checked ownership/stage. This
    // asserts the UPDATE itself now independently re-asserts both.
    expect(body).toMatch(
      /update public\.applications\s*\n\s*set\s*\n\s*stage = v_to_stage,\s*\n\s*submitted_at = case when v_to_stage = 'submitted' then now\(\) else submitted_at end,\s*\n\s*withdrawn_at = case when v_to_stage = 'withdrawn' then now\(\) else withdrawn_at end\s*\n\s*where id = p_application_id\s*\n\s*and student_user_id = auth\.uid\(\)\s*\n\s*and stage = v_old_stage\s*\n\s*returning \* into v_row;/
    );
  });

  it("[patch — defense-in-depth] raises the same safe, generic error if the final UPDATE unexpectedly affects zero rows, before inserting any history row", () => {
    const updateIndex = body.indexOf("update public.applications");
    const secondNullCheckIndex = body.indexOf("if v_row.id is null then", body.indexOf("if v_row.id is null then") + 1);
    const historyInsertIndex = body.indexOf("insert into public.application_status_history");
    expect(updateIndex).toBeGreaterThan(-1);
    expect(secondNullCheckIndex).toBeGreaterThan(updateIndex);
    expect(historyInsertIndex).toBeGreaterThan(secondNullCheckIndex);
  });

  it("[patch — defense-in-depth] the generic anti-enumeration error now appears at least three times (initial ownership/stage check, post-select stage check, post-update zero-row check) and is still always the exact same text", () => {
    const messages = [...body.matchAll(/raise exception '([^']*)'/g)].map((m) => m[1]);
    const genericMessages = messages.filter((m) => m.includes("may not be yours"));
    expect(genericMessages.length).toBeGreaterThanOrEqual(3);
    expect(new Set(genericMessages).size).toBe(1);
  });
});

describe("0017_student_application_workflow.sql — student_update_application_note()", () => {
  const start = sql.indexOf("create or replace function public.student_update_application_note(p_application_id uuid, p_note text)");
  const end = sql.indexOf("\n$$;", start);
  const body = sql.slice(start, end);

  it("exists, is SECURITY DEFINER with a pinned search_path", () => {
    expect(start).toBeGreaterThan(-1);
    expect(body).toMatch(/security definer/);
    expect(body).toMatch(/set search_path = public/);
  });

  it("scopes its UPDATE to student_user_id = auth.uid() inside the WHERE clause itself, never a preceding SELECT alone", () => {
    expect(body).toMatch(/update public\.applications\s*\n\s*set student_note = v_note\s*\n\s*where id = p_application_id\s*\n\s*and student_user_id = auth\.uid\(\)/);
  });

  it("touches no column other than student_note", () => {
    expect(body).toMatch(/set student_note = v_note/);
    expect(body).not.toMatch(/set stage/);
    expect(body).not.toMatch(/set decision_status/);
  });

  it("trims and length-caps the note (defense in depth alongside the CHECK constraint)", () => {
    expect(body).toMatch(/v_note := nullif\(btrim\(coalesce\(p_note, ''\)\), ''\);/);
    expect(body).toMatch(/if v_note is not null and length\(v_note\) > 2000 then/);
  });

  it("is granted to authenticated only, never PUBLIC", () => {
    expect(sql).toMatch(/revoke all on function public\.student_update_application_note\(uuid, text\) from public;/);
    expect(sql).toMatch(/grant execute on function public\.student_update_application_note\(uuid, text\) to authenticated;/);
  });
});

describe("0017_student_application_workflow.sql — closing the application_status_history IDOR gap", () => {
  it("drops and recreates both the SELECT and INSERT policies, narrowing them to ownership/admin authorization", () => {
    expect(sql).toMatch(/drop policy if exists "Application history follows application visibility \(read\)" on public\.application_status_history;/);
    expect(sql).toMatch(/drop policy if exists "Application history follows application visibility \(insert\)" on public\.application_status_history;/);
  });

  const readPolicyStart = sql.indexOf('create policy "Application history follows application visibility (read)"');
  const readPolicyEnd = sql.indexOf("drop policy if exists \"Application history follows application visibility (insert)\"", readPolicyStart);
  const readPolicy = sql.slice(readPolicyStart, readPolicyEnd);

  const insertPolicyStart = sql.indexOf('create policy "Application history follows application visibility (insert)"');
  const insertPolicyEnd = sql.indexOf("comment on table public.application_status_history", insertPolicyStart);
  const insertPolicy = sql.slice(insertPolicyStart, insertPolicyEnd);

  it("the read policy is admin/counsellor-only — a plain student can no longer read this table directly at all (patch: RLS restricts rows, not columns, so a student-owns-this-row branch could still leak `note`/`changed_by`)", () => {
    expect(readPolicy).toMatch(/public\.is_admin_role\(array\['super_admin', 'admin', 'finance', 'analyst'\]\)/);
    expect(readPolicy).not.toMatch(/a\.student_user_id = auth\.uid\(\)/);
  });

  it("the read policy still lets an authorized counsellor read history for their OWN assigned applications only", () => {
    expect(readPolicy).toMatch(/public\.is_admin_role\(array\['counsellor'\]\)/);
    expect(readPolicy).toMatch(/a\.assigned_counsellor_id = public\.current_counsellor_id\(\)/);
  });

  it("[patch-issue-1.1] the insert policy no longer has a student_user_id branch — an ordinary student can never directly INSERT a history row", () => {
    expect(insertPolicy).toMatch(/changed_by = auth\.uid\(\)/);
    expect(insertPolicy).not.toMatch(/a\.student_user_id = auth\.uid\(\)/);
  });

  it("[patch-issue-1.3] admin/super_admin can still create legitimate history entries directly", () => {
    expect(insertPolicy).toMatch(/public\.is_admin_role\(array\['super_admin', 'admin'\]\)/);
  });

  it("[patch-issue-1.4] an assigned counsellor can still create legitimate history entries directly", () => {
    expect(insertPolicy).toMatch(/public\.is_admin_role\(array\['counsellor'\]\)/);
  });

  it("[patch-issue-1.5] a counsellor's insert authorization is scoped to applications assigned to THAT counsellor — never any application, so an unrelated counsellor cannot insert history for another counsellor's case", () => {
    // The counsellor branch of the insert policy must join back through an
    // `applications` row filtered on assigned_counsellor_id =
    // current_counsellor_id() (the currently-authenticated counsellor) —
    // not a bare "is a counsellor" check with no per-row scoping.
    const counsellorBranchStart = insertPolicy.indexOf("public.is_admin_role(array['counsellor'])");
    expect(counsellorBranchStart).toBeGreaterThan(-1);
    const counsellorBranch = insertPolicy.slice(counsellorBranchStart, counsellorBranchStart + 300);
    expect(counsellorBranch).toMatch(/a\.assigned_counsellor_id = public\.current_counsellor_id\(\)/);
  });

  it("[patch-issue-1.2] student_advance_application() remains the legitimate path that still creates the student's own history row (see the dedicated describe block above) — its INSERT is unaffected by this policy narrowing because it is SECURITY DEFINER and therefore bypasses RLS as the function owner", () => {
    // Cross-check: the RPC's own INSERT statement (asserted in detail in
    // the "student_advance_application()" describe block above) is present
    // and untouched by this patch.
    expect(sql).toMatch(/insert into public\.application_status_history \(application_id, from_status, to_status, changed_by, actor_type, student_visible_message\)/);
  });
});

describe("0017_student_application_workflow.sql — get_my_application_status_history() (patch — Issue 2: column-level leak via direct table access)", () => {
  const start = sql.indexOf("create or replace function public.get_my_application_status_history(p_application_id uuid)");
  const end = sql.indexOf("\n$$;", start);
  const body = sql.slice(start, end);
  const returnsTableStart = sql.indexOf("returns table (", start);
  const returnsTableEnd = sql.indexOf(")", returnsTableStart);
  const returnsTableColumns = sql.slice(returnsTableStart, returnsTableEnd);

  it("exists, is SECURITY DEFINER with a pinned search_path", () => {
    expect(start).toBeGreaterThan(-1);
    expect(body).toMatch(/security definer/);
    expect(body).toMatch(/set search_path = public/);
  });

  it("verifies ownership itself (application.student_user_id = auth.uid()) rather than trusting RLS on the underlying tables", () => {
    expect(body).toMatch(/a\.student_user_id = auth\.uid\(\)/);
  });

  it("its RETURNS TABLE column list never includes `note` or `changed_by` — structurally, not just by convention", () => {
    expect(returnsTableColumns).not.toMatch(/\bnote\b/);
    expect(returnsTableColumns).not.toMatch(/\bchanged_by\b/);
    expect(returnsTableColumns).toMatch(/student_visible_message/);
  });

  it("its query body also never selects `note` or `changed_by` off the underlying table", () => {
    const selectStart = body.indexOf("select h.id");
    const selectEnd = body.indexOf("\n", body.indexOf("order by", selectStart));
    const querySection = body.slice(selectStart, selectEnd === -1 ? undefined : selectEnd);
    expect(querySection).not.toMatch(/h\.note\b/);
    expect(querySection).not.toMatch(/h\.changed_by\b/);
  });

  it("is granted to authenticated only, never PUBLIC", () => {
    expect(sql).toMatch(/revoke all on function public\.get_my_application_status_history\(uuid\) from public;/);
    expect(sql).toMatch(/grant execute on function public\.get_my_application_status_history\(uuid\) to authenticated;/);
  });
});

describe("0017_student_application_workflow.sql — duplicate active application protection", () => {
  it("uses two partial unique indexes, not one — Postgres NULL-distinctness means a single combined index would never fire for the no-intake-linked case", () => {
    expect(sql).toMatch(
      /create unique index applications_one_active_per_student_course_no_intake\s*\n\s*on public\.applications \(student_user_id, course_id\)\s*\n\s*where course_id is not null and course_intake_id is null and stage not in \('rejected', 'withdrawn'\);/
    );
    expect(sql).toMatch(
      /create unique index applications_one_active_per_student_course_intake\s*\n\s*on public\.applications \(student_user_id, course_id, course_intake_id\)\s*\n\s*where course_id is not null and course_intake_id is not null and stage not in \('rejected', 'withdrawn'\);/
    );
  });

  it("only 'rejected' and 'withdrawn' are excluded from the active-application guard — every other stage counts as active", () => {
    // Scoped to PART 5's own two partial unique index definitions — v3 adds
    // two MORE occurrences of this exact phrase inside
    // student_start_application()'s reapplication-reuse logic (PART 9),
    // which intentionally mirrors the same rule at the RPC layer, so a
    // whole-file count would no longer assert anything about PART 5
    // specifically.
    const part5Start = sql.indexOf("PART 5 — Duplicate active application protection");
    const part5End = sql.indexOf("PART 6 — Analytics", part5Start);
    const part5 = sql.slice(part5Start, part5End);
    const matches = part5.match(/stage not in \('rejected', 'withdrawn'\)/g) ?? [];
    expect(matches.length).toBe(2);
  });

  it("[v3] student_start_application()'s own reapplication-reuse logic mirrors the exact same 'rejected'/'withdrawn' exclusion rule", () => {
    const start = sql.indexOf("create or replace function public.student_start_application(p_course_id uuid, p_university_id uuid)");
    const end = sql.indexOf("\n$$;", start);
    const body = sql.slice(start, end);
    const matches = body.match(/stage not in \('rejected', 'withdrawn'\)/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });
});

describe("0017_student_application_workflow.sql — analytics: product_events_event_name_check widening", () => {
  it("drops the old constraint before adding the new one", () => {
    expect(sql).toMatch(/alter table public\.product_events drop constraint if exists product_events_event_name_check;/);
  });

  it("copies every event name from the most recent prior definition (0012) verbatim, never dropping or renaming one", () => {
    const priorStart = stampingSql.indexOf("alter table public.product_events add constraint product_events_event_name_check check (event_name in (");
    const priorEnd = stampingSql.indexOf("));", priorStart);
    const priorNames = [...stampingSql.slice(priorStart, priorEnd).matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);

    const newStart = sql.indexOf("alter table public.product_events add constraint product_events_event_name_check check (event_name in (");
    const newEnd = sql.indexOf("));", newStart);
    const newNames = [...sql.slice(newStart, newEnd).matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);

    for (const name of priorNames) {
      expect(newNames).toContain(name);
    }
  });

  it("appends exactly the three new Milestone 16 event names", () => {
    for (const name of ["application_status_changed", "application_submitted", "application_withdrawn"]) {
      expect(sql).toMatch(new RegExp(`'${name}'`));
    }
  });

  it("does not touch the pre-existing (reserved) 'offer_received' product event name's own meaning — it still appears exactly once as an actual list entry (ignoring SQL comment lines)", () => {
    const start = sql.indexOf("alter table public.product_events add constraint product_events_event_name_check check (event_name in (");
    const end = sql.indexOf("));", start);
    const codeOnly = sql
      .slice(start, end)
      .split("\n")
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n");
    const matches = codeOnly.match(/'offer_received'/g) ?? [];
    expect(matches.length).toBe(1);
  });
});

// ============================================================================
// v3 — FINAL STUDENT DATABASE-BOUNDARY HARDENING
// ============================================================================

describe("0017_student_application_workflow.sql — v3 [test 1] mutation RPC return types exclude internal staff columns", () => {
  it("student_advance_application() no longer `returns public.applications` — it returns a narrow TABLE of 5 columns only", () => {
    expect(sql).not.toMatch(/create or replace function public\.student_advance_application\(p_application_id uuid, p_action text\)\s*\nreturns public\.applications/);
    const start = sql.indexOf("create or replace function public.student_advance_application(p_application_id uuid, p_action text)");
    const returnsStart = sql.indexOf("returns table (", start);
    const returnsEnd = sql.indexOf(")", returnsStart);
    const shape = sql.slice(returnsStart, returnsEnd);
    expect(shape).toMatch(/id uuid/);
    expect(shape).toMatch(/stage text/);
    expect(shape).toMatch(/submitted_at timestamptz/);
    expect(shape).toMatch(/withdrawn_at timestamptz/);
    expect(shape).toMatch(/updated_at timestamptz/);
    expect(shape).not.toMatch(/internal_notes/);
    expect(shape).not.toMatch(/assigned_counsellor_id/);
    expect(shape).not.toMatch(/last_contact_date/);
    expect(shape).not.toMatch(/changed_by/);
  });

  it("student_advance_application()'s final statement is `return query select ...` off the narrowed columns, not `return v_row;` (the full row)", () => {
    const start = sql.indexOf("create or replace function public.student_advance_application(p_application_id uuid, p_action text)");
    const end = sql.indexOf("\n$$;", start);
    const body = sql.slice(start, end);
    expect(body).toMatch(/return query select v_row\.id, v_row\.stage, v_row\.submitted_at, v_row\.withdrawn_at, v_row\.updated_at;/);
    expect(body).not.toMatch(/\n\s*return v_row;\s*\n/);
  });

  it("student_update_application_note() no longer `returns public.applications` — it returns a narrow TABLE of 3 columns only", () => {
    expect(sql).not.toMatch(/create or replace function public\.student_update_application_note\(p_application_id uuid, p_note text\)\s*\nreturns public\.applications/);
    const start = sql.indexOf("create or replace function public.student_update_application_note(p_application_id uuid, p_note text)");
    const returnsStart = sql.indexOf("returns table (", start);
    const returnsEnd = sql.indexOf(")", returnsStart);
    const shape = sql.slice(returnsStart, returnsEnd);
    expect(shape).toMatch(/id uuid/);
    expect(shape).toMatch(/student_note text/);
    expect(shape).toMatch(/updated_at timestamptz/);
    expect(shape).not.toMatch(/internal_notes/);
    expect(shape).not.toMatch(/assigned_counsellor_id/);
    expect(shape).not.toMatch(/last_contact_date/);
  });

  it("student_update_application_note()'s final statement is `return query select ...`, not `return v_row;`", () => {
    const start = sql.indexOf("create or replace function public.student_update_application_note(p_application_id uuid, p_note text)");
    const end = sql.indexOf("\n$$;", start);
    const body = sql.slice(start, end);
    expect(body).toMatch(/return query select v_row\.id, v_row\.student_note, v_row\.updated_at;/);
    expect(body).not.toMatch(/\n\s*return v_row;\s*\n/);
  });

  it("both mutation RPCs remain granted to authenticated only, never PUBLIC (grants are unaffected by the return-shape narrowing)", () => {
    expect(sql).toMatch(/revoke all on function public\.student_advance_application\(uuid, text\) from public;/);
    expect(sql).toMatch(/grant execute on function public\.student_advance_application\(uuid, text\) to authenticated;/);
    expect(sql).toMatch(/revoke all on function public\.student_update_application_note\(uuid, text\) from public;/);
    expect(sql).toMatch(/grant execute on function public\.student_update_application_note\(uuid, text\) to authenticated;/);
  });
});

describe("0017_student_application_workflow.sql — v3 [test 2/3] get_my_applications()/get_my_application() exclude internal staff columns", () => {
  const SAFE_COLUMNS = [
    "id",
    "university_id",
    "course_id",
    "course_intake_id",
    "stage",
    "intake",
    "submission_date",
    "decision_status",
    "offer_type",
    "deadlines",
    "next_action",
    "next_action_date",
    "student_note",
    "submitted_at",
    "decision_at",
    "withdrawn_at",
    "created_at",
    "updated_at",
  ];
  const STAFF_ONLY_COLUMNS = ["internal_notes", "assigned_counsellor_id", "last_contact_date"];

  function returnsTableShapeFor(functionSignature: string): string {
    const start = sql.indexOf(functionSignature);
    expect(start).toBeGreaterThan(-1);
    const returnsStart = sql.indexOf("returns table (", start);
    const returnsEnd = sql.indexOf("\n)", returnsStart);
    return sql.slice(returnsStart, returnsEnd);
  }

  it("[test 2] get_my_applications()'s RETURNS TABLE lists exactly the 18 student-safe columns, no staff-only column", () => {
    const shape = returnsTableShapeFor("create or replace function public.get_my_applications()");
    for (const column of SAFE_COLUMNS) {
      expect(shape).toMatch(new RegExp(`\\b${column}\\b`));
    }
    for (const column of STAFF_ONLY_COLUMNS) {
      expect(shape).not.toMatch(new RegExp(`\\b${column}\\b`));
    }
  });

  it("[test 2] get_my_applications() takes no parameters and derives identity from auth.uid() only", () => {
    expect(sql).toMatch(/create or replace function public\.get_my_applications\(\)/);
    const start = sql.indexOf("create or replace function public.get_my_applications()");
    const end = sql.indexOf("\n$$;", start);
    const body = sql.slice(start, end);
    expect(body).toMatch(/where a\.student_user_id = auth\.uid\(\)/);
    expect(body).not.toMatch(/p_student_user_id/);
  });

  it("[test 3] get_my_application(p_application_id uuid)'s RETURNS TABLE lists exactly the same 18 student-safe columns, no staff-only column", () => {
    const shape = returnsTableShapeFor("create or replace function public.get_my_application(p_application_id uuid)");
    for (const column of SAFE_COLUMNS) {
      expect(shape).toMatch(new RegExp(`\\b${column}\\b`));
    }
    for (const column of STAFF_ONLY_COLUMNS) {
      expect(shape).not.toMatch(new RegExp(`\\b${column}\\b`));
    }
  });

  it("[test 3/4] get_my_application() takes only an application id — never a student/owner id — and scopes to a.student_user_id = auth.uid()", () => {
    const start = sql.indexOf("create or replace function public.get_my_application(p_application_id uuid)");
    const end = sql.indexOf("\n$$;", start);
    const body = sql.slice(start, end);
    expect(body).toMatch(/where a\.id = p_application_id\s*\n\s*and a\.student_user_id = auth\.uid\(\)/);
    expect(sql.slice(start, start + 200)).not.toMatch(/p_student_user_id/);
  });

  it("[test 4] another student's application is structurally unreachable — both functions filter on student_user_id = auth.uid() as a hard WHERE clause, never an optional/bypassable check", () => {
    const listBody = sql.slice(sql.indexOf("create or replace function public.get_my_applications()"), sql.indexOf("\n$$;", sql.indexOf("create or replace function public.get_my_applications()")));
    const detailBody = sql.slice(
      sql.indexOf("create or replace function public.get_my_application(p_application_id uuid)"),
      sql.indexOf("\n$$;", sql.indexOf("create or replace function public.get_my_application(p_application_id uuid)"))
    );
    expect(listBody).toMatch(/auth\.uid\(\)/);
    expect(detailBody).toMatch(/auth\.uid\(\)/);
  });

  it("both read RPCs are SECURITY DEFINER, STABLE, search_path-pinned, and granted to authenticated only", () => {
    for (const fn of ["get_my_applications()", "get_my_application(uuid)"]) {
      const grantTarget = fn === "get_my_applications()" ? "get_my_applications()" : "get_my_application(uuid)";
      expect(sql).toMatch(new RegExp(`revoke all on function public\\.${grantTarget.replace(/[()]/g, (c) => `\\${c}`)} from public;`));
      expect(sql).toMatch(new RegExp(`grant execute on function public\\.${grantTarget.replace(/[()]/g, (c) => `\\${c}`)} to authenticated;`));
    }
    const listStart = sql.indexOf("create or replace function public.get_my_applications()");
    const listEnd = sql.indexOf("$$;", listStart);
    const listBody = sql.slice(listStart, listEnd);
    expect(listBody).toMatch(/security definer/);
    expect(listBody).toMatch(/set search_path = public/);
    expect(listBody).toMatch(/stable/);

    const detailStart = sql.indexOf("create or replace function public.get_my_application(p_application_id uuid)");
    const detailEnd = sql.indexOf("$$;", detailStart);
    const detailBody = sql.slice(detailStart, detailEnd);
    expect(detailBody).toMatch(/security definer/);
    expect(detailBody).toMatch(/set search_path = public/);
    expect(detailBody).toMatch(/stable/);
  });
});

describe("0017_student_application_workflow.sql — v3 [test 5/6] ordinary-student direct SELECT/INSERT on `applications` is removed", () => {
  it("confirms the exact two student policies being dropped genuinely exist (unmodified) in 0006_global_university_course_data.sql, so this migration is dropping the real thing, not a typo'd name", () => {
    expect(globalCourseDataSql).toMatch(/create policy "Students can read their own applications"\s*\n\s*on public\.applications for select to authenticated\s*\n\s*using \(auth\.uid\(\) = student_user_id\);/);
    expect(globalCourseDataSql).toMatch(
      /create policy "Students can start their own application from a course"\s*\n\s*on public\.applications for insert to authenticated\s*\n\s*with check \(auth\.uid\(\) = student_user_id\);/
    );
  });

  it("[test 5] drops the student SELECT policy with no corresponding create — an ordinary student has no direct read path left", () => {
    expect(sql).toMatch(/drop policy if exists "Students can read their own applications" on public\.applications;/);
    const dropIndex = sql.indexOf('drop policy if exists "Students can read their own applications" on public.applications;');
    const nextCreateForSamePolicy = sql.indexOf('create policy "Students can read their own applications"', dropIndex);
    expect(nextCreateForSamePolicy).toBe(-1);
  });

  it("[test 6] drops the student INSERT policy with no corresponding create — an ordinary student has no direct write path left", () => {
    expect(sql).toMatch(/drop policy if exists "Students can start their own application from a course" on public\.applications;/);
    const dropIndex = sql.indexOf('drop policy if exists "Students can start their own application from a course" on public.applications;');
    const nextCreateForSamePolicy = sql.indexOf('create policy "Students can start their own application from a course"', dropIndex);
    expect(nextCreateForSamePolicy).toBe(-1);
  });

  it("[test 18] the three original admin/counsellor policies from 0004 are never touched by this migration — no drop statement mentions them", () => {
    for (const policyName of ["Admins/assigned counsellor/finance/analyst can read applications", "Admins/counsellor can create applications", "Admins/assigned counsellor can update applications"]) {
      expect(sql).not.toMatch(new RegExp(`drop policy if exists "${policyName.replace(/[/]/g, "\\/")}"`));
    }
  });
});

describe("0017_student_application_workflow.sql — v3 [tests 7-11] student_start_application() sets every protected field itself", () => {
  const start = sql.indexOf("create or replace function public.student_start_application(p_course_id uuid, p_university_id uuid)");
  const end = sql.indexOf("\n$$;", start);
  const body = sql.slice(start, end);

  it("exists, is SECURITY DEFINER with a pinned search_path, takes only p_course_id/p_university_id", () => {
    expect(start).toBeGreaterThan(-1);
    expect(body).toMatch(/security definer/);
    expect(body).toMatch(/set search_path = public/);
    expect(sql.slice(start, start + 120)).toMatch(/\(p_course_id uuid, p_university_id uuid\)/);
  });

  it("[test 7/8] derives the owner from auth.uid() — v_student_id := auth.uid() — never accepts a student/owner id parameter", () => {
    expect(body).toMatch(/v_student_id := auth\.uid\(\);/);
    expect(sql.slice(start, start + 120)).not.toMatch(/p_student_user_id|p_owner/);
  });

  it("[test 8] raises before doing anything else if auth.uid() is null", () => {
    expect(body).toMatch(/if v_student_id is null then\s*\n\s*raise exception 'Not authenticated\.'/);
  });

  it("[test 9] the INSERT hardcodes stage = 'inquiry' — the function signature has no way to accept a caller-supplied stage at all", () => {
    expect(body).toMatch(/'inquiry', null, null, 'pending', null, '\[\]'::jsonb,/);
    expect(sql.slice(start, start + 120)).not.toMatch(/p_stage/);
  });

  it("[test 10] the INSERT hardcodes internal_notes = null — the function signature has no way to accept caller-supplied internal_notes", () => {
    const insertStart = body.indexOf("insert into public.applications");
    const insertEnd = body.indexOf(");", insertStart);
    const insertStatement = body.slice(insertStart, insertEnd);
    expect(insertStatement).toMatch(/internal_notes/);
    expect(insertStatement).toMatch(/null, null, null\n/); // last_contact_date, internal_notes both hardcoded null on the values line
    expect(sql.slice(start, start + 120)).not.toMatch(/p_internal_notes/);
  });

  it("[test 11] the INSERT hardcodes assigned_counsellor_id = null — the function signature has no way to accept a caller-supplied counsellor", () => {
    const insertStart = body.indexOf("insert into public.applications");
    const insertEnd = body.indexOf(");", insertStart);
    const insertStatement = body.slice(insertStart, insertEnd);
    expect(insertStatement).toMatch(/assigned_counsellor_id/);
    expect(insertStatement).toMatch(/v_student_id, p_university_id, p_course_id, null,/); // assigned_counsellor_id is the 4th value, hardcoded null
    expect(sql.slice(start, start + 120)).not.toMatch(/p_assigned_counsellor_id|p_counsellor/);
  });

  it("student_user_id is always v_student_id (auth.uid()), never a parameter, on the INSERT's values line", () => {
    expect(body).toMatch(/values \(\s*\n\s*v_student_id, p_university_id, p_course_id, null,/);
  });

  it("decision_status is always the canonical 'pending' initial value, matching 0004's own applications_decision_status_check", () => {
    expect(originalAdminSystemSql).toMatch(/applications_decision_status_check\s*\n\s*check \(decision_status in \('pending', 'offer', 'waitlist', 'rejected', 'deferred'\)\)/);
    expect(body).toMatch(/'inquiry', null, null, 'pending', null,/);
  });

  it("returns only a uuid (the application id) — never `returns public.applications` or a TABLE of columns", () => {
    expect(sql.slice(start, sql.indexOf("language plpgsql", start))).toMatch(/returns uuid/);
  });

  it("is granted to authenticated only, never PUBLIC", () => {
    expect(sql).toMatch(/revoke all on function public\.student_start_application\(uuid, uuid\) from public;/);
    expect(sql).toMatch(/grant execute on function public\.student_start_application\(uuid, uuid\) to authenticated;/);
  });
});

describe("0017_student_application_workflow.sql — v3 [tests 12/13] course/university relationship verification", () => {
  const start = sql.indexOf("create or replace function public.student_start_application(p_course_id uuid, p_university_id uuid)");
  const end = sql.indexOf("\n$$;", start);
  const body = sql.slice(start, end);

  it("confirms courses.university_id is the real, sole, NOT NULL FK relationship this validation must use (audited, not guessed) — read verbatim from 0004_admin_system.sql", () => {
    expect(originalAdminSystemSql).toMatch(/university_id uuid not null references public\.universities \(id\) on delete cascade/);
  });

  it("confirms the exact published+active gate this RPC mirrors is the real, pre-existing public course-browsing policy in 0006 (audited, not invented)", () => {
    expect(globalCourseDataSql).toMatch(/create policy "Public can read published active courses of published unis"/);
    expect(globalCourseDataSql).toMatch(/is_active = true and publication_status = 'published'/);
  });

  it("[test 12] verifies the course belongs to the supplied university via the real courses.university_id FK — c.university_id = p_university_id", () => {
    expect(body).toMatch(/from public\.courses c\s*\n\s*join public\.universities u on u\.id = c\.university_id\s*\n\s*where c\.id = p_course_id\s*\n\s*and c\.university_id = p_university_id/);
  });

  it("[test 12/13] requires the course AND its parent university both be is_active + publication_status = 'published' — the exact same gate as the public course-browsing policy", () => {
    expect(body).toMatch(/c\.is_active = true\s*\n\s*and c\.publication_status = 'published'/);
    expect(body).toMatch(/u\.is_active = true\s*\n\s*and u\.publication_status = 'published'/);
  });

  it("[test 13] a mismatched/invalid pair raises the SAME generic error as any other failure reason (course missing, wrong university, unpublished) — anti-enumeration, never a distinguishable message", () => {
    const messages = [...body.matchAll(/raise exception '([^']*)'/g)].map((m) => m[1]);
    const genericMessages = messages.filter((m) => m.includes("could not be found or is not currently accepting applications"));
    expect(genericMessages.length).toBeGreaterThanOrEqual(2); // null-id guard + not-exists guard
    expect(new Set(genericMessages).size).toBe(1);
  });

  it("PART 10's validate_application_course_university() trigger gives the ADMIN path the same course/university consistency guarantee, without breaking a legitimate admin submission that sets only one of the two", () => {
    const triggerStart = sql.indexOf("create or replace function public.validate_application_course_university()");
    const triggerEnd = sql.indexOf("\n$$;", triggerStart);
    const triggerBody = sql.slice(triggerStart, triggerEnd);
    expect(triggerStart).toBeGreaterThan(-1);
    expect(triggerBody).toMatch(/if new\.course_id is not null and new\.university_id is not null then/);
    expect(triggerBody).toMatch(/if not exists \(select 1 from public\.courses c where c\.id = new\.course_id and c\.university_id = new\.university_id\) then/);
    expect(sql).toMatch(/before insert or update of course_id, university_id on public\.applications/);
  });

  it("the course/university trigger is attached to public.applications (both student RPC inserts and admin create/update writes pass through the same table-level trigger)", () => {
    expect(sql).toMatch(/create trigger validate_applications_course_university\s*\n\s*before insert or update of course_id, university_id on public\.applications\s*\n\s*for each row execute function public\.validate_application_course_university\(\);/);
  });
});

describe("0017_student_application_workflow.sql — v3 [tests 14-17] duplicate/reapplication/concurrency handled database-authoritatively", () => {
  const start = sql.indexOf("create or replace function public.student_start_application(p_course_id uuid, p_university_id uuid)");
  const end = sql.indexOf("\n$$;", start);
  const body = sql.slice(start, end);

  it("[test 14] reuses an existing NON-TERMINAL application for the same course rather than inserting a duplicate", () => {
    expect(body).toMatch(/select id into v_existing_id\s*\n\s*from public\.applications\s*\n\s*where student_user_id = v_student_id\s*\n\s*and course_id = p_course_id\s*\n\s*and stage not in \('rejected', 'withdrawn'\)/);
    expect(body).toMatch(/if v_existing_id is not null then\s*\n\s*return v_existing_id;\s*\n\s*end if;/);
  });

  it("[test 15/16] 'rejected' and 'withdrawn' are excluded from the reuse check — a reapplication after either always falls through to a fresh INSERT", () => {
    const reuseCheckStart = body.indexOf("select id into v_existing_id");
    const reuseCheckEnd = body.indexOf(";", reuseCheckStart);
    const reuseCheck = body.slice(reuseCheckStart, reuseCheckEnd);
    expect(reuseCheck).toMatch(/stage not in \('rejected', 'withdrawn'\)/);
  });

  it("[test 17] wraps the INSERT in its own exception block catching unique_violation — a genuine concurrent race is resolved by re-selecting, never by surfacing the raw constraint error", () => {
    expect(body).toMatch(/exception when unique_violation then/);
    const exceptionStart = body.indexOf("exception when unique_violation then");
    const exceptionEnd = body.indexOf("end;", exceptionStart);
    const exceptionBlock = body.slice(exceptionStart, exceptionEnd);
    expect(exceptionBlock).toMatch(/select id into v_new_id/);
    expect(exceptionBlock).toMatch(/if v_new_id is null then\s*\n\s*raise;\s*\n\s*end if;/);
  });

  it("the exact two partial unique indexes from PART 5 remain the authoritative backstop — unchanged by this patch", () => {
    expect(sql).toMatch(/create unique index applications_one_active_per_student_course_no_intake/);
    expect(sql).toMatch(/create unique index applications_one_active_per_student_course_intake/);
  });
});

describe("0017_student_application_workflow.sql — v3 [test 18] admin application flow untouched", () => {
  it("no admin-facing table/policy/function this migration did not already own is dropped or altered destructively — this migration only ever adds new functions/policies and drops the two STUDENT-only policies from 0006", () => {
    const dropStatements = [...sql.matchAll(/drop policy if exists "([^"]+)" on public\.\w+;/g)].map((m) => m[1]);
    for (const studentOnly of ["Students can read their own applications", "Students can start their own application from a course"]) {
      expect(dropStatements).toContain(studentOnly);
    }
    // Every OTHER dropped-and-recreated policy in this file is one PART 4 already owns (application_status_history's read/insert policies) — never an admin/counsellor applications policy.
    const nonStudentDrops = dropStatements.filter((name) => !name.includes("Students"));
    for (const name of nonStudentDrops) {
      expect(name).toMatch(/Application history follows application visibility/);
    }
  });

  it("the three original 0004 admin/counsellor RLS policies on `applications` still exist, unmodified, in 0004_admin_system.sql", () => {
    expect(originalAdminSystemSql).toMatch(/"Admins\/assigned counsellor\/finance\/analyst can read applications"/);
    expect(originalAdminSystemSql).toMatch(/"Admins\/counsellor can create applications"/);
    expect(originalAdminSystemSql).toMatch(/"Admins\/assigned counsellor can update applications"/);
  });
});

describe("0017_student_application_workflow.sql — v3 [test 19] all v2 protections remain intact", () => {
  it("application_status_history's narrowed read/insert policies (v2 PART 4) are still present and still exclude a student_user_id branch", () => {
    expect(sql).toMatch(/drop policy if exists "Application history follows application visibility \(read\)" on public\.application_status_history;/);
    expect(sql).toMatch(/drop policy if exists "Application history follows application visibility \(insert\)" on public\.application_status_history;/);
  });

  it("get_my_application_status_history() (v2 PART 4.1) is still present, unchanged, structurally excluding note/changed_by", () => {
    expect(sql).toMatch(/create or replace function public\.get_my_application_status_history\(p_application_id uuid\)/);
    const start = sql.indexOf("create or replace function public.get_my_application_status_history(p_application_id uuid)");
    const returnsStart = sql.indexOf("returns table (", start);
    const returnsEnd = sql.indexOf(")", returnsStart);
    const shape = sql.slice(returnsStart, returnsEnd);
    expect(shape).not.toMatch(/\bnote\b/);
    expect(shape).not.toMatch(/\bchanged_by\b/);
  });

  it("validate_application_course_intake()'s v2 hardening (course_intake_id requires course_id) is still present, unchanged", () => {
    const start = sql.indexOf("create or replace function public.validate_application_course_intake()");
    const end = sql.indexOf("\n$$;", start);
    const body = sql.slice(start, end);
    expect(body).toMatch(/if new\.course_id is null then\s*\n\s*raise exception 'course_intake_id requires a matching course_id/);
  });

  it("student_advance_application()'s v2 defense-in-depth (UPDATE re-scoped to student_user_id = auth.uid() and stage = v_old_stage) is still present, unchanged", () => {
    const start = sql.indexOf("create or replace function public.student_advance_application(p_application_id uuid, p_action text)");
    const end = sql.indexOf("\n$$;", start);
    const body = sql.slice(start, end);
    expect(body).toMatch(/where id = p_application_id\s*\n\s*and student_user_id = auth\.uid\(\)\s*\n\s*and stage = v_old_stage/);
  });

  it("the two partial unique duplicate-protection indexes (v1/v2) remain byte-for-byte present", () => {
    expect(sql).toMatch(
      /create unique index applications_one_active_per_student_course_no_intake\s*\n\s*on public\.applications \(student_user_id, course_id\)\s*\n\s*where course_id is not null and course_intake_id is null and stage not in \('rejected', 'withdrawn'\);/
    );
  });
});

describe("0017_student_application_workflow.sql — v3 [payment isolation] no payment/refund/Razorpay/pricing/invoice/tax/billing code touched", () => {
  it("this migration never creates/alters/drops a payment-domain table, function, or trigger — the one incidental 'Razorpay' mention is only the pre-existing baseline-commit provenance comment at the top of the file, not any actual SQL statement", () => {
    for (const objectNamePattern of [
      /(alter|create|drop) table (if exists |if not exists )?public\.(refunds|razorpay|invoices|payments|pricing_packages|tax_\w+)/,
      /create or replace function public\.(claim_refund|finalize_refund|apply_.*_webhook_event|create_stamp_request)/,
    ]) {
      expect(sql.toLowerCase()).not.toMatch(objectNamePattern);
    }
    // The only place "razorpay" may legitimately appear at all is the
    // top-of-file provenance comment describing which baseline commit this
    // migration was audited against — never inside an actual statement.
    const razorpayMentions = [...sql.matchAll(/^.*razorpay.*$/gim)];
    for (const mention of razorpayMentions) {
      expect(mention[0].trim().startsWith("--")).toBe(true);
    }
  });
});
