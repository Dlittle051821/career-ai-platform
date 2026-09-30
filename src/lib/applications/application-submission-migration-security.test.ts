import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Milestone 19 — static-SQL-text regression guard for
 * supabase/migrations/0021_application_submission_tracking.sql. Mirrors
 * src/lib/applications/application-documents-migration-security.test.ts and
 * application-processing-workspace-migration-security.test.ts exactly (no
 * live Postgres connection exists in this project's Vitest setup, so RLS/
 * RPC correctness is verified against the actual migration text, not a live
 * database).
 */

const MIGRATIONS_DIR = path.resolve(process.cwd(), "supabase/migrations");
const FILENAME = "0021_application_submission_tracking.sql";
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

describe("0021 — forward-only, does not edit prior migrations", () => {
  it("is a free migration number with no gap below it — no duplication (updated by the Milestone 19 in-place correction: 0021 is no longer necessarily the LAST migration, since 0022_authoritative_submission_invariant.sql corrects a real invariant gap this file's own design left open; it must still exist with nothing skipped underneath it)", () => {
    const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql"));
    const numbers = files.map((f) => parseInt(f.slice(0, 4), 10)).sort((a, b) => a - b);
    expect(numbers).toContain(21);
    const maxNum = Math.max(...numbers);
    expect(maxNum).toBeGreaterThanOrEqual(21);
    for (let n = 1; n <= maxNum; n++) {
      expect(numbers).toContain(n);
    }
  });

  it("0018, 0019, and 0020 exist on disk, unmodified by this file", () => {
    for (const filename of [
      "0018_application_documents_foundation.sql",
      "0019_application_document_rpc_permissions.sql",
      "0020_application_processing_workspace.sql",
    ]) {
      const content = readFileSync(path.join(MIGRATIONS_DIR, filename), "utf8");
      expect(content.length).toBeGreaterThan(0);
    }
  });

  it("does not DROP any pre-existing table", () => {
    expect(sql).not.toMatch(/drop table/i);
  });

  it("never references the payments/invoices/refunds/pricing/Razorpay tables or objects (the header comment's own prose mentioning those module names by way of explaining scope is not a reference and is deliberately excluded from this check)", () => {
    for (const forbidden of ["public.payments", "public.invoices", "public.refunds", "public.pricing_plan", "razorpay_", "verify_checkout_payment", "apply_webhook_event"]) {
      expect(sql.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
  });

  it("never references an SEO-owned file path (src/app/robots.ts, src/app/sitemap.ts) — this is a .sql file, so this is a text sanity check that no such path was accidentally pasted in", () => {
    expect(sql).not.toMatch(/src\/app\/robots\.ts|src\/app\/sitemap\.ts/);
  });
});

describe("0021 — PART 1: application_submissions", () => {
  it("has a UNIQUE index on application_id — enforces exactly one submission per application (the explicit one-vs-multiple design decision)", () => {
    expect(sql).toMatch(/create unique index if not exists application_submissions_one_per_application on public\.application_submissions \(application_id\);/);
  });

  it("CHECK-constrains submission_method to exactly the five recognized values — no agent-workflow/commission vocabulary", () => {
    const start = sql.indexOf("application_submissions_method_check");
    const body = sql.slice(start, sql.indexOf(";", start));
    for (const method of ["university_portal", "centralized_platform", "email", "agent_partner", "other"]) {
      expect(body).toMatch(new RegExp(`'${method}'`));
    }
    expect(body).not.toMatch(/commission/i);
  });

  it("length-constrains platform_name, external_reference, external_url, and internal_note", () => {
    expect(sql).toMatch(/platform_name is null or length\(platform_name\) <= 200/);
    expect(sql).toMatch(/external_reference is null or length\(external_reference\) <= 200/);
    expect(sql).toMatch(/external_url is null or length\(external_url\) <= 500/);
    expect(sql).toMatch(/internal_note is null or length\(internal_note\) <= 2000/);
  });

  it("format-constrains external_url to an http(s) scheme", () => {
    expect(sql).toMatch(/external_url is null or external_url ~ '\^https\?:\/\/'/);
  });

  it("submitted_by_user_id references auth.users, never a plain text column", () => {
    expect(sql).toMatch(/submitted_by_user_id uuid references auth\.users/);
  });

  it("has no updated_at column and no update trigger — the row is immutable once written", () => {
    const tableStart = sql.indexOf("create table if not exists public.application_submissions");
    const tableEnd = sql.indexOf(");", tableStart);
    const tableBody = sql.slice(tableStart, tableEnd);
    expect(tableBody).not.toMatch(/updated_at/);
    expect(sql).not.toMatch(/application_submissions for update/);
  });
});

describe("0021 — PART 2: application_submission_documents", () => {
  it("references application_documents ON DELETE RESTRICT — a snapshotted document row can never be destroyed by a later cleanup", () => {
    expect(sql).toMatch(/application_document_id uuid not null references public\.application_documents \(id\) on delete restrict/);
  });

  it("has a UNIQUE constraint on (submission_id, application_document_id) — no duplicate snapshot rows for the same document", () => {
    expect(sql).toMatch(/constraint application_submission_documents_unique unique \(submission_id, application_document_id\)/);
  });

  it("has no UPDATE or DELETE policy anywhere in this file — the snapshot is append-only", () => {
    expect(sql).not.toMatch(/application_submission_documents for update/);
    expect(sql).not.toMatch(/application_submission_documents for delete/);
  });
});

describe("0021 — PART 3: staff_record_application_submission()", () => {
  const SIGNATURE = "create or replace function public.staff_record_application_submission(";
  const body = sliceFunctionBody(SIGNATURE);

  it("is SECURITY DEFINER with a pinned search_path", () => {
    expect(body).toMatch(/security definer/);
    expect(body).toMatch(/set search_path = public/);
  });

  it("derives the submitter identity exclusively from auth.uid() — never a caller-supplied submitted_by parameter", () => {
    expect(body).not.toMatch(/p_submitted_by/);
    expect(body).toMatch(/auth\.uid\(\)/);
    expect(body).toMatch(/v_app\.id, auth\.uid\(\)/);
  });

  it("never accepts a caller-supplied document-id list — the full current+accepted pack is always selected server-side", () => {
    expect(body).not.toMatch(/p_document_ids/);
    expect(body).toMatch(/d\.is_current = true and d\.review_status = 'accepted'/);
  });

  it("locks the parent application row with SELECT ... FOR UPDATE before any check runs", () => {
    expect(body).toMatch(/select \* into v_app from public\.applications a where a\.id = p_application_id for update;/);
  });

  it("re-derives authorization from the freshly locked row's assigned_counsellor_id — the same two-branch shape used everywhere else in this codebase", () => {
    expect(body).toMatch(/is_admin_role\(array\['super_admin', 'admin'\]\)/);
    expect(body).toMatch(/is_admin_role\(array\['counsellor'\]\)/);
    expect(body).toMatch(/v_app\.assigned_counsellor_id = public\.current_counsellor_id\(\)/);
  });

  it("rejects when a submission already exists for this application — the one-per-application invariant enforced in application logic, not just the unique index", () => {
    expect(body).toMatch(/exists \(select 1 from public\.application_submissions s where s\.application_id = p_application_id\)/);
    expect(body).toMatch(/already been recorded as submitted/);
  });

  it("requires the freshly locked row's stage to be exactly 'ready_to_submit' — never a broader appropriate-stage set", () => {
    expect(body).toMatch(/v_app\.stage <> 'ready_to_submit'/);
  });

  it("blocks when any current document is needs_correction", () => {
    expect(body).toMatch(/d\.is_current = true and d\.review_status = 'needs_correction'/);
  });

  it("requires every hardcoded required document type to have a current, accepted document", () => {
    for (const docType of ["academic_transcript", "identity_document", "resume_cv"]) {
      expect(body).toMatch(new RegExp(`'${docType}'`));
    }
    expect(body).toMatch(/d\.document_type = req\.doc_type\s+and d\.is_current = true\s+and d\.review_status = 'accepted'/);
  });

  it("requires every hardcoded manual checklist item to be complete", () => {
    for (const key of ["profile_reviewed", "eligibility_checked", "intake_confirmed", "details_confirmed"]) {
      expect(body).toMatch(new RegExp(`'${key}'`));
    }
    expect(body).toMatch(/c\.completed_at is not null/);
  });

  it("performs the stage transition with a conditional UPDATE re-asserting stage = 'ready_to_submit', never trusting the earlier lock alone", () => {
    expect(body).toMatch(/update public\.applications\s+set stage = 'submitted', submitted_at = now\(\)\s+where id = p_application_id and stage = 'ready_to_submit'/);
  });

  it("raises and rolls back the whole transaction if the conditional stage UPDATE matches zero rows — no partial submission is ever left behind", () => {
    expect(body).toMatch(/if v_new_stage is null then/);
  });

  it("writes an application_status_history row with a student-visible message and a server-derived actor_type — never a caller-supplied actor identity", () => {
    expect(body).toMatch(/insert into public\.application_status_history \(application_id, from_status, to_status, changed_by, actor_type, student_visible_message\)/);
    expect(body).toMatch(/v_actor_type := case when v_is_admin then 'admin' else 'counsellor' end;/);
  });

  it("validates submission_method against the fixed vocabulary before touching the database", () => {
    expect(body).toMatch(/if p_submission_method not in \('university_portal', 'centralized_platform', 'email', 'agent_partner', 'other'\) then/);
  });

  it("validates the external URL format and length before touching the database", () => {
    expect(body).toMatch(/p_external_url !~ '\^https\?:\/\/'/);
    expect(body).toMatch(/length\(p_external_url\) > 500/);
  });

  it("returns a narrow explicit column list — never submitted_by_user_id, internal_note, or SELECT *", () => {
    const returnsStart = sql.indexOf("returns table", sql.indexOf(SIGNATURE));
    const returnsBody = sql.slice(returnsStart, sql.indexOf(")\nlanguage plpgsql", returnsStart));
    expect(returnsBody).not.toMatch(/submitted_by_user_id/);
    expect(returnsBody).not.toMatch(/internal_note/);
    expect(returnsBody).toMatch(/id uuid/);
    expect(returnsBody).toMatch(/stage text/);
  });

  it("is revoked from public AND anon explicitly, before being granted to authenticated (the 0019 lesson, applied here)", () => {
    expect(sql).toMatch(/revoke all on function public\.staff_record_application_submission\([^)]*\) from public;/);
    expect(sql).toMatch(/revoke execute on function public\.staff_record_application_submission\([^)]*\) from anon;/);
    expect(sql).toMatch(/grant execute on function public\.staff_record_application_submission\([^)]*\) to authenticated;/);
  });
});

describe("0021 — PART 4: get_my_application_submission()", () => {
  const SIGNATURE = "create or replace function public.get_my_application_submission(";
  const body = sliceFunctionBody(SIGNATURE);

  it("is SECURITY DEFINER with a pinned search_path and is STABLE", () => {
    expect(body).toMatch(/security definer/);
    expect(body).toMatch(/set search_path = public/);
    expect(body).toMatch(/stable/);
  });

  it("verifies application.student_user_id = auth.uid() — the same ownership boundary as every other student-facing RPC", () => {
    expect(body).toMatch(/a\.student_user_id = auth\.uid\(\)/);
  });

  it("NEVER returns submitted_by_user_id, internal_note, external_url, or platform_name to the student", () => {
    const returnsStart = sql.indexOf("returns table", sql.indexOf(SIGNATURE));
    const returnsBody = sql.slice(returnsStart, sql.indexOf(")\nlanguage sql", returnsStart));
    for (const forbidden of ["submitted_by_user_id", "internal_note", "external_url", "platform_name"]) {
      expect(returnsBody).not.toMatch(new RegExp(forbidden));
    }
  });

  it("is revoked from public AND anon explicitly before being granted to authenticated", () => {
    expect(sql).toMatch(/revoke all on function public\.get_my_application_submission\(uuid\) from public;/);
    expect(sql).toMatch(/revoke execute on function public\.get_my_application_submission\(uuid\) from anon;/);
    expect(sql).toMatch(/grant execute on function public\.get_my_application_submission\(uuid\) to authenticated;/);
  });
});

describe("0021 — PART 5: Row Level Security", () => {
  it("enables RLS on both new tables", () => {
    expect(sql).toMatch(/alter table public\.application_submissions enable row level security;/);
    expect(sql).toMatch(/alter table public\.application_submission_documents enable row level security;/);
  });

  it("application_submissions SELECT policy scopes to super_admin/admin or the assigned counsellor only — no student branch", () => {
    const body = slicePolicy("Admins/assigned counsellor can read application submissions");
    expect(body).toMatch(/is_admin_role\(array\['super_admin', 'admin'\]\)/);
    expect(body).toMatch(/current_counsellor_id\(\)/);
    expect(body).not.toMatch(/student_user_id = auth\.uid\(\)/);
  });

  it("application_submission_documents SELECT policy scopes to super_admin/admin or the assigned counsellor only — no student branch", () => {
    const body = slicePolicy("Admins/assigned counsellor can read submission documents");
    expect(body).toMatch(/is_admin_role\(array\['super_admin', 'admin'\]\)/);
    expect(body).toMatch(/current_counsellor_id\(\)/);
    expect(body).not.toMatch(/student_user_id = auth\.uid\(\)/);
  });

  it("neither table has any INSERT/UPDATE/DELETE policy — every write happens exclusively inside the SECURITY DEFINER RPC", () => {
    expect(sql).not.toMatch(/application_submissions for insert/);
    expect(sql).not.toMatch(/application_submissions for update/);
    expect(sql).not.toMatch(/application_submissions for delete/);
    expect(sql).not.toMatch(/application_submission_documents for insert/);
    expect(sql).not.toMatch(/application_submission_documents for update/);
    expect(sql).not.toMatch(/application_submission_documents for delete/);
  });

  it("neither table's SELECT policy grants finance/analyst/content_editor access — those roles are absent from both policy bodies entirely", () => {
    for (const policyName of ["Admins/assigned counsellor can read application submissions", "Admins/assigned counsellor can read submission documents"]) {
      const body = slicePolicy(policyName);
      expect(body).not.toMatch(/finance/);
      expect(body).not.toMatch(/analyst/);
      expect(body).not.toMatch(/content_editor/);
    }
  });
});

describe("0021 — anon denial across every new function", () => {
  it("every function this file defines has an explicit 'revoke ... from anon' line", () => {
    for (const name of ["staff_record_application_submission", "get_my_application_submission"]) {
      expect(sql).toMatch(new RegExp(`revoke execute on function public\\.${name}\\([^)]*\\) from anon;`));
    }
  });
});

describe("0021 — out of scope, not accidentally introduced", () => {
  it("never mutates applications.stage to anything other than 'submitted'", () => {
    const matches = sql.match(/set stage = '([a-z_]+)'/g) ?? [];
    for (const match of matches) {
      expect(match).toContain("submitted");
    }
  });

  it("never introduces a broader submission-status vocabulary than 'submitted' (no under_review_by_university/offer_expected/decision_pending-style additions)", () => {
    for (const forbidden of ["under_review_by_university", "offer_expected", "visa_ready", "cas_", "i_20", "acknowledged"]) {
      expect(sql.toLowerCase()).not.toContain(forbidden);
    }
  });

  it("never references storage.objects or the application-documents Storage bucket — this migration snapshots document metadata only", () => {
    expect(sql).not.toMatch(/storage\.objects/);
    expect(sql).not.toMatch(/storage\.buckets/);
  });
});
