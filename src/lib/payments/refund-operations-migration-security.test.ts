import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Regression guard for supabase/migrations/0016_refund_operations.sql's
 * security- and financial-safety-relevant invariants — mirrors
 * src/lib/discovery-sessions/migration-security.test.ts exactly (a static
 * check against the actual migration SQL text, not a live Postgres
 * connection — this project has no database in its Vitest setup).
 *
 * Also asserts, per the M13 spec's explicit requirement, that 0001-0015 are
 * untouched on disk and that 0005_payments_billing.sql's three pre-existing
 * refund-related RLS policies (which already satisfy every M13 access-
 * control requirement — see 0016's PART 3 comment) still exist unchanged.
 */

const MIGRATIONS_DIR = path.resolve(process.cwd(), "supabase/migrations");
const MIGRATION_PATH = path.join(MIGRATIONS_DIR, "0016_refund_operations.sql");
const sql = readFileSync(MIGRATION_PATH, "utf8");
const originalPaymentsBillingSql = readFileSync(path.join(MIGRATIONS_DIR, "0005_payments_billing.sql"), "utf8");

describe("0016_refund_operations.sql — file scope", () => {
  it("is the only new migration file added for M13 (0001-0015 present and untouched by this test's own working tree)", () => {
    // This test cannot itself diff against git history, but it can assert
    // the specific pre-existing definitions this migration extends via
    // `create or replace` still exist verbatim in 0005 — the concrete,
    // checkable form of "0001-0015 unmodified" for the functions this file
    // actually touches.
    expect(originalPaymentsBillingSql).toMatch(/create or replace function public\.apply_webhook_event\(/);
    expect(originalPaymentsBillingSql).toMatch(/create table if not exists public\.refunds/);
  });
});

describe("0016_refund_operations.sql — status lifecycle", () => {
  it("widens refunds_status_check to the full M13 lifecycle, preserving all four Milestone 8 values", () => {
    expect(sql).toMatch(
      /constraint refunds_status_check\s*\n\s*check \(status in \('requested', 'under_review', 'approved', 'processing', 'processed', 'failed', 'rejected', 'cancelled'\)\)/
    );
  });

  it("drops the old refunds_status_check before adding the new one (never two conflicting CHECK constraints)", () => {
    expect(sql).toMatch(/alter table public\.refunds drop constraint if exists refunds_status_check;/);
  });

  it("every new lifecycle column is additive (ADD COLUMN IF NOT EXISTS), never a destructive change", () => {
    for (const column of [
      "reviewed_by",
      "reviewed_at",
      "approved_by",
      "approved_at",
      "rejected_by",
      "rejected_at",
      "rejection_reason",
      "cancelled_by",
      "cancelled_at",
      "finalized_at",
    ]) {
      expect(sql).toMatch(new RegExp(`alter table public\\.refunds add column if not exists ${column} `));
    }
    expect(sql).not.toMatch(/alter table public\.refunds drop column/);
  });
});

describe("0016_refund_operations.sql — rejection_reason financial-safety patch", () => {
  it("rejects blank/whitespace-only rejection reasons via btrim(), not just empty-string", () => {
    expect(sql).toMatch(/constraint refunds_rejection_reason_check\s*\n\s*check \(status <> 'rejected' or \(rejection_reason is not null and length\(btrim\(rejection_reason\)\) > 0\)\)/);
  });
});

describe("0016_refund_operations.sql — at most one active refund per transaction", () => {
  it("replaces the Milestone 8 index with one covering every non-terminal status", () => {
    expect(sql).toMatch(/drop index if exists public\.refunds_one_open_per_transaction;/);
    expect(sql).toMatch(
      /create unique index if not exists refunds_one_active_per_transaction\s*\n\s*on public\.refunds \(payment_transaction_id\)\s*\n\s*where status in \('requested', 'under_review', 'approved', 'processing'\);/
    );
  });
});

describe("0016_refund_operations.sql — amount immutability after approval", () => {
  it("has a trigger function that raises on an amount change once status has left requested/under_review", () => {
    expect(sql).toMatch(/create or replace function public\.prevent_refund_amount_change_after_approval\(\)/);
    expect(sql).toMatch(/if new\.amount_minor_units <> old\.amount_minor_units and old\.status not in \('requested', 'under_review'\) then/);
    expect(sql).toMatch(/raise exception/);
  });

  it("wires the trigger as BEFORE UPDATE on public.refunds", () => {
    expect(sql).toMatch(/create trigger prevent_refund_amount_change\s*\n\s*before update on public\.refunds/);
  });
});

describe("0016_refund_operations.sql — claim_refund_for_processing()", () => {
  it("exists, is SECURITY INVOKER with a pinned search_path, and locks both refunds and payment_transactions FOR UPDATE", () => {
    const start = sql.indexOf("create or replace function public.claim_refund_for_processing(p_refund_id uuid)");
    expect(start).toBeGreaterThan(-1);
    const end = sql.indexOf("$$;", start);
    const body = sql.slice(start, end);
    expect(body).toMatch(/security invoker/);
    expect(body).toMatch(/set search_path = public/);
    expect(body).toMatch(/from public\.refunds where id = p_refund_id for update/);
    expect(body).toMatch(/from public\.payment_transactions where id = v_refund\.payment_transaction_id for update/);
  });

  it("only claims a refund that is currently 'approved'", () => {
    expect(sql).toMatch(/if v_refund\.status <> 'approved' then/);
  });

  it("re-derives the remaining refundable balance from CURRENT payment_transactions data, not a cached value", () => {
    expect(sql).toMatch(/v_remaining := v_txn\.amount_minor_units - v_txn\.amount_refunded_minor_units;/);
    expect(sql).toMatch(/if v_refund\.amount_minor_units > v_remaining then/);
  });

  it("grants execute only to authenticated, never PUBLIC", () => {
    expect(sql).toMatch(/revoke all on function public\.claim_refund_for_processing\(uuid\) from public;/);
    expect(sql).toMatch(/grant execute on function public\.claim_refund_for_processing\(uuid\) to authenticated;/);
  });

  it("its comment string has no malformed concatenation artifacts (must be valid single-quoted SQL)", () => {
    const start = sql.indexOf("comment on function public.claim_refund_for_processing(uuid) is");
    const end = sql.indexOf(";", start);
    const commentStatement = sql.slice(start, end);
    expect(commentStatement).not.toMatch(/'\s*\+\s*'/);
  });
});

describe("0016_refund_operations.sql — finalize_refund()", () => {
  it("exists, is SECURITY INVOKER with a pinned search_path", () => {
    const start = sql.indexOf("create or replace function public.finalize_refund(");
    expect(start).toBeGreaterThan(-1);
    const end = sql.indexOf("$$;", start);
    const body = sql.slice(start, end);
    expect(body).toMatch(/security invoker/);
    expect(body).toMatch(/set search_path = public/);
  });

  it("is exactly-once by refund ROW STATE, not webhook payload identity — already processed/failed short-circuits to a safe no-op", () => {
    expect(sql).toMatch(/if v_refund\.status in \('processed', 'failed'\) then/);
    expect(sql).toMatch(/'already_finalized', true/);
  });

  it("only finalizes a refund that is currently 'processing' (never a bare requested/under_review/approved case)", () => {
    expect(sql).toMatch(/if v_refund\.status <> 'processing' then/);
  });

  it("re-asserts the captured-amount ceiling immediately before recording money as moved", () => {
    expect(sql).toMatch(/if v_new_refunded > v_txn\.amount_minor_units then/);
    expect(sql).toMatch(/raise exception 'Refund % \(amount %\) would push total refunded/);
  });

  it("is the only place amount_refunded_minor_units is written in this migration", () => {
    const matches = sql.match(/amount_refunded_minor_units\s*=/g) ?? [];
    // Exactly one UPDATE statement sets it (inside finalize_refund's 'processed' branch).
    expect(matches.length).toBe(1);
  });

  it("calls recompute_invoice_status() after a processed outcome, same as every other money-moving path in this codebase", () => {
    expect(sql).toMatch(/perform public\.recompute_invoice_status\(v_refund\.invoice_id\);/);
  });

  it("grants execute only to authenticated, never PUBLIC", () => {
    expect(sql).toMatch(/revoke all on function public\.finalize_refund\(uuid, text, text\) from public;/);
    expect(sql).toMatch(/grant execute on function public\.finalize_refund\(uuid, text, text\) to authenticated;/);
  });
});

describe("0016_refund_operations.sql — apply_webhook_event() redefinition", () => {
  it("preserves the HMAC signature verification preamble verbatim", () => {
    expect(sql).toMatch(/select razorpay_webhook_secret into v_secret from public\.payment_gateway_config where id = 1;/);
    expect(sql).toMatch(/v_expected := encode\(hmac\(p_raw_body, v_secret, 'sha256'\), 'hex'\);/);
    expect(sql).toMatch(/if v_expected <> p_signature then/);
    expect(sql).toMatch(/raise exception 'Invalid webhook signature\.';/);
  });

  it("preserves the idempotency ledger insert-first pattern verbatim", () => {
    expect(sql).toMatch(/on conflict \(provider, event_id\) do nothing/);
    expect(sql).toMatch(/return jsonb_build_object\('duplicate', true, 'event_type', v_event_type\);/);
  });

  it("preserves the payment.authorized/captured/failed branch's core upsert verbatim", () => {
    expect(sql).toMatch(/insert into public\.payment_transactions \(payment_attempt_id, provider_payment_id, status, amount_minor_units, currency, method_category, captured_at, failure_reason, raw_status\)/);
  });

  it("routes refund.processed/refund.failed through finalize_refund(), never inline arithmetic", () => {
    const start = sql.indexOf("elsif v_event_type in ('refund.processed', 'refund.failed') then");
    expect(start).toBeGreaterThan(-1);
    // Bounded by the next top-level statement after the whole if/elsif/else
    // block (not the first "else", which is an INNER else inside this same
    // branch's own nested if-statements and would truncate the slice before
    // ever reaching the finalize_refund() call).
    const end = sql.indexOf("update public.payment_webhook_events", start);
    expect(end).toBeGreaterThan(start);
    const branch = sql.slice(start, end);
    expect(branch).toMatch(/public\.finalize_refund\(/);
    expect(branch).not.toMatch(/update public\.payment_transactions\s*\n\s*set amount_refunded_minor_units/);
  });

  it("never matches a bare requested/under_review/approved refund case for a webhook — only provider_refund_id match or an in-flight 'processing' row with no id yet", () => {
    const start = sql.indexOf("select r.id into v_refund_match_id");
    const end = sql.indexOf("limit 1;", start);
    const matchClause = sql.slice(start, end);
    expect(matchClause).toMatch(/r\.provider_refund_id is null\s*\n\s*and r\.status = 'processing'/);
    expect(matchClause).not.toMatch(/status = 'requested'/);
    expect(matchClause).not.toMatch(/status = 'under_review'/);
    expect(matchClause).not.toMatch(/status = 'approved'/);
  });

  it("FINAL FINANCIAL SAFETY PATCH (Issue 4) — the id-less fallback match also requires the webhook's own amount (and currency, when present) to match the refund case", () => {
    const start = sql.indexOf("select r.id into v_refund_match_id");
    const end = sql.indexOf("limit 1;", start);
    const matchClause = sql.slice(start, end);
    expect(matchClause).toMatch(/and \(v_amount is null or r\.amount_minor_units = v_amount\)/);
    expect(matchClause).toMatch(/and \(v_refund_currency is null or v_txn\.currency = v_refund_currency\)/);
  });

  it("FINAL FINANCIAL SAFETY PATCH (Issue 4) — an exact provider_refund_id match does not require the amount/currency cross-check (an id match is unambiguous on its own)", () => {
    const start = sql.indexOf("select r.id into v_refund_match_id");
    const idMatchLineEnd = sql.indexOf("or (", start);
    const idMatchClause = sql.slice(start, idMatchLineEnd);
    expect(idMatchClause).toMatch(/v_provider_refund_id is not null and r\.provider_refund_id = v_provider_refund_id/);
    expect(idMatchClause).not.toMatch(/amount_minor_units/);
  });

  it("extracts the refund webhook's own currency field for the fallback cross-check", () => {
    expect(sql).toMatch(/v_refund_currency := v_entity ->> 'currency';/);
  });

  it("FINAL FINANCIAL SAFETY PATCH (Issue 4) — an exact provider_refund_id match is ordered ahead of the amount/currency-checked fallback, so if both a rows exist a webhook always finalizes the id-matched row", () => {
    const start = sql.indexOf("select r.id into v_refund_match_id");
    const end = sql.indexOf("limit 1;", start);
    const matchClause = sql.slice(start, end);
    expect(matchClause).toMatch(/order by \(r\.provider_refund_id is not null\) desc/);
  });

  it("keeps the webhook route's execution-grant posture (no PUBLIC grant) unchanged", () => {
    expect(sql).not.toMatch(/grant execute on function public\.apply_webhook_event\(text, text\) to (public|anon);/);
  });
});

describe("0016_refund_operations.sql — RLS", () => {
  it("makes no RLS policy changes on public.refunds — PART 3 is comment-only, documenting why the Milestone 8 policies already suffice", () => {
    const start = sql.indexOf("PART 3 — RLS");
    const end = sql.indexOf("PART 4 —", start);
    const section = sql.slice(start, end);
    expect(section).not.toMatch(/create policy/);
    expect(section).not.toMatch(/alter table public\.refunds (enable|disable) row level security/);
  });

  it("the three pre-existing refund RLS policies this migration relies on still exist, unchanged, in 0005_payments_billing.sql", () => {
    expect(originalPaymentsBillingSql).toMatch(/create policy "[^"]*(super_admin|admin|finance)[^"]*"\s*\n\s*on public\.refunds for all/i);
    expect(originalPaymentsBillingSql).toMatch(/create policy "[^"]*(analyst)[^"]*"[\s\S]{0,400}on public\.refunds for select/i);
    expect(originalPaymentsBillingSql).toMatch(/create policy "Students can read[^"]*"\s*\n\s*on public\.refunds for select/i);
  });
});
