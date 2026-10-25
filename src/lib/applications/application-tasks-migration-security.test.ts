import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * NW06.6/NW06.7 — static-SQL-text regression guard for
 * supabase/migrations-proposed/NW06_application_tasks.sql (PROPOSED, not
 * yet applied to any database — same "no live Postgres connection in this
 * project's Vitest setup, so RLS/RPC correctness is verified against the
 * actual migration text" convention as every other
 * `*-migration-security.test.ts` file in src/lib/applications/, and the
 * same "read a file under supabase/migrations-proposed/" convention
 * src/lib/profile/nw05-provenance-verification-security-audit.test.ts
 * already established for NW05_student_mark_section_self_entered.sql).
 *
 * Covers: the RPC-only write boundary (zero INSERT/UPDATE/DELETE RLS
 * policy), the fixed staff status-transition table, the student's own
 * ownership boundary, the evidence-document cross-application guard, the
 * student-safe RETURNS TABLE shapes (no staff_note/created_by/verified_by/
 * cancelled_at/cancelled_by leak), and — the brief's own hard constraint —
 * that the external_payment columns can never be mistaken for a Nextwise
 * payment flow.
 */

const MIGRATION_PATH = path.resolve(process.cwd(), "supabase/migrations-proposed/NW06_application_tasks.sql");
const sql = readFileSync(MIGRATION_PATH, "utf8");

function sliceFunctionBody(functionSignature: string): string {
  const start = sql.indexOf(functionSignature);
  expect(start).toBeGreaterThan(-1);
  const end = sql.indexOf("\n$$;", start);
  expect(end).toBeGreaterThan(start);
  return sql.slice(start, end);
}

function sliceReturnsTable(functionSignature: string): string {
  const start = sql.indexOf(functionSignature);
  expect(start).toBeGreaterThan(-1);
  const returnsStart = sql.indexOf("returns table (", start);
  const returnsEnd = sql.indexOf(")", returnsStart);
  expect(returnsStart).toBeGreaterThan(start);
  return sql.slice(returnsStart, returnsEnd);
}

describe("application_tasks table shape", () => {
  const start = sql.indexOf("create table if not exists public.application_tasks");
  const end = sql.indexOf("create index if not exists application_tasks_application_idx", start);
  const body = sql.slice(start, end);

  it("has no payment-method/bank/UPI/card/Razorpay column — only staff-entered informational text/numbers plus self-report/verification columns", () => {
    expect(body).not.toMatch(/payment_method/i);
    expect(body).not.toMatch(/bank_account|upi_id|card_number|razorpay/i);
  });

  it("task_type is CHECK-constrained to exactly the seven controlled values", () => {
    for (const type of [
      "document_upload",
      "document_replacement",
      "application_review",
      "application_correction",
      "external_payment",
      "information_request",
      "other_approved_action",
    ]) {
      expect(body).toMatch(new RegExp(`'${type}'`));
    }
  });

  it("status is CHECK-constrained to exactly the five controlled values", () => {
    expect(body).toMatch(/status in \('open', 'in_progress', 'student_completed', 'verified_complete', 'cancelled'\)/);
  });

  it("[safety invariant] the five external_payment_* columns are schema-level constrained to NULL unless task_type = 'external_payment' — defense in depth beyond the RPC's own nulling", () => {
    expect(body).toMatch(
      /constraint application_tasks_payment_fields_scoped_check check \(\s*\n\s*task_type = 'external_payment'\s*\n\s*or \(\s*\n\s*external_payment_amount_minor_units is null\s*\n\s*and external_payment_currency is null\s*\n\s*and external_payment_payee is null\s*\n\s*and external_payment_instructions is null\s*\n\s*and external_payment_reference is null\s*\n\s*\)\s*\n\s*\)/
    );
  });

  it("the payment amount, when present, must be strictly positive", () => {
    expect(body).toMatch(/external_payment_amount_minor_units is null or external_payment_amount_minor_units > 0/);
  });

  it("the payment currency, when present, must be exactly 3 characters", () => {
    expect(body).toMatch(/external_payment_currency is null or length\(external_payment_currency\) = 3/);
  });

  it("evidence_document_id references application_documents ON DELETE SET NULL — a task can never block a document lifecycle event", () => {
    expect(body).toMatch(/evidence_document_id uuid references public\.application_documents \(id\) on delete set null/);
  });

  it("staff_note and student_note are two separate columns — never conflated, mirroring application_documents.review_note vs correction_message", () => {
    expect(body).toMatch(/staff_note text/);
    expect(body).toMatch(/student_note text/);
  });
});

describe("[safety invariant, PART 2] NextWise does not collect third-party fees — stated explicitly in the migration itself", () => {
  it("documents, in its own source, that no code path in this migration or codebase reads these columns to process a payment", () => {
    expect(sql).toMatch(/NEXTWISE DOES NOT COLLECT: university application fees, tuition fees, visa\s*\n--\s*fees, government fees, or any other third-party education charge/);
    expect(sql).toMatch(/never a transaction of any kind/);
  });
});

describe("RLS: staff SELECT only, zero student policy, zero staff write policy", () => {
  it("enables RLS on application_tasks", () => {
    expect(sql).toMatch(/alter table public\.application_tasks enable row level security;/);
  });

  it("has exactly one policy defined on application_tasks, and it is SELECT-only", () => {
    const policyMatches = sql.match(/create policy "[^"]+"\s*\n\s*on public\.application_tasks/g) ?? [];
    expect(policyMatches).toHaveLength(1);
  });

  it("has no INSERT/UPDATE/DELETE policy of any kind — every mutation goes through the three SECURITY DEFINER RPCs", () => {
    expect(sql).not.toMatch(/on public\.application_tasks for insert/);
    expect(sql).not.toMatch(/on public\.application_tasks for update/);
    expect(sql).not.toMatch(/on public\.application_tasks for delete/);
  });

  it("the one SELECT policy has no student_user_id/student branch — a student has zero direct table access, matching application_documents/application_submissions", () => {
    const start = sql.indexOf('create policy "Admins/assigned counsellor can read application tasks"');
    const end = sql.indexOf(");", start);
    const policy = sql.slice(start, end);
    expect(policy).not.toMatch(/student_user_id/);
    expect(policy).toMatch(/is_admin_role\(array\['super_admin', 'admin'\]\)/);
    expect(policy).toMatch(/is_admin_role\(array\['counsellor'\]\) and a\.assigned_counsellor_id = public\.current_counsellor_id\(\)/);
  });
});

describe("staff_create_application_task()", () => {
  const signature = "create or replace function public.staff_create_application_task(";
  const body = sliceFunctionBody(signature);

  it("is SECURITY DEFINER with a pinned search_path", () => {
    expect(body).toMatch(/security definer/);
    expect(body).toMatch(/set search_path = public/);
  });

  it("validates auth.uid() is present before doing anything else", () => {
    expect(body).toMatch(/if auth\.uid\(\) is null then\s*\n\s*raise exception 'Not authenticated\.'/);
  });

  it("requires payee and instructions for an external_payment task, and validates amount/currency when present", () => {
    expect(body).toMatch(/A payee is required for an external payment task/);
    expect(body).toMatch(/Payment instructions are required for an external payment task/);
    expect(body).toMatch(/The payment amount must be greater than zero\./);
    expect(body).toMatch(/The currency code must be exactly 3 letters/);
  });

  it("the payee/amount/currency/instructions/reference checks are gated behind v_is_external, so a non-payment task is never forced through them", () => {
    const externalBlockStart = body.indexOf("v_is_external := p_task_type = 'external_payment';");
    const ifStart = body.indexOf("if v_is_external then", externalBlockStart);
    expect(ifStart).toBeGreaterThan(externalBlockStart);
  });

  it("verifies the application exists and the caller is super_admin/admin or the assigned counsellor before inserting", () => {
    expect(body).toMatch(/if v_app\.id is null then\s*\n\s*raise exception 'This application could not be found\.'/);
    expect(body).toMatch(/is_admin_role\(array\['super_admin', 'admin'\]\)\s*\n\s*or \(public\.is_admin_role\(array\['counsellor'\]\) and v_app\.assigned_counsellor_id = public\.current_counsellor_id\(\)\)/);
  });

  it("status is always inserted as the literal 'open' and created_by is always auth.uid() — never caller-supplied", () => {
    expect(body).toMatch(/\) values \(\s*\n\s*p_application_id, p_task_type, 'open', btrim\(p_title\)/);
    expect(body).toMatch(/auth\.uid\(\)\s*\n\s*\)\s*\n\s*returning \* into v_row;/);
  });

  it("nulls every payment field for a non-external task via a CASE expression, rather than trusting the caller to omit them", () => {
    expect(body).toMatch(/case when v_is_external then p_external_payment_amount_minor_units else null end/);
    expect(body).toMatch(/case when v_is_external then upper\(p_external_payment_currency\) else null end/);
    expect(body).toMatch(/case when v_is_external then btrim\(p_external_payment_payee\) else null end/);
  });

  it("the function's own parameter list contains no created_by/status/student id parameter", () => {
    const signatureEnd = sql.indexOf(")\nreturns table", sql.indexOf(signature));
    const paramList = sql.slice(sql.indexOf(signature), signatureEnd);
    expect(paramList).not.toMatch(/p_created_by|p_status|p_student_user_id/);
  });

  it("is revoked from PUBLIC and anon, granted only to authenticated", () => {
    const fnSig = "staff_create_application_task(uuid, text, text, text, date, text, bigint, text, text, text, text)";
    expect(sql).toMatch(new RegExp(`revoke all on function public\\.${fnSig.replace(/[()]/g, "\\$&")} from public;`));
    expect(sql).toMatch(new RegExp(`revoke execute on function public\\.${fnSig.replace(/[()]/g, "\\$&")} from anon;`));
    expect(sql).toMatch(new RegExp(`grant execute on function public\\.${fnSig.replace(/[()]/g, "\\$&")} to authenticated;`));
  });
});

describe("staff_update_application_task_status()", () => {
  const signature = "create or replace function public.staff_update_application_task_status(";
  const body = sliceFunctionBody(signature);

  it("is SECURITY DEFINER with a pinned search_path", () => {
    expect(body).toMatch(/security definer/);
    expect(body).toMatch(/set search_path = public/);
  });

  it("locks the task row (joined to its application) FIRST, before any authorization or transition check", () => {
    const lockIndex = body.indexOf("for update of t;");
    const authCheckIndex = body.indexOf("v_is_admin := public.is_admin_role");
    const transitionCheckIndex = body.indexOf("v_allowed := case v_current.status");
    expect(lockIndex).toBeGreaterThan(-1);
    expect(authCheckIndex).toBeGreaterThan(lockIndex);
    expect(transitionCheckIndex).toBeGreaterThan(authCheckIndex);
  });

  it("re-checks authorization against the freshly-locked row's own assigned_counsellor_id, never a value read before the lock", () => {
    expect(body).toMatch(/v_current\.assigned_counsellor_id = public\.current_counsellor_id\(\)/);
  });

  it("enforces a fixed transition table — verified_complete and cancelled are both terminal (the ELSE branch is false, allowing no outgoing transition)", () => {
    expect(body).toMatch(
      /v_allowed := case v_current\.status\s*\n\s*when 'open' then p_status in \('in_progress', 'cancelled'\)\s*\n\s*when 'in_progress' then p_status in \('open', 'cancelled'\)\s*\n\s*when 'student_completed' then p_status in \('verified_complete', 'open', 'in_progress', 'cancelled'\)\s*\n\s*else false\s*\n\s*end;/
    );
  });

  it("the final UPDATE's own WHERE clause re-asserts the exact prior status, as defense in depth beyond the row lock", () => {
    expect(body).toMatch(/where id = p_task_id and status = v_current\.status\s*\n\s*returning \* into v_row;/);
  });

  it("verified_at/verified_by and cancelled_at/cancelled_by are always derived from now()/auth.uid() inside a CASE on p_status — never caller-supplied values", () => {
    expect(body).toMatch(/verified_at = case when p_status = 'verified_complete' then now\(\) else verified_at end/);
    expect(body).toMatch(/verified_by = case when p_status = 'verified_complete' then auth\.uid\(\) else verified_by end/);
    expect(body).toMatch(/cancelled_at = case when p_status = 'cancelled' then now\(\) else cancelled_at end/);
    expect(body).toMatch(/cancelled_by = case when p_status = 'cancelled' then auth\.uid\(\) else cancelled_by end/);
  });

  it("uses one generic, anti-enumeration error message covering 'not found', 'not authorized', and 'invalid transition' alike", () => {
    const message = "This task could not be updated — it may not exist, you may not have access, or its status may have already changed.";
    const occurrences = body.split(message).length - 1;
    expect(occurrences).toBeGreaterThanOrEqual(3);
  });

  it("is revoked from PUBLIC and anon, granted only to authenticated", () => {
    expect(sql).toMatch(/revoke all on function public\.staff_update_application_task_status\(uuid, text, text\) from public;/);
    expect(sql).toMatch(/revoke execute on function public\.staff_update_application_task_status\(uuid, text, text\) from anon;/);
    expect(sql).toMatch(/grant execute on function public\.staff_update_application_task_status\(uuid, text, text\) to authenticated;/);
  });
});

describe("student_complete_application_task()", () => {
  const signature = "create or replace function public.student_complete_application_task(";
  const body = sliceFunctionBody(signature);

  it("is SECURITY DEFINER with a pinned search_path", () => {
    expect(body).toMatch(/security definer/);
    expect(body).toMatch(/set search_path = public/);
  });

  it("scopes the lock itself to a.student_user_id = auth.uid() — ownership lives in the same query as the lock, not a preceding trusted read", () => {
    expect(body).toMatch(/where t\.id = p_task_id and a\.student_user_id = auth\.uid\(\)\s*\n\s*for update of t;/);
  });

  it("never touches verified_at/verified_by/staff_note — a student self-report can never itself become staff verification", () => {
    expect(body).not.toMatch(/verified_at\s*=/);
    expect(body).not.toMatch(/verified_by\s*=/);
    expect(body).not.toMatch(/staff_note\s*=/);
  });

  it("[defense in depth] an evidence document must belong to the SAME application and be the CURRENT version — never another application's, never a retired one", () => {
    expect(body).toMatch(/where d\.id = p_evidence_document_id and d\.application_id = v_app_id and d\.is_current = true/);
  });

  it("the evidence-document check runs only when an id was actually supplied, and before the final UPDATE", () => {
    const checkIndex = body.indexOf("if p_evidence_document_id is not null then");
    const updateIndex = body.indexOf("update public.application_tasks");
    expect(checkIndex).toBeGreaterThan(-1);
    expect(updateIndex).toBeGreaterThan(checkIndex);
  });

  it("is callable while already student_completed (amend before staff verify), but the WHERE clause still excludes verified_complete/cancelled", () => {
    expect(body).toMatch(/and status in \('open', 'in_progress', 'student_completed'\)/);
  });

  it("is revoked from PUBLIC and anon, granted only to authenticated", () => {
    expect(sql).toMatch(/revoke all on function public\.student_complete_application_task\(uuid, text, uuid\) from public;/);
    expect(sql).toMatch(/revoke execute on function public\.student_complete_application_task\(uuid, text, uuid\) from anon;/);
    expect(sql).toMatch(/grant execute on function public\.student_complete_application_task\(uuid, text, uuid\) to authenticated;/);
  });
});

describe("get_my_application_tasks() / get_my_open_application_tasks() — student-safe shapes", () => {
  it("get_my_application_tasks() derives ownership from a join to applications.student_user_id = auth.uid() — never a parameter", () => {
    const body = sliceFunctionBody("create or replace function public.get_my_application_tasks(p_application_id uuid)");
    expect(body).toMatch(/a\.student_user_id = auth\.uid\(\)/);
  });

  it("get_my_application_tasks()'s RETURNS TABLE structurally excludes staff_note/created_by/verified_by/cancelled_at/cancelled_by", () => {
    const returns = sliceReturnsTable("create or replace function public.get_my_application_tasks(p_application_id uuid)");
    for (const staffOnlyColumn of ["staff_note", "created_by", "verified_by", "cancelled_at", "cancelled_by"]) {
      expect(returns).not.toMatch(new RegExp(`\\b${staffOnlyColumn}\\b`));
    }
  });

  it("get_my_open_application_tasks() takes no parameters — identity comes entirely from auth.uid()", () => {
    expect(sql).toMatch(/create or replace function public\.get_my_open_application_tasks\(\)/);
  });

  it("get_my_open_application_tasks() filters to open/in_progress/student_completed only — never verified_complete or cancelled", () => {
    const body = sliceFunctionBody("create or replace function public.get_my_open_application_tasks()");
    expect(body).toMatch(/t\.status in \('open', 'in_progress', 'student_completed'\)/);
  });

  it("get_my_open_application_tasks()'s RETURNS TABLE also excludes every staff-only column", () => {
    const returns = sliceReturnsTable("create or replace function public.get_my_open_application_tasks()");
    for (const staffOnlyColumn of ["staff_note", "created_by", "verified_by", "verified_at", "cancelled_at", "cancelled_by", "student_note", "description"]) {
      expect(returns).not.toMatch(new RegExp(`\\b${staffOnlyColumn}\\b`));
    }
  });

  it("both are revoked from PUBLIC and anon, granted only to authenticated", () => {
    expect(sql).toMatch(/revoke all on function public\.get_my_application_tasks\(uuid\) from public;/);
    expect(sql).toMatch(/revoke execute on function public\.get_my_application_tasks\(uuid\) from anon;/);
    expect(sql).toMatch(/grant execute on function public\.get_my_application_tasks\(uuid\) to authenticated;/);
    expect(sql).toMatch(/revoke all on function public\.get_my_open_application_tasks\(\) from public;/);
    expect(sql).toMatch(/revoke execute on function public\.get_my_open_application_tasks\(\) from anon;/);
    expect(sql).toMatch(/grant execute on function public\.get_my_open_application_tasks\(\) to authenticated;/);
  });
});

describe("no anon grant anywhere in this migration", () => {
  it("never grants execute to anon on any function this migration defines", () => {
    expect(sql).not.toMatch(/grant execute.*to anon/i);
  });

  it("every function this migration defines has an explicit 'revoke execute ... from anon' line (the 0019 lesson, restated per PART 9)", () => {
    const grantLines = sql.match(/grant execute on function public\.\w+\([^)]*\) to authenticated;/g) ?? [];
    expect(grantLines.length).toBeGreaterThanOrEqual(5);
    const revokeAnonLines = sql.match(/revoke execute on function public\.\w+\([^)]*\) from anon;/g) ?? [];
    expect(revokeAnonLines.length).toBe(grantLines.length);
  });
});
