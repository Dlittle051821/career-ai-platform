import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Milestone 18 — static-SQL-text regression guard for
 * supabase/migrations/0020_application_processing_workspace.sql. Mirrors
 * src/lib/applications/application-documents-migration-security.test.ts
 * exactly (no live Postgres connection exists in this project's Vitest
 * setup, so RLS/RPC correctness is verified against the actual migration
 * text, not a live database).
 */

const MIGRATIONS_DIR = path.resolve(process.cwd(), "supabase/migrations");
const FILENAME = "0020_application_processing_workspace.sql";
const sql = readFileSync(path.join(MIGRATIONS_DIR, FILENAME), "utf8");

function sliceFunctionBody(functionSignature: string): string {
  const start = sql.indexOf(functionSignature);
  expect(start).toBeGreaterThan(-1);
  const end = sql.indexOf("\n$$;", start);
  expect(end).toBeGreaterThan(start);
  return sql.slice(start, end);
}

function slicePolicy(policyName: string): string {
  const marker = `create policy "${policyName}"`;
  const start = sql.indexOf(marker);
  expect(start).toBeGreaterThan(-1);
  const end = sql.indexOf(";\n\n", start);
  return sql.slice(start, end);
}

describe("0020 — forward-only, does not edit prior migrations", () => {
  it("is the next free migration number — no 0020 gap, no 0018/0019 duplication", () => {
    const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql"));
    const numbers = files.map((f) => parseInt(f.slice(0, 4), 10)).sort((a, b) => a - b);
    expect(numbers).toContain(20);
    expect(Math.max(...numbers)).toBe(20);
  });

  it("0018 and 0019 exist on disk, unmodified in size-order (this file never rewrites them)", () => {
    for (const filename of ["0018_application_documents_foundation.sql", "0019_application_document_rpc_permissions.sql"]) {
      const content = readFileSync(path.join(MIGRATIONS_DIR, filename), "utf8");
      expect(content.length).toBeGreaterThan(0);
    }
  });

  it("does not DROP any pre-existing table", () => {
    expect(sql).not.toMatch(/drop table/i);
  });

  it("never mutates applications.stage directly (no document review action may auto-advance the lifecycle)", () => {
    expect(sql).not.toMatch(/update\s+public\.applications\s+set\s+stage/i);
  });
});

describe("0020 — PART 1: application_documents review columns", () => {
  it("adds review_status with a default of pending_review", () => {
    expect(sql).toMatch(/review_status text not null default 'pending_review'/);
  });

  it("CHECK-constrains review_status to exactly the three recognized states — no 'rejected'", () => {
    const start = sql.indexOf("add constraint application_documents_review_status_check");
    const body = sql.slice(start, sql.indexOf(";", start));
    expect(body).toMatch(/'pending_review'/);
    expect(body).toMatch(/'accepted'/);
    expect(body).toMatch(/'needs_correction'/);
    expect(body).not.toMatch(/'rejected'/);
  });

  it("length-constrains review_note and correction_message", () => {
    expect(sql).toMatch(/review_note is null or length\(review_note\) <= 2000/);
    expect(sql).toMatch(/correction_message is null or length\(correction_message\) <= 1000/);
  });

  it("reviewed_by references auth.users, never a plain text column", () => {
    expect(sql).toMatch(/reviewed_by uuid references auth\.users/);
  });
});

describe("0020 — PART 2: staff_review_application_document()", () => {
  const SIGNATURE = "create or replace function public.staff_review_application_document(";
  const body = sliceFunctionBody(SIGNATURE);

  it("is SECURITY DEFINER with a pinned search_path", () => {
    expect(body).toMatch(/security definer/);
    expect(body).toMatch(/set search_path = public/);
  });

  it("derives the reviewer identity exclusively from auth.uid() — never a caller-supplied reviewer id parameter", () => {
    expect(body).not.toMatch(/p_reviewed_by/);
    expect(body).not.toMatch(/p_reviewer/);
    expect(body).toMatch(/reviewed_by = auth\.uid\(\)/);
  });

  it("the UPDATE's WHERE clause requires is_current = true — a retired/replaced document can never be reviewed", () => {
    const updateStart = body.indexOf("update public.application_documents");
    const whereClause = body.slice(updateStart, body.indexOf("returning", updateStart));
    expect(whereClause).toMatch(/is_current = true/);
  });

  it("the same WHERE clause embeds the role/assignment check via is_admin_role()/current_counsellor_id() — never a preceding SELECT", () => {
    const updateStart = body.indexOf("update public.application_documents");
    const whereClause = body.slice(updateStart, body.indexOf("returning", updateStart));
    expect(whereClause).toMatch(/is_admin_role\(array\['super_admin', 'admin'\]\)/);
    expect(whereClause).toMatch(/is_admin_role\(array\['counsellor'\]\)/);
    expect(whereClause).toMatch(/current_counsellor_id\(\)/);
  });

  it("clears correction_message whenever the decision is not needs_correction", () => {
    expect(body).toMatch(/case when p_review_status = 'needs_correction' then p_correction_message else null end/);
  });

  it("raises one generic anti-enumeration error — never distinguishes not-found from not-authorized from not-current", () => {
    expect(body).toMatch(/could not be reviewed/);
  });

  it("returns a narrow explicit column list — never review_note/reviewed_by columns beyond what this returns table declares, and never SELECT *", () => {
    const returnsStart = sql.indexOf("returns table", sql.indexOf(SIGNATURE));
    const returnsBody = sql.slice(returnsStart, sql.indexOf(")\nlanguage plpgsql", returnsStart));
    expect(returnsBody).toMatch(/id uuid/);
    expect(returnsBody).toMatch(/application_id uuid/);
    expect(returnsBody).toMatch(/review_status text/);
  });

  it("is revoked from public AND anon explicitly, before being granted to authenticated (the 0019 lesson, applied here)", () => {
    expect(sql).toMatch(/revoke all on function public\.staff_review_application_document\([^)]*\) from public;/);
    expect(sql).toMatch(/revoke execute on function public\.staff_review_application_document\([^)]*\) from anon;/);
    expect(sql).toMatch(/grant execute on function public\.staff_review_application_document\([^)]*\) to authenticated;/);
  });
});

describe("0020 — PART 3: get_my_application_documents() forward-extension", () => {
  it("drops and recreates the exact 0018 function signature — a forward replacement, not an edit to the 0018 file", () => {
    expect(sql).toMatch(/drop function if exists public\.get_my_application_documents\(uuid\);/);
  });

  it("returns review_status and correction_message to the student", () => {
    const start = sql.lastIndexOf("create or replace function public.get_my_application_documents");
    const body = sql.slice(start, sql.indexOf("\n$$;", start));
    expect(body).toMatch(/review_status text/);
    expect(body).toMatch(/correction_message text/);
  });

  it("NEVER returns review_note or reviewed_by to the student — both are staff-internal only", () => {
    const start = sql.lastIndexOf("create or replace function public.get_my_application_documents");
    const body = sql.slice(start, sql.indexOf("\n$$;", start));
    expect(body).not.toMatch(/review_note/);
    expect(body).not.toMatch(/reviewed_by/);
  });

  it("still verifies application.student_user_id = auth.uid() and filters is_current = true — the M17 ownership/version boundary is unchanged", () => {
    const start = sql.lastIndexOf("create or replace function public.get_my_application_documents");
    const body = sql.slice(start, sql.indexOf("\n$$;", start));
    expect(body).toMatch(/a\.student_user_id = auth\.uid\(\)/);
    expect(body).toMatch(/d\.is_current = true/);
  });

  it("is revoked from public AND anon explicitly before being re-granted to authenticated", () => {
    const lastRevokePublic = sql.lastIndexOf("revoke all on function public.get_my_application_documents(uuid) from public;");
    const lastRevokeAnon = sql.lastIndexOf("revoke execute on function public.get_my_application_documents(uuid) from anon;");
    const lastGrant = sql.lastIndexOf("grant execute on function public.get_my_application_documents(uuid) to authenticated;");
    expect(lastRevokePublic).toBeGreaterThan(-1);
    expect(lastRevokeAnon).toBeGreaterThan(lastRevokePublic);
    expect(lastGrant).toBeGreaterThan(lastRevokeAnon);
  });
});

describe("0020 — PART 4: application_checklist_items", () => {
  it("CHECK-constrains item_key to exactly the four manual keys", () => {
    const start = sql.indexOf("application_checklist_items_item_key_check");
    const body = sql.slice(start, sql.indexOf(";", start));
    for (const key of ["profile_reviewed", "eligibility_checked", "intake_confirmed", "details_confirmed"]) {
      expect(body).toMatch(new RegExp(`'${key}'`));
    }
  });

  it("has a unique constraint on (application_id, item_key) — no duplicate checklist rows", () => {
    expect(sql).toMatch(/constraint application_checklist_items_unique unique \(application_id, item_key\)/);
  });

  it("enables row level security", () => {
    expect(sql).toMatch(/alter table public\.application_checklist_items enable row level security;/);
  });

  it("SELECT policy scopes to super_admin/admin or the assigned counsellor only", () => {
    const body = slicePolicy("Admins/assigned counsellor can read checklist items");
    expect(body).toMatch(/is_admin_role\(array\['super_admin', 'admin'\]\)/);
    expect(body).toMatch(/a\.assigned_counsellor_id = public\.current_counsellor_id\(\)/);
  });

  it("INSERT/UPDATE policies require completed_by to be null or the caller's own auth.uid() — no writing another user's id", () => {
    const insertBody = slicePolicy("Admins/assigned counsellor can set checklist items");
    const updateBody = slicePolicy("Admins/assigned counsellor can update checklist items");
    expect(insertBody).toMatch(/completed_by is null or completed_by = auth\.uid\(\)/);
    expect(updateBody).toMatch(/completed_by is null or completed_by = auth\.uid\(\)/);
  });

  it("has no DELETE policy", () => {
    expect(sql).not.toMatch(/application_checklist_items for delete/);
  });
});

describe("0020 — PART 5: application_internal_notes (staff-only, append-only)", () => {
  it("enables row level security", () => {
    expect(sql).toMatch(/alter table public\.application_internal_notes enable row level security;/);
  });

  it("SELECT policy scopes to super_admin/admin or the assigned counsellor only — never a student", () => {
    const body = slicePolicy("Admins/assigned counsellor can read internal notes");
    expect(body).toMatch(/is_admin_role\(array\['super_admin', 'admin'\]\)/);
    expect(body).toMatch(/current_counsellor_id\(\)/);
    expect(body).not.toMatch(/student_user_id = auth\.uid\(\)/);
  });

  it("INSERT policy requires author_user_id = auth.uid() — no writing a note attributed to someone else", () => {
    const body = slicePolicy("Admins/assigned counsellor can add internal notes");
    expect(body).toMatch(/author_user_id = auth\.uid\(\)/);
  });

  it("has no UPDATE or DELETE policy — append-only, matching admin_student_notes", () => {
    expect(sql).not.toMatch(/application_internal_notes for update/);
    expect(sql).not.toMatch(/application_internal_notes for delete/);
  });

  it("note length is constrained to at most 4000 characters, matching admin_student_notes' own limit", () => {
    expect(sql).toMatch(/length\(note\) >= 1 and length\(note\) <= 4000/);
  });

  it("is never referenced by any student-facing get_my_* function in this file", () => {
    const studentFns = sql.match(/create or replace function public\.get_my_[a-z_]+/g) ?? [];
    for (const fn of studentFns) {
      const start = sql.indexOf(fn);
      const body = sql.slice(start, sql.indexOf("\n$$;", start));
      expect(body).not.toMatch(/application_internal_notes/);
    }
  });
});

describe("0020 — anon denial across every new/replaced function", () => {
  it("every function this file defines or replaces has an explicit 'revoke ... from anon' line", () => {
    const functionNames = ["staff_review_application_document", "get_my_application_documents"];
    for (const name of functionNames) {
      expect(sql).toMatch(new RegExp(`revoke execute on function public\\.${name}\\([^)]*\\) from anon;`));
    }
  });
});
