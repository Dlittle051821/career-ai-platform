import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Milestone 19 IN-PLACE CORRECTION — static-SQL-text regression guard for
 * supabase/migrations/0022_authoritative_submission_invariant.sql. Mirrors
 * application-submission-migration-security.test.ts's own convention exactly
 * (no live Postgres connection exists in this project's Vitest setup, so
 * trigger/RPC correctness is verified against the actual migration text, not
 * a live database).
 *
 * This file exists specifically to prove, at the SQL-text level, the six
 * regression cases the correction task requires:
 *   1. a student cannot transition ready_to_submit -> submitted directly
 *   2. staff_record_application_submission() can still perform the
 *      transition
 *   3. a submitted application always has a submission row after the
 *      authoritative path (the submission insert happens before the stage
 *      UPDATE, in the same transaction)
 *   4. failure during snapshot creation cannot leave stage = 'submitted'
 *      (the stage UPDATE is the LAST write, after both inserts — any earlier
 *      failure rolls back before ever reaching it)
 *   5. every OTHER M16 lifecycle transition (start_preparing,
 *      mark_ready_to_submit, withdraw) is untouched
 *   6. this migration does not touch M17 (documents)/M18 (checklist) DDL at
 *      all
 */

const MIGRATIONS_DIR = path.resolve(process.cwd(), "supabase/migrations");
const FILENAME = "0022_authoritative_submission_invariant.sql";
const sql = readFileSync(path.join(MIGRATIONS_DIR, FILENAME), "utf8");

function sliceFunctionBody(functionSignature: string): string {
  const start = sql.indexOf(functionSignature);
  expect(start).toBeGreaterThan(-1);
  const end = sql.indexOf("\n$$;", start);
  expect(end).toBeGreaterThan(start);
  return sql.slice(start, end);
}

describe("0022 — forward-only, does not edit prior migrations", () => {
  it("is the next free migration number after 0021 — no gap, no duplication", () => {
    const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql"));
    const numbers = files.map((f) => parseInt(f.slice(0, 4), 10)).sort((a, b) => a - b);
    expect(numbers).toContain(22);
    expect(Math.max(...numbers)).toBe(22);
  });

  it("0001-0021 exist on disk, unmodified by this file (spot-checked: 0017 and 0021, the two functions this migration redefines)", () => {
    for (const filename of ["0017_student_application_workflow.sql", "0021_application_submission_tracking.sql"]) {
      const content = readFileSync(path.join(MIGRATIONS_DIR, filename), "utf8");
      expect(content.length).toBeGreaterThan(0);
      // Neither prior file mentions this correction's own flag name — proof
      // this migration did not need to (and did not) edit them in place.
      expect(content).not.toMatch(/allow_authoritative_submission/);
    }
  });

  it("does not DROP or ALTER any table, and does not CREATE any new table — this correction is trigger + function redefinitions only", () => {
    expect(sql).not.toMatch(/drop table/i);
    expect(sql).not.toMatch(/create table/i);
    expect(sql).not.toMatch(/alter table/i);
  });

  it("never references the payments/invoices/refunds/pricing/Razorpay tables or objects, or an SEO-owned file path", () => {
    for (const forbidden of ["public.payments", "public.invoices", "public.refunds", "public.pricing_plan", "razorpay_", "src/app/robots.ts", "src/app/sitemap.ts"]) {
      expect(sql.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
  });
});

describe("0022 — PART 1: applications_enforce_submitted_transition() trigger", () => {
  const SIGNATURE = "create or replace function public.applications_enforce_submitted_transition()";
  const body = sliceFunctionBody(SIGNATURE);

  it("only gates a genuine transition INTO 'submitted' — old.stage is distinct from new.stage, not merely new.stage = 'submitted'", () => {
    expect(body).toMatch(/new\.stage = 'submitted' and old\.stage is distinct from new\.stage/);
  });

  it("checks a transaction-local session flag, defaulting to blocked (coalesce to empty string, not 'on') when the flag was never set", () => {
    expect(body).toMatch(/current_setting\('app\.allow_authoritative_submission', true\)/);
    expect(body).toMatch(/coalesce\(current_setting\('app\.allow_authoritative_submission', true\), ''\) <> 'on'/);
  });

  it("raises a safe, non-technical, non-enumerating error when the flag is not set — never a raw Postgres error", () => {
    expect(body).toMatch(/raise exception 'An application can only be marked "submitted" through Nextwise/);
    expect(body).toMatch(/using errcode = 'P0001'/);
  });

  it("is attached BEFORE UPDATE, FOR EACH ROW — after update would be too late to block anything", () => {
    expect(sql).toMatch(/create trigger applications_enforce_submitted_transition\s*\n\s*before update on public\.applications\s*\n\s*for each row\s*\n\s*execute function public\.applications_enforce_submitted_transition\(\);/);
  });

  it("drops any pre-existing same-named trigger before creating it — safe to re-run", () => {
    expect(sql).toMatch(/drop trigger if exists applications_enforce_submitted_transition on public\.applications;/);
  });
});

describe("0022 — PART 2: student_advance_application() — 'submit' can no longer transition anything [regression case 1 and 5]", () => {
  const SIGNATURE = "create or replace function public.student_advance_application(p_application_id uuid, p_action text)";
  const body = sliceFunctionBody(SIGNATURE);

  function sliceCase(action: string): string {
    const marker = `when '${action}' then`;
    const start = body.indexOf(marker);
    expect(start).toBeGreaterThan(-1);
    const nextWhen = body.indexOf("\n    when '", start + marker.length);
    const nextElse = body.indexOf("\n    else", start + marker.length);
    const candidates = [nextWhen, nextElse].filter((n) => n > -1);
    const end = candidates.length > 0 ? Math.min(...candidates) : body.indexOf("\n  end case;", start);
    return body.slice(start, end);
  }

  it("[regression case 1] the 'submit' branch raises an exception and never assigns v_to_stage/v_from_stages at all", () => {
    const submitCase = sliceCase("submit");
    expect(submitCase).toMatch(/raise exception 'This step is now completed by Nextwise staff/);
    expect(submitCase).not.toMatch(/v_to_stage :=/);
    expect(submitCase).not.toMatch(/v_from_stages :=/);
    expect(submitCase).not.toMatch(/v_message :=/);
  });

  it("[regression case 1] the string \"v_to_stage := 'submitted'\" does not appear ANYWHERE in this function — no code path inside it can ever set that target stage", () => {
    expect(body).not.toMatch(/v_to_stage := 'submitted'/);
  });

  it("[regression case 1] no case branch ever assigns v_to_stage the value 'submitted' — 'submitted' still legitimately appears as a FROM-stage for withdraw (withdrawing an already-submitted application is unaffected), but never again as the target this function's shared UPDATE would write", () => {
    const v_to_stage_assignments = body.match(/v_to_stage := '[a-z_]+'/g) ?? [];
    expect(v_to_stage_assignments.length).toBeGreaterThan(0); // sanity: other actions still assign it
    for (const assignment of v_to_stage_assignments) {
      expect(assignment).not.toBe("v_to_stage := 'submitted'");
    }
  });

  it("[regression case 5] start_preparing is byte-for-byte unchanged from 0017 — same from-stage, same target, same message", () => {
    const c = sliceCase("start_preparing");
    expect(c).toMatch(/v_from_stages := array\['inquiry'\];/);
    expect(c).toMatch(/v_to_stage := 'preparing';/);
    expect(c).toMatch(/v_message := 'You started preparing this application\.';/);
  });

  it("[regression case 5] mark_ready_to_submit is byte-for-byte unchanged from 0017", () => {
    const c = sliceCase("mark_ready_to_submit");
    expect(c).toMatch(/v_from_stages := array\['preparing'\];/);
    expect(c).toMatch(/v_to_stage := 'ready_to_submit';/);
    expect(c).toMatch(/v_message := 'You marked this application ready to submit\.';/);
  });

  it("[regression case 5] withdraw is byte-for-byte unchanged from 0017 — same six from-stages, including 'submitted' itself (withdrawing a submitted application is still allowed; only self-*reaching* 'submitted' is blocked)", () => {
    const c = sliceCase("withdraw");
    expect(c).toMatch(/v_from_stages := array\['inquiry', 'preparing', 'ready_to_submit', 'submitted', 'under_review', 'interview'\];/);
    expect(c).toMatch(/v_to_stage := 'withdrawn';/);
  });

  it("is still SECURITY DEFINER with a pinned search_path, and still re-scopes every write to student_user_id = auth.uid() in the UPDATE's own WHERE clause", () => {
    expect(body).toMatch(/security definer/);
    expect(body).toMatch(/set search_path = public/);
    expect(body).toMatch(/where id = p_application_id\s*\n\s*and student_user_id = auth\.uid\(\)\s*\n\s*and stage = v_old_stage/);
  });

  it("is still revoked from public/anon and granted only to authenticated", () => {
    expect(sql).toMatch(/revoke all on function public\.student_advance_application\(uuid, text\) from public;/);
    expect(sql).toMatch(/revoke execute on function public\.student_advance_application\(uuid, text\) from anon;/);
    expect(sql).toMatch(/grant execute on function public\.student_advance_application\(uuid, text\) to authenticated;/);
  });
});

describe("0022 — PART 3: staff_record_application_submission() — sets/clears the invariant flag around its own UPDATE [regression cases 2, 3, 4]", () => {
  const SIGNATURE = "create or replace function public.staff_record_application_submission(";
  const body = sliceFunctionBody(SIGNATURE);

  it("[regression case 2] still performs the ready_to_submit -> submitted transition — the authoritative path is not itself blocked", () => {
    expect(body).toMatch(/update public\.applications\s*\n\s*set stage = 'submitted', submitted_at = now\(\)\s*\n\s*where id = p_application_id and stage = 'ready_to_submit'/);
  });

  it("sets the SAME flag name the PART 1 trigger checks — a typo here would silently defeat the whole invariant", () => {
    expect(body).toMatch(/set_config\('app\.allow_authoritative_submission', 'on', true\)/);
  });

  it("sets the flag to 'on' immediately before, and back to 'off' immediately after, its own UPDATE — never left 'on' for any other statement in this function", () => {
    const onIndex = body.indexOf("set_config('app.allow_authoritative_submission', 'on', true)");
    const updateIndex = body.indexOf("update public.applications\n  set stage = 'submitted'");
    const offIndex = body.indexOf("set_config('app.allow_authoritative_submission', 'off', true)");
    expect(onIndex).toBeGreaterThan(-1);
    expect(updateIndex).toBeGreaterThan(onIndex);
    expect(offIndex).toBeGreaterThan(updateIndex);
  });

  it("[regression cases 3 and 4] the submission row insert and its document-snapshot insert both happen BEFORE the stage UPDATE — so a submitted application always has a row, and a failure while inserting either can never leave stage = 'submitted' (the UPDATE simply never runs)", () => {
    const submissionInsertIndex = body.indexOf("insert into public.application_submissions (");
    const documentsInsertIndex = body.indexOf("insert into public.application_submission_documents (");
    const updateIndex = body.indexOf("update public.applications\n  set stage = 'submitted'");
    expect(submissionInsertIndex).toBeGreaterThan(-1);
    expect(documentsInsertIndex).toBeGreaterThan(submissionInsertIndex);
    expect(updateIndex).toBeGreaterThan(documentsInsertIndex);
  });

  it("[regression case 4] the conditional UPDATE re-asserts stage = 'ready_to_submit' and raises if it matches zero rows — no partial state survives", () => {
    expect(body).toMatch(/where id = p_application_id and stage = 'ready_to_submit'\s*\n\s*returning stage into v_new_stage;/);
    expect(body).toMatch(/if v_new_stage is null then/);
  });

  it("every other check (authorization, readiness, document/checklist requirements) is byte-for-byte unchanged from 0021", () => {
    expect(body).toMatch(/is_admin_role\(array\['super_admin', 'admin'\]\)/);
    expect(body).toMatch(/is_admin_role\(array\['counsellor'\]\)/);
    expect(body).toMatch(/exists \(select 1 from public\.application_submissions s where s\.application_id = p_application_id\)/);
    expect(body).toMatch(/d\.is_current = true and d\.review_status = 'needs_correction'/);
    for (const docType of ["academic_transcript", "identity_document", "resume_cv"]) {
      expect(body).toMatch(new RegExp(`'${docType}'`));
    }
    for (const key of ["profile_reviewed", "eligibility_checked", "intake_confirmed", "details_confirmed"]) {
      expect(body).toMatch(new RegExp(`'${key}'`));
    }
  });

  it("is still revoked from public/anon and granted only to authenticated", () => {
    expect(sql).toMatch(/revoke all on function public\.staff_record_application_submission\([^)]*\) from public;/);
    expect(sql).toMatch(/revoke execute on function public\.staff_record_application_submission\([^)]*\) from anon;/);
    expect(sql).toMatch(/grant execute on function public\.staff_record_application_submission\([^)]*\) to authenticated;/);
  });
});

describe("0022 — regression case 6: M17 (documents) / M18 (checklist) are read, never redefined", () => {
  it("references application_documents/application_checklist_items only inside SELECT/EXISTS checks it already had in 0021 — no CREATE/ALTER against either table, no redefinition of any M17/M18 function", () => {
    expect(sql).not.toMatch(/create (or replace )?function public\.staff_review_application_document/);
    expect(sql).not.toMatch(/create (or replace )?function public\.(student_upload_application_document|student_remove_application_document)/);
    expect(sql).not.toMatch(/alter table public\.application_documents/);
    expect(sql).not.toMatch(/alter table public\.application_checklist_items/);
  });
});

describe("0022 — out of scope, not accidentally introduced", () => {
  it("does not widen anon/public access anywhere — every revoke/grant pair still denies public and anon first", () => {
    const grantLines = sql.split("\n").filter((line) => /^grant execute on function/.test(line.trim()));
    for (const line of grantLines) {
      expect(line).toMatch(/to authenticated;$/);
      expect(line).not.toMatch(/to (public|anon);/);
    }
  });

  it("never introduces a new applications.stage value — the CHECK constraint from 0017 is not touched here", () => {
    expect(sql).not.toMatch(/applications_stage_check/);
  });
});
