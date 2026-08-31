-- ============================================================================
-- Milestone 8 — Payments, Invoicing and Receipts
--
-- HOW TO RUN THIS (no SQL knowledge required):
--   1. Open your Supabase project dashboard (supabase.com/dashboard).
--   2. Click "SQL Editor" in the left sidebar.
--   3. Click "New query".
--   4. Paste the entire contents of this file.
--   5. Click "Run".
--
-- Safe to run once. Re-running is also safe — every statement is written to
-- not fail if already applied (`if not exists` / `or replace` / `drop
-- policy if exists` before `create policy`), same convention as 0001-0004.
--
-- This migration does NOT modify 0001, 0002, 0003, or 0004 in place. It only
-- ADDS new tables, new functions, and new RLS policies. The Milestone 7
-- `public.payments` table (0004_admin_system.sql PART 7) is left completely
-- untouched — see docs/payments-billing-guide.md §3 "Relationship to the
-- Milestone 7 payments table" for why: that table's rows are honest,
-- manually-recorded operational tracking, never a gateway-verified
-- transaction, and this migration never reinterprets them as one. Milestone
-- 8 introduces a parallel, richer model (invoices -> payment_attempts ->
-- payment_transactions -> refunds) for anything that goes through the
-- Razorpay gateway from this point forward.
--
-- No service-role key is used or required anywhere in Milestone 8. Every
-- admin and student read/write goes through the same RLS-respecting
-- publishable-key client every other milestone uses.
-- ============================================================================


-- ============================================================================
-- PART 0 — Gateway secrets store + pgcrypto
--
-- WHY THIS TABLE EXISTS (read this before anything else in the file):
--
-- Every other admin write in this project is authorized purely by RLS,
-- keyed on the calling session's role (is_admin_role()) — that is enough
-- because the caller always HAS a Supabase session. Two payment flows in
-- Milestone 8 do not: (1) a student's browser reporting that Razorpay
-- checkout just completed, and (2) Razorpay's own webhook server, which
-- carries no Supabase session at all. For both, RLS alone cannot be the
-- boundary — a session (or no session) proves who is ASKING, not whether
-- what they are asking Postgres to record is actually true. So for exactly
-- these two writes, Postgres itself re-derives the truth cryptographically
-- (Razorpay's own HMAC-SHA256 checkout-signature and webhook-signature
-- schemes — the same algorithms the official razorpay-node SDK implements
-- in validatePaymentVerification()/validateWebhookSignature()) INSIDE a
-- SECURITY DEFINER function, using a copy of the two Razorpay secrets kept
-- in this table. A student's browser cannot produce a signature Razorpay
-- did not itself sign, so this is not "trust the caller" — it is "verify
-- the caller cannot have forged this," which is what "cryptographically
-- verified gateway evidence" (the spec's own phrase) means in practice.
--
-- This table has RLS enabled with ZERO policies — not even super_admin can
-- read or write it through the API/dashboard-as-client; it is reachable
-- only from inside the SECURITY DEFINER functions below, which run as the
-- table owner and bypass RLS internally. Populate it with the manual
-- BOOTSTRAP statement at the end of this file (same one-time-manual-step
-- pattern already used for the first super_admin in 0004_admin_system.sql)
-- — values should exactly match RAZORPAY_KEY_SECRET / RAZORPAY_WEBHOOK_SECRET
-- in your server environment. Until populated, checkout verification and
-- webhook processing both fail closed with a clear "payment gateway is not
-- configured" error rather than silently accepting unverified data — see
-- docs/payments-billing-guide.md §4.
-- ============================================================================

create extension if not exists pgcrypto;

create table if not exists public.payment_gateway_config (
  id smallint primary key default 1,
  razorpay_key_secret text,
  razorpay_webhook_secret text,
  updated_at timestamptz not null default now(),
  constraint payment_gateway_config_singleton check (id = 1)
);

insert into public.payment_gateway_config (id) values (1) on conflict (id) do nothing;

comment on table public.payment_gateway_config is
  'Milestone 8 — server-side-only copy of the two Razorpay secrets (RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET), used exclusively by verify_checkout_payment()/apply_webhook_event() below to independently re-derive Razorpay''s own HMAC signatures. RLS is enabled with NO policies for any role — this table is intentionally unreachable via the normal Supabase client/dashboard-as-API, only via SECURITY DEFINER function bodies. See the BOOTSTRAP section at the end of this file to populate it.';

alter table public.payment_gateway_config enable row level security;
-- Deliberately zero policies — see table comment above.


-- ============================================================================
-- PART 1 — Billing settings (singleton) — legitimate business/tax details an
-- authorized admin must configure BEFORE any tax-related invoice field is
-- allowed to appear. Never fabricated by application code; see
-- src/lib/payments/tax.ts for the enforcement of "no GSTIN/tax rate without
-- this row saying so".
-- ============================================================================

create table if not exists public.billing_settings (
  id smallint primary key default 1,
  legal_entity_name text,
  business_address text,
  support_email text,
  support_phone text,
  gst_registered boolean not null default false,
  gstin text,
  default_tax_rate_bps integer,
  invoice_footer_note text,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_settings_singleton check (id = 1),
  constraint billing_settings_tax_rate_check check (default_tax_rate_bps is null or (default_tax_rate_bps >= 0 and default_tax_rate_bps <= 10000)),
  constraint billing_settings_gstin_requires_flag check (gstin is null or gst_registered = true)
);

comment on table public.billing_settings is
  'Milestone 8 — singleton row (id always 1) of the business/tax details that must be genuinely configured before an invoice is allowed to show GST fields or claim to be a tax invoice. gstin can only be set when gst_registered = true, enforced by billing_settings_gstin_requires_flag. Never auto-populated with invented values — see src/lib/payments/tax.ts.';

insert into public.billing_settings (id) values (1) on conflict (id) do nothing;

alter table public.billing_settings enable row level security;

drop policy if exists "super_admin/admin/finance can read billing settings" on public.billing_settings;
create policy "super_admin/admin/finance can read billing settings"
  on public.billing_settings for select to authenticated
  using (public.is_admin_role(array['super_admin', 'admin', 'finance']));

drop policy if exists "super_admin/admin/finance can update billing settings" on public.billing_settings;
create policy "super_admin/admin/finance can update billing settings"
  on public.billing_settings for update to authenticated
  using (public.is_admin_role(array['super_admin', 'admin', 'finance']))
  with check (public.is_admin_role(array['super_admin', 'admin', 'finance']));

-- Deliberately no insert/delete policy for anyone — the single row is
-- seeded once above by this migration and is never created or destroyed
-- again; only its columns are ever updated.

drop trigger if exists set_billing_settings_updated_at on public.billing_settings;
create trigger set_billing_settings_updated_at before update on public.billing_settings for each row execute function public.set_updated_at();


-- ============================================================================
-- PART 2 — Atomic invoice numbering
--
-- Deliberately NOT `select max(...) + 1 from invoices` in application code
-- (spec requirement) — that pattern races under concurrent requests. This
-- uses a dedicated one-row-per-year sequence table plus an `insert ... on
-- conflict do update ... returning` statement, which takes a row-level lock
-- for the duration of the statement — two concurrent callers for the same
-- year serialize on that lock and each gets a distinct, gap-free next
-- value. Wrapped in a SECURITY DEFINER function so the sequence table
-- itself never needs a permissive RLS write policy for `authenticated`.
-- ============================================================================

create table if not exists public.invoice_number_sequences (
  prefix text primary key,
  last_value bigint not null default 0,
  updated_at timestamptz not null default now()
);

comment on table public.invoice_number_sequences is
  'Milestone 8 — one row per invoice-number prefix (currently one per calendar year, e.g. "INV-2026"). Only ever written through public.next_invoice_number() below, never directly, and never read by application code to compute a number itself.';

alter table public.invoice_number_sequences enable row level security;
-- No policies at all for `authenticated` — this table is only ever touched
-- by the SECURITY DEFINER function below, same pattern as admin_audit_log.

create or replace function public.next_invoice_number()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefix text;
  v_next bigint;
begin
  if public.current_admin_role() is null then
    raise exception 'Only an authenticated admin can generate an invoice number.';
  end if;

  v_prefix := 'INV-' || to_char(now(), 'YYYY');

  insert into public.invoice_number_sequences (prefix, last_value, updated_at)
  values (v_prefix, 1, now())
  on conflict (prefix) do update
    set last_value = public.invoice_number_sequences.last_value + 1,
        updated_at = now()
  returning last_value into v_next;

  return v_prefix || '-' || lpad(v_next::text, 5, '0');
end;
$$;

comment on function public.next_invoice_number() is
  'The only way to generate an invoice number. Atomic under concurrency (the INSERT ... ON CONFLICT DO UPDATE row lock serializes concurrent callers for the same year); never derives the next number from MAX(invoice_number). Returns e.g. "INV-2026-00001".';


-- ============================================================================
-- PART 3 — Invoices
-- ============================================================================

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text unique,
  student_user_id uuid references auth.users (id) on delete set null,
  application_id uuid references public.applications (id) on delete set null,
  status text not null default 'draft',
  currency text not null default 'INR',
  subtotal_minor_units bigint not null default 0,
  discount_minor_units bigint not null default 0,
  tax_minor_units bigint not null default 0,
  total_minor_units bigint not null default 0,
  issue_date date,
  due_date date,
  internal_notes text,
  student_notes text,
  billing_snapshot jsonb,
  void_reason text,
  created_by uuid references auth.users (id) on delete set null,
  issued_by uuid references auth.users (id) on delete set null,
  issued_at timestamptz,
  paid_at timestamptz,
  voided_by uuid references auth.users (id) on delete set null,
  voided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invoices_status_check check (status in ('draft', 'issued', 'partially_paid', 'paid', 'overdue', 'void', 'refunded', 'partially_refunded')),
  constraint invoices_amounts_check check (
    subtotal_minor_units >= 0 and discount_minor_units >= 0 and tax_minor_units >= 0 and total_minor_units >= 0
  ),
  constraint invoices_issued_number_check check (status = 'draft' or invoice_number is not null)
);

create index if not exists invoices_student_idx on public.invoices (student_user_id);
create index if not exists invoices_status_idx on public.invoices (status);
create index if not exists invoices_application_idx on public.invoices (application_id);
create index if not exists invoices_invoice_number_idx on public.invoices (invoice_number);
create index if not exists invoices_due_date_idx on public.invoices (due_date);

comment on table public.invoices is
  'Milestone 8 — a request for payment from a student, with one or more line items. `total_minor_units`/`subtotal_minor_units`/etc are integers in the currency''s minor unit (paise for INR) — never a float, same convention as public.payments (0004). `billing_snapshot` freezes the student name/business details/tax fields as they were AT ISSUANCE (see src/lib/payments/snapshot.ts) so a later edit to the student profile or billing_settings never silently rewrites an already-issued document. A row only ever reaches status <> ''draft'' once invoice_number is set (invoices_issued_number_check). Never hard-deleted — an unpaid invoice is voided (status = ''void'' + void_reason), never removed, so the financial record and its audit trail persist.';

alter table public.invoices enable row level security;

drop policy if exists "super_admin/admin/finance/analyst/counsellor can read invoices" on public.invoices;
create policy "super_admin/admin/finance/analyst/counsellor can read invoices"
  on public.invoices for select to authenticated
  using (
    public.is_admin_role(array['super_admin', 'admin', 'finance', 'analyst'])
    or (
      public.is_admin_role(array['counsellor'])
      and exists (
        select 1 from public.admin_student_meta m
        where m.student_user_id = invoices.student_user_id and m.assigned_counsellor_id = public.current_counsellor_id()
      )
    )
  );

drop policy if exists "Students can read their own invoices" on public.invoices;
create policy "Students can read their own invoices"
  on public.invoices for select to authenticated
  using (auth.uid() = student_user_id);

drop policy if exists "super_admin/admin/finance can create invoices" on public.invoices;
create policy "super_admin/admin/finance can create invoices"
  on public.invoices for insert to authenticated
  with check (public.is_admin_role(array['super_admin', 'admin', 'finance']));

drop policy if exists "super_admin/admin/finance can update invoices" on public.invoices;
create policy "super_admin/admin/finance can update invoices"
  on public.invoices for update to authenticated
  using (public.is_admin_role(array['super_admin', 'admin', 'finance']))
  with check (public.is_admin_role(array['super_admin', 'admin', 'finance']));

-- Deliberately no delete policy for anyone, and no update policy for
-- students — a student can read their own invoice but can never change its
-- total, status, or any other field ("hiding a button is not authorization"
-- — this is the actual enforcement, not just the UI not offering a form).

drop trigger if exists set_invoices_updated_at on public.invoices;
create trigger set_invoices_updated_at before update on public.invoices for each row execute function public.set_updated_at();


-- ============================================================================
-- PART 4 — Invoice line items
-- ============================================================================

create table if not exists public.invoice_line_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  description text not null,
  quantity numeric not null default 1,
  unit_amount_minor_units bigint not null,
  discount_minor_units bigint not null default 0,
  tax_rate_bps integer,
  tax_minor_units bigint not null default 0,
  line_total_minor_units bigint not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint invoice_line_items_quantity_check check (quantity > 0),
  constraint invoice_line_items_amounts_check check (
    unit_amount_minor_units >= 0 and discount_minor_units >= 0 and tax_minor_units >= 0 and line_total_minor_units >= 0
  ),
  constraint invoice_line_items_tax_rate_check check (tax_rate_bps is null or (tax_rate_bps >= 0 and tax_rate_bps <= 10000))
);

create index if not exists invoice_line_items_invoice_idx on public.invoice_line_items (invoice_id);

comment on table public.invoice_line_items is
  'Milestone 8 — one row per invoice line. `line_total_minor_units` is server-computed from quantity/unit_amount/discount/tax by src/lib/payments/invoice-math.ts and re-verified on every write — never taken as-is from client input. Cascades with its parent invoice only because a line item has no independent meaning outside its invoice (the invoice row itself is never hard-deleted in practice — see invoices comment).';

alter table public.invoice_line_items enable row level security;

drop policy if exists "Invoice line items follow invoice read visibility" on public.invoice_line_items;
create policy "Invoice line items follow invoice read visibility"
  on public.invoice_line_items for select to authenticated
  using (exists (select 1 from public.invoices i where i.id = invoice_line_items.invoice_id));

drop policy if exists "super_admin/admin/finance can write invoice line items" on public.invoice_line_items;
create policy "super_admin/admin/finance can write invoice line items"
  on public.invoice_line_items for all to authenticated
  using (public.is_admin_role(array['super_admin', 'admin', 'finance']))
  with check (public.is_admin_role(array['super_admin', 'admin', 'finance']));

-- The SELECT policy above intentionally does not itself re-check role —
-- it relies on invoices' own RLS to have already scoped which invoice rows
-- the `exists` subquery can see (a student can only see line items of an
-- invoice they can already read; an unrelated admin role sees none). This
-- is the same "follows parent visibility" pattern 0004_admin_system.sql
-- uses for application_status_history/lead_status_history.


-- ============================================================================
-- PART 5 — Payment attempts (one Razorpay order per attempt)
-- ============================================================================

create table if not exists public.payment_attempts (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  provider text not null default 'razorpay',
  provider_order_id text,
  idempotency_key text not null,
  status text not null default 'created',
  amount_minor_units bigint not null,
  currency text not null default 'INR',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_attempts_amount_check check (amount_minor_units >= 0),
  constraint payment_attempts_status_check check (status in ('created', 'pending', 'authorized', 'captured', 'failed', 'cancelled', 'refunded', 'partially_refunded')),
  constraint payment_attempts_idempotency_key_unique unique (idempotency_key)
);

create index if not exists payment_attempts_invoice_idx on public.payment_attempts (invoice_id);
create index if not exists payment_attempts_status_idx on public.payment_attempts (status);
create index if not exists payment_attempts_provider_order_idx on public.payment_attempts (provider_order_id);

-- Idempotent order creation, enforced at the database level: at most one
-- non-terminal (still payable) attempt per invoice can exist at a time.
-- Before creating a Razorpay order, the app looks for an existing row here
-- first (see src/lib/payments/order-flow.ts); if two requests race anyway
-- (double-click, double page load), this partial unique index rejects the
-- second INSERT rather than silently creating a second live order.
create unique index if not exists payment_attempts_one_active_per_invoice
  on public.payment_attempts (invoice_id)
  where status in ('created', 'pending', 'authorized');

comment on table public.payment_attempts is
  'Milestone 8 — one row per Razorpay order created against an invoice. `idempotency_key` is generated server-side and sent to Razorpay as the order''s `receipt` field, so a retried request that reuses the same key is recognizable even before the DB constraint below is checked. `payment_attempts_one_active_per_invoice` is the actual idempotency enforcement: only one attempt in a non-terminal status may exist per invoice at a time.';

alter table public.payment_attempts enable row level security;

drop policy if exists "super_admin/admin/finance/analyst/counsellor can read payment attempts" on public.payment_attempts;
create policy "super_admin/admin/finance/analyst/counsellor can read payment attempts"
  on public.payment_attempts for select to authenticated
  using (
    public.is_admin_role(array['super_admin', 'admin', 'finance', 'analyst'])
    or (
      public.is_admin_role(array['counsellor'])
      and exists (
        select 1 from public.invoices i
        join public.admin_student_meta m on m.student_user_id = i.student_user_id
        where i.id = payment_attempts.invoice_id and m.assigned_counsellor_id = public.current_counsellor_id()
      )
    )
  );

drop policy if exists "Students can read their own payment attempts" on public.payment_attempts;
create policy "Students can read their own payment attempts"
  on public.payment_attempts for select to authenticated
  using (exists (select 1 from public.invoices i where i.id = payment_attempts.invoice_id and i.student_user_id = auth.uid()));

drop policy if exists "super_admin/admin/finance can create payment attempts" on public.payment_attempts;
create policy "super_admin/admin/finance can create payment attempts"
  on public.payment_attempts for insert to authenticated
  with check (public.is_admin_role(array['super_admin', 'admin', 'finance']));

drop policy if exists "Students can create payment attempts on their own invoices" on public.payment_attempts;
create policy "Students can create payment attempts on their own invoices"
  on public.payment_attempts for insert to authenticated
  with check (exists (select 1 from public.invoices i where i.id = payment_attempts.invoice_id and i.student_user_id = auth.uid()));

drop policy if exists "super_admin/admin/finance can update payment attempts" on public.payment_attempts;
create policy "super_admin/admin/finance can update payment attempts"
  on public.payment_attempts for update to authenticated
  using (public.is_admin_role(array['super_admin', 'admin', 'finance']))
  with check (public.is_admin_role(array['super_admin', 'admin', 'finance']));

-- No update policy for students — once created, an attempt's status only
-- ever changes via server-side reconciliation against Razorpay (a verified
-- checkout signature, a fetchPayment call, or a webhook), all of which run
-- through the admin-equivalent server-only Supabase client actions in
-- src/lib/payments/*, never a direct client-writable path. The webhook
-- route handler itself authenticates to Supabase the same way any other
-- server-side code in this project does (the publishable-key client) and
-- is only able to write here because those actions are admin-permission
-- gated at the RLS layer — see docs/payments-billing-guide.md §6 for the
-- exact call chain.

drop trigger if exists set_payment_attempts_updated_at on public.payment_attempts;
create trigger set_payment_attempts_updated_at before update on public.payment_attempts for each row execute function public.set_updated_at();


-- ============================================================================
-- PART 6 — Payment transactions (individual gateway payment records)
-- ============================================================================

create table if not exists public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  payment_attempt_id uuid not null references public.payment_attempts (id) on delete cascade,
  provider_payment_id text,
  is_manual boolean not null default false,
  status text not null,
  amount_minor_units bigint not null,
  amount_refunded_minor_units bigint not null default 0,
  currency text not null default 'INR',
  method_category text,
  captured_at timestamptz,
  failure_reason text,
  raw_status text,
  recorded_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_transactions_amount_check check (amount_minor_units >= 0 and amount_refunded_minor_units >= 0),
  constraint payment_transactions_status_check check (status in ('created', 'authorized', 'captured', 'failed', 'refunded', 'partially_refunded')),
  constraint payment_transactions_manual_requires_no_provider_id check (not is_manual or provider_payment_id is null)
);

create index if not exists payment_transactions_attempt_idx on public.payment_transactions (payment_attempt_id);
create index if not exists payment_transactions_status_idx on public.payment_transactions (status);
create unique index if not exists payment_transactions_provider_payment_unique
  on public.payment_transactions (provider_payment_id)
  where provider_payment_id is not null;

comment on table public.payment_transactions is
  'Milestone 8 — one row per Razorpay payment id observed against an attempt (usually one, occasionally more if the customer retries after a failure on the same order), OR one row per admin-recorded OFFLINE payment (is_manual = true, provider_payment_id always null for these — payment_transactions_manual_requires_no_provider_id enforces the two never mix). `recorded_by` is set for offline rows (which admin recorded it) and null for gateway rows. `status` on a non-manual row only ever moves forward based on cryptographically verified evidence (a verified checkout signature -> "authorized"; a verified webhook or admin fetchPayment reconciliation -> "captured"/"failed"/"refunded") — never because the browser merely returned to a success URL. `provider_payment_id`/`failure_reason`/`raw_status` never contain card numbers, CVVs, or other payment credentials — Razorpay itself never sends this system that data. See docs/payments-billing-guide.md §11 for why offline (is_manual) rows must always render visibly differently from gateway-verified ones in every UI that shows them.';

alter table public.payment_transactions enable row level security;

drop policy if exists "super_admin/admin/finance/analyst/counsellor can read payment transactions" on public.payment_transactions;
create policy "super_admin/admin/finance/analyst/counsellor can read payment transactions"
  on public.payment_transactions for select to authenticated
  using (
    public.is_admin_role(array['super_admin', 'admin', 'finance', 'analyst'])
    or (
      public.is_admin_role(array['counsellor'])
      and exists (
        select 1 from public.payment_attempts pa
        join public.invoices i on i.id = pa.invoice_id
        join public.admin_student_meta m on m.student_user_id = i.student_user_id
        where pa.id = payment_transactions.payment_attempt_id and m.assigned_counsellor_id = public.current_counsellor_id()
      )
    )
  );

drop policy if exists "Students can read their own payment transactions" on public.payment_transactions;
create policy "Students can read their own payment transactions"
  on public.payment_transactions for select to authenticated
  using (
    exists (
      select 1 from public.payment_attempts pa
      join public.invoices i on i.id = pa.invoice_id
      where pa.id = payment_transactions.payment_attempt_id and i.student_user_id = auth.uid()
    )
  );

drop policy if exists "super_admin/admin/finance can write payment transactions" on public.payment_transactions;
create policy "super_admin/admin/finance can write payment transactions"
  on public.payment_transactions for all to authenticated
  using (public.is_admin_role(array['super_admin', 'admin', 'finance']))
  with check (public.is_admin_role(array['super_admin', 'admin', 'finance']));

-- Every write path here — the checkout-verification server action, the
-- webhook handler, and the manual "refresh status" reconciliation action —
-- runs as an authenticated admin-permission-gated server action (see
-- src/lib/supabase/admin/payment-attempts.ts). A student's own successful
-- checkout is recorded by that same server-side code acting on their
-- behalf, not by a client-writable RLS grant, so this policy is
-- deliberately admin-role-only even though students trigger the underlying
-- action.

drop trigger if exists set_payment_transactions_updated_at on public.payment_transactions;
create trigger set_payment_transactions_updated_at before update on public.payment_transactions for each row execute function public.set_updated_at();


-- ============================================================================
-- PART 6.5 — recompute_invoice_status()
--
-- SECURITY CORRECTION (applied after initial release): this function was
-- originally SECURITY DEFINER with no explicit execution grants, which meant
-- ANY authenticated caller could invoke it (PUBLIC's default EXECUTE grant)
-- and have its body run with the function OWNER's privileges — bypassing
-- invoice RLS entirely for both the SELECT and UPDATE inside it, regardless
-- of whether the caller was an admin, the invoice's own student, or a
-- completely unrelated student. That is now fixed: this function is
-- SECURITY INVOKER (runs with the CALLING role's own privileges, so its
-- internal SELECT/UPDATE against public.invoices/payment_transactions/
-- payment_attempts/refunds are fully subject to those tables' normal RLS
-- policies for whoever is actually calling it) and PART 10 below explicitly
-- revokes PUBLIC's default EXECUTE grant and re-grants only to
-- `authenticated`.
--
-- This still works correctly for both callers that rely on it:
--   - A direct RPC call from an authenticated super_admin/admin/finance
--     server action (src/lib/supabase/admin/invoices.ts's
--     recordOfflinePayment, src/lib/supabase/admin/payment-attempts.ts's
--     reconcilePaymentAttempt) succeeds because those roles satisfy the
--     existing "super_admin/admin/finance can update invoices" RLS policy —
--     no change needed there.
--   - A nested call from inside apply_webhook_event() (PART 8, still
--     SECURITY DEFINER) continues to work because PostgreSQL evaluates a
--     SECURITY INVOKER function called from within a SECURITY DEFINER
--     function under the DEFINER's already-elevated role for the duration
--     of that call chain (the "invoker" at that point in execution IS the
--     outer function's owner) — and a function's owner always retains
--     implicit EXECUTE on functions it owns regardless of PART 10's REVOKE.
--     Nothing about the webhook flow's behavior changes.
--
-- What DOES change: a student (or any non-admin authenticated user) who
-- tries to call this RPC directly can no longer use it to read or silently
-- "update" an invoice they don't own — the internal SELECT returns no rows
-- for an invoice outside their own RLS visibility (raises "Invoice not
-- found" below, same as before), and even for their OWN invoice the
-- internal UPDATE now affects zero rows (there is still no student UPDATE
-- policy on public.invoices) rather than silently succeeding under an
-- owner-privileged DEFINER context — see the explicit post-UPDATE check
-- added below, which turns that into a clear exception instead of a
-- silently null-filled return value.
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

comment on function public.recompute_invoice_status(uuid) is
  'Re-derives an invoice''s status from the sum of its captured payment_transactions and processed refunds. The one and only place invoice status transitions happen for payment-driven reasons — never set directly by application code. SECURITY INVOKER (corrected from an original SECURITY DEFINER release) — runs with the calling role''s own privileges, so a direct call is fully subject to invoices/payment_transactions/payment_attempts/refunds RLS; only reaches elevated privileges when called from inside another SECURITY DEFINER function (apply_webhook_event), which is unaffected by this change. EXECUTE is restricted to `authenticated` only — see PART 10. See src/lib/payments/invoice-status.ts for the equivalent decision table mirrored in TypeScript for UI display/testing purposes (SQL here remains authoritative for the actual write).';


-- ============================================================================
-- PART 6.6 — verify_checkout_payment()
--
-- Called immediately after Razorpay Checkout''s client-side success handler
-- fires (razorpay_payment_id/razorpay_order_id/razorpay_signature), from a
-- Next.js Server Action running as the STUDENT''S OWN authenticated session
-- (or an admin''s). Independently re-derives Razorpay''s checkout signature
-- (payload = order_id || "|" || payment_id, HMAC-SHA256 with the Razorpay
-- key secret, hex-encoded — the exact algorithm razorpay-node''s
-- validatePaymentVerification() implements) using the secret stored in
-- payment_gateway_config, NOT whatever the caller claims. A forged
-- signature (or a signature copied from a different order/payment than the
-- one being targeted) is rejected. On success this marks the transaction/
-- attempt "authorized" ONLY — never "captured" — because a verified
-- checkout signature proves the payment genuinely belongs to this order,
-- not that Razorpay has finished capturing it; the webhook (or an admin''s
-- manual reconciliation) is what ever moves a transaction to "captured".
-- ============================================================================

create or replace function public.verify_checkout_payment(
  p_payment_attempt_id uuid,
  p_provider_payment_id text,
  p_provider_order_id text,
  p_signature text
)
returns public.payment_attempts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt public.payment_attempts;
  v_invoice public.invoices;
  v_secret text;
  v_expected text;
begin
  if p_payment_attempt_id is null or p_provider_payment_id is null or p_provider_order_id is null or p_signature is null then
    raise exception 'Missing required checkout verification parameters.';
  end if;

  select * into v_attempt from public.payment_attempts where id = p_payment_attempt_id;
  if v_attempt.id is null then
    raise exception 'Payment attempt not found.';
  end if;

  select * into v_invoice from public.invoices where id = v_attempt.invoice_id;

  if not (
    public.is_admin_role(array['super_admin', 'admin', 'finance'])
    or (auth.uid() is not null and auth.uid() = v_invoice.student_user_id)
  ) then
    raise exception 'You are not authorized to verify this payment.';
  end if;

  if v_attempt.provider_order_id is null or v_attempt.provider_order_id <> p_provider_order_id then
    raise exception 'This signature does not correspond to the payment attempt being verified.';
  end if;

  select razorpay_key_secret into v_secret from public.payment_gateway_config where id = 1;
  if v_secret is null or length(trim(v_secret)) = 0 then
    raise exception 'Payment gateway is not configured.';
  end if;

  v_expected := encode(hmac(p_provider_order_id || '|' || p_provider_payment_id, v_secret, 'sha256'), 'hex');
  if v_expected <> p_signature then
    raise exception 'Invalid payment signature.';
  end if;

  insert into public.payment_transactions (payment_attempt_id, provider_payment_id, status, amount_minor_units, currency, raw_status)
  values (v_attempt.id, p_provider_payment_id, 'authorized', v_attempt.amount_minor_units, v_attempt.currency, 'checkout_signature_verified')
  on conflict (provider_payment_id) where provider_payment_id is not null do update
    set updated_at = now();

  update public.payment_attempts
    set status = 'authorized'
    where id = p_payment_attempt_id and status in ('created', 'pending')
    returning * into v_attempt;

  if v_attempt.id is null then
    select * into v_attempt from public.payment_attempts where id = p_payment_attempt_id;
  end if;

  return v_attempt;
end;
$$;

comment on function public.verify_checkout_payment(uuid, text, text, text) is
  'The only way a checkout-completed signal from the browser ever reaches the database. Independently re-verifies Razorpay''s HMAC signature using the secret in payment_gateway_config — a caller (student, or anyone with a valid session) cannot forge acceptance by supplying arbitrary parameters, since only a signature Razorpay itself produced will pass. Marks the transaction "authorized", never "captured" — see docs/payments-billing-guide.md §4.';


-- ============================================================================
-- PART 7 — Refunds
-- ============================================================================

create table if not exists public.refunds (
  id uuid primary key default gen_random_uuid(),
  payment_transaction_id uuid not null references public.payment_transactions (id) on delete restrict,
  invoice_id uuid not null references public.invoices (id) on delete restrict,
  provider_refund_id text,
  amount_minor_units bigint not null,
  status text not null default 'requested',
  reason text,
  initiated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint refunds_amount_check check (amount_minor_units > 0),
  constraint refunds_status_check check (status in ('requested', 'processing', 'processed', 'failed'))
);

create index if not exists refunds_transaction_idx on public.refunds (payment_transaction_id);
create index if not exists refunds_invoice_idx on public.refunds (invoice_id);
create index if not exists refunds_status_idx on public.refunds (status);

-- At most one in-flight (not yet processed/failed) refund per transaction
-- at a time — keeps apply_webhook_event()'s refund.processed/refund.failed
-- matching in PART 8 unambiguous, and stops an admin from double-submitting
-- two overlapping refund requests against the same payment.
create unique index if not exists refunds_one_open_per_transaction
  on public.refunds (payment_transaction_id)
  where status in ('requested', 'processing');

comment on table public.refunds is
  'Milestone 8 — a refund requested against a captured payment_transaction. `on delete restrict` on both foreign keys because a refund is itself a financial record that must never be silently orphaned or removed by a cascading delete elsewhere. Only super_admin/admin/finance can initiate one; every attempt is audited (src/lib/supabase/admin/refunds.ts). refunds_one_open_per_transaction keeps at most one in-flight refund per transaction, so webhook reconciliation always has an unambiguous row to update.';

alter table public.refunds enable row level security;

drop policy if exists "super_admin/admin/finance/analyst can read refunds" on public.refunds;
create policy "super_admin/admin/finance/analyst can read refunds"
  on public.refunds for select to authenticated
  using (public.is_admin_role(array['super_admin', 'admin', 'finance', 'analyst']));

drop policy if exists "Students can read refunds on their own invoices" on public.refunds;
create policy "Students can read refunds on their own invoices"
  on public.refunds for select to authenticated
  using (exists (select 1 from public.invoices i where i.id = refunds.invoice_id and i.student_user_id = auth.uid()));

drop policy if exists "super_admin/admin/finance can write refunds" on public.refunds;
create policy "super_admin/admin/finance can write refunds"
  on public.refunds for all to authenticated
  using (public.is_admin_role(array['super_admin', 'admin', 'finance']))
  with check (public.is_admin_role(array['super_admin', 'admin', 'finance']));

drop trigger if exists set_refunds_updated_at on public.refunds;
create trigger set_refunds_updated_at before update on public.refunds for each row execute function public.set_updated_at();


-- ============================================================================
-- PART 8 — Webhook events (idempotency ledger)
-- ============================================================================

create table if not exists public.payment_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'razorpay',
  event_id text not null,
  event_type text not null,
  processing_status text not null default 'received',
  related_invoice_id uuid references public.invoices (id) on delete set null,
  related_payment_attempt_id uuid references public.payment_attempts (id) on delete set null,
  related_payment_transaction_id uuid references public.payment_transactions (id) on delete set null,
  diagnostic_message text,
  payload_summary jsonb,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  constraint payment_webhook_events_processing_status_check check (processing_status in ('received', 'processed', 'ignored', 'failed')),
  constraint payment_webhook_events_provider_event_unique unique (provider, event_id)
);

create index if not exists payment_webhook_events_type_idx on public.payment_webhook_events (event_type);
create index if not exists payment_webhook_events_created_at_idx on public.payment_webhook_events (created_at);
create index if not exists payment_webhook_events_invoice_idx on public.payment_webhook_events (related_invoice_id);

comment on table public.payment_webhook_events is
  'Milestone 8 — append-only ledger of every Razorpay webhook delivery this system has verified and accepted for processing. `event_id` is a deterministic fingerprint (SHA-256 hex of the raw, signature-verified request body, computed in this function via digest(p_raw_body, ''sha256'') — see PART 8''s apply_webhook_event() below), NOT a header Razorpay is guaranteed to send on every plan; `payment_webhook_events_provider_event_unique` is the actual duplicate-delivery guard — a second delivery of byte-identical content collides on insert and is treated as already-processed, never reprocessed. `payload_summary` holds only a small, redacted summary (event type, entity id, amount, status) — never the raw webhook body, which could contain more than this system needs to retain.';

alter table public.payment_webhook_events enable row level security;

drop policy if exists "super_admin/admin/finance can read webhook events" on public.payment_webhook_events;
create policy "super_admin/admin/finance can read webhook events"
  on public.payment_webhook_events for select to authenticated
  using (public.is_admin_role(array['super_admin', 'admin', 'finance']));

drop policy if exists "super_admin/admin/finance can write webhook events" on public.payment_webhook_events;
create policy "super_admin/admin/finance can write webhook events"
  on public.payment_webhook_events for all to authenticated
  using (public.is_admin_role(array['super_admin', 'admin', 'finance']))
  with check (public.is_admin_role(array['super_admin', 'admin', 'finance']));

-- The webhook ROUTE HANDLER itself (src/app/api/webhooks/razorpay/route.ts)
-- is called by Razorpay's servers, not a signed-in admin, and carries no
-- Supabase session at all. apply_webhook_event() below is the sole write
-- path for webhook-driven state: it independently re-verifies Razorpay's
-- own webhook signature (HMAC-SHA256 of the RAW request body using the
-- webhook secret in payment_gateway_config — the exact algorithm
-- razorpay-node's validateWebhookSignature() implements) before trusting
-- anything in the body, so it is safe to call with no session at all — the
-- verification IS the authorization. The route handler also verifies the
-- signature itself in Node first (fast-fail on obviously invalid requests
-- without a DB round trip), but this function is the authoritative check
-- for the actual privileged write, not the Node check.
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
  -- Deterministic fingerprint: hash of the verified raw body itself. A true
  -- duplicate delivery resends byte-identical content -> identical
  -- fingerprint -> caught by payment_webhook_events_provider_event_unique.
  -- A different event (even for the same payment, e.g. authorized then
  -- captured) has different content -> different fingerprint -> processed
  -- as its own event, in whatever order it arrives (see the "only move
  -- forward" state logic below for out-of-order handling).
  v_fingerprint := encode(digest(p_raw_body, 'sha256'), 'hex');

  -- Idempotency: reserve this event_id first. If it already exists, this
  -- delivery is a duplicate — return immediately without touching any
  -- other table.
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
                -- Only move forward: never let a late/out-of-order
                -- 'authorized' overwrite an already-'captured' row, and
                -- never resurrect a 'failed' row.
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

    if v_provider_payment_id is null then
      v_diagnostic := 'Missing payment id in refund payload.';
    else
      select * into v_txn from public.payment_transactions where provider_payment_id = v_provider_payment_id;
      if v_txn.id is null then
        v_diagnostic := 'No matching payment_transactions row for this refund — event ignored.';
      else
        select * into v_attempt from public.payment_attempts where id = v_txn.payment_attempt_id;

        update public.refunds
          set provider_refund_id = v_provider_refund_id,
              status = case when v_event_type = 'refund.processed' then 'processed' else 'failed' end,
              updated_at = now()
          where payment_transaction_id = v_txn.id
            and (provider_refund_id = v_provider_refund_id or (provider_refund_id is null and status in ('requested', 'processing')))
          returning id into v_related_txn_id; -- reused var only to detect a match; see below

        if v_event_type = 'refund.processed' then
          update public.payment_transactions
            set amount_refunded_minor_units = least(amount_minor_units, amount_refunded_minor_units + coalesce(v_amount, 0)),
                status = case when amount_refunded_minor_units + coalesce(v_amount, 0) >= amount_minor_units then 'refunded' else 'partially_refunded' end,
                updated_at = now()
            where id = v_txn.id;

          perform public.recompute_invoice_status(v_attempt.invoice_id);
        end if;

        v_related_invoice_id := v_attempt.invoice_id;
        v_related_attempt_id := v_attempt.id;
        v_related_txn_id := v_txn.id;
        v_processing_status := 'processed';
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
  'The only entry point for Razorpay webhook deliveries. Independently re-verifies the webhook HMAC signature against payment_gateway_config before trusting any field in the body — a request without a genuine Razorpay signature never reaches the parsing/state-transition logic below it. Idempotent via payment_webhook_events_provider_event_unique (keyed on a SHA-256 fingerprint of the verified raw body): a duplicate delivery returns {duplicate: true} without touching any other table. Handles payment.authorized/payment.captured/payment.failed and refund.processed/refund.failed; any other event type is recorded (for audit completeness) but marked processing_status = ''ignored''. "Only move forward" logic in the ON CONFLICT branch prevents a late/out-of-order authorized event from downgrading an already-captured transaction.';


-- ============================================================================
-- PART 9 — Payment request tokens (opaque payment-link identifiers)
-- ============================================================================

create table if not exists public.payment_request_tokens (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  token_hash text not null,
  expires_at timestamptz not null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  constraint payment_request_tokens_hash_unique unique (token_hash)
);

create index if not exists payment_request_tokens_invoice_idx on public.payment_request_tokens (invoice_id);

comment on table public.payment_request_tokens is
  'Milestone 8 — opaque "copy payment link" tokens. Only `token_hash` (SHA-256 of the raw token) is ever stored; the raw token itself exists only in the URL handed to the admin and is never written to this database or to admin_audit_log. A token is a LOOKUP CONVENIENCE ONLY: /pay/[token] resolves it to an invoice_id and then still requires the visitor to be signed in as that invoice''s own student before anything can be viewed or paid — RLS on invoices/payment_attempts/etc. is the actual ownership boundary, never bypassed by possessing a token. See docs/payments-billing-guide.md §8.';

alter table public.payment_request_tokens enable row level security;

drop policy if exists "super_admin/admin/finance can read payment request tokens" on public.payment_request_tokens;
create policy "super_admin/admin/finance can read payment request tokens"
  on public.payment_request_tokens for select to authenticated
  using (public.is_admin_role(array['super_admin', 'admin', 'finance']));

drop policy if exists "Students can read tokens for their own invoices" on public.payment_request_tokens;
create policy "Students can read tokens for their own invoices"
  on public.payment_request_tokens for select to authenticated
  using (exists (select 1 from public.invoices i where i.id = payment_request_tokens.invoice_id and i.student_user_id = auth.uid()));

drop policy if exists "super_admin/admin/finance can write payment request tokens" on public.payment_request_tokens;
create policy "super_admin/admin/finance can write payment request tokens"
  on public.payment_request_tokens for all to authenticated
  using (public.is_admin_role(array['super_admin', 'admin', 'finance']))
  with check (public.is_admin_role(array['super_admin', 'admin', 'finance']));


-- ============================================================================
-- PART 9.5 — SECURITY DEFINER audit summary (SECURITY CORRECTION)
--
-- Every SECURITY DEFINER function this migration defines was reviewed
-- against four criteria after the PART 6.5 correction above. Recorded here
-- as an explicit, checkable statement rather than left implicit:
--
--                          fixed safe   internal auth/    cannot bypass RLS   cannot change
--                          search_path  crypto check       to expose data      arbitrary invoices
-- next_invoice_number()        yes      current_admin_role()  n/a — touches       yes — only ever
--                                        is not null, or       only invoice_      returns a formatted
--                                        raises                number_sequences,  number string, never
--                                                              never invoices/    invoice/payment data
--                                                              payment data
-- verify_checkout_payment()    yes      admin role OR         only writes the    yes — resolves the
--                                        auth.uid() =          ONE payment_       target invoice from
--                                        invoice's own         attempt matched    p_payment_attempt_id,
--                                        student_user_id,      by id + a          not from an invoice id
--                                        AND independent       matching           supplied directly;
--                                        HMAC signature         provider_order_id  requires a genuine
--                                        re-derivation                            Razorpay signature
-- apply_webhook_event()        yes      independent HMAC      writes only rows   yes — every row it
--                                        signature re-          matched via        touches is looked up
--                                        derivation against     provider_order_id/ by a Razorpay-issued
--                                        payment_gateway_       provider_          identifier already
--                                        config BEFORE          payment_id         present in a payment_
--                                        parsing/trusting       already on file    attempts/payment_
--                                        anything in the                          transactions row —
--                                        body                                     never an arbitrary
--                                                                                  client-supplied
--                                                                                  invoice id
--
-- recompute_invoice_status() is intentionally NOT in this table — it was
-- the one function found to violate these properties (see the PART 6.5
-- comment above for the full before/after) and has been changed to
-- SECURITY INVOKER precisely so it no longer needs to meet this bar: it now
-- inherits whatever RLS applies to its actual caller, rather than needing
-- its own internal authorization check.
-- ============================================================================


-- ============================================================================
-- PART 10 — Explicit function execution privileges (SECURITY CORRECTION)
--
-- By default, PostgreSQL grants EXECUTE on every newly created function to
-- the PUBLIC pseudo-role, which in a Supabase project means both the `anon`
-- and `authenticated` roles can call it unless revoked. The four functions
-- this migration defines were not given explicit grants in the original
-- release, which is exactly what let PART 6.5's now-fixed
-- recompute_invoice_status() bug be reachable by any authenticated caller
-- in the first place. This section closes that gap for all four functions,
-- following least privilege: nobody gets more than the one Postgres role
-- that this application's actual call sites need (see the call sites cited
-- next to each grant below; they are exhaustive as of this migration —
-- src/app/api/webhooks/razorpay/route.ts, src/lib/supabase/payments/
-- checkout.ts, src/lib/supabase/admin/invoices.ts, src/lib/supabase/admin/
-- payment-attempts.ts).
--
-- This does not, by itself, make any of these four functions "safe" to
-- call broadly — each one's own body is what actually enforces correctness
-- (an internal role/ownership check, or an independent cryptographic
-- signature re-derivation) exactly as documented at each function's own
-- definition above. These grants are defense in depth on top of that, not
-- a replacement for it: narrowing WHO may even attempt the call, while the
-- function body itself still governs what a permitted call may actually do.
-- ============================================================================

revoke execute on function public.next_invoice_number() from public;
revoke execute on function public.recompute_invoice_status(uuid) from public;
revoke execute on function public.verify_checkout_payment(uuid, text, text, text) from public;
revoke execute on function public.apply_webhook_event(text, text) from public;

-- Called only from authenticated admin server actions when issuing an
-- invoice (src/lib/supabase/admin/invoices.ts's issueInvoice). Internally
-- re-checks public.current_admin_role() is not null before doing anything,
-- so this grant is defense in depth, not the only check.
grant execute on function public.next_invoice_number() to authenticated;

-- Called from authenticated admin server actions only (recordOfflinePayment,
-- reconcilePaymentAttempt — see the PART 6.5 comment above for the full
-- analysis of why this remains safe for both that direct path and the
-- nested call from inside apply_webhook_event). Not granted to `anon` —
-- there is no unauthenticated call site for this function anywhere in the
-- application.
grant execute on function public.recompute_invoice_status(uuid) to authenticated;

-- Called from src/lib/supabase/payments/checkout.ts's verifyCheckoutPayment,
-- always after the caller has an authenticated Supabase session (a student
-- verifying their own checkout, or an admin). The function's own body
-- additionally re-checks that the caller is either an admin role or the
-- invoice's own student (auth.uid() = invoices.student_user_id) before
-- accepting anything — this grant only controls who may attempt the call.
grant execute on function public.verify_checkout_payment(uuid, text, text, text) to authenticated;

-- Called ONLY from src/app/api/webhooks/razorpay/route.ts, which
-- deliberately carries no Supabase session (Razorpay's servers have no
-- user to authenticate as) and therefore executes as the `anon` Postgres
-- role — see that file's own top-of-file comment. Granting this to `anon`
-- and NOT to `authenticated` reflects the actual minimum role the one real
-- caller runs as; no authenticated-session code path in this application
-- ever calls it. This is safe specifically because the function body
-- independently re-verifies Razorpay's HMAC-SHA256 webhook signature
-- against the secret in payment_gateway_config before trusting or writing
-- anything (PART 8 above) — the grant controls who may attempt the call,
-- the signature check controls whether the attempt succeeds.
grant execute on function public.apply_webhook_event(text, text) to anon;


-- ============================================================================
-- PART 11 — Security verification queries (run manually after applying this
-- migration; not executed automatically by this file)
--
-- has_function_privilege() lets you confirm, from inside the SQL Editor,
-- that PART 10's grants above landed exactly as intended — useful right
-- after first applying this migration, and worth re-running after any
-- future edit to this file's grants. Every query below is read-only and
-- safe to run as many times as you like; none of them require or use the
-- BOOTSTRAP secrets.
--
-- Expected results (all four function signatures use the same regprocedure
-- cast; PostgreSQL will resolve the specific overload from the argument
-- types given):
--
-- 1) `authenticated` SHOULD be able to execute all four:
--
-- select
--   has_function_privilege('authenticated', 'public.next_invoice_number()', 'execute') as next_invoice_number,
--   has_function_privilege('authenticated', 'public.recompute_invoice_status(uuid)', 'execute') as recompute_invoice_status,
--   has_function_privilege('authenticated', 'public.verify_checkout_payment(uuid,text,text,text)', 'execute') as verify_checkout_payment,
--   has_function_privilege('authenticated', 'public.apply_webhook_event(text,text)', 'execute') as apply_webhook_event;
-- -- expected: true, true, true, false  (apply_webhook_event is anon-only, not authenticated)
--
-- 2) `anon` should be able to execute ONLY apply_webhook_event:
--
-- select
--   has_function_privilege('anon', 'public.next_invoice_number()', 'execute') as next_invoice_number,
--   has_function_privilege('anon', 'public.recompute_invoice_status(uuid)', 'execute') as recompute_invoice_status,
--   has_function_privilege('anon', 'public.verify_checkout_payment(uuid,text,text,text)', 'execute') as verify_checkout_payment,
--   has_function_privilege('anon', 'public.apply_webhook_event(text,text)', 'execute') as apply_webhook_event;
-- -- expected: false, false, false, true
--
-- 3) PUBLIC itself should be able to execute none of the four (confirms the
--    REVOKE ... FROM PUBLIC statements above actually took effect — a
--    non-empty result here means a grant is broader than intended):
--
-- select
--   has_function_privilege('public', 'public.next_invoice_number()', 'execute') as next_invoice_number,
--   has_function_privilege('public', 'public.recompute_invoice_status(uuid)', 'execute') as recompute_invoice_status,
--   has_function_privilege('public', 'public.verify_checkout_payment(uuid,text,text,text)', 'execute') as verify_checkout_payment,
--   has_function_privilege('public', 'public.apply_webhook_event(text,text)', 'execute') as apply_webhook_event;
-- -- expected: false, false, false, false
--
-- 4) Confirm the security mode (DEFINER vs INVOKER) of each function
--    matches what's documented above — `true` in prosecdef means SECURITY
--    DEFINER; `false` means SECURITY INVOKER:
--
-- select p.proname, p.prosecdef as is_security_definer
-- from pg_proc p
-- join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public'
--   and p.proname in ('next_invoice_number', 'recompute_invoice_status', 'verify_checkout_payment', 'apply_webhook_event')
-- order by p.proname;
-- -- expected: apply_webhook_event=true, next_invoice_number=true,
-- --           recompute_invoice_status=false, verify_checkout_payment=true
--
-- 5) End-to-end RLS behavior check for the actual bug this correction
--    fixes — run this AS a non-admin authenticated test user (e.g. via
--    `set local role authenticated; set local request.jwt.claims = ...` in
--    a scratch session, or by testing through the app UI/API as a real
--    student account) against an invoice_id that belongs to a DIFFERENT
--    student:
--
-- select public.recompute_invoice_status('<some other student''s invoice id>'::uuid);
-- -- expected: raises "Invoice not found." (RLS makes the row invisible to
-- -- the SELECT inside the function) — it must NOT return that invoice's
-- -- data, and it must NOT be able to change its status.
-- ============================================================================


-- ============================================================================
-- BOOTSTRAP — one manual step required after running this file (in
-- addition to the super_admin bootstrap already documented in
-- 0004_admin_system.sql, if you have not done that yet).
--
-- billing_settings is seeded with its single empty row automatically above
-- (PART 1) — no manual step needed there. No tax/GST fields will appear on
-- any invoice until a super_admin/admin/finance user fills them in at
-- /admin/billing-settings.
--
-- payment_gateway_config, however, MUST be populated manually before any
-- real checkout or webhook can be verified — without this, every checkout
-- verification and every webhook delivery fails closed with "Payment
-- gateway is not configured" (by design — see PART 0 above). Copy the
-- EXACT SAME values you set for RAZORPAY_KEY_SECRET and
-- RAZORPAY_WEBHOOK_SECRET in your server environment (.env.local locally,
-- your hosting provider's environment settings in production) into the
-- statement below, then run just this one statement in the SQL Editor:
--
-- update public.payment_gateway_config
-- set razorpay_key_secret = 'paste_your_RAZORPAY_KEY_SECRET_value_here',
--     razorpay_webhook_secret = 'paste_your_RAZORPAY_WEBHOOK_SECRET_value_here',
--     updated_at = now()
-- where id = 1;
--
-- Verify it worked (returns one row, values redacted here for your safety —
-- do not paste real secrets into a shared query result if this project is
-- shared with anyone who should not see them):
-- select id, (razorpay_key_secret is not null) as key_secret_set,
--        (razorpay_webhook_secret is not null) as webhook_secret_set, updated_at
-- from public.payment_gateway_config;
--
-- If you rotate either secret in Razorpay's dashboard later, re-run the
-- UPDATE above with the new value(s) — nothing else needs to change.
-- ============================================================================
