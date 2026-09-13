-- ============================================================================
-- Milestone 13 — Refund Operations (financial-safety-first)
--
-- HOW TO RUN THIS (no SQL knowledge required):
--   1. Open your Supabase project dashboard (supabase.com/dashboard).
--   2. Click "SQL Editor" in the left sidebar.
--   3. Click "New query".
--   4. Paste the entire contents of this file.
--   5. Click "Run".
--
-- This migration does NOT modify 0001-0015 in place — every file from
-- 0001_profiles.sql through 0015_discovery_session_duplicate_booking_guard.sql
-- is untouched on disk. It only ADDS columns/constraints/indexes/functions to
-- the `public.refunds` table Milestone 8 (0005_payments_billing.sql PART 7)
-- already created, and REDEFINES (via `create or replace function`, the
-- normal Postgres way to extend a function from a later migration —
-- 0006/0009/0013/0014 all do the same thing to functions/policies an earlier
-- migration first created) the existing `public.apply_webhook_event()`
-- webhook entry point so its refund.processed/refund.failed handling routes
-- through the new exactly-once finalizer below instead of the inline
-- arithmetic it used to do directly. See src/lib/payments/refund-operations-
-- migration-security.test.ts for the automated regression guard that 0001-
-- 0015 remain byte-for-byte unmodified and that the invariants below hold.
--
-- THE CORE PROBLEM THIS MIGRATION FIXES
--
-- The Milestone 8 refund flow (still present, unchanged, in the four
-- statuses `requested`/`processing`/`processed`/`failed`) called
-- gateway.createRefund() synchronously from inside initiateRefund() and, on
-- ANY thrown error — a definite provider rejection OR a network timeout
-- where Razorpay may have silently created the refund anyway — immediately
-- marked the refund `failed`. That is unsafe: a timed-out request that
-- actually succeeded on Razorpay's side would leave this system able to
-- accept a second refund request for the same money. This migration adds:
--   1. A superset status lifecycle (PART 1) with admin review/approval
--      before any gateway call happens at all.
--   2. A database-authoritative "claim" RPC (PART 4) that re-locks and
--      re-validates the remaining refundable balance immediately before the
--      gateway is ever called — closing the "another refund finished in the
--      meantime" race.
--   3. A single, idempotent "finalize" RPC (PART 5) that is the ONLY place
--      amount_refunded_minor_units is ever incremented, called identically
--      by the synchronous gateway response, the webhook, and manual
--      reconciliation — closing every double-accounting race between them.
--
-- FINAL FINANCIAL SAFETY PATCH (applied before this migration was ever
-- installed against a real database — no 0017 was created; this file was
-- patched in place):
--   4. The refund.processed/refund.failed webhook's id-less fallback match
--      (PART 6) now also requires the webhook's own refund amount — and
--      currency, when present — to match the refund case's own recorded
--      amount/currency before finalizing it, closing a theoretical
--      wrong-case-finalized gap in the fallback path.
--   (The other three parts of this patch — never finalizing a merely
--   `pending` synchronous createRefund() response as processed, atomic
--   database-authoritative status transitions for review/approve/reject/
--   cancel, and checking gateway configuration before claiming a case for
--   processing — are entirely application-layer changes in
--   src/lib/supabase/admin/refunds.ts; see that file's own docblock and
--   docs/payments-billing-guide.md §25.)
-- ============================================================================


-- ============================================================================
-- PART 1 — Extend public.refunds with the full lifecycle
--
-- Superset of the Milestone 8 four-value lifecycle (requested / processing /
-- processed / failed, all preserved as-is) adding: under_review, approved,
-- rejected, cancelled. Every new column is nullable and additive — no
-- existing row's meaning changes, and every Milestone 8 refund row (whatever
-- status it is in) remains valid under the new, wider CHECK constraint
-- below.
-- ============================================================================

alter table public.refunds add column if not exists reviewed_by uuid references auth.users (id) on delete set null;
alter table public.refunds add column if not exists reviewed_at timestamptz;
alter table public.refunds add column if not exists approved_by uuid references auth.users (id) on delete set null;
alter table public.refunds add column if not exists approved_at timestamptz;
alter table public.refunds add column if not exists rejected_by uuid references auth.users (id) on delete set null;
alter table public.refunds add column if not exists rejected_at timestamptz;
alter table public.refunds add column if not exists rejection_reason text;
alter table public.refunds add column if not exists cancelled_by uuid references auth.users (id) on delete set null;
alter table public.refunds add column if not exists cancelled_at timestamptz;
-- Set exactly once, by finalize_refund() (PART 5) only, the moment a refund
-- reaches a TERMINAL outcome that finalizer decided (processed or a
-- definite failed) — never touched by the claim RPC or by approve/reject/
-- cancel. Doubles as a human-auditable "this is when money-moving certainty
-- was reached" timestamp distinct from updated_at (which changes on every
-- lifecycle step).
alter table public.refunds add column if not exists finalized_at timestamptz;

comment on column public.refunds.rejection_reason is
  'Required (non-blank — see refunds_rejection_reason_check below) when status = ''rejected''. Student-visible verbatim (src/lib/supabase/payments/student-invoices.ts) — never put internal-only context here; use admin_audit_log context for that instead (see docs/payments-billing-guide.md §25).';
comment on column public.refunds.finalized_at is
  'Set exactly once by finalize_refund() when a refund reaches processed or a definite failed — the money-moved-or-definitively-did-not-move moment. Never set by any other code path.';

-- Widen the status CHECK constraint to the full M13 lifecycle. All four
-- original values are preserved verbatim so no existing row is invalidated.
alter table public.refunds drop constraint if exists refunds_status_check;
alter table public.refunds add constraint refunds_status_check
  check (status in ('requested', 'under_review', 'approved', 'processing', 'processed', 'failed', 'rejected', 'cancelled'));

-- Financial-safety patch — strengthen rejection_reason validation against
-- blank/whitespace-only values. btrim() (not just checking for '') so
-- " " / "\t\n" cannot slip through as a "reason".
alter table public.refunds drop constraint if exists refunds_rejection_reason_check;
alter table public.refunds add constraint refunds_rejection_reason_check
  check (status <> 'rejected' or (rejection_reason is not null and length(btrim(rejection_reason)) > 0));

-- Replaces Milestone 8's refunds_one_open_per_transaction (which only
-- covered requested/processing) with one covering every NON-TERMINAL status
-- in the wider lifecycle — requested, under_review, approved, processing.
-- This is section 11's "at most one active refund case per transaction"
-- requirement; it is necessary but (per section 11's own note, and PART 4/5
-- below) NOT sufficient on its own for financial safety.
drop index if exists public.refunds_one_open_per_transaction;
create unique index if not exists refunds_one_active_per_transaction
  on public.refunds (payment_transaction_id)
  where status in ('requested', 'under_review', 'approved', 'processing');

comment on table public.refunds is
  'Milestone 8 fields preserved as-is; Milestone 13 (Refund Operations) adds full admin review/approval lifecycle columns and the exactly-once finalization machinery in PART 4/5 below. refunds_one_active_per_transaction: at most one non-terminal (requested/under_review/approved/processing) refund case may exist per payment_transaction at a time — necessary but not sufficient for financial safety; see claim_refund_for_processing()/finalize_refund() for the actual process-time revalidation and exactly-once accounting.';


-- ============================================================================
-- PART 2 — Amount immutability after approval
--
-- Section 13: "Once approved, the amount must become immutable... Implement
-- database protection so amount cannot quietly change after approval." A
-- refund's amount may still be adjusted by an admin while it sits at
-- `requested`/`under_review` (the review step is exactly where a requested
-- amount gets corrected before approval); once it has ever been approved
-- (i.e. leaves requested/under_review), no code path — including a bug —
-- may change amount_minor_units again.
-- ============================================================================

create or replace function public.prevent_refund_amount_change_after_approval()
returns trigger
language plpgsql
as $$
begin
  if new.amount_minor_units <> old.amount_minor_units and old.status not in ('requested', 'under_review') then
    raise exception 'A refund amount cannot be changed once it has left requested/under_review (current status: %).', old.status;
  end if;
  return new;
end;
$$;

comment on function public.prevent_refund_amount_change_after_approval() is
  'Milestone 13 — enforces that refunds.amount_minor_units is immutable from the moment a case is approved onward. Fires on every UPDATE, not just admin-initiated ones, so this holds regardless of which code path attempts the change.';

drop trigger if exists prevent_refund_amount_change on public.refunds;
create trigger prevent_refund_amount_change
  before update on public.refunds
  for each row execute function public.prevent_refund_amount_change_after_approval();


-- ============================================================================
-- PART 3 — RLS
--
-- No RLS policy changes are needed. Milestone 8's existing policies already
-- match the M13 spec's access model exactly:
--   - "super_admin/admin/finance can write refunds" (FOR ALL) already covers
--     every new lifecycle write (review/approve/reject/cancel/claim/
--     finalize) for exactly the three roles the spec names as authorized —
--     counsellor and content_editor/analyst are NOT in that list, so
--     counsellor correctly has zero financial refund authority (spec §35)
--     without any change here.
--   - "super_admin/admin/finance/analyst can read refunds" already grants
--     analyst read-only visibility, matching spec §35's "Analyst may be
--     read-only only if existing conventions permit it" — this repo's
--     existing convention already does.
--   - "Students can read refunds on their own invoices" already scopes
--     student visibility correctly (via invoices.student_user_id = auth.uid()),
--     satisfying spec §33/§47 (IDOR protection) with no change.
-- src/lib/payments/refund-operations-migration-security.test.ts asserts
-- these three policy names still exist unchanged in 0005_payments_billing.sql
-- as the automated guard for this claim.
-- ============================================================================


-- ============================================================================
-- PART 4 — claim_refund_for_processing(): the database-authoritative
-- processing claim (spec §16/§17 — "THIS IS THE MOST IMPORTANT PART").
--
-- Must run BEFORE any Razorpay call. Locks the refund row AND its related
-- payment_transaction row (FOR UPDATE — real Postgres row locks, not an
-- application-level check-then-update), re-verifies the transaction is
-- still technically refundable, RE-READS the authoritative amount already
-- refunded (which may have changed since this refund was approved, if
-- another refund on the same transaction completed asynchronously in the
-- meantime), and only then atomically flips this refund to `processing`.
--
-- Two concurrent calls for the SAME refund: the second blocks on the FOR
-- UPDATE lock until the first's transaction commits, then re-reads
-- status='processing' (not 'approved') and fails its own status check — so
-- only one caller can ever successfully claim a given refund, satisfying
-- spec §46.A/§46.B (double-click / two admins).
-- ============================================================================

create or replace function public.claim_refund_for_processing(p_refund_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_refund public.refunds;
  v_txn public.payment_transactions;
  v_remaining bigint;
begin
  if auth.uid() is not null and not public.is_admin_role(array['super_admin', 'admin', 'finance']) then
    raise exception 'You are not authorized to process refunds.';
  end if;

  select * into v_refund from public.refunds where id = p_refund_id for update;
  if v_refund.id is null then
    raise exception 'Refund not found.';
  end if;

  if v_refund.status <> 'approved' then
    raise exception 'Refund % is not approved (current status: %) — it cannot be claimed for processing.', p_refund_id, v_refund.status;
  end if;

  select * into v_txn from public.payment_transactions where id = v_refund.payment_transaction_id for update;
  if v_txn.id is null then
    raise exception 'Related payment transaction not found.';
  end if;

  if v_txn.is_manual or v_txn.provider_payment_id is null then
    raise exception 'This payment has no gateway payment id and cannot be refunded through the payment gateway.';
  end if;

  if v_txn.status not in ('captured', 'partially_refunded') then
    raise exception 'The underlying payment is no longer in a refundable state (current status: %).', v_txn.status;
  end if;

  -- Process-time revalidation (spec §17): re-derive the remaining
  -- refundable balance from the CURRENT authoritative row, not whatever was
  -- true when this refund was approved. A previous refund on this same
  -- transaction may have finished (via webhook) after approval.
  v_remaining := v_txn.amount_minor_units - v_txn.amount_refunded_minor_units;

  if v_refund.amount_minor_units <= 0 then
    raise exception 'Refund amount must be greater than zero.';
  end if;

  if v_refund.amount_minor_units > v_remaining then
    raise exception 'Cannot process this refund: the remaining refundable balance is now % (in the payment''s minor currency units), less than the approved amount %. Another refund likely completed since this one was approved — cancel this case and open a new one for the correct amount.',
      v_remaining, v_refund.amount_minor_units;
  end if;

  update public.refunds
    set status = 'processing', updated_at = now()
    where id = p_refund_id
    returning * into v_refund;

  return jsonb_build_object(
    'refund_id', v_refund.id,
    'payment_transaction_id', v_txn.id,
    'provider_payment_id', v_txn.provider_payment_id,
    'amount_minor_units', v_refund.amount_minor_units,
    'currency', v_txn.currency
  );
end;
$$;

comment on function public.claim_refund_for_processing(uuid) is
  'Milestone 13 — the ONLY safe way to move a refund from approved to processing. Locks refunds + payment_transactions FOR UPDATE, re-validates technical refundability and remaining balance against CURRENT authoritative data, and only then flips status. Must be called, and must succeed, before src/lib/payments''s gateway.createRefund() is ever invoked (src/lib/supabase/admin/refunds.ts processApprovedRefund()). Returns the authoritative provider_payment_id/amount/currency so the caller cannot substitute browser-supplied values for the gateway call.';

revoke all on function public.claim_refund_for_processing(uuid) from public;
grant execute on function public.claim_refund_for_processing(uuid) to authenticated;


-- ============================================================================
-- PART 5 — finalize_refund(): the single, exactly-once accounting authority
-- (spec §21/§22/§23/§24/§25/§26/§27 — "Do NOT duplicate accounting logic").
--
-- This is the ONLY place amount_refunded_minor_units is ever incremented.
-- Called identically from three places (src/lib/supabase/admin/refunds.ts):
--   1. processApprovedRefund() — synchronous gateway response says "processed"
--   2. apply_webhook_event() (PART 6 below) — verified refund.processed/failed
--   3. reconcileRefund() — manual "check with Razorpay" action
--
-- Exactly-once is enforced by checking the REFUND ROW'S OWN STATE
-- (already processed/failed => safe no-op), never by comparing webhook
-- payload bytes — so a logically-duplicate refund.processed webhook with a
-- different raw body (different timestamp/nonce/whatever) is just as safe a
-- no-op as a byte-identical redelivery (spec §25), and a synchronous-
-- response/webhook race or a reconcile/webhook race both collapse to "the
-- second caller sees an already-terminal row and returns already_finalized"
-- (spec §23/§24).
--
-- Authorization: mirrors the existing, already-reviewed precedent in
-- 0005_payments_billing.sql PART 6.5 (recompute_invoice_status) exactly —
-- SECURITY INVOKER, with an explicit admin-role check that only applies
-- when there IS a caller session (auth.uid() is not null). The one caller
-- with no session at all is apply_webhook_event() (SECURITY DEFINER, so by
-- the time it calls this function the effective role is already that
-- function owner's elevated, RLS-bypassing role — same mechanism the 0005
-- comment documents for its own nested call to recompute_invoice_status)
-- and that caller has ALREADY independently re-verified Razorpay''s HMAC
-- signature before ever reaching this call — "the verification IS the
-- authorization", the same phrase 0005 uses to justify apply_webhook_event
-- itself accepting a sessionless caller.
-- ============================================================================

create or replace function public.finalize_refund(
  p_refund_id uuid,
  p_provider_refund_id text,
  p_outcome text
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_refund public.refunds;
  v_txn public.payment_transactions;
  v_new_refunded bigint;
  v_new_txn_status text;
begin
  if p_outcome not in ('processed', 'failed') then
    raise exception 'finalize_refund: invalid outcome "%" (must be processed or failed).', p_outcome;
  end if;

  if auth.uid() is not null and not public.is_admin_role(array['super_admin', 'admin', 'finance']) then
    raise exception 'You are not authorized to finalize refunds.';
  end if;

  select * into v_refund from public.refunds where id = p_refund_id for update;
  if v_refund.id is null then
    raise exception 'Refund not found.';
  end if;

  select * into v_txn from public.payment_transactions where id = v_refund.payment_transaction_id for update;
  if v_txn.id is null then
    raise exception 'Related payment transaction not found.';
  end if;

  -- Exactly-once, by REFUND STATE — a refund already in a terminal outcome
  -- is a safe no-op no matter how many times, or by which of the three
  -- callers, this is invoked again for it.
  if v_refund.status in ('processed', 'failed') then
    return jsonb_build_object(
      'already_finalized', true,
      'refund_id', v_refund.id,
      'status', v_refund.status,
      'amount_refunded_minor_units', v_txn.amount_refunded_minor_units
    );
  end if;

  -- Only a refund that actually reached provider processing may be
  -- finalized (spec §26/§29) — a bare requested/under_review/approved case
  -- has not been sent to the provider yet and has no business being
  -- terminated by a provider event or a reconcile call.
  if v_refund.status <> 'processing' then
    raise exception 'Refund % is not in a finalizable state (current status: %).', p_refund_id, v_refund.status;
  end if;

  if p_outcome = 'failed' then
    update public.refunds
      set status = 'failed',
          provider_refund_id = coalesce(v_refund.provider_refund_id, p_provider_refund_id),
          finalized_at = now(),
          updated_at = now()
      where id = p_refund_id
      returning * into v_refund;

    return jsonb_build_object(
      'already_finalized', false,
      'refund_id', v_refund.id,
      'status', v_refund.status,
      'amount_refunded_minor_units', v_txn.amount_refunded_minor_units
    );
  end if;

  -- p_outcome = 'processed'.
  v_new_refunded := v_txn.amount_refunded_minor_units + v_refund.amount_minor_units;

  -- Last-line-of-defense re-assertion immediately before money is recorded
  -- as moved. claim_refund_for_processing() already checked this before the
  -- gateway call; re-checking here costs nothing and means a bug anywhere
  -- upstream can never actually push recorded refunds past the captured
  -- amount (spec §8/§66.3).
  if v_new_refunded > v_txn.amount_minor_units then
    raise exception 'Refund % (amount %) would push total refunded (%) past the captured amount (%) for transaction % — refusing to finalize.',
      p_refund_id, v_refund.amount_minor_units, v_new_refunded, v_txn.amount_minor_units, v_txn.id;
  end if;

  v_new_txn_status := case when v_new_refunded >= v_txn.amount_minor_units then 'refunded' else 'partially_refunded' end;

  update public.payment_transactions
    set amount_refunded_minor_units = v_new_refunded,
        status = v_new_txn_status,
        updated_at = now()
    where id = v_txn.id;

  update public.refunds
    set status = 'processed',
        provider_refund_id = coalesce(v_refund.provider_refund_id, p_provider_refund_id),
        finalized_at = now(),
        updated_at = now()
    where id = p_refund_id
    returning * into v_refund;

  perform public.recompute_invoice_status(v_refund.invoice_id);

  return jsonb_build_object(
    'already_finalized', false,
    'refund_id', v_refund.id,
    'status', v_refund.status,
    'amount_refunded_minor_units', v_new_refunded
  );
end;
$$;

comment on function public.finalize_refund(uuid, text, text) is
  'Milestone 13 — the ONLY place amount_refunded_minor_units is ever incremented. Idempotent by refund-row state (processed/failed = safe no-op returning already_finalized:true), never by webhook-payload identity, so a logically-duplicate refund.processed event (different raw body, same meaning) is exactly as safe as a byte-identical redelivery. Shared by the synchronous gateway-response path, apply_webhook_event(), and manual reconciliation — see docs/payments-billing-guide.md §25.';

revoke all on function public.finalize_refund(uuid, text, text) from public;
grant execute on function public.finalize_refund(uuid, text, text) to authenticated;


-- ============================================================================
-- PART 6 — apply_webhook_event(): route refund.processed/refund.failed
-- through finalize_refund() instead of the Milestone 8 inline arithmetic.
--
-- This is a `create or replace function` of the SAME name/signature
-- (text, text) -> jsonb that 0005_payments_billing.sql PART 8 originally
-- defined — the standard Postgres way to extend a function from a later
-- migration (see this file's header comment for the other precedents in
-- this codebase). Every other branch (payment.authorized/captured/failed,
-- the HMAC signature verification, the payment_webhook_events idempotency
-- ledger insert-first pattern) is copied verbatim, UNCHANGED, from the
-- current production definition — only the refund.processed/refund.failed
-- branch's body is different. See src/lib/payments/refund-operations-
-- migration-security.test.ts for an automated diff-style guard confirming
-- the payment.* branch and the HMAC verification preamble are byte-for-byte
-- identical to the 0005 original.
-- ============================================================================

create or replace function public.apply_webhook_event(
  p_raw_body text,
  p_signature text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_secret text;
  v_expected text;
  v_body jsonb;
  v_event_type text;
  v_fingerprint text;
  v_entity jsonb;
  v_provider_payment_id text;
  v_provider_order_id text;
  v_provider_refund_id text;
  v_amount bigint;
  v_currency text;
  v_refund_currency text;
  v_method text;
  v_attempt public.payment_attempts;
  v_txn public.payment_transactions;
  v_status text;
  v_diagnostic text := null;
  v_processing_status text := 'ignored';
  v_related_invoice_id uuid := null;
  v_related_attempt_id uuid := null;
  v_related_txn_id uuid := null;
  v_refund_match_id uuid;
  v_finalize_result jsonb;
  v_webhook_event_id uuid;
begin
  if p_raw_body is null or p_signature is null then
    raise exception 'Missing webhook body or signature.';
  end if;

  select razorpay_webhook_secret into v_secret from public.payment_gateway_config where id = 1;
  if v_secret is null or length(trim(v_secret)) = 0 then
    raise exception 'Payment gateway webhook is not configured.';
  end if;

  v_expected := encode(hmac(p_raw_body, v_secret, 'sha256'), 'hex');
  if v_expected <> p_signature then
    raise exception 'Invalid webhook signature.';
  end if;

  begin
    v_body := p_raw_body::jsonb;
  exception when others then
    raise exception 'Webhook body is not valid JSON.';
  end;

  v_event_type := v_body ->> 'event';
  v_fingerprint := encode(digest(p_raw_body, 'sha256'), 'hex');

  insert into public.payment_webhook_events (provider, event_id, event_type, processing_status)
  values ('razorpay', v_fingerprint, coalesce(v_event_type, 'unknown'), 'received')
  on conflict (provider, event_id) do nothing
  returning id into v_webhook_event_id;

  if v_webhook_event_id is null then
    return jsonb_build_object('duplicate', true, 'event_type', v_event_type);
  end if;

  if v_event_type in ('payment.authorized', 'payment.captured', 'payment.failed') then
    v_entity := v_body #> '{payload,payment,entity}';
    v_provider_payment_id := v_entity ->> 'id';
    v_provider_order_id := v_entity ->> 'order_id';
    v_amount := nullif(v_entity ->> 'amount', '')::bigint;
    v_currency := coalesce(v_entity ->> 'currency', 'INR');
    v_method := v_entity ->> 'method';

    if v_provider_payment_id is null or v_provider_order_id is null then
      v_diagnostic := 'Missing payment/order id in payload.';
    else
      select * into v_attempt from public.payment_attempts where provider_order_id = v_provider_order_id;
      if v_attempt.id is null then
        v_diagnostic := 'No matching payment_attempts row for this order — event ignored.';
      else
        v_status := case v_event_type
          when 'payment.authorized' then 'authorized'
          when 'payment.captured' then 'captured'
          when 'payment.failed' then 'failed'
        end;

        insert into public.payment_transactions (payment_attempt_id, provider_payment_id, status, amount_minor_units, currency, method_category, captured_at, failure_reason, raw_status)
        values (
          v_attempt.id, v_provider_payment_id, v_status, coalesce(v_amount, v_attempt.amount_minor_units), v_currency, v_method,
          case when v_status = 'captured' then now() else null end,
          case when v_status = 'failed' then left(coalesce(v_entity ->> 'error_description', 'Payment failed.'), 500) else null end,
          v_event_type
        )
        on conflict (provider_payment_id) where provider_payment_id is not null do update
          set status = case
                when public.payment_transactions.status = 'captured' and excluded.status = 'authorized' then public.payment_transactions.status
                when public.payment_transactions.status in ('failed') then public.payment_transactions.status
                else excluded.status
              end,
              captured_at = coalesce(public.payment_transactions.captured_at, excluded.captured_at),
              failure_reason = coalesce(excluded.failure_reason, public.payment_transactions.failure_reason),
              raw_status = excluded.raw_status,
              updated_at = now()
        returning * into v_txn;

        update public.payment_attempts
          set status = case when v_status = 'authorized' and status = 'captured' then status else v_status end
          where id = v_attempt.id
          returning * into v_attempt;

        perform public.recompute_invoice_status(v_attempt.invoice_id);

        v_related_invoice_id := v_attempt.invoice_id;
        v_related_attempt_id := v_attempt.id;
        v_related_txn_id := v_txn.id;
        v_processing_status := 'processed';
      end if;
    end if;

  elsif v_event_type in ('refund.processed', 'refund.failed') then
    v_entity := v_body #> '{payload,refund,entity}';
    v_provider_refund_id := v_entity ->> 'id';
    v_provider_payment_id := v_entity ->> 'payment_id';
    v_amount := nullif(v_entity ->> 'amount', '')::bigint;
    -- Milestone 13 FINAL FINANCIAL SAFETY PATCH (Issue 4) — Razorpay's
    -- refund entity carries its own `currency` field (see
    -- node_modules/razorpay/dist/types/refunds.d.ts's RazorpayRefund).
    -- Captured here so the id-less fallback match below can cross-check it
    -- against the matched payment_transaction's currency when present.
    v_refund_currency := v_entity ->> 'currency';

    if v_provider_payment_id is null then
      v_diagnostic := 'Missing payment id in refund payload.';
    else
      select * into v_txn from public.payment_transactions where provider_payment_id = v_provider_payment_id;
      if v_txn.id is null then
        v_diagnostic := 'No matching payment_transactions row for this refund — event ignored.';
      else
        -- Refund matching (spec §29, strengthened by the FINAL FINANCIAL
        -- SAFETY PATCH's Issue 4): prefer an exact provider_refund_id match
        -- (already recorded — e.g. the synchronous createRefund() response,
        -- including a 'pending' one, already stored it — see
        -- src/lib/supabase/admin/refunds.ts's processApprovedRefund()) — an
        -- id match is unambiguous on its own and needs no further
        -- corroboration. Fall back, ONLY when no id match
        -- exists, to "exactly one PROCESSING refund on this transaction
        -- with no provider_refund_id yet, whose recorded amount (and
        -- currency, when the payload supplies one) matches this webhook
        -- payload" — the uncertain-outcome case (spec §20) where the id was
        -- never captured because the create-refund response was lost. The
        -- amount/currency cross-check means a fallback match can never
        -- silently finalize the wrong case with the wrong amount even in
        -- the (currently impossible, given refunds_one_active_per_transaction)
        -- event of ambiguity. Never matches a bare requested/under_review/
        -- approved case — only a refund that actually reached provider
        -- processing may be finalized (spec §26/§29).
        select r.id into v_refund_match_id
        from public.refunds r
        where r.payment_transaction_id = v_txn.id
          and (
            (v_provider_refund_id is not null and r.provider_refund_id = v_provider_refund_id)
            or (
              r.provider_refund_id is null
              and r.status = 'processing'
              and (v_amount is null or r.amount_minor_units = v_amount)
              and (v_refund_currency is null or v_txn.currency = v_refund_currency)
            )
          )
        order by (r.provider_refund_id is not null) desc
        limit 1;

        if v_refund_match_id is null then
          v_diagnostic := 'No matching in-flight (processing) refund found for this webhook — ignored.';
        else
          v_finalize_result := public.finalize_refund(
            v_refund_match_id,
            v_provider_refund_id,
            case when v_event_type = 'refund.processed' then 'processed' else 'failed' end
          );

          select * into v_attempt from public.payment_attempts where id = v_txn.payment_attempt_id;
          v_related_invoice_id := v_attempt.invoice_id;
          v_related_attempt_id := v_attempt.id;
          v_related_txn_id := v_txn.id;
          v_processing_status := 'processed';
        end if;
      end if;
    end if;

  else
    v_diagnostic := 'Event type not relevant to this system — recorded, not processed.';
  end if;

  update public.payment_webhook_events
    set processing_status = v_processing_status,
        related_invoice_id = v_related_invoice_id,
        related_payment_attempt_id = v_related_attempt_id,
        related_payment_transaction_id = v_related_txn_id,
        diagnostic_message = v_diagnostic,
        payload_summary = jsonb_build_object(
          'event', v_event_type,
          'provider_payment_id', v_provider_payment_id,
          'provider_order_id', v_provider_order_id,
          'provider_refund_id', v_provider_refund_id,
          'amount_minor_units', v_amount
        ),
        processed_at = now()
    where id = v_webhook_event_id;

  return jsonb_build_object('duplicate', false, 'event_type', v_event_type, 'processing_status', v_processing_status);
end;
$$;

comment on function public.apply_webhook_event(text, text) is
  'The only entry point for Razorpay webhook deliveries. Unchanged from the Milestone 8 original for HMAC verification, idempotency ledger, and payment.* handling. Milestone 13 change: refund.processed/refund.failed now match an in-flight refund (never a bare requested/under_review/approved case) and finalize it via finalize_refund() (PART 5) — the same exactly-once authority the synchronous gateway-response path and manual reconciliation use — instead of incrementing amount_refunded_minor_units inline.';

-- Preserve the exact execution-grant posture the Milestone 8 original had —
-- see 0005_payments_billing.sql PART 9.5's audit summary. No PUBLIC grant;
-- this function is invoked only via the anonymous-but-HMAC-verified webhook
-- route (src/app/api/webhooks/razorpay/route.ts), which calls it through
-- supabase.rpc() using the publishable-key client — the same posture as
-- every other RPC in this project.


-- ============================================================================
-- PART 7 — Indexes for the new admin refunds workspace (spec §34: list,
-- filter, search).
-- ============================================================================

create index if not exists refunds_status_created_idx on public.refunds (status, created_at desc);


-- ============================================================================
-- BOOTSTRAP / MANUAL VERIFICATION
--
-- No manual bootstrap step is required — this migration reuses the existing
-- payment_gateway_config row from 0005_payments_billing.sql (already
-- populated as part of Milestone 8 setup) and defines no new secrets table.
--
-- Run these after applying, to confirm the migration landed correctly
-- (also documented in M13_INSTALL_INSTRUCTIONS.md):
--
--   -- 1. Status constraint covers the full lifecycle:
--   select conname, pg_get_constraintdef(oid) from pg_constraint
--     where conrelid = 'public.refunds'::regclass and conname = 'refunds_status_check';
--
--   -- 2. Lifecycle columns exist:
--   select column_name from information_schema.columns
--     where table_schema = 'public' and table_name = 'refunds'
--     order by column_name;
--
--   -- 3. Rejection-reason constraint blocks whitespace-only reasons:
--   select conname, pg_get_constraintdef(oid) from pg_constraint
--     where conrelid = 'public.refunds'::regclass and conname = 'refunds_rejection_reason_check';
--
--   -- 4. Active-refund unique index exists (old one gone):
--   select indexname, indexdef from pg_indexes
--     where schemaname = 'public' and tablename = 'refunds' and indexname like 'refunds_%';
--
--   -- 5. Amount-immutability trigger exists:
--   select tgname from pg_trigger where tgrelid = 'public.refunds'::regclass and not tgisinternal;
--
--   -- 6. Claim + finalize RPCs exist, with the expected argument types:
--   select proname, pg_get_function_identity_arguments(oid) from pg_proc
--     where pronamespace = 'public'::regnamespace and proname in ('claim_refund_for_processing', 'finalize_refund');
--
--   -- 7. Execute grants: authenticated only, never PUBLIC:
--   select routine_name, grantee, privilege_type from information_schema.routine_privileges
--     where routine_schema = 'public' and routine_name in ('claim_refund_for_processing', 'finalize_refund');
--
--   -- 8. search_path is pinned on every new/redefined function (defense
--   --    against search_path hijacking in a SECURITY DEFINER function):
--   select proname, proconfig from pg_proc
--     where pronamespace = 'public'::regnamespace
--       and proname in ('claim_refund_for_processing', 'finalize_refund', 'apply_webhook_event');
--
--   -- 9. RLS is still enabled on refunds (unaffected by this migration, but
--   --    worth confirming after any migration that touches the table):
--   select relrowsecurity from pg_class where oid = 'public.refunds'::regclass;
-- ============================================================================
