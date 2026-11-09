-- PROPOSED - DO NOT APPLY. Requires separate written approval and completed security gates (see docs/stabilization/nw-f01-s3/CC-16-REVIEW.md).
-- REVIEW ONLY. NOT APPLIED. Standalone payment migration. Apply after 05_payment_attempt_integrity.sql.
--
-- CC-16 (P1) — Razorpay captured-amount reconciliation.
-- Baseline public.apply_webhook_event() (0016) matched a payment event to an
-- attempt by order id and then recorded the transaction WITHOUT comparing the
-- gateway amount or currency with the attempt; on conflict with the row the
-- checkout signature path had already created (attempt amount) it never
-- updated the amount. A capture for a different amount could therefore mark
-- an invoice paid. This replaces the function with the 0016 body unchanged
-- except:
--   * payment.authorized / payment.captured are applied only when the payload
--     amount equals payment_attempts.amount_minor_units and the payload
--     currency equals the attempt currency, which must equal the invoice
--     currency; otherwise the event is recorded as 'failed' with a diagnostic
--     and NOTHING is written to payment_transactions / payment_attempts /
--     invoice status (manual reconciliation: refund the mismatched capture);
--   * search_path pinned (pg_catalog, extensions, public, pg_temp).
-- Execute grants are unchanged (anon EXECUTE, HMAC-verified in the body).
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';
do $$ begin
  if current_user <> 'postgres' then raise exception 'Reviewed migration owner must be postgres'; end if;
  if to_regprocedure('public.apply_webhook_event(text,text)') is null or to_regprocedure('public.finalize_refund(uuid,text,text)') is null then
    raise exception 'Prerequisites missing: 0005 and 0016 payment migrations';
  end if;
  if to_regclass('public.payment_attempts_provider_order_unique') is null then
    raise exception 'Apply 05_payment_attempt_integrity.sql first (unique provider order id)';
  end if;
end $$;

create or replace function public.apply_webhook_event(
  p_raw_body text,
  p_signature text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, extensions, public, pg_temp
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
      elsif v_event_type in ('payment.authorized', 'payment.captured') and (
            v_amount is null
            or v_amount <> v_attempt.amount_minor_units
            or upper(v_entity ->> 'currency') is distinct from upper(v_attempt.currency)
            or not exists (select 1 from public.invoices i
                           where i.id = v_attempt.invoice_id and upper(i.currency) = upper(v_attempt.currency))
          ) then
        -- CC-16 (P1): the amount and currency Razorpay actually authorized or
        -- captured must equal the server-created payment attempt (and that
        -- attempt's invoice currency). Anything else is never applied to the
        -- ledger or the invoice status; it is recorded for manual
        -- reconciliation (refund) instead.
        v_diagnostic := 'Gateway amount/currency does not match the payment attempt — NOT applied. Manual reconciliation (refund) required.';
        v_processing_status := 'failed';
        v_related_invoice_id := v_attempt.invoice_id;
        v_related_attempt_id := v_attempt.id;
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
  'The only entry point for Razorpay webhook deliveries (0016 behaviour). CC-16: payment.authorized/payment.captured are applied only when the gateway amount and currency equal the server-created payment attempt (and the invoice currency); mismatches are recorded as failed for manual reconciliation and never change the ledger or invoice status.';

do $$ begin
  -- Same posture as 0005: callable by the HMAC-verified webhook route (anon client).
  if not has_function_privilege('anon', 'public.apply_webhook_event(text,text)', 'execute') then
    raise exception 'Unexpected grant posture on apply_webhook_event';
  end if;
  if not exists(select 1 from pg_proc where oid = 'public.apply_webhook_event(text,text)'::regprocedure
                and prosrc like '%Gateway amount/currency does not match%') then
    raise exception 'Postcondition failed: amount reconciliation not installed';
  end if;
end $$;
commit;
