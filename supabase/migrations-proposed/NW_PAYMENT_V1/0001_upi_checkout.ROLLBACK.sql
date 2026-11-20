-- ============================================================================
-- ROLLBACK for NW-PAYMENT-V1/0001_upi_checkout.sql (QA-tested).
--
-- Restores apply_webhook_event() and recompute_invoice_status() to the exact
-- definitions that were live before 0001 (taken from a schema dump of the QA
-- replica, which matches migrations 0005/0016), drops the Payment V1
-- functions, trigger and settings table, and DROPS NOTHING ELSE.
--
-- The added columns are left in place on purpose: they may hold the record
-- of real payments (quote link, QR id, settlement link, review flags) and
-- dropping them would destroy financial history. They are nullable and
-- unused by legacy code, so leaving them is harmless. Remove them by hand
-- only after finance confirms no Payment V1 rows exist.
--
-- Run BEFORE rollback: confirm no Payment V1 checkout is mid-payment
--   select count(*) from payment_attempts where channel is not null and status in ('created','pending','authorized');
-- ============================================================================
begin;
set local lock_timeout = '10s';

CREATE OR REPLACE FUNCTION public.apply_webhook_event(p_raw_body text, p_signature text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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

CREATE OR REPLACE FUNCTION public.recompute_invoice_status(p_invoice_id uuid) RETURNS public.invoices
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_invoice public.invoices;
  v_captured_total bigint;
  v_refunded_total bigint;
  v_new_status text;
begin
  select * into v_invoice from public.invoices where id = p_invoice_id;
  if v_invoice.id is null then
    raise exception 'Invoice not found.';
  end if;

  -- draft/void are never touched by recomputation — a draft has no payable
  -- total yet, and a void invoice's status is a deliberate admin decision
  -- that a later stray transaction event must never silently overwrite.
  if v_invoice.status in ('draft', 'void') then
    return v_invoice;
  end if;

  select coalesce(sum(pt.amount_minor_units), 0) into v_captured_total
  from public.payment_transactions pt
  join public.payment_attempts pa on pa.id = pt.payment_attempt_id
  where pa.invoice_id = p_invoice_id and pt.status in ('captured', 'refunded', 'partially_refunded');

  select coalesce(sum(r.amount_minor_units), 0) into v_refunded_total
  from public.refunds r
  where r.invoice_id = p_invoice_id and r.status = 'processed';

  if v_refunded_total > 0 and v_refunded_total >= v_captured_total and v_captured_total >= v_invoice.total_minor_units and v_invoice.total_minor_units > 0 then
    v_new_status := 'refunded';
  elsif v_refunded_total > 0 then
    v_new_status := 'partially_refunded';
  elsif v_captured_total >= v_invoice.total_minor_units and v_invoice.total_minor_units > 0 then
    v_new_status := 'paid';
  elsif v_captured_total > 0 then
    v_new_status := 'partially_paid';
  elsif v_invoice.due_date is not null and v_invoice.due_date < current_date then
    v_new_status := 'overdue';
  else
    v_new_status := 'issued';
  end if;

  update public.invoices
    set status = v_new_status,
        paid_at = case when v_new_status = 'paid' and paid_at is null then now() else paid_at end
    where id = p_invoice_id
    returning * into v_invoice;

  -- Under SECURITY INVOKER, a caller with no UPDATE privilege on this row
  -- (RLS-wise) reaches this point with zero rows affected by the UPDATE
  -- above, which leaves v_invoice as an all-NULL composite rather than
  -- raising automatically (PL/pgSQL only raises on a bare UPDATE ... INTO
  -- STRICT). Fail loudly instead of silently returning a null-filled row.
  if v_invoice.id is null then
    raise exception 'Invoice not found or you do not have permission to update it.';
  end if;

  return v_invoice;
end;
$$;

COMMENT ON FUNCTION public.apply_webhook_event(p_raw_body text, p_signature text) IS 'The only entry point for Razorpay webhook deliveries. Unchanged from the Milestone 8 original for HMAC verification, idempotency ledger, and payment.* handling. Milestone 13 change: refund.processed/refund.failed now match an in-flight refund (never a bare requested/under_review/approved case) and finalize it via finalize_refund() (PART 5) — the same exactly-once authority the synchronous gateway-response path and manual reconciliation use — instead of incrementing amount_refunded_minor_units inline.';

alter function public.verify_checkout_payment(uuid, text, text, text) set search_path = public;

drop function if exists public.upi_attempts_to_reconcile(text, text);
drop function if exists public.get_quote_checkout_state(uuid);
drop function if exists public.apply_upi_gateway_record(text, text);
drop function if exists public.nw_upi_settle_payment(uuid, jsonb, text);
drop function if exists public.prepare_upi_attempt(uuid, text);
drop function if exists public.start_quote_checkout(uuid);
drop function if exists public.nw_upi_line_tax(text, text, bigint, integer);
drop trigger if exists nw_upi_guard_attempt_insert on public.payment_attempts;
drop function if exists public.nw_upi_guard_attempt_insert();
drop table if exists public.payment_upi_settings;

commit;
