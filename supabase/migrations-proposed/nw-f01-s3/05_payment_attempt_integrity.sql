-- PROPOSED - DO NOT APPLY. Requires separate written approval and completed security gates (see docs/stabilization/nw-f01-s3/CC-15-REVIEW.md).
-- REVIEW ONLY. NOT APPLIED. Standalone payment-integrity migration (independent of the NW09.2 artifact).
--
-- CC-15 re-review finding P1 (Critical, reproduced on disposable PostgreSQL):
-- the baseline policy "Students can create payment attempts on their own
-- invoices" (0005) lets a student INSERT any payment_attempts row for their own
-- invoice with a free amount and ANY provider_order_id, and nothing makes the
-- order id unique. A student could attach a cheap invoice's real Razorpay order
-- to the ₹1,999 Nextwise Verified invoice, pay ₹10 and have 199,900 recorded.
--
-- This migration enforces, in the database for every student insert:
--   * one attempt per (provider, provider_order_id) — an order cannot be reused;
--   * the attempt is a fresh 'created' Razorpay attempt for an invoice the
--     student owns, in a payable status, in the invoice currency, for EXACTLY
--     the amount still due (total minus captured/refunded transactions);
--   * Nextwise Verified invoices: total and attempt amount exactly 199,900 INR.
--   * CC-18: authoritative GST configuration (billing_settings) validated;
--     registered-but-incomplete configuration fails closed; Verified tax must be
--     the inclusive share of 199,900; invoice and line breakdowns must agree.
--     public.check_invoice_charge() lets the server run the same check BEFORE
--     creating a gateway order.
-- Admin/finance insert and update policies are unchanged. Residual (P1, open):
-- the webhook still trusts the attempt amount on capture; reconcile it against
-- the gateway amount in a separate reviewed change.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';
do $$ begin
  if current_user <> 'postgres' then raise exception 'Reviewed migration owner must be postgres'; end if;
  if to_regclass('public.payment_attempts') is null or to_regclass('public.pricing_purchases') is null
     or to_regclass('public.billing_settings') is null
     or not exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'invoices' and column_name = 'pricing_plan_id') then
    raise exception 'Prerequisites missing: payments (0005) and pricing (0007) migrations';
  end if;
  if exists(select 1 from public.payment_attempts where provider_order_id is not null
            group by provider, provider_order_id having count(*) > 1) then
    raise exception 'Resolve duplicate provider order IDs on payment_attempts before migration';
  end if;
end $$;

create unique index if not exists payment_attempts_provider_order_unique
  on public.payment_attempts (provider, provider_order_id) where provider_order_id is not null;

-- ---------------------------------------------------------------------------
-- CC-18: authoritative GST configuration and Verified invoice validation.
-- Shared by the student payment-attempt RLS policy (below), the pre-order
-- check the application calls BEFORE creating a Razorpay order
-- (public.check_invoice_charge) and purchase_pricing_plan() (NW01).
-- Rules (Nextwise Verified = exactly 199,900 paise INR, GST INCLUSIVE):
--   * billing_settings row must exist;
--   * gst_registered = false  -> a Verified invoice may carry no tax;
--   * gst_registered = true   -> GSTIN must be a well-formed 15-character GSTIN
--     and default_tax_rate_bps must be 1..2800 (0.01%..28%); otherwise FAIL
--     CLOSED (never silently treated as zero tax);
--   * Verified with GST: tax = round(199900 * r / (10000 + r)) inside the
--     199,900 total (18% -> 30,493 tax, 169,407 net), every taxed line at r.
-- ---------------------------------------------------------------------------
create or replace function public.nw_billing_tax_config_problem()
returns text
language plpgsql stable security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare v public.billing_settings;
begin
  select * into v from public.billing_settings where id = 1;
  if not found then return 'billing_settings_missing'; end if;
  if v.gst_registered is not true then
    if v.gstin is not null and length(trim(v.gstin)) > 0 then return 'gstin_without_registration'; end if;
    return null;
  end if;
  if v.gstin is null or upper(trim(v.gstin)) !~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$' then
    return 'gstin_invalid';
  end if;
  if v.default_tax_rate_bps is null or v.default_tax_rate_bps < 1 or v.default_tax_rate_bps > 2800 then
    return 'gst_rate_invalid';
  end if;
  return null;
end;
$$;

-- The configured GST rate when registration is enabled and valid; null when
-- not registered. Callers must check nw_billing_tax_config_problem() first.
create or replace function public.nw_billing_gst_rate_bps()
returns integer
language sql stable security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select case when s.gst_registered then s.default_tax_rate_bps else null end
  from public.billing_settings s where s.id = 1;
$$;

-- Null when charging p_amount (p_currency) on p_invoice_id for p_student is
-- allowed; otherwise a short reason code. VOLATILE: locks the invoice row
-- (FOR SHARE) so a concurrent admin edit cannot slip between check and insert.
create or replace function public.nw_invoice_charge_problem(
  p_invoice_id uuid, p_amount bigint, p_currency text, p_student uuid
) returns text
language plpgsql volatile security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_invoice public.invoices; v_captured bigint; v_config text; v_rate integer;
  v_verified boolean; v_lines integer; v_line_total bigint; v_line_tax bigint;
  v_bad_rate_lines integer; v_expected_tax bigint; v_purchase public.pricing_purchases;
begin
  if p_student is null or p_invoice_id is null or p_amount is null then return 'invalid_request'; end if;
  select * into v_invoice from public.invoices where id = p_invoice_id for share;
  if not found or v_invoice.student_user_id is distinct from p_student then return 'invoice_not_found'; end if;
  if v_invoice.status not in ('issued', 'partially_paid', 'overdue') then return 'invoice_not_payable'; end if;
  if p_currency is distinct from v_invoice.currency then return 'currency_mismatch'; end if;

  v_config := public.nw_billing_tax_config_problem();
  if v_config is not null then return v_config; end if;
  v_rate := public.nw_billing_gst_rate_bps();

  select coalesce(sum(t.amount_minor_units), 0) into v_captured
    from public.payment_transactions t join public.payment_attempts a on a.id = t.payment_attempt_id
   where a.invoice_id = p_invoice_id and t.status in ('captured', 'refunded', 'partially_refunded');
  if p_amount <= 0 or p_amount <> v_invoice.total_minor_units - v_captured then return 'amount_not_due'; end if;

  select count(*), coalesce(sum(line_total_minor_units), 0), coalesce(sum(tax_minor_units), 0),
         count(*) filter (where tax_minor_units > 0 and tax_rate_bps is distinct from v_rate)
    into v_lines, v_line_total, v_line_tax, v_bad_rate_lines
    from public.invoice_line_items where invoice_id = p_invoice_id;
  if v_lines = 0 or v_line_total <> v_invoice.total_minor_units or v_line_tax <> v_invoice.tax_minor_units then
    return 'invoice_breakdown_inconsistent';
  end if;

  select pp.* into v_purchase from public.pricing_purchases pp where pp.invoice_id = p_invoice_id limit 1;
  select exists(
    select 1 from public.pricing_plans pl where pl.id = v_invoice.pricing_plan_id and pl.slug = 'nextwise-verified'
  ) or exists(
    select 1 from public.pricing_purchases pp left join public.pricing_plans pl on pl.id = pp.plan_id
     where pp.invoice_id = p_invoice_id
       and (pl.slug = 'nextwise-verified' or lower(trim(pp.plan_name_at_purchase)) = 'nextwise verified')
  ) into v_verified;

  if v_verified then
    if v_invoice.currency <> 'INR' then return 'verified_currency'; end if;
    if v_invoice.subtotal_minor_units <> 199900 or v_invoice.discount_minor_units <> 0
       or v_invoice.total_minor_units <> 199900 or p_amount <> 199900 or v_captured <> 0 then
      return 'verified_price_mismatch';
    end if;
    v_expected_tax := case when v_rate is null then 0 else round(199900 * v_rate / (10000.0 + v_rate)) end;
    if v_invoice.tax_minor_units <> v_expected_tax then return 'verified_tax_mismatch'; end if;
    if v_bad_rate_lines > 0 then return 'verified_tax_mismatch'; end if;
    if v_purchase.id is null
       or v_purchase.original_amount_minor_units <> 199900 or v_purchase.discount_minor_units <> 0
       or v_purchase.final_amount_minor_units <> 199900 or v_purchase.tax_minor_units <> v_expected_tax
       or v_purchase.currency <> 'INR' then
      return 'verified_purchase_mismatch';
    end if;
  end if;
  return null;
end;
$$;

-- Student attempt gate used by the RLS policy (signature unchanged from CC-15).
create or replace function public.payment_attempt_insert_allowed(
  p_invoice_id uuid, p_amount bigint, p_currency text, p_status text, p_provider text, p_order_id text
) returns boolean
language plpgsql volatile security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if auth.uid() is null then return false; end if;
  if p_status is distinct from 'created' or p_provider is distinct from 'razorpay'
     or p_order_id is null or length(trim(p_order_id)) = 0 then
    return false;
  end if;
  return public.nw_invoice_charge_problem(p_invoice_id, p_amount, p_currency, auth.uid()) is null;
end;
$$;

-- Pre-order check the application calls with the student's own session BEFORE
-- it asks Razorpay for an order. Returns null (OK) or a reason code for the
-- caller's OWN invoice only; never exposes another student's data.
create or replace function public.check_invoice_charge(p_invoice_id uuid, p_amount bigint, p_currency text)
returns text
language plpgsql volatile security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if auth.uid() is null then return 'not_signed_in'; end if;
  return public.nw_invoice_charge_problem(p_invoice_id, p_amount, p_currency, auth.uid());
end;
$$;

revoke all on function public.nw_billing_tax_config_problem() from public, anon, authenticated, service_role;
revoke all on function public.nw_billing_gst_rate_bps() from public, anon, authenticated, service_role;
revoke all on function public.nw_invoice_charge_problem(uuid, bigint, text, uuid) from public, anon, authenticated, service_role;
revoke all on function public.payment_attempt_insert_allowed(uuid, bigint, text, text, text, text) from public, anon, authenticated, service_role;
grant execute on function public.payment_attempt_insert_allowed(uuid, bigint, text, text, text, text) to authenticated;
revoke all on function public.check_invoice_charge(uuid, bigint, text) from public, anon, authenticated, service_role;
grant execute on function public.check_invoice_charge(uuid, bigint, text) to authenticated;

drop policy if exists "Students can create payment attempts on their own invoices" on public.payment_attempts;
create policy "Students can create payment attempts on their own invoices"
  on public.payment_attempts for insert to authenticated
  with check (
    exists (select 1 from public.invoices i where i.id = payment_attempts.invoice_id and i.student_user_id = auth.uid())
    and created_by is not distinct from auth.uid()
    and public.payment_attempt_insert_allowed(invoice_id, amount_minor_units, currency, status, provider, provider_order_id)
  );

do $$ begin
  if not exists(select 1 from pg_indexes where schemaname = 'public' and indexname = 'payment_attempts_provider_order_unique') then
    raise exception 'Postcondition failed: unique provider order index';
  end if;
  if not exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'payment_attempts'
                and policyname = 'Students can create payment attempts on their own invoices'
                and with_check like '%payment_attempt_insert_allowed%') then
    raise exception 'Postcondition failed: student insert policy';
  end if;
  if has_function_privilege('anon', 'public.payment_attempt_insert_allowed(uuid,bigint,text,text,text,text)', 'execute') then
    raise exception 'Postcondition failed: anon can execute the attempt check';
  end if;
  if has_function_privilege('anon', 'public.check_invoice_charge(uuid,bigint,text)', 'execute')
     or not has_function_privilege('authenticated', 'public.check_invoice_charge(uuid,bigint,text)', 'execute')
     or has_function_privilege('authenticated', 'public.nw_invoice_charge_problem(uuid,bigint,text,uuid)', 'execute')
     or has_function_privilege('authenticated', 'public.nw_billing_tax_config_problem()', 'execute') then
    raise exception 'Postcondition failed: charge-check grants';
  end if;
end $$;
commit;
