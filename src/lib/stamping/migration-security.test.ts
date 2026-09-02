import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Regression guard for 0012_electronic_stamping_and_assisted_onboarding.sql's
 * security-relevant invariants — mirrors
 * src/lib/signatures/migration-security.test.ts exactly (a static check
 * against the actual migration SQL text, not a live Postgres connection —
 * this project has no database in its Vitest setup). What this test DOES
 * catch: someone loosening a grant, removing a REVOKE, or deleting the
 * partial unique index without touching this file. It is a text-level
 * invariant check, not a substitute for running the verification queries
 * in the migration's own PART 7 against a real database after applying it.
 */

const MIGRATION_PATH = path.resolve(process.cwd(), "supabase/migrations/0012_electronic_stamping_and_assisted_onboarding.sql");
const sql = readFileSync(MIGRATION_PATH, "utf8");

describe("0012_electronic_stamping_and_assisted_onboarding.sql — security invariants (M11-A stamping)", () => {
  it("apply_stamp_webhook_event is granted to anon, and revoked from public", () => {
    expect(sql).toMatch(/revoke execute on function public\.apply_stamp_webhook_event\(text, text\) from public;/);
    expect(sql).toMatch(/grant execute on function public\.apply_stamp_webhook_event\(text, text\) to anon;/);
  });

  it("apply_stamp_webhook_event is NOT granted to authenticated (webhook has no session)", () => {
    expect(sql).not.toMatch(/grant execute on function public\.apply_stamp_webhook_event\(text, text\) to authenticated;/);
  });

  it("set_stamp_document_path is granted to anon, and revoked from public", () => {
    expect(sql).toMatch(/revoke execute on function public\.set_stamp_document_path\(text, text, text\) from public;/);
    expect(sql).toMatch(/grant execute on function public\.set_stamp_document_path\(text, text, text\) to anon;/);
  });

  it("create_stamp_request is SECURITY INVOKER, not SECURITY DEFINER — it must stay fully RLS-respecting", () => {
    const body = functionBody("create_stamp_request");
    expect(body).toMatch(/\bsecurity invoker\b/);
    expect(body).not.toMatch(/\bsecurity definer\b/);
  });

  it("apply_stamp_webhook_event and set_stamp_document_path and sync_agreement_stamp_status are SECURITY DEFINER", () => {
    for (const name of ["apply_stamp_webhook_event", "set_stamp_document_path", "sync_agreement_stamp_status"]) {
      expect(functionBody(name)).toMatch(/\bsecurity definer\b/);
    }
  });

  it("apply_stamp_webhook_event never raises on a verification failure (would roll back its own audit-log write) — every failure branch returns a jsonb value instead", () => {
    const body = functionBody("apply_stamp_webhook_event");
    expect(body).toMatch(/'valid', false, 'reason', 'not_configured'/);
    expect(body).toMatch(/'valid', false, 'reason', 'invalid_signature'/);
    expect(body).toMatch(/'valid', false, 'reason', 'invalid_json'/);
  });

  it("stamp_requests has the partial unique index preventing more than one active request per version", () => {
    expect(sql).toMatch(/create unique index if not exists stamp_requests_one_active_per_version\s*\n\s*on public\.stamp_requests \(agreement_version_id\)\s*\n\s*where status in \('draft', 'pending', 'processing'\);/);
  });

  it("stamp_requests INSERT/UPDATE policies are restricted to super_admin/admin only", () => {
    const policies = [...sql.matchAll(/create policy "super_admin\/admin can (create|update) stamp requests"[\s\S]*?with check \(public\.is_admin_role\(array\['super_admin', 'admin'\]\)\);/g)];
    expect(policies.length).toBe(2);
  });

  it("stamp_provider_config has RLS enabled and NO policies defined for it anywhere in the file", () => {
    expect(sql).toMatch(/alter table public\.stamp_provider_config enable row level security;/);
    const start = sql.indexOf("create table if not exists public.stamp_provider_config");
    expect(start).toBeGreaterThan(-1);
    const nextSectionHeader = sql.indexOf("create or replace function public.apply_stamp_webhook_event", start);
    expect(nextSectionHeader).toBeGreaterThan(start);
    const section = sql.slice(start, nextSectionHeader);
    expect(section).not.toMatch(/create policy/);
  });

  it("no existing 0001-0011 migration content is redefined here — this file only ALTERs agreements/product_events additively, never a full CREATE TABLE for a pre-existing table", () => {
    expect(sql).not.toMatch(/create table if not exists public\.agreements /);
    expect(sql).not.toMatch(/create table if not exists public\.agreement_versions/);
    expect(sql).not.toMatch(/create table if not exists public\.signature_requests/);
  });

  it("agreements gains stamp_sign_sequence/stamp_status via ADD COLUMN IF NOT EXISTS, never a destructive column change", () => {
    expect(sql).toMatch(/alter table public\.agreements add column if not exists stamp_sign_sequence text;/);
    expect(sql).toMatch(/alter table public\.agreements add column if not exists stamp_status text not null default 'not_started';/);
    expect(sql).not.toMatch(/alter table public\.agreements drop column/);
  });

  it("product_events' event_name CHECK constraint includes all four Milestone 11-A stamping event names", () => {
    for (const name of ["agreement_stamp_requested", "agreement_stamp_completed", "agreement_stamp_failed", "agreement_stamp_cancelled"]) {
      expect(sql).toContain(`'${name}'`);
    }
  });

  it("still accepts every pre-existing product_events name (widened additively, nothing dropped)", () => {
    for (const name of [
      "user_registered",
      "profile_completed",
      "career_recommendations_generated",
      "payment_completed",
      "agreement_signature_requested",
      "agreement_signature_cancelled",
    ]) {
      expect(sql).toContain(`'${name}'`);
    }
  });

  it("stamped-agreements storage RLS never grants a public/anon read policy", () => {
    const start = sql.indexOf("PART 5 — Storage RLS");
    expect(start).toBeGreaterThan(-1);
    const end = sql.indexOf("PART 6 —", start);
    const section = sql.slice(start, end);
    expect(section).not.toMatch(/for select to anon/);
    expect(section).not.toMatch(/to public/);
  });
});

function functionBody(functionName: string): string {
  const start = sql.indexOf(`create or replace function public.${functionName}(`);
  expect(start, `expected to find a definition for public.${functionName}() in ${MIGRATION_PATH}`).toBeGreaterThan(-1);
  const end = sql.indexOf("\n$$;", start);
  expect(end, `expected to find the closing "$$;" for public.${functionName}()`).toBeGreaterThan(start);
  return sql.slice(start, end);
}
