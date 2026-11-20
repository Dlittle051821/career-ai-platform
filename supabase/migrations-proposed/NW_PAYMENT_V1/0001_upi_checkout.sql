-- ============================================================================
-- NW-PAYMENT-V1 — UPI checkout for Pricing V3.1 package quotes.
-- PROPOSED. Tested on the QA replica only. Do NOT run on production without
-- the founder's explicit approval (see DB-MIGRATION-REPORT.md).
--
-- Extends the existing Milestone 8 billing ledger (invoices → payment_attempts
-- → payment_transactions → refunds → payment_webhook_events). It adds no
-- second ledger and no second entitlement system: a student's access still
-- comes only from a pricing_purchases row whose invoice is `paid`.
--
-- What it adds
--   PART 1  payment_upi_settings  — DB-side launch switch and mode (test/live).
--   PART 2  columns: quote link, channel, QR id/image/expiry, settlement link,
--           review reason, university coverage frozen on the purchase.
--   PART 3  start_quote_checkout(quote)      — quote → draft invoice + purchase.
--   PART 4  prepare_upi_attempt(invoice, ch) — one active attempt, reused on refresh.
--   PART 5  nw_upi_settle_payment(...)       — THE single settlement point.
--   PART 6  apply_upi_gateway_record(...)    — server-attested gateway facts.
--   PART 7  apply_webhook_event(...)         — 0016 body + qr_code.* + amount checks.
--   PART 8  get_quote_checkout_state(quote)  — owner-only read for the checkout UI.
--   PART 9  grants and self-checks.
--
-- Exactly-once guarantees (why one verified payment gives exactly one paid
-- invoice, one receipt and one entitlement):
--   * one invoice per quote             unique (invoices.pricing_quote_id)
--   * one purchase per quote            unique (pricing_purchases.pricing_quote_id)
--   * one transaction per gateway payment  existing unique (provider_payment_id)
--   * one settling transaction per invoice  invoices.settled_transaction_id,
--     set under `select … for update` on the invoice row inside
--     nw_upi_settle_payment(); any further captured payment for the same
--     invoice is recorded with review_reason = 'duplicate_payment' for
--     finance (refund) and never shown as a student receipt
--   * webhook redelivery                 existing (provider, event fingerprint) ledger
--   * invoice number                     allocated once, at settlement, from the
--     existing invoice_number_sequences row lock — no number is spent on an
--     abandoned checkout.
-- ============================================================================

begin;

set local lock_timeout = '10s';

do $$
begin
  if to_regclass('public.pricing_quotes') is null or to_regclass('public.pricing_plan_addons') is null then
    raise exception 'NW_PRICING_V3/0001_three_plan_catalogue.sql must be applied first.';
  end if;
  if to_regprocedure('public.apply_webhook_event(text,text)') is null or to_regprocedure('public.finalize_refund(uuid,text,text)') is null then
    raise exception 'Payment migrations 0005 and 0016 must be applied first.';
  end if;
end $$;

-- ============================================================================
-- PART 1 — Launch switch, held in the database as well as in the app.
-- Live charging needs BOTH this row (upi_checkout_enabled, gateway_mode
-- 'live') AND the app's environment gates. Only super_admin may change it.
-- ============================================================================

create table if not exists public.payment_upi_settings (
  id smallint primary key default 1,
  upi_checkout_enabled boolean not null default false,
  gateway_mode text not null default 'test',
  qr_lifetime_seconds integer not null default 900,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint payment_upi_settings_singleton check (id = 1),
  constraint payment_upi_settings_mode check (gateway_mode in ('test', 'live')),
  constraint payment_upi_settings_qr_lifetime check (qr_lifetime_seconds between 180 and 7200)
);
insert into public.payment_upi_settings (id) values (1) on conflict (id) do nothing;
comment on table public.payment_upi_settings is
  'NW-PAYMENT-V1 — database launch switch for UPI checkout. Off by default. In `live` mode start_quote_checkout() refuses to bill a plan or add-on whose tax treatment is not configured, and refuses unless the billing issuer (legal name and address) is configured. Only super_admin may change it.';
alter table public.payment_upi_settings enable row level security;
drop policy if exists "super_admin/admin/finance can read UPI settings" on public.payment_upi_settings;
create policy "super_admin/admin/finance can read UPI settings" on public.payment_upi_settings for select to authenticated
  using (public.is_admin_role(array['super_admin', 'admin', 'finance']));
drop policy if exists "super_admin can update UPI settings" on public.payment_upi_settings;
create policy "super_admin can update UPI settings" on public.payment_upi_settings for update to authenticated
  using (public.is_admin_role(array['super_admin'])) with check (public.is_admin_role(array['super_admin']));

-- ============================================================================
-- PART 2 — Additive columns (nullable; every existing row is unaffected).
-- ============================================================================

alter table public.invoices add column if not exists pricing_quote_id uuid references public.pricing_quotes (id) on delete restrict;
alter table public.invoices add column if not exists settled_transaction_id uuid references public.payment_transactions (id) on delete restrict;
create unique index if not exists invoices_one_per_quote on public.invoices (pricing_quote_id) where pricing_quote_id is not null;

alter table public.payment_attempts add column if not exists channel text;
alter table public.payment_attempts add column if not exists provider_qr_id text;
alter table public.payment_attempts add column if not exists qr_image_url text;
alter table public.payment_attempts add column if not exists expires_at timestamptz;
alter table public.payment_attempts add column if not exists closed_at timestamptz;
alter table public.payment_attempts add column if not exists close_reason text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'payment_attempts_channel_check') then
    alter table public.payment_attempts add constraint payment_attempts_channel_check check (channel is null or channel in ('upi_qr', 'upi_checkout'));
  end if;
end $$;
create unique index if not exists payment_attempts_provider_qr_unique on public.payment_attempts (provider_qr_id) where provider_qr_id is not null;
create index if not exists payment_attempts_channel_idx on public.payment_attempts (channel) where channel is not null;

alter table public.payment_transactions add column if not exists review_reason text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'payment_transactions_review_reason_check') then
    alter table public.payment_transactions add constraint payment_transactions_review_reason_check
      check (review_reason is null or review_reason in ('duplicate_payment', 'payment_on_inactive_invoice'));
  end if;
end $$;
create index if not exists payment_transactions_review_idx on public.payment_transactions (review_reason) where review_reason is not null;

alter table public.pricing_purchases add column if not exists pricing_quote_id uuid references public.pricing_quotes (id) on delete restrict;
alter table public.pricing_purchases add column if not exists included_universities_at_purchase integer;
alter table public.pricing_purchases add column if not exists additional_universities_at_purchase integer;
alter table public.pricing_purchases add column if not exists total_universities_at_purchase integer;
create unique index if not exists pricing_purchases_one_per_quote on public.pricing_purchases (pricing_quote_id) where pricing_quote_id is not null;

-- The existing RLS policy lets a student INSERT a payment_attempts row on
-- their own invoice (legacy PayButton path). A Payment V1 attempt must only
-- ever be created by prepare_upi_attempt() (SECURITY DEFINER), so a direct
-- API insert may not set any Payment V1 field. Inside a definer function
-- current_user is the function owner, never an API role.
create or replace function public.nw_upi_guard_attempt_insert()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('anon', 'authenticated') and (new.channel is not null or new.provider_qr_id is not null or new.qr_image_url is not null
     or exists (select 1 from public.invoices i where i.id = new.invoice_id and i.pricing_quote_id is not null)) then
    raise exception 'Payment attempts for online checkout can only be created by the checkout service.';
  end if;
  return new;
end;
$$;
drop trigger if exists nw_upi_guard_attempt_insert on public.payment_attempts;
create trigger nw_upi_guard_attempt_insert before insert on public.payment_attempts for each row execute function public.nw_upi_guard_attempt_insert();

comment on column public.invoices.settled_transaction_id is 'NW-PAYMENT-V1 — the one gateway transaction that settled this quote invoice. Set once, under a row lock, by nw_upi_settle_payment(). The student receipt is for this transaction only.';
comment on column public.payment_transactions.review_reason is 'NW-PAYMENT-V1 — set when real money arrived that must not settle anything: a second payment for an already-settled invoice (duplicate_payment) or a payment for a void/superseded invoice (payment_on_inactive_invoice). Finance refunds these; they are never shown to the student as a receipt and grant nothing.';

-- ============================================================================
-- PART 3 — start_quote_checkout(): the quote becomes a DRAFT invoice (no
-- number yet) plus its immutable purchase snapshot. Nothing is payable,
-- visible as an invoice, or granted until a verified payment settles it.
-- ============================================================================

create or replace function public.nw_upi_line_tax(p_tax_status text, p_mode text, p_gross_unit bigint, p_gst_rate_bps integer)
returns integer
language plpgsql
immutable
set search_path = public
as $$
-- Returns the GST share INSIDE one unit's advertised (gross) price, or 0.
-- Never adds tax on top of an advertised price.
begin
  if p_tax_status = 'tax_inclusive' then
    if p_gst_rate_bps is null then return 0; end if;          -- not GST-registered: the price is final, no tax line
    return round(p_gross_unit * p_gst_rate_bps / (10000.0 + p_gst_rate_bps))::integer;
  elsif p_tax_status = 'unconfigured' and p_mode = 'test' then
    return 0;                                                  -- sandbox only: plain invoice, no tax
  elsif p_tax_status = 'tax_exclusive' then
    raise exception 'This package''s tax treatment adds tax on top of the advertised price, which Payment V1 does not allow. Please contact Nextwise.';
  else
    raise exception 'Online payment for this package is not ready yet (tax treatment not configured).';
  end if;
end;
$$;

create or replace function public.start_quote_checkout(p_quote_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_settings public.payment_upi_settings;
  v_quote public.pricing_quotes;
  v_plan public.pricing_plans;
  v_version public.pricing_plan_versions;
  v_addon public.pricing_plan_addons;
  v_billing public.billing_settings;
  v_existing public.invoices;
  v_gst_rate integer;
  v_base_tax integer := 0;
  v_unit_tax integer := 0;
  v_tax_total bigint;
  v_invoice_id uuid;
  v_purchase_id uuid;
  v_name text;
  v_email text;
  v_inclusions jsonb;
  v_limits jsonb;
begin
  if v_uid is null then raise exception 'You must be signed in to pay.'; end if;

  select * into v_settings from public.payment_upi_settings where id = 1;
  if not coalesce(v_settings.upi_checkout_enabled, false) then
    raise exception 'Online payment is not open yet.';
  end if;

  select * into v_quote from public.pricing_quotes where id = p_quote_id for update;
  if v_quote.id is null or v_quote.student_user_id is distinct from v_uid then
    raise exception 'This package selection was not found.';                 -- same message for "not yours": no enumeration
  end if;

  -- an earlier call for the same quote: hand back the same invoice
  select * into v_existing from public.invoices where pricing_quote_id = v_quote.id;
  if v_existing.id is not null then
    if v_existing.voided_at is not null and v_existing.status = 'draft' then
      raise exception 'This package selection is no longer current. Please choose your package again.';
    end if;
    return jsonb_build_object('invoice_id', v_existing.id, 'reused', true, 'status', v_existing.status,
      'total_minor_units', v_existing.total_minor_units, 'currency', v_existing.currency);
  end if;

  if v_quote.status <> 'open' then raise exception 'This package selection is no longer current. Please choose your package again.'; end if;
  if v_quote.expires_at <= now() then
    update public.pricing_quotes set status = 'expired' where id = v_quote.id;
    raise exception 'This package selection has expired. Please choose your package again.';
  end if;

  select * into v_plan from public.pricing_plans where id = v_quote.plan_id;
  if v_plan.id is null or not v_plan.is_active then raise exception 'This package is not currently offered.'; end if;

  -- the quote must still match the currently published version exactly (stale quotes are refused)
  select * into v_version from public.pricing_plan_versions
  where plan_id = v_plan.id and status = 'published'
    and (effective_from is null or effective_from <= now()) and (effective_until is null or effective_until >= now())
  order by version_number desc limit 1;
  if v_version.id is null or v_version.id <> v_quote.plan_version_id
     or v_version.amount_minor_units <> v_quote.base_amount_minor_units or v_version.currency <> v_quote.currency then
    raise exception 'The price of this package has changed. Please review your package again.';
  end if;

  if v_quote.additional_universities > 0 then
    select * into v_addon from public.pricing_plan_addons where plan_version_id = v_version.id and addon_key = 'additional_university';
    if v_addon.id is null or v_addon.id is distinct from v_quote.addon_id
       or v_addon.unit_amount_minor_units <> v_quote.addon_unit_amount_minor_units or v_addon.currency <> v_quote.currency then
      raise exception 'The price of this package has changed. Please review your package again.';
    end if;
    if v_quote.additional_universities > 100 or (v_addon.max_additional_quantity is not null and v_quote.additional_universities > v_addon.max_additional_quantity) then
      raise exception 'That is more additional universities than one package can include.';
    end if;
  end if;
  if v_quote.total_amount_minor_units <> v_quote.base_amount_minor_units + v_quote.additional_universities * coalesce(v_quote.addon_unit_amount_minor_units, 0)
     or v_quote.total_amount_minor_units <= 0 then
    raise exception 'This package could not be priced.';
  end if;

  -- issuer and tax readiness
  select * into v_billing from public.billing_settings where id = 1;
  if v_settings.gateway_mode = 'live' and (coalesce(trim(v_billing.legal_entity_name), '') = '' or coalesce(trim(v_billing.business_address), '') = '') then
    raise exception 'Online payment is not ready yet (invoice issuer details are not configured).';
  end if;
  v_gst_rate := case when v_billing.gst_registered and coalesce(trim(v_billing.gstin), '') <> '' then v_billing.default_tax_rate_bps else null end;
  if v_billing.gst_registered and v_gst_rate is null and v_settings.gateway_mode = 'live' then
    raise exception 'Online payment is not ready yet (GST rate not configured).';
  end if;

  v_base_tax := public.nw_upi_line_tax(v_version.tax_status, v_settings.gateway_mode, v_quote.base_amount_minor_units, v_gst_rate);
  if v_quote.additional_universities > 0 then
    v_unit_tax := public.nw_upi_line_tax(v_addon.tax_status, v_settings.gateway_mode, v_quote.addon_unit_amount_minor_units, v_gst_rate);
  end if;
  v_tax_total := v_base_tax + v_unit_tax::bigint * v_quote.additional_universities;

  select full_name, email into v_name, v_email from public.profiles where id = v_uid;

  -- a newer checkout replaces an older unpaid one: void its draft invoice and cancel its attempts
  -- (the app also closes their QR codes at Razorpay; a late payment to one is held for finance, never settled)
  update public.payment_attempts pa set status = 'cancelled', closed_at = now(), close_reason = coalesce(close_reason, 'superseded')
  from public.invoices i
  where pa.invoice_id = i.id and i.student_user_id = v_uid and i.pricing_quote_id is not null and i.status = 'draft'
    and pa.status in ('created', 'pending');
  -- (a draft has no invoice number, and invoices_issued_number_check only allows
  -- un-numbered rows in `draft`, so a superseded checkout stays a draft marked
  -- with voided_at — it is never numbered, never shown, and never settled)
  update public.invoices set void_reason = 'Superseded by a newer checkout before payment.', voided_at = now()
  where student_user_id = v_uid and pricing_quote_id is not null and status = 'draft' and voided_at is null and pricing_quote_id <> v_quote.id
    and not exists (select 1 from public.payment_attempts pa where pa.invoice_id = invoices.id and pa.status = 'authorized');

  insert into public.invoices (
    invoice_number, student_user_id, status, currency, subtotal_minor_units, discount_minor_units, tax_minor_units, total_minor_units,
    billing_snapshot, pricing_plan_id, pricing_quote_id, created_by, internal_notes
  ) values (
    null, v_uid, 'draft', v_quote.currency,
    v_quote.total_amount_minor_units - v_tax_total, 0, v_tax_total, v_quote.total_amount_minor_units,
    jsonb_build_object(
      'studentName', coalesce(nullif(trim(v_name), ''), 'Student'),
      'studentEmail', v_email,
      'legalEntityName', v_billing.legal_entity_name,
      'businessAddress', v_billing.business_address,
      'gstin', case when v_gst_rate is not null then v_billing.gstin else null end,
      'gstRegisteredAtIssuance', v_gst_rate is not null,
      'paymentMode', v_settings.gateway_mode
    ),
    v_plan.id, v_quote.id, v_uid,
    'Self-service UPI checkout (NW-PAYMENT-V1). Draft until a verified payment settles it.'
  ) returning id into v_invoice_id;

  insert into public.invoice_line_items (invoice_id, description, quantity, unit_amount_minor_units, discount_minor_units, tax_rate_bps, tax_minor_units, line_total_minor_units, sort_order)
  values (v_invoice_id,
    v_version.public_title || case when v_quote.included_universities is not null then ' (includes ' || v_quote.included_universities || ' universities)' else '' end,
    1, v_quote.base_amount_minor_units - v_base_tax, 0, case when v_base_tax > 0 then v_gst_rate else null end, v_base_tax, v_quote.base_amount_minor_units, 0);
  if v_quote.additional_universities > 0 then
    insert into public.invoice_line_items (invoice_id, description, quantity, unit_amount_minor_units, discount_minor_units, tax_rate_bps, tax_minor_units, line_total_minor_units, sort_order)
    values (v_invoice_id, 'Additional university application assistance', v_quote.additional_universities,
      v_quote.addon_unit_amount_minor_units - v_unit_tax, 0, case when v_unit_tax > 0 then v_gst_rate else null end,
      v_unit_tax::bigint * v_quote.additional_universities, v_quote.addon_amount_minor_units, 1);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('title', i.title, 'explanation', i.explanation, 'category', i.category,
           'numericAllowance', i.numeric_allowance, 'unit', i.unit, 'isHighlight', i.is_highlight) order by i.display_order) filter (where i.is_active), '[]'::jsonb)
    into v_inclusions from public.pricing_plan_inclusions i where i.plan_version_id = v_version.id;
  v_limits := jsonb_build_object('applicationSupportLimit', coalesce(v_quote.included_universities, v_version.application_support_limit),
    'additionalUniversities', v_quote.additional_universities, 'totalUniversities', v_quote.included_universities + v_quote.additional_universities,
    'counsellorTier', v_version.counsellor_tier, 'supportDurationNote', v_version.support_duration_note);

  insert into public.pricing_purchases (
    student_user_id, plan_id, plan_version_id, plan_name_at_purchase, included_services_at_purchase,
    original_amount_minor_units, discount_minor_units, tax_minor_units, final_amount_minor_units, currency,
    invoice_id, session_count_at_purchase, inclusions_at_purchase, presentation_limits_at_purchase,
    pricing_quote_id, included_universities_at_purchase, additional_universities_at_purchase, total_universities_at_purchase
  ) values (
    v_uid, v_plan.id, v_version.id, v_version.public_title, v_version.included_services,
    v_quote.total_amount_minor_units, 0, v_tax_total, v_quote.total_amount_minor_units, v_quote.currency,
    v_invoice_id, v_version.session_count, v_inclusions, v_limits,
    v_quote.id, v_quote.included_universities, v_quote.additional_universities,
    case when v_quote.included_universities is null then null else v_quote.included_universities + v_quote.additional_universities end
  ) returning id into v_purchase_id;

  return jsonb_build_object('invoice_id', v_invoice_id, 'purchase_id', v_purchase_id, 'reused', false, 'status', 'draft',
    'total_minor_units', v_quote.total_amount_minor_units, 'currency', v_quote.currency);
end;
$$;

-- ============================================================================
-- PART 4 — prepare_upi_attempt(): at most one live attempt per invoice
-- (existing partial unique index). A refresh reuses the live QR; an expired
-- or other-channel attempt is cancelled and its QR id returned so the server
-- closes it at Razorpay. The amount is the invoice total — never client input.
-- ============================================================================

create or replace function public.prepare_upi_attempt(p_invoice_id uuid, p_channel text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_settings public.payment_upi_settings;
  v_invoice public.invoices;
  v_active public.payment_attempts;
  v_to_close text := null;
  v_attempt public.payment_attempts;
begin
  if v_uid is null then raise exception 'You must be signed in to pay.'; end if;
  if p_channel not in ('upi_qr', 'upi_checkout') then raise exception 'Unsupported payment method.'; end if;
  select * into v_settings from public.payment_upi_settings where id = 1;
  if not coalesce(v_settings.upi_checkout_enabled, false) then raise exception 'Online payment is not open yet.'; end if;

  select * into v_invoice from public.invoices where id = p_invoice_id for update;
  if v_invoice.id is null or v_invoice.student_user_id is distinct from v_uid or v_invoice.pricing_quote_id is null then
    raise exception 'This checkout was not found.';
  end if;
  if v_invoice.settled_transaction_id is not null or v_invoice.status = 'paid' then
    return jsonb_build_object('paid', true);
  end if;
  if v_invoice.status <> 'draft' or v_invoice.voided_at is not null then raise exception 'This checkout can no longer be paid.'; end if;

  select * into v_active from public.payment_attempts where invoice_id = v_invoice.id and status in ('created', 'pending', 'authorized') limit 1;
  if v_active.id is not null then
    if v_active.status = 'authorized' then
      return jsonb_build_object('attempt_id', v_active.id, 'channel', v_active.channel, 'reused', true, 'needs_gateway', false, 'in_progress', true);
    end if;
    if v_active.channel = p_channel and (
         (p_channel = 'upi_checkout' and v_active.provider_order_id is not null)
      or (p_channel = 'upi_qr' and v_active.provider_qr_id is not null and v_active.expires_at > now() + interval '30 seconds')) then
      return jsonb_build_object('attempt_id', v_active.id, 'channel', v_active.channel, 'reused', true, 'needs_gateway', false);
    end if;
    if v_active.channel = p_channel and v_active.provider_qr_id is null and v_active.provider_order_id is null and v_active.created_at > now() - interval '45 seconds' then
      return jsonb_build_object('attempt_id', v_active.id, 'channel', v_active.channel, 'reused', true, 'needs_gateway', false, 'setting_up', true);
    end if;
    update public.payment_attempts set status = 'cancelled', closed_at = now(),
      close_reason = case when channel = p_channel then 'expired' else 'switched_method' end
      where id = v_active.id;
    v_to_close := v_active.provider_qr_id;
  end if;

  insert into public.payment_attempts (invoice_id, provider, idempotency_key, status, amount_minor_units, currency, created_by, channel, expires_at)
  values (v_invoice.id, 'razorpay', 'upi-' || replace(gen_random_uuid()::text, '-', ''), 'created', v_invoice.total_minor_units, v_invoice.currency, v_uid,
          p_channel, case when p_channel = 'upi_qr' then now() + make_interval(secs => v_settings.qr_lifetime_seconds) else null end)
  returning * into v_attempt;

  return jsonb_build_object('attempt_id', v_attempt.id, 'channel', p_channel, 'reused', false, 'needs_gateway', true,
    'amount_minor_units', v_attempt.amount_minor_units, 'currency', v_attempt.currency, 'idempotency_key', v_attempt.idempotency_key,
    'requested_close_by', extract(epoch from v_attempt.expires_at)::bigint, 'close_qr_id', v_to_close, 'invoice_id', v_invoice.id);
end;
$$;

-- ============================================================================
-- PART 5 — nw_upi_settle_payment(): the ONE place a gateway payment for a
-- Payment V1 attempt is recorded and settled. Called only from
-- apply_webhook_event() (Razorpay-signed) and apply_upi_gateway_record()
-- (server-attested reconciliation). Not executable by any API role.
-- ============================================================================

create or replace function public.nw_upi_settle_payment(p_attempt_id uuid, p_payment jsonb, p_source text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt public.payment_attempts;
  v_invoice public.invoices;
  v_txn public.payment_transactions;
  v_pid text := p_payment ->> 'id';
  v_status text;
  v_amount bigint := nullif(p_payment ->> 'amount', '')::bigint;
  v_currency text := upper(coalesce(p_payment ->> 'currency', ''));
  v_rank_new int;
  v_prefix text;
  v_next bigint;
  v_number text;
  v_review text := null;
  v_settled boolean := false;
begin
  if v_pid is null or v_pid !~ '^pay_[A-Za-z0-9]+$' then
    return jsonb_build_object('result', 'ignored', 'reason', 'missing or malformed payment id');
  end if;
  v_status := case
    when coalesce((p_payment ->> 'captured')::boolean, false) or p_payment ->> 'status' in ('captured', 'refunded') then 'captured'
    when p_payment ->> 'status' = 'authorized' then 'authorized'
    when p_payment ->> 'status' = 'failed' then 'failed'
    else null end;
  if v_status is null then
    return jsonb_build_object('result', 'ignored', 'reason', 'payment not in a final or authorised state');
  end if;

  -- lock the invoice first, then the attempt: every settlement path takes the same order
  select i.* into v_invoice from public.invoices i join public.payment_attempts pa on pa.invoice_id = i.id where pa.id = p_attempt_id for update of i;
  select * into v_attempt from public.payment_attempts where id = p_attempt_id for update;
  if v_attempt.id is null or v_attempt.channel is null then
    return jsonb_build_object('result', 'ignored', 'reason', 'not a Payment V1 attempt');
  end if;

  -- the money must be exactly what this attempt asked for (fixed-amount QR / order), in the same currency
  if v_status <> 'failed' and (v_amount is null or v_amount <> v_attempt.amount_minor_units or v_amount <> v_invoice.total_minor_units
     or v_currency <> upper(v_attempt.currency) or upper(v_invoice.currency) <> upper(v_attempt.currency)) then
    return jsonb_build_object('result', 'rejected', 'reason', 'amount or currency does not match the attempt — held for finance review, nothing settled');
  end if;
  -- one gateway payment can never satisfy two different attempts
  if exists (select 1 from public.payment_transactions where provider_payment_id = v_pid and payment_attempt_id <> v_attempt.id) then
    return jsonb_build_object('result', 'rejected', 'reason', 'payment already recorded against a different attempt');
  end if;

  v_rank_new := case v_status when 'failed' then 0 when 'authorized' then 1 else 2 end;
  insert into public.payment_transactions (payment_attempt_id, provider_payment_id, status, amount_minor_units, currency, method_category, captured_at, failure_reason, raw_status)
  values (v_attempt.id, v_pid, v_status, coalesce(v_amount, v_attempt.amount_minor_units), coalesce(nullif(v_currency, ''), v_attempt.currency),
          coalesce(p_payment ->> 'method', 'upi'), case when v_status = 'captured' then now() else null end,
          case when v_status = 'failed' then left(coalesce(p_payment ->> 'error_description', 'Payment failed.'), 500) else null end,
          p_source || ':' || coalesce(p_payment ->> 'status', ''))
  on conflict (provider_payment_id) where provider_payment_id is not null do update
    set status = case
          -- forward only: failed < authorized < captured < refunded states (refunds are owned by the refund flow)
          when public.payment_transactions.status in ('refunded', 'partially_refunded') then public.payment_transactions.status
          when public.payment_transactions.status = 'captured' then 'captured'
          when public.payment_transactions.status = 'authorized' and excluded.status = 'failed' then 'authorized'
          else excluded.status end,
        captured_at = coalesce(public.payment_transactions.captured_at, excluded.captured_at),
        failure_reason = case when excluded.status = 'failed' then coalesce(public.payment_transactions.failure_reason, excluded.failure_reason) else public.payment_transactions.failure_reason end,
        raw_status = excluded.raw_status,
        updated_at = now()
  returning * into v_txn;

  if v_txn.status = 'captured' then
    if v_invoice.settled_transaction_id = v_txn.id then
      v_settled := true;                                              -- replay of the settling payment: nothing more to do
    elsif v_invoice.settled_transaction_id is not null or v_invoice.status = 'paid' then
      v_review := 'duplicate_payment';
    elsif v_invoice.status not in ('draft', 'issued') or v_invoice.voided_at is not null then
      v_review := 'payment_on_inactive_invoice';                      -- void / superseded checkout
    else
      -- settle: allocate the invoice number now (same gap-free sequence as every other path), issue, mark paid
      if v_invoice.status = 'draft' then
        v_prefix := 'INV-' || to_char(now(), 'YYYY');
        insert into public.invoice_number_sequences (prefix, last_value, updated_at) values (v_prefix, 1, now())
        on conflict (prefix) do update set last_value = public.invoice_number_sequences.last_value + 1, updated_at = now()
        returning last_value into v_next;
        v_number := v_prefix || '-' || lpad(v_next::text, 5, '0');
        update public.invoices set invoice_number = v_number, status = 'issued', issue_date = current_date, issued_at = now(), issued_by = student_user_id
          where id = v_invoice.id;
      end if;
      update public.invoices set settled_transaction_id = v_txn.id where id = v_invoice.id;
      perform public.recompute_invoice_status(v_invoice.id);
      update public.pricing_quotes set status = 'converted' where id = v_invoice.pricing_quote_id and status in ('open', 'expired', 'superseded');
      v_settled := true;
    end if;
    if v_review is not null then
      update public.payment_transactions set review_reason = v_review where id = v_txn.id and review_reason is null;
    end if;
  end if;

  update public.payment_attempts set
    status = case
      when status in ('captured', 'refunded', 'partially_refunded') then status
      when v_txn.status = 'captured' then 'captured'
      when v_txn.status = 'authorized' then 'authorized'
      when v_txn.status = 'failed' and status in ('created', 'pending') then 'failed'
      else status end,
    closed_at = case when v_txn.status in ('captured', 'failed') then coalesce(closed_at, now()) else closed_at end,
    close_reason = case when v_txn.status = 'captured' then coalesce(close_reason, 'paid') when v_txn.status = 'failed' then coalesce(close_reason, 'failed') else close_reason end
  where id = v_attempt.id;

  return jsonb_build_object('result', case when v_settled then 'settled' when v_review is not null then 'held_for_review' else v_txn.status end,
    'transaction_id', v_txn.id, 'invoice_id', v_invoice.id, 'review_reason', v_review, 'rank', v_rank_new);
end;
$$;

-- ============================================================================
-- PART 5b — recompute_invoice_status(): the 0005 body with ONE change. Money
-- held for finance review (review_reason is not null: a duplicate second
-- payment, or a payment to a void checkout) and refunds of that money are
-- left out of the invoice's paid/refunded arithmetic. Without this, refunding
-- a student's accidental second payment would flip the correctly paid
-- invoice to `partially_refunded` and silently remove their access.
-- review_reason is only ever set by Payment V1, so legacy invoices compute
-- exactly as before.
-- ============================================================================

create or replace function public.recompute_invoice_status(p_invoice_id uuid)
returns public.invoices
language plpgsql
security invoker
set search_path = public
as $$
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
  if v_invoice.status in ('draft', 'void') then
    return v_invoice;
  end if;

  select coalesce(sum(pt.amount_minor_units), 0) into v_captured_total
  from public.payment_transactions pt
  join public.payment_attempts pa on pa.id = pt.payment_attempt_id
  where pa.invoice_id = p_invoice_id and pt.status in ('captured', 'refunded', 'partially_refunded') and pt.review_reason is null;

  select coalesce(sum(r.amount_minor_units), 0) into v_refunded_total
  from public.refunds r
  left join public.payment_transactions pt on pt.id = r.payment_transaction_id
  where r.invoice_id = p_invoice_id and r.status = 'processed' and pt.review_reason is null;

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
  if v_invoice.id is null then
    raise exception 'Invoice not found or you do not have permission to update it.';
  end if;
  return v_invoice;
end;
$$;

-- The existing checkout-signature RPC calls pgcrypto's hmac() with
-- search_path = public. On Supabase pgcrypto lives in the `extensions`
-- schema, so that call cannot resolve there. Widen its search_path; the
-- function body is unchanged.
alter function public.verify_checkout_payment(uuid, text, text, text) set search_path = public, extensions;

-- ============================================================================
-- PART 6 — apply_upi_gateway_record(): facts the SERVER read from Razorpay's
-- API (QR created/closed, order created, payments observed), attested with an
-- HMAC-SHA256 over the exact payload using the Razorpay key secret — the same
-- secret-based trust model as verify_checkout_payment(). A browser cannot
-- produce the signature, so calling this RPC directly gains nothing.
-- ============================================================================

create or replace function public.apply_upi_gateway_record(p_payload text, p_signature text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_secret text;
  v_body jsonb;
  v_type text;
  v_attempt public.payment_attempts;
  v_payment jsonb;
  v_results jsonb := '[]'::jsonb;
begin
  select razorpay_key_secret into v_secret from public.payment_gateway_config where id = 1;
  if coalesce(trim(v_secret), '') = '' then raise exception 'Payment gateway is not configured.'; end if;
  if p_payload is null or p_signature is null or encode(hmac(p_payload, v_secret, 'sha256'), 'hex') <> p_signature then
    raise exception 'Invalid gateway record signature.';
  end if;
  v_body := p_payload::jsonb;
  if abs(extract(epoch from now()) - (v_body ->> 'ts')::numeric) > 900 then
    raise exception 'Gateway record is too old.';
  end if;
  v_type := v_body ->> 'type';
  select * into v_attempt from public.payment_attempts where id = (v_body ->> 'attempt_id')::uuid;
  if v_attempt.id is null or v_attempt.channel is null then raise exception 'Unknown payment attempt.'; end if;

  if v_type = 'qr_created' then
    if v_attempt.channel <> 'upi_qr' then raise exception 'Not a QR attempt.'; end if;
    if (v_body ->> 'amount')::bigint <> v_attempt.amount_minor_units or upper(v_body ->> 'currency') <> upper(v_attempt.currency)
       or coalesce((v_body ->> 'fixed_amount')::boolean, false) is not true or v_body ->> 'usage' <> 'single_use' then
      raise exception 'Gateway QR does not match the attempt.';
    end if;
    update public.payment_attempts set provider_qr_id = v_body ->> 'qr_id', qr_image_url = v_body ->> 'image_url',
      expires_at = to_timestamp((v_body ->> 'close_by')::bigint), status = case when status = 'created' then 'pending' else status end
    where id = v_attempt.id and provider_qr_id is null;
    return jsonb_build_object('result', 'attached');

  elsif v_type = 'order_created' then
    if v_attempt.channel <> 'upi_checkout' then raise exception 'Not a checkout attempt.'; end if;
    if (v_body ->> 'amount')::bigint <> v_attempt.amount_minor_units or upper(v_body ->> 'currency') <> upper(v_attempt.currency) then
      raise exception 'Gateway order does not match the attempt.';
    end if;
    update public.payment_attempts set provider_order_id = v_body ->> 'order_id', status = case when status = 'created' then 'pending' else status end
    where id = v_attempt.id and provider_order_id is null;
    return jsonb_build_object('result', 'attached');

  elsif v_type = 'attempt_closed' then
    update public.payment_attempts set status = case when status in ('created', 'pending') then 'cancelled' else status end,
      closed_at = coalesce(closed_at, now()), close_reason = coalesce(close_reason, left(v_body ->> 'reason', 60))
    where id = v_attempt.id;
    return jsonb_build_object('result', 'closed');

  elsif v_type = 'payments_observed' then
    for v_payment in select * from jsonb_array_elements(coalesce(v_body -> 'payments', '[]'::jsonb)) loop
      v_results := v_results || jsonb_build_array(public.nw_upi_settle_payment(v_attempt.id, v_payment, 'reconcile'));
    end loop;
    return jsonb_build_object('result', 'observed', 'outcomes', v_results);
  end if;
  raise exception 'Unknown gateway record type.';
end;
$$;

-- ============================================================================
-- PART 7 — apply_webhook_event(): the 0016 body, unchanged for legacy
-- invoices except the amount/currency check (same rule as the reviewed but
-- unapplied nw-f01-s3/06), plus:
--   * qr_code.credited  → nw_upi_settle_payment() via the QR id (Razorpay QR
--     payments carry order_id = null), falling back to the attempt id we put
--     in the QR's notes if the server never got to record the QR id;
--   * qr_code.closed    → attempt closed;
--   * payment.* for Payment V1 attempts → nw_upi_settle_payment();
--   * payment.* with order_id = null → matched only through an existing
--     transaction (never through payment notes, which the browser can set).
-- ============================================================================

create or replace function public.apply_webhook_event(p_raw_body text, p_signature text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_secret text; v_expected text; v_body jsonb; v_event_type text; v_fingerprint text; v_entity jsonb;
  v_provider_payment_id text; v_provider_order_id text; v_provider_refund_id text; v_amount bigint; v_currency text;
  v_refund_currency text; v_method text; v_attempt public.payment_attempts; v_txn public.payment_transactions; v_status text;
  v_diagnostic text := null; v_processing_status text := 'ignored'; v_related_invoice_id uuid := null; v_related_attempt_id uuid := null;
  v_related_txn_id uuid := null; v_refund_match_id uuid; v_finalize_result jsonb; v_webhook_event_id uuid;
  v_qr jsonb; v_settle jsonb; v_note_attempt text;
begin
  if p_raw_body is null or p_signature is null then raise exception 'Missing webhook body or signature.'; end if;
  select razorpay_webhook_secret into v_secret from public.payment_gateway_config where id = 1;
  if v_secret is null or length(trim(v_secret)) = 0 then raise exception 'Payment gateway webhook is not configured.'; end if;
  v_expected := encode(hmac(p_raw_body, v_secret, 'sha256'), 'hex');
  if v_expected <> p_signature then raise exception 'Invalid webhook signature.'; end if;
  begin v_body := p_raw_body::jsonb; exception when others then raise exception 'Webhook body is not valid JSON.'; end;

  v_event_type := v_body ->> 'event';
  v_fingerprint := encode(digest(p_raw_body, 'sha256'), 'hex');
  insert into public.payment_webhook_events (provider, event_id, event_type, processing_status)
  values ('razorpay', v_fingerprint, coalesce(v_event_type, 'unknown'), 'received')
  on conflict (provider, event_id) do nothing returning id into v_webhook_event_id;
  if v_webhook_event_id is null then return jsonb_build_object('duplicate', true, 'event_type', v_event_type); end if;

  if v_event_type = 'qr_code.credited' then
    v_entity := v_body #> '{payload,payment,entity}';
    v_qr := v_body #> '{payload,qr_code,entity}';
    v_provider_payment_id := v_entity ->> 'id'; v_amount := nullif(v_entity ->> 'amount', '')::bigint;
    select * into v_attempt from public.payment_attempts where provider_qr_id = v_qr ->> 'id';
    if v_attempt.id is null then
      v_note_attempt := v_qr #>> '{notes,nw_attempt_id}';
      if v_note_attempt ~ '^[0-9a-f-]{36}$' then
        select * into v_attempt from public.payment_attempts where id = v_note_attempt::uuid and channel = 'upi_qr' and provider_qr_id is null;
        if v_attempt.id is not null then
          update public.payment_attempts set provider_qr_id = v_qr ->> 'id' where id = v_attempt.id;
        end if;
      end if;
    end if;
    if v_attempt.id is null then
      v_diagnostic := 'No matching payment attempt for this QR code — held for finance review.'; v_processing_status := 'failed';
    else
      v_settle := public.nw_upi_settle_payment(v_attempt.id, v_entity, 'webhook:qr_code.credited');
      v_related_invoice_id := v_attempt.invoice_id; v_related_attempt_id := v_attempt.id; v_related_txn_id := (v_settle ->> 'transaction_id')::uuid;
      v_processing_status := case when v_settle ->> 'result' = 'rejected' then 'failed' else 'processed' end;
      v_diagnostic := case when v_settle ->> 'result' in ('rejected', 'held_for_review') then v_settle ->> 'result' || ': ' || coalesce(v_settle ->> 'reason', v_settle ->> 'review_reason') end;
    end if;

  elsif v_event_type = 'qr_code.closed' then
    v_qr := v_body #> '{payload,qr_code,entity}';
    update public.payment_attempts set status = case when status in ('created', 'pending') then 'cancelled' else status end,
      closed_at = coalesce(closed_at, now()), close_reason = coalesce(close_reason, 'qr_' || coalesce(v_qr ->> 'close_reason', 'closed'))
    where provider_qr_id = v_qr ->> 'id' returning * into v_attempt;
    v_related_attempt_id := v_attempt.id; v_related_invoice_id := v_attempt.invoice_id;
    v_processing_status := case when v_attempt.id is null then 'ignored' else 'processed' end;

  elsif v_event_type in ('payment.authorized', 'payment.captured', 'payment.failed') then
    v_entity := v_body #> '{payload,payment,entity}';
    v_provider_payment_id := v_entity ->> 'id'; v_provider_order_id := v_entity ->> 'order_id';
    v_amount := nullif(v_entity ->> 'amount', '')::bigint; v_currency := coalesce(v_entity ->> 'currency', 'INR'); v_method := v_entity ->> 'method';

    if v_provider_order_id is not null then
      select * into v_attempt from public.payment_attempts where provider_order_id = v_provider_order_id;
    elsif v_provider_payment_id is not null then
      select pa.* into v_attempt from public.payment_attempts pa join public.payment_transactions pt on pt.payment_attempt_id = pa.id where pt.provider_payment_id = v_provider_payment_id;
    end if;
    -- No fallback to payment notes here: Checkout lets the browser add notes to a
    -- payment, so they prove nothing. Only the server-created order id (or a
    -- payment already recorded by a verified path) can identify the attempt.

    if v_provider_payment_id is null then
      v_diagnostic := 'Missing payment id in payload.';
    elsif v_attempt.id is null then
      v_diagnostic := 'No matching payment_attempts row for this payment — event ignored.';
    elsif v_attempt.channel is not null then
      v_settle := public.nw_upi_settle_payment(v_attempt.id, v_entity, 'webhook:' || v_event_type);
      v_related_invoice_id := v_attempt.invoice_id; v_related_attempt_id := v_attempt.id; v_related_txn_id := (v_settle ->> 'transaction_id')::uuid;
      v_processing_status := case when v_settle ->> 'result' = 'rejected' then 'failed' when v_settle ->> 'result' = 'ignored' then 'ignored' else 'processed' end;
      v_diagnostic := case when v_settle ->> 'result' in ('rejected', 'held_for_review', 'ignored') then v_settle ->> 'result' || ': ' || coalesce(v_settle ->> 'reason', v_settle ->> 'review_reason') end;
    elsif v_event_type <> 'payment.failed' and (v_amount is null or v_amount <> v_attempt.amount_minor_units or upper(v_currency) <> upper(v_attempt.currency)) then
      -- legacy invoice path: never let a payment of a different amount/currency count (as reviewed in nw-f01-s3/06)
      v_diagnostic := 'Payment amount/currency does not match the order — nothing recorded; refund or reconcile manually.';
      v_processing_status := 'failed';
    else
      v_status := case v_event_type when 'payment.authorized' then 'authorized' when 'payment.captured' then 'captured' when 'payment.failed' then 'failed' end;
      insert into public.payment_transactions (payment_attempt_id, provider_payment_id, status, amount_minor_units, currency, method_category, captured_at, failure_reason, raw_status)
      values (v_attempt.id, v_provider_payment_id, v_status, coalesce(v_amount, v_attempt.amount_minor_units), v_currency, v_method,
              case when v_status = 'captured' then now() else null end,
              case when v_status = 'failed' then left(coalesce(v_entity ->> 'error_description', 'Payment failed.'), 500) else null end, v_event_type)
      on conflict (provider_payment_id) where provider_payment_id is not null do update
        set status = case
              when public.payment_transactions.status in ('refunded', 'partially_refunded') then public.payment_transactions.status
              when public.payment_transactions.status = 'captured' then 'captured'
              when public.payment_transactions.status in ('failed') then public.payment_transactions.status
              else excluded.status end,
            captured_at = coalesce(public.payment_transactions.captured_at, excluded.captured_at),
            failure_reason = coalesce(excluded.failure_reason, public.payment_transactions.failure_reason),
            raw_status = excluded.raw_status, updated_at = now()
      returning * into v_txn;
      update public.payment_attempts set status = case when status in ('captured', 'refunded', 'partially_refunded') then status
          when v_status = 'authorized' and status = 'captured' then status else v_status end
        where id = v_attempt.id returning * into v_attempt;
      perform public.recompute_invoice_status(v_attempt.invoice_id);
      v_related_invoice_id := v_attempt.invoice_id; v_related_attempt_id := v_attempt.id; v_related_txn_id := v_txn.id; v_processing_status := 'processed';
    end if;

  elsif v_event_type in ('refund.processed', 'refund.failed') then
    v_entity := v_body #> '{payload,refund,entity}';
    v_provider_refund_id := v_entity ->> 'id'; v_provider_payment_id := v_entity ->> 'payment_id';
    v_amount := nullif(v_entity ->> 'amount', '')::bigint; v_refund_currency := v_entity ->> 'currency';
    if v_provider_payment_id is null then
      v_diagnostic := 'Missing payment id in refund payload.';
    else
      select * into v_txn from public.payment_transactions where provider_payment_id = v_provider_payment_id;
      if v_txn.id is null then
        v_diagnostic := 'No matching payment_transactions row for this refund — event ignored.';
      else
        select r.id into v_refund_match_id from public.refunds r
        where r.payment_transaction_id = v_txn.id
          and ((v_provider_refund_id is not null and r.provider_refund_id = v_provider_refund_id)
               or (r.provider_refund_id is null and r.status = 'processing' and (v_amount is null or r.amount_minor_units = v_amount)
                   and (v_refund_currency is null or v_txn.currency = v_refund_currency)))
        order by (r.provider_refund_id is not null) desc limit 1;
        if v_refund_match_id is null then
          v_diagnostic := 'No matching in-flight (processing) refund found for this webhook — ignored.';
        else
          v_finalize_result := public.finalize_refund(v_refund_match_id, v_provider_refund_id, case when v_event_type = 'refund.processed' then 'processed' else 'failed' end);
          select * into v_attempt from public.payment_attempts where id = v_txn.payment_attempt_id;
          v_related_invoice_id := v_attempt.invoice_id; v_related_attempt_id := v_attempt.id; v_related_txn_id := v_txn.id; v_processing_status := 'processed';
        end if;
      end if;
    end if;
  else
    v_diagnostic := 'Event type not relevant to this system — recorded, not processed.';
  end if;

  update public.payment_webhook_events
    set processing_status = v_processing_status, related_invoice_id = v_related_invoice_id, related_payment_attempt_id = v_related_attempt_id,
        related_payment_transaction_id = v_related_txn_id, diagnostic_message = v_diagnostic,
        payload_summary = jsonb_build_object('event', v_event_type, 'provider_payment_id', v_provider_payment_id, 'provider_order_id', v_provider_order_id,
          'provider_refund_id', v_provider_refund_id, 'provider_qr_id', v_qr ->> 'id', 'amount_minor_units', v_amount),
        processed_at = now()
  where id = v_webhook_event_id;

  return jsonb_build_object('duplicate', false, 'event_type', v_event_type, 'processing_status', v_processing_status);
end;
$$;

comment on function public.apply_webhook_event(text, text) is
  'The only entry point for Razorpay webhook deliveries. 0016 body (HMAC verification, idempotency ledger, refund handling) plus NW-PAYMENT-V1: qr_code.credited/qr_code.closed, payment.* for UPI checkout attempts routed through nw_upi_settle_payment(), and an amount/currency check on every payment event.';

-- ============================================================================
-- PART 8 — get_quote_checkout_state(): owner-only read for the checkout UI
-- (draft invoices are not readable by students through RLS).
-- ============================================================================

create or replace function public.get_quote_checkout_state(p_quote_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_quote public.pricing_quotes;
  v_invoice public.invoices;
  v_attempt public.payment_attempts;
  v_settled public.payment_transactions;
  v_last public.payment_transactions;
  v_purchase public.pricing_purchases;
begin
  if v_uid is null then return null; end if;
  select * into v_quote from public.pricing_quotes where id = p_quote_id and student_user_id = v_uid;
  if v_quote.id is null then return null; end if;
  select * into v_invoice from public.invoices where pricing_quote_id = v_quote.id;
  select * into v_purchase from public.pricing_purchases where pricing_quote_id = v_quote.id;
  if v_invoice.id is not null then
    select * into v_attempt from public.payment_attempts where invoice_id = v_invoice.id order by created_at desc limit 1;
    select * into v_settled from public.payment_transactions where id = v_invoice.settled_transaction_id;
    select pt.* into v_last from public.payment_transactions pt join public.payment_attempts pa on pa.id = pt.payment_attempt_id
      where pa.invoice_id = v_invoice.id and pt.review_reason is null order by pt.updated_at desc limit 1;
  end if;
  return jsonb_build_object(
    'quote', jsonb_build_object('id', v_quote.id, 'status', v_quote.status, 'planSlug', v_quote.plan_slug_at_quote, 'planName', v_quote.plan_name_at_quote,
      'currency', v_quote.currency, 'baseMinor', v_quote.base_amount_minor_units, 'includedUniversities', v_quote.included_universities,
      'additionalUniversities', v_quote.additional_universities, 'addonUnitMinor', v_quote.addon_unit_amount_minor_units,
      'addonMinor', v_quote.addon_amount_minor_units, 'totalMinor', v_quote.total_amount_minor_units, 'expiresAt', v_quote.expires_at),
    'invoice', case when v_invoice.id is null then null else jsonb_build_object('id', v_invoice.id, 'status', v_invoice.status, 'number', v_invoice.invoice_number,
      'totalMinor', v_invoice.total_minor_units, 'taxMinor', v_invoice.tax_minor_units, 'currency', v_invoice.currency, 'paidAt', v_invoice.paid_at,
      'settledTransactionId', v_invoice.settled_transaction_id, 'superseded', v_invoice.voided_at is not null) end,
    'attempt', case when v_attempt.id is null then null else jsonb_build_object('id', v_attempt.id, 'channel', v_attempt.channel, 'status', v_attempt.status,
      'amountMinor', v_attempt.amount_minor_units, 'qrImageUrl', v_attempt.qr_image_url, 'expiresAt', v_attempt.expires_at, 'reference', v_attempt.idempotency_key,
      'hasGatewayObject', (v_attempt.provider_qr_id is not null or v_attempt.provider_order_id is not null), 'closeReason', v_attempt.close_reason) end,
    'settled', case when v_settled.id is null then null else jsonb_build_object('transactionId', v_settled.id, 'paymentId', v_settled.provider_payment_id,
      'amountMinor', v_settled.amount_minor_units, 'method', v_settled.method_category, 'capturedAt', v_settled.captured_at) end,
    'lastPayment', case when v_last.id is null then null else jsonb_build_object('status', v_last.status, 'failureReason', v_last.failure_reason) end,
    'purchaseId', v_purchase.id
  );
end;
$$;

-- ============================================================================
-- PART 8b — upi_attempts_to_reconcile(): for the scheduled reconciliation
-- job (no user session). Attested exactly like apply_upi_gateway_record(),
-- so only a holder of the Razorpay key secret can list anything. Returns the
-- open or recently closed Payment V1 attempts whose gateway object should be
-- asked "were you paid?" — this is what settles a payment whose webhook was
-- lost AND whose student closed the browser.
-- ============================================================================

create or replace function public.upi_attempts_to_reconcile(p_payload text, p_signature text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_secret text;
  v_body jsonb;
begin
  select razorpay_key_secret into v_secret from public.payment_gateway_config where id = 1;
  if coalesce(trim(v_secret), '') = '' then raise exception 'Payment gateway is not configured.'; end if;
  if p_payload is null or p_signature is null or encode(hmac(p_payload, v_secret, 'sha256'), 'hex') <> p_signature then
    raise exception 'Invalid gateway record signature.';
  end if;
  v_body := p_payload::jsonb;
  if v_body ->> 'type' <> 'list_reconcile' or abs(extract(epoch from now()) - (v_body ->> 'ts')::numeric) > 900 then
    raise exception 'Invalid reconcile request.';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('attempt_id', pa.id, 'channel', pa.channel, 'provider_qr_id', pa.provider_qr_id,
             'provider_order_id', pa.provider_order_id, 'status', pa.status, 'expires_at', pa.expires_at,
             'amount_minor_units', pa.amount_minor_units, 'currency', pa.currency) order by pa.created_at)
    from public.payment_attempts pa
    join public.invoices i on i.id = pa.invoice_id
    where pa.channel is not null
      and (pa.provider_qr_id is not null or pa.provider_order_id is not null)
      and (pa.status in ('created', 'pending', 'authorized')
           or (pa.status in ('cancelled', 'failed') and coalesce(pa.closed_at, pa.updated_at) > now() - interval '48 hours'))
      and pa.created_at > now() - interval '7 days'
    limit 200), '[]'::jsonb);
end;
$$;

-- ============================================================================
-- PART 9 — Grants and self-checks.
-- ============================================================================

revoke execute on function public.nw_upi_settle_payment(uuid, jsonb, text) from public, anon, authenticated;
revoke execute on function public.nw_upi_line_tax(text, text, bigint, integer) from public, anon;
grant execute on function public.nw_upi_line_tax(text, text, bigint, integer) to authenticated;
revoke execute on function public.start_quote_checkout(uuid) from public, anon;
grant execute on function public.start_quote_checkout(uuid) to authenticated;
revoke execute on function public.prepare_upi_attempt(uuid, text) from public, anon;
grant execute on function public.prepare_upi_attempt(uuid, text) to authenticated;
revoke execute on function public.apply_upi_gateway_record(text, text) from public;
grant execute on function public.apply_upi_gateway_record(text, text) to anon, authenticated;   -- HMAC-attested in the body, like apply_webhook_event
revoke execute on function public.upi_attempts_to_reconcile(text, text) from public;
grant execute on function public.upi_attempts_to_reconcile(text, text) to anon, authenticated;
revoke execute on function public.get_quote_checkout_state(uuid) from public, anon;
grant execute on function public.get_quote_checkout_state(uuid) to authenticated;
-- apply_webhook_event keeps its existing grants (the webhook route calls it without a session; HMAC-verified in the body)

do $$
begin
  if has_function_privilege('authenticated', 'public.nw_upi_settle_payment(uuid, jsonb, text)', 'execute') then
    raise exception 'self-check: settlement must not be callable by API roles';
  end if;
  if (select upi_checkout_enabled from public.payment_upi_settings where id = 1) then
    raise notice 'UPI checkout was already enabled before this migration ran; left unchanged.';
  end if;
end $$;

commit;
