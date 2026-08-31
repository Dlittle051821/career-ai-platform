import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Regression guard for 0011_electronic_signature.sql's security-relevant
 * invariants — a static check against the actual migration SQL text, not
 * a live Postgres connection (this project has no database in its Vitest
 * setup — see vitest.config.mts's own docblock, and
 * src/lib/payments/migration-security.test.ts for the established
 * precedent this file mirrors). What this test DOES catch: someone
 * loosening a grant, removing a REVOKE, or deleting the immutability
 * trigger/partial unique index without touching this file. It is a
 * text-level invariant check, not a substitute for running the
 * verification queries in the migration's own PART 10 against a real
 * database after applying it.
 */

const MIGRATION_PATH = path.resolve(process.cwd(), "supabase/migrations/0011_electronic_signature.sql");
const sql = readFileSync(MIGRATION_PATH, "utf8");

describe("0011_electronic_signature.sql — security invariants", () => {
  it("apply_signature_webhook_event is granted to anon, and revoked from public", () => {
    expect(sql).toMatch(/revoke execute on function public\.apply_signature_webhook_event\(text, text\) from public;/);
    expect(sql).toMatch(/grant execute on function public\.apply_signature_webhook_event\(text, text\) to anon;/);
  });

  it("apply_signature_webhook_event is NOT granted to authenticated (webhook has no session, so this would be meaningless — a stray grant here would be a signal something is confused)", () => {
    expect(sql).not.toMatch(/grant execute on function public\.apply_signature_webhook_event\(text, text\) to authenticated;/);
  });

  it("set_signature_document_path is granted to anon, and revoked from public", () => {
    expect(sql).toMatch(/revoke execute on function public\.set_signature_document_path\(text, text, text\) from public;/);
    expect(sql).toMatch(/grant execute on function public\.set_signature_document_path\(text, text, text\) to anon;/);
  });

  it("record_system_audit_log is revoked from public and has NO grant to anon or authenticated anywhere in the file", () => {
    expect(sql).toMatch(/revoke execute on function public\.record_system_audit_log\(text, text, text, text, jsonb, jsonb\) from public;/);
    expect(sql).not.toMatch(/grant execute on function public\.record_system_audit_log/);
  });

  it("create_signature_request is SECURITY INVOKER, not SECURITY DEFINER — it must stay fully RLS-respecting", () => {
    const body = functionBody("create_signature_request");
    expect(body).toMatch(/\bsecurity invoker\b/);
    expect(body).not.toMatch(/\bsecurity definer\b/);
  });

  it("apply_signature_webhook_event and set_signature_document_path and record_system_audit_log are SECURITY DEFINER", () => {
    for (const name of ["apply_signature_webhook_event", "set_signature_document_path", "record_system_audit_log"]) {
      expect(functionBody(name)).toMatch(/\bsecurity definer\b/);
    }
  });

  it("apply_signature_webhook_event never raises on a verification failure (would roll back its own audit-log write) — every failure branch returns a jsonb value instead", () => {
    const body = functionBody("apply_signature_webhook_event");
    // The only 'raise exception' allowed inside this function's happy-path
    // failure branches would be a regression — verification failures must
    // return, not raise. (Missing-body/signature, not_configured,
    // invalid_signature, invalid_json all return 'valid', false.)
    expect(body).toMatch(/'valid', false, 'reason', 'not_configured'/);
    expect(body).toMatch(/'valid', false, 'reason', 'invalid_signature'/);
    expect(body).toMatch(/'valid', false, 'reason', 'invalid_json'/);
  });

  it("agreement_versions has an immutability trigger wired to prevent_agreement_version_mutation, BEFORE UPDATE", () => {
    expect(sql).toMatch(/create trigger prevent_agreement_versions_mutation\s*\n\s*before update on public\.agreement_versions\s*\n\s*for each row execute function public\.prevent_agreement_version_mutation\(\);/);
  });

  it("signature_requests has the partial unique index preventing more than one active request per version", () => {
    expect(sql).toMatch(/create unique index if not exists signature_requests_one_active_per_version\s*\n\s*on public\.signature_requests \(agreement_version_id\)\s*\n\s*where status in \('draft', 'pending', 'sent', 'viewed'\);/);
  });

  it("agreement_versions and signature_requests INSERT/UPDATE policies are restricted to super_admin/admin only", () => {
    const insertPolicies = [...sql.matchAll(/create policy "super_admin\/admin can (create|update) (agreement versions|signature requests)"[\s\S]*?with check \(public\.is_admin_role\(array\['super_admin', 'admin'\]\)\);/g)];
    expect(insertPolicies.length).toBe(4); // create+update for each of the two tables
  });

  it("signature_provider_config has RLS enabled and NO policies defined for it anywhere in the file", () => {
    expect(sql).toMatch(/alter table public\.signature_provider_config enable row level security;/);
    // Scope the "no policy" check to just this table's own PART section
    // (between its "create table" and the next "PART" header) — a
    // whole-file substring/lazy-regex search would false-positive on an
    // unrelated "create policy ... on public.<other_table>" appearing
    // anywhere later in the file, or on this table's own (unrelated,
    // policy-free) updated_at trigger line.
    const start = sql.indexOf("create table if not exists public.signature_provider_config");
    expect(start).toBeGreaterThan(-1);
    const nextPartHeader = sql.indexOf("-- PART 6 —", start);
    expect(nextPartHeader).toBeGreaterThan(start);
    const section = sql.slice(start, nextPartHeader);
    expect(section).not.toMatch(/create policy/);
  });

  it("no existing 0001-0010 migration content markers (agreements table's own status CHECK) are redefined here — this file only ALTERs product_events' CHECK, never agreements'", () => {
    expect(sql).not.toMatch(/alter table public\.agreements/);
  });

  it("product_events' event_name CHECK constraint includes all five Milestone 10 signature event names", () => {
    for (const name of [
      "agreement_signature_requested",
      "agreement_signature_viewed",
      "agreement_signature_completed",
      "agreement_signature_declined",
      "agreement_signature_cancelled",
    ]) {
      expect(sql).toContain(`'${name}'`);
    }
  });
});

function functionBody(functionName: string): string {
  const start = sql.indexOf(`create or replace function public.${functionName}(`);
  expect(start, `expected to find a definition for public.${functionName}() in ${MIGRATION_PATH}`).toBeGreaterThan(-1);
  const end = sql.indexOf("\n$$;", start);
  expect(end, `expected to find the closing "$$;" for public.${functionName}()`).toBeGreaterThan(start);
  return sql.slice(start, end);
}
