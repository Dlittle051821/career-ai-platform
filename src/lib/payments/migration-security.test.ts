import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Regression guard for the Milestone 8 security correction: a static check
 * against the actual migration SQL text, not a live Postgres connection
 * (Vitest has no database in this project's test setup — see
 * vitest.config.mts's own docblock — and the two authoritative SECURITY
 * DEFINER functions can only be truly exercised against a real Postgres
 * instance; see docs/payments-billing-guide.md §19/§12 for the manual
 * verification process, including the has_function_privilege() queries in
 * the migration file's own PART 11).
 *
 * What this test DOES catch: someone reverting or silently weakening the
 * fix — e.g. flipping recompute_invoice_status back to SECURITY DEFINER, or
 * deleting/broadening one of the explicit REVOKE/GRANT statements — without
 * touching this file. It is a text-level invariant check, not a substitute
 * for running the queries in PART 11 against a real database after applying
 * the migration.
 */

const MIGRATION_PATH = path.resolve(process.cwd(), "supabase/migrations/0005_payments_billing.sql");
const sql = readFileSync(MIGRATION_PATH, "utf8");

/** Extracts the `create or replace function ... $$;` body for one function name, so assertions can be scoped to the right function instead of matching anywhere in the file. */
function functionBody(functionName: string): string {
  const start = sql.indexOf(`create or replace function public.${functionName}(`);
  expect(start, `expected to find a definition for public.${functionName}() in ${MIGRATION_PATH}`).toBeGreaterThan(-1);
  const end = sql.indexOf("\n$$;", start);
  expect(end, `expected to find the closing "$$;" for public.${functionName}()`).toBeGreaterThan(start);
  return sql.slice(start, end);
}

describe("0005_payments_billing.sql — security correction invariants", () => {
  it("recompute_invoice_status is SECURITY INVOKER, not SECURITY DEFINER", () => {
    const body = functionBody("recompute_invoice_status");
    expect(body).toMatch(/\bsecurity invoker\b/);
    expect(body).not.toMatch(/\bsecurity definer\b/);
  });

  it("recompute_invoice_status still pins search_path (defense in depth even under INVOKER)", () => {
    const body = functionBody("recompute_invoice_status");
    expect(body).toMatch(/set search_path = public/);
  });

  it("recompute_invoice_status raises rather than silently returning a null-filled row when the UPDATE affects zero rows", () => {
    const body = functionBody("recompute_invoice_status");
    expect(body).toMatch(/if v_invoice\.id is null then\s*\n\s*raise exception 'Invoice not found or you do not have permission to update it\.';/);
  });

  it("the other three privileged functions remain SECURITY DEFINER with a pinned search_path", () => {
    for (const name of ["next_invoice_number", "verify_checkout_payment", "apply_webhook_event"]) {
      const body = functionBody(name);
      expect(body, `${name} should still be SECURITY DEFINER`).toMatch(/\bsecurity definer\b/);
      expect(body, `${name} should still pin search_path`).toMatch(/set search_path = public/);
    }
  });

  it("PUBLIC's default EXECUTE grant is explicitly revoked from all four functions", () => {
    for (const signature of [
      "public.next_invoice_number()",
      "public.recompute_invoice_status(uuid)",
      "public.verify_checkout_payment(uuid, text, text, text)",
      "public.apply_webhook_event(text, text)",
    ]) {
      expect(sql).toContain(`revoke execute on function ${signature} from public;`);
    }
  });

  it("next_invoice_number, recompute_invoice_status, and verify_checkout_payment are granted to authenticated only", () => {
    for (const signature of [
      "public.next_invoice_number()",
      "public.recompute_invoice_status(uuid)",
      "public.verify_checkout_payment(uuid, text, text, text)",
    ]) {
      expect(sql).toContain(`grant execute on function ${signature} to authenticated;`);
      // None of these three should ever be granted to anon.
      expect(sql).not.toContain(`grant execute on function ${signature} to anon;`);
    }
  });

  it("apply_webhook_event is granted to anon only (the unauthenticated webhook route's actual Postgres role), never to authenticated", () => {
    expect(sql).toContain("grant execute on function public.apply_webhook_event(text, text) to anon;");
    expect(sql).not.toContain("grant execute on function public.apply_webhook_event(text, text) to authenticated;");
  });

  it("includes a has_function_privilege-based manual security verification section", () => {
    expect(sql).toMatch(/PART 11 — Security verification queries/);
    expect(sql).toContain("has_function_privilege(");
  });
});
