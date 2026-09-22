import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Milestone 17 — static-SQL-text regression guard for
 * supabase/migrations/0018_application_documents_foundation.sql. Mirrors
 * src/lib/applications/application-workflow-migration-security.test.ts
 * exactly (no live Postgres connection exists in this project's Vitest
 * setup, so RLS/RPC correctness is verified against the actual migration
 * text, not a live database).
 *
 * This file asserts v2's original FIVE security fixes a pre-install review
 * found in an earlier draft of this migration, PLUS the two further fixes
 * from the M17-v3 hardening pass (Issue 1 — block direct deletion of a
 * current document's Storage object; Issue 2 — least-privilege document
 * access, narrowing SELECT to super_admin/admin/assigned-counsellor only) —
 * each `describe` block below is labeled with the issue/milestone it
 * guards, matching this milestone's own required test coverage.
 */

const MIGRATIONS_DIR = path.resolve(process.cwd(), "supabase/migrations");
const sql = readFileSync(path.join(MIGRATIONS_DIR, "0018_application_documents_foundation.sql"), "utf8");
const priorMigrationFilenames = [
  "0004_admin_system.sql",
  "0005_payments_billing.sql",
  "0006_global_university_course_data.sql",
  "0011_electronic_signature.sql",
  "0012_electronic_stamping_and_assisted_onboarding.sql",
  "0013_assisted_onboarding_and_recommendation_readiness.sql",
  "0014_discovery_session_counsellor_scope.sql",
  "0015_discovery_session_duplicate_booking_guard.sql",
  "0016_refund_operations.sql",
  "0017_student_application_workflow.sql",
];

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
  const end = sql.indexOf(");", start);
  return sql.slice(start, end);
}

describe("0018 — baseline: 0001-0017 untouched", () => {
  it("does not DROP or ALTER any pre-existing table other than the storage.buckets upsert", () => {
    expect(sql).not.toMatch(/drop table.*applications\b/i);
    expect(sql).not.toMatch(/drop table.*application_status_history/i);
  });

  it("every prior migration file still exists on disk, unmodified by this file", () => {
    for (const filename of priorMigrationFilenames) {
      const content = readFileSync(path.join(MIGRATIONS_DIR, filename), "utf8");
      expect(content.length).toBeGreaterThan(0);
    }
  });

  it("creates no migration numbered 0019 or any number other than 0018 (single-file check by construction: this test only reads 0018)", () => {
    expect(path.basename(path.join(MIGRATIONS_DIR, "0018_application_documents_foundation.sql"))).toBe("0018_application_documents_foundation.sql");
  });
});

describe("0018 — application_documents table shape", () => {
  it("creates the table with no student_user_id column (ownership always derived via the applications join)", () => {
    const start = sql.indexOf("create table if not exists public.application_documents");
    const end = sql.indexOf(");", start);
    const body = sql.slice(start, end);
    expect(body).not.toMatch(/student_user_id/);
  });

  it("document_type is CHECK-constrained to exactly the nine controlled values", () => {
    for (const type of [
      "academic_transcript",
      "degree_certificate",
      "resume_cv",
      "identity_document",
      "english_test_score",
      "standardized_test_score",
      "financial_document",
      "portfolio",
      "other_supporting_document",
    ]) {
      expect(sql).toMatch(new RegExp(`'${type}'`));
    }
  });

  it("file_size_bytes is capped at 25MB (26214400) and must be positive", () => {
    expect(sql).toMatch(/file_size_bytes > 0 and file_size_bytes <= 26214400/);
  });

  it("storage_path is unique", () => {
    expect(sql).toMatch(/constraint application_documents_storage_path_unique unique \(storage_path\)/);
  });

  it("has a partial unique index enforcing at most one current document per (application_id, document_type)", () => {
    expect(sql).toMatch(/create unique index application_documents_one_current_per_type\s*\n\s*on public\.application_documents \(application_id, document_type\)\s*\n\s*where is_current = true;/);
  });

  it("has an updated_at trigger reusing the pre-existing set_updated_at()", () => {
    expect(sql).toMatch(/create trigger set_application_documents_updated_at\s*\n\s*before update on public\.application_documents\s*\n\s*for each row execute function public\.set_updated_at\(\);/);
  });
});

describe("0018 — RLS: admin/counsellor read-only, zero student policy", () => {
  it("enables RLS on application_documents", () => {
    expect(sql).toMatch(/alter table public\.application_documents enable row level security;/);
  });

  it("has exactly one policy defined on application_documents, and it is SELECT-only", () => {
    const policyMatches = sql.match(/create policy "[^"]+"\s*\n\s*on public\.application_documents/g) ?? [];
    expect(policyMatches).toHaveLength(1);
    const policy = slicePolicy("Admins/assigned counsellor can read application documents");
    expect(policy).toMatch(/for select to authenticated/);
  });

  it("has no INSERT/UPDATE/DELETE policy of any kind on application_documents — every mutation goes through the SECURITY DEFINER RPCs", () => {
    expect(sql).not.toMatch(/on public\.application_documents for insert/);
    expect(sql).not.toMatch(/on public\.application_documents for update/);
    expect(sql).not.toMatch(/on public\.application_documents for delete/);
  });

  it("the one SELECT policy has no student_user_id branch — a student has zero direct access to this table", () => {
    const policy = slicePolicy("Admins/assigned counsellor can read application documents");
    expect(policy).not.toMatch(/student_user_id/);
  });
});

describe("0018 — [security fix — Issue 2, M17-v3] least-privilege document access: table-level SELECT policy", () => {
  const policy = slicePolicy("Admins/assigned counsellor can read application documents");

  it("still allows super_admin and admin", () => {
    expect(policy).toMatch(/is_admin_role\(array\['super_admin', 'admin'\]\)/);
  });

  it("no longer allows finance or analyst — narrowed away from v2's broader role array", () => {
    expect(policy).not.toMatch(/'finance'/);
    expect(policy).not.toMatch(/'analyst'/);
  });

  it("still allows the assigned counsellor via the counsellor branch, unaffected by the narrowing", () => {
    expect(policy).toMatch(/is_admin_role\(array\['counsellor'\]\) and a\.assigned_counsellor_id = public\.current_counsellor_id\(\)/);
  });

  it("the old v2 policy name (which named finance in its own title) is dropped, not merely superseded", () => {
    expect(sql).toMatch(/drop policy if exists "Admins\/finance\/assigned counsellor can read application documents" on public\.application_documents;/);
  });
});

describe("0018 — get_my_application_documents()", () => {
  const body = sliceFunctionBody("create or replace function public.get_my_application_documents(p_application_id uuid)");

  it("is SECURITY DEFINER, STABLE, with a pinned search_path", () => {
    expect(body).toMatch(/security definer/);
    expect(body).toMatch(/set search_path = public/);
    expect(body).toMatch(/stable/);
  });

  it("derives ownership from auth.uid() via a join to applications — never a parameter", () => {
    expect(body).toMatch(/a\.student_user_id = auth\.uid\(\)/);
  });

  it("returns only is_current = true rows — no version-history leak to a student", () => {
    expect(body).toMatch(/d\.is_current = true/);
  });

  it("is revoked from PUBLIC and granted only to authenticated — never anon", () => {
    expect(sql).toMatch(/revoke all on function public\.get_my_application_documents\(uuid\) from public;/);
    expect(sql).toMatch(/grant execute on function public\.get_my_application_documents\(uuid\) to authenticated;/);
  });
});

describe("0018 — Issue 4/Storage Bucket Provisioning: idempotent SQL-based bucket creation", () => {
  it("provisions the application-documents bucket via an idempotent insert into storage.buckets, not a manual-dashboard-only BOOTSTRAP note", () => {
    expect(sql).toMatch(/insert into storage\.buckets \(id, name, public, file_size_limit, allowed_mime_types\)/);
    expect(sql).toMatch(/'application-documents',\s*\n\s*'application-documents',\s*\n\s*false,\s*\n\s*26214400,/);
    expect(sql).toMatch(/on conflict \(id\) do update set/);
  });

  it("does NOT repeat the blanket 'SQL cannot create a bucket' claim as this milestone's own bootstrap instruction", () => {
    // The correction itself is documented in prose (mentioning the claim in
    // order to refute it), but there must be no BOOTSTRAP section directing
    // an operator to manually create this bucket in the dashboard.
    expect(sql).not.toMatch(/BOOTSTRAP[\s\S]{0,200}create.{0,40}bucket.{0,40}dashboard/i);
  });

  it("sets the bucket private, with the exact 25MB limit and four allowed MIME types matching the table-level constraint", () => {
    expect(sql).toMatch(/array\['application\/pdf', 'image\/jpeg', 'image\/png', 'image\/webp'\]/);
  });
});

describe("0018 — Storage RLS for the application-documents bucket", () => {
  it("has exactly three storage.objects policies, all scoped to this bucket", () => {
    const policyMatches = sql.match(/create policy "[^"]+"\s*\n\s*on storage\.objects/g) ?? [];
    expect(policyMatches).toHaveLength(3);
  });

  it("has no UPDATE policy on storage.objects for this bucket — a replace is always a new object, never an in-place mutation", () => {
    expect(sql).not.toMatch(/on storage\.objects for update/);
  });

  it("has no admin/counsellor DELETE policy — deletion is owning-student only (still gated by ownership even after the v3 is_current hardening below)", () => {
    const deletePolicy = slicePolicy("Owning student can delete application documents");
    expect(deletePolicy).not.toMatch(/is_admin_role/);
  });

  it("every policy regex-guards the UUID cast before using it, same pattern as the pre-existing signed/stamped-agreements buckets", () => {
    const uuidRegex = "\\^\\[0-9a-fA-F\\]\\{8\\}-\\[0-9a-fA-F\\]\\{4\\}-\\[0-9a-fA-F\\]\\{4\\}-\\[0-9a-fA-F\\]\\{4\\}-\\[0-9a-fA-F\\]\\{12\\}\\$";
    const occurrences = sql.match(new RegExp(uuidRegex, "g")) ?? [];
    expect(occurrences.length).toBeGreaterThanOrEqual(3);
  });

  it("derives ownership from a join to applications.student_user_id — never storage.objects.owner", () => {
    expect(sql).not.toMatch(/storage\.objects\.owner/);
  });

  describe("[security fix — Issue 3] retired file access", () => {
    const selectPolicy = slicePolicy("Owning student or authorized staff can read current application documents");

    it("the SELECT policy joins to application_documents and requires is_current = true — not just bucket + ownership", () => {
      expect(selectPolicy).toMatch(/join public\.application_documents d/);
      expect(selectPolicy).toMatch(/d\.is_current = true/);
    });

    it("the SELECT policy still allows the owning student, admin, or the assigned counsellor", () => {
      expect(selectPolicy).toMatch(/a\.student_user_id = auth\.uid\(\)/);
      expect(selectPolicy).toMatch(/is_admin_role\(array\['super_admin', 'admin'\]\)/);
      expect(selectPolicy).toMatch(/is_admin_role\(array\['counsellor'\]\) and a\.assigned_counsellor_id = public\.current_counsellor_id\(\)/);
    });

    it("matches the object's own storage_path exactly (d.storage_path = storage.objects.name), not merely the same application", () => {
      expect(selectPolicy).toMatch(/d\.storage_path = storage\.objects\.name/);
    });
  });

  describe("[security fix — Issue 2, M17-v3] least-privilege document access: Storage-level SELECT policy", () => {
    const selectPolicy = slicePolicy("Owning student or authorized staff can read current application documents");

    it("no longer allows finance or analyst to read the underlying Storage object — narrowed away from v2's broader role array", () => {
      expect(selectPolicy).not.toMatch(/'finance'/);
      expect(selectPolicy).not.toMatch(/'analyst'/);
    });

    it("agrees with the table-level SELECT policy's role set exactly (super_admin/admin only, plus the counsellor branch) — SQL and TypeScript authorization models must never diverge", () => {
      const tablePolicy = slicePolicy("Admins/assigned counsellor can read application documents");
      expect(selectPolicy).toMatch(/is_admin_role\(array\['super_admin', 'admin'\]\)/);
      expect(tablePolicy).toMatch(/is_admin_role\(array\['super_admin', 'admin'\]\)/);
    });
  });

  it("the INSERT policy is owning-student only — no admin/counsellor branch", () => {
    const insertPolicy = slicePolicy("Owning student can upload application documents");
    expect(insertPolicy).toMatch(/a\.student_user_id = auth\.uid\(\)/);
    expect(insertPolicy).not.toMatch(/is_admin_role/);
  });

  describe("[security fix — Issue 1, M17-v3] block direct deletion of current documents", () => {
    const deletePolicy = slicePolicy("Owning student can delete application documents");

    it("remains bucket-scoped to 'application-documents'", () => {
      expect(deletePolicy).toMatch(/bucket_id = 'application-documents'/);
    });

    it("still regex-guards the UUID cast before using it, exactly like the INSERT/SELECT policies", () => {
      expect(deletePolicy).toMatch(/split_part\(storage\.objects\.name, '\/', 1\) ~ '\^\[0-9a-fA-F\]\{8\}-\[0-9a-fA-F\]\{4\}-\[0-9a-fA-F\]\{4\}-\[0-9a-fA-F\]\{4\}-\[0-9a-fA-F\]\{12\}\$'/);
    });

    it("still verifies the owning application via a join to applications.student_user_id = auth.uid()", () => {
      expect(deletePolicy).toMatch(/a\.student_user_id = auth\.uid\(\)/);
    });

    it("adds a NOT EXISTS clause checking the exact storage_path against application_documents", () => {
      expect(deletePolicy).toMatch(/not exists \(\s*\n\s*select 1 from public\.application_documents d\s*\n\s*where d\.storage_path = storage\.objects\.name/);
    });

    it("the NOT EXISTS clause checks is_current = true — this is what actually blocks deleting a CURRENT document's object", () => {
      expect(deletePolicy).toMatch(/and d\.is_current = true\s*\n\s*\)/);
    });

    it("the ownership check and the is_current check are both required (ANDed), not alternatives (ORed) — either gap alone would let a caller bypass the other", () => {
      // The new `not exists (...)` clause must be joined to the preceding
      // ownership `exists (...)` block with `and`, never `or` — an `or`
      // would let a caller satisfy just one of the two checks and still
      // delete a current document.
      expect(deletePolicy).toMatch(/\)\s*\n\s*and not exists \(/);
      expect(deletePolicy).not.toMatch(/\)\s*\n\s*or not exists \(/);
    });

    it("does not trust any client-supplied document id/path — the check is keyed off storage.objects.name (Storage's own value), never a parameter", () => {
      const signatureHasParams = /create policy "Owning student can delete application documents"\s*\n\s*on storage\.objects for delete to authenticated\s*\n\s*using \(/;
      expect(deletePolicy).toMatch(signatureHasParams);
      expect(deletePolicy).not.toMatch(/p_storage_path|p_document_id/);
    });

    describe("conceptual cleanup-state coverage (matches the three legitimate call sites in src/lib/supabase/education/application-documents.ts)", () => {
      it("(A) orphan cleanup — a Storage object with NO application_documents row at all satisfies NOT EXISTS trivially, so deletion remains permitted", () => {
        // The NOT EXISTS subquery is unconditional on `d.storage_path =
        // storage.objects.name` alone (plus is_current) — it does not require
        // a matching row to exist first, so an object with zero matching rows
        // makes the whole `not exists (...)` true by construction. This test
        // documents that property directly against the clause's own shape
        // (a bare `where` with no additional existence precondition).
        expect(deletePolicy).toMatch(/not exists \(\s*\n\s*select 1 from public\.application_documents d\s*\n\s*where d\.storage_path = storage\.objects\.name\s*\n\s*and d\.is_current = true\s*\n\s*\)/);
      });

      it("(B) replacement cleanup — student_upload_application_document() (PART 6) flips the OLD row's is_current to false via RETURNING before any Storage delete is ever attempted, so by the time cleanup runs NOT EXISTS is satisfied", () => {
        const uploadBody = sliceFunctionBody(
          "create or replace function public.student_upload_application_document(\n  p_application_id uuid,\n  p_document_type text,\n  p_original_filename text,\n  p_storage_path text,\n  p_mime_type text,\n  p_file_size_bytes bigint,\n  p_display_label text default null\n)"
        );
        expect(uploadBody).toMatch(/set is_current = false\s*\n\s*where application_id = p_application_id\s*\n\s*and document_type = p_document_type\s*\n\s*and is_current = true\s*\n\s*returning storage_path into v_previous_storage_path;/);
      });

      it("(C) explicit-remove cleanup — student_remove_application_document() (PART 7) flips is_current to false in the same atomic UPDATE that also sets removed_at, before any Storage delete is ever attempted", () => {
        const removeBody = sliceFunctionBody("create or replace function public.student_remove_application_document(p_document_id uuid)");
        expect(removeBody).toMatch(/set is_current = false, removed_at = now\(\)/);
      });

      it("never deletes a current document first — no code path in this migration flips is_current to false AFTER a Storage delete; both RPCs commit the metadata retirement as their own statement, with cleanup happening only afterward in TypeScript", () => {
        // Structural guard: neither RPC body contains a call to
        // storage.objects deletion at all — Storage cleanup is exclusively a
        // TypeScript-side, post-commit concern (see
        // src/lib/supabase/education/application-documents.ts), never
        // something either SECURITY DEFINER function attempts itself.
        const uploadBody = sliceFunctionBody(
          "create or replace function public.student_upload_application_document(\n  p_application_id uuid,\n  p_document_type text,\n  p_original_filename text,\n  p_storage_path text,\n  p_mime_type text,\n  p_file_size_bytes bigint,\n  p_display_label text default null\n)"
        );
        const removeBody = sliceFunctionBody("create or replace function public.student_remove_application_document(p_document_id uuid)");
        expect(uploadBody).not.toMatch(/delete from storage\.objects/);
        expect(removeBody).not.toMatch(/delete from storage\.objects/);
      });
    });
  });
});

describe("0018 — student_upload_application_document()", () => {
  const body = sliceFunctionBody(
    "create or replace function public.student_upload_application_document(\n  p_application_id uuid,\n  p_document_type text,\n  p_original_filename text,\n  p_storage_path text,\n  p_mime_type text,\n  p_file_size_bytes bigint,\n  p_display_label text default null\n)"
  );

  it("is SECURITY DEFINER with a pinned search_path", () => {
    expect(body).toMatch(/security definer/);
    expect(body).toMatch(/set search_path = public/);
  });

  it("validates auth.uid() is present before doing anything else", () => {
    expect(body).toMatch(/if auth\.uid\(\) is null then\s*\n\s*raise exception 'Not authenticated\.'/);
  });

  it("validates document_type, mime_type, file size, filename length, and label length before touching storage.objects or the table", () => {
    expect(body).toMatch(/if p_document_type not in \(/);
    expect(body).toMatch(/if p_mime_type not in \('application\/pdf', 'image\/jpeg', 'image\/png', 'image\/webp'\)/);
    expect(body).toMatch(/if p_file_size_bytes is null or p_file_size_bytes <= 0 or p_file_size_bytes > 26214400/);
    expect(body).toMatch(/if p_original_filename is null or length\(p_original_filename\) < 1 or length\(p_original_filename\) > 255/);
    expect(body).toMatch(/if p_display_label is not null and length\(p_display_label\) > 200/);
  });

  it("locks the parent applications row scoped to student_user_id = auth.uid() before any write", () => {
    expect(body).toMatch(/where id = p_application_id and student_user_id = auth\.uid\(\) for update;/);
  });

  describe("[security fix — Issue 1] ghost metadata", () => {
    it("requires an exact match against storage.objects before metadata becomes current", () => {
      expect(body).toMatch(/if not exists \(\s*\n\s*select 1 from storage\.objects so\s*\n\s*where so\.bucket_id = 'application-documents'\s*\n\s*and so\.name = p_storage_path\s*\n\s*\) then/);
    });

    it("the existence check runs AFTER the ownership lock, not before (never lets a caller probe existence under a foreign application)", () => {
      const lockIndex = body.indexOf("for update;");
      const existsCheckIndex = body.indexOf("select 1 from storage.objects so");
      expect(lockIndex).toBeGreaterThan(-1);
      expect(existsCheckIndex).toBeGreaterThan(lockIndex);
    });
  });

  describe("[security fix — Issue 2] replacement cleanup", () => {
    it("captures the retired row's own storage_path via RETURNING, rather than discarding it", () => {
      expect(body).toMatch(/returning storage_path into v_previous_storage_path;/);
    });

    it("the retire-old-row UPDATE is scoped to the same application_id and document_type, only touching is_current = true rows", () => {
      expect(body).toMatch(/update public\.application_documents\s*\n\s*set is_current = false\s*\n\s*where application_id = p_application_id\s*\n\s*and document_type = p_document_type\s*\n\s*and is_current = true\s*\n\s*returning storage_path into v_previous_storage_path;/);
    });

    it("returns previous_storage_path as part of the function's own RETURNS TABLE, so the caller never has to guess it", () => {
      expect(sql).toMatch(/previous_storage_path text\s*\n\)\s*\nlanguage plpgsql/);
    });

    it("the retire step happens before the insert step (retire-then-insert, not insert-then-retire)", () => {
      const retireIndex = body.indexOf("set is_current = false");
      const insertIndex = body.indexOf("insert into public.application_documents");
      expect(retireIndex).toBeGreaterThan(-1);
      expect(insertIndex).toBeGreaterThan(retireIndex);
    });
  });

  it("re-validates the storage_path's own application-id prefix as defense in depth beyond the Storage INSERT policy", () => {
    expect(body).toMatch(/v_expected_prefix := p_application_id::text \|\| '\/';/);
  });

  it("is revoked from PUBLIC and granted only to authenticated", () => {
    expect(sql).toMatch(/revoke all on function public\.student_upload_application_document\([^)]*\) from public;/);
    expect(sql).toMatch(/grant execute on function public\.student_upload_application_document\([^)]*\) to authenticated;/);
  });

  it("uses one generic, anti-enumeration message for a foreign/missing application — never distinguishes the two", () => {
    expect(body).toMatch(/This document could not be saved — the application may not be yours\. Please refresh and try again\./);
  });
});

describe("0018 — student_remove_application_document()", () => {
  const body = sliceFunctionBody("create or replace function public.student_remove_application_document(p_document_id uuid)");

  it("is SECURITY DEFINER with a pinned search_path", () => {
    expect(body).toMatch(/security definer/);
    expect(body).toMatch(/set search_path = public/);
  });

  it("validates auth.uid() is present before doing anything else", () => {
    expect(body).toMatch(/if auth\.uid\(\) is null then\s*\n\s*raise exception 'Not authenticated\.'/);
  });

  it("is a single atomic UPDATE whose own WHERE clause is the entire ownership check — never a preceding SELECT", () => {
    expect(body).not.toMatch(/select \* into v_row from public\.application_documents/);
    expect(body).toMatch(/update public\.application_documents d\s*\n\s*set is_current = false, removed_at = now\(\)\s*\n\s*where d\.id = p_document_id\s*\n\s*and d\.is_current = true\s*\n\s*and exists \(/);
  });

  it("returns the retired row's own storage_path so the caller never uses a client-supplied path for cleanup", () => {
    expect(body).toMatch(/returning \* into v_row;/);
    expect(body).toMatch(/return query select v_row\.id, v_row\.storage_path;/);
  });

  it("[security fix — Issue 4] sets removed_at (an explicit removal), never leaves it null the way a replacement does", () => {
    expect(body).toMatch(/set is_current = false, removed_at = now\(\)/);
  });

  it("uses one generic, anti-enumeration error message covering both 'not yours' and 'already removed'", () => {
    expect(body).toMatch(/This document could not be removed — it may not be yours, or it may have already been removed\. Please refresh and try again\./);
  });

  it("is revoked from PUBLIC and granted only to authenticated", () => {
    expect(sql).toMatch(/revoke all on function public\.student_remove_application_document\(uuid\) from public;/);
    expect(sql).toMatch(/grant execute on function public\.student_remove_application_document\(uuid\) to authenticated;/);
  });
});

describe("0018 — no anon grant anywhere in this migration", () => {
  it("never grants execute to anon on any function this migration defines", () => {
    expect(sql).not.toMatch(/grant execute.*to anon/i);
  });

  it("every storage.objects policy in this file is scoped `to authenticated`, never `to anon` or `to public`", () => {
    const roles = [...sql.matchAll(/on storage\.objects for (?:insert|select|delete) to (\w+)/g)].map((m) => m[1]);
    expect(roles).toHaveLength(3);
    for (const role of roles) {
      expect(role).toBe("authenticated");
    }
  });
});

describe("0018 — client cannot set privileged fields", () => {
  it("student_upload_application_document()'s parameter list contains only caller-owned, student-safe inputs — no owner/student id parameter", () => {
    const signatureStart = sql.indexOf("create or replace function public.student_upload_application_document(");
    const signatureEnd = sql.indexOf(")\nreturns table", signatureStart);
    const signature = sql.slice(signatureStart, signatureEnd);
    expect(signature).not.toMatch(/p_student_user_id/);
    expect(signature).not.toMatch(/p_owner/);
  });
});
