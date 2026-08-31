-- ============================================================================
-- Milestone 10 — NextWise Pricing & Offers
--
-- HOW TO RUN THIS (no SQL knowledge required):
--   1. Open your Supabase project dashboard (supabase.com/dashboard).
--   2. Click "SQL Editor" in the left sidebar.
--   3. Click "New query".
--   4. Paste the entire contents of this file.
--   5. Click "Run".
--   6. Then run supabase/seed/0004_pricing_offers_seed.sql once (see that
--      file's own header) to load the nine official NextWise plans.
--
-- Safe to run once. Re-running is also safe — every statement is written to
-- not fail if already applied (`if not exists` / `or replace` / `drop
-- policy if exists` before `create policy`), same convention as 0001-0006.
--
-- This migration does NOT modify 0001-0006 in place. It only ADDS new
-- tables, new columns (two nullable, additive columns on the existing
-- public.invoices table — PART 6), new functions, and new RLS policies.
-- public.invoices/invoice_line_items/payment_attempts/payment_transactions/
-- refunds/payment_webhook_events (0005_payments_billing.sql) are otherwise
-- left completely untouched: a plan purchase becomes an ordinary invoice in
-- that exact same ledger, flows through the exact same Razorpay checkout/
-- verification/webhook machinery, and appears in the exact same admin
-- invoices list — there is no second payment ledger anywhere in this file.
--
-- WHAT THIS MILESTONE ADDS, IN ONE SENTENCE EACH:
--   - pricing_plans        catalog identity: slug, category, display order,
--                           recommended flag, active flag.
--   - pricing_plan_versions immutable-once-published price/content
--                           snapshots, one-to-many under a plan. "Editing a
--                           price" is publishing a new version, never
--                           mutating an old one.
--   - pricing_offers       optional, plan-scoped discounts with their own
--                           draft/published/archived lifecycle, redemption
--                           limits, and an inactive-by-default posture.
--   - pricing_purchases    an immutable, append-only record of exactly what
--                           a student was charged and why, frozen at the
--                           moment of purchase — never recomputed from the
--                           plan's current price.
--   - pricing_analytics_events   a narrow, non-sensitive funnel-signal log
--                           (page view / plan selected / checkout started
--                           only — no amounts, no payment data).
--   - public.purchase_pricing_plan()   the one and only way a student's own
--                           browser can turn a plan selection into a real,
--                           priced, numbered invoice — see PART 7.
--
-- See docs/nextwise-pricing-offers-guide.md for the full design writeup,
-- including why each table is shaped the way it is and what was
-- deliberately left out (subscriptions, instalments, tax invention).
-- ============================================================================


-- ============================================================================
-- PART 1 — pricing_plans (catalog identity)
--
-- Deliberately does NOT itself carry price/currency/description — see
-- pricing_plan_versions below for why those live on the immutable version
-- row instead, and PART 2 for the deferred `current_version_id` link back
-- to it (a genuine circular reference between these two tables, resolved
-- with an ALTER TABLE ... ADD COLUMN after pricing_plan_versions exists).
-- ============================================================================

create table if not exists public.pricing_plans (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  category text not null,
  internal_name text not null,
  display_order integer not null default 0,
  is_recommended boolean not null default false,
  is_active boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pricing_plans_category_check
    check (category in ('school_counselling', 'class_11_counselling', 'class_12_counselling', 'bachelor_abroad', 'master_abroad')),
  constraint pricing_plans_slug_format_check check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

create index if not exists pricing_plans_category_idx on public.pricing_plans (category);
create index if not exists pricing_plans_active_idx on public.pricing_plans (is_active);

comment on table public.pricing_plans is
  'Milestone 10 — one row per sellable NextWise service (School Counselling, Class 11/12 Counselling, and the three Bachelor/Master Abroad tiers). Carries only catalog identity and display concerns (slug, category, display_order, is_recommended, is_active) — every price-bearing, describable field (title, description, currency, amount, included services) lives on pricing_plan_versions instead, so "the plan" and "what it currently costs" are never the same mutable row. `slug` is the stable identifier referenced by the seed file, the public pricing page anchors, and (indirectly, via pricing_purchases.plan_id) every historical invoice ever generated from this plan — never repurpose a slug for a different service.';

alter table public.pricing_plans enable row level security;

drop policy if exists "Anyone can read active pricing plans" on public.pricing_plans;
create policy "Anyone can read active pricing plans"
  on public.pricing_plans for select to anon, authenticated
  using (is_active = true);

drop policy if exists "super_admin/admin/finance/analyst can read all pricing plans" on public.pricing_plans;
create policy "super_admin/admin/finance/analyst can read all pricing plans"
  on public.pricing_plans for select to authenticated
  using (public.is_admin_role(array['super_admin', 'admin', 'finance', 'analyst']));

drop policy if exists "super_admin/admin/finance can create pricing plans" on public.pricing_plans;
create policy "super_admin/admin/finance can create pricing plans"
  on public.pricing_plans for insert to authenticated
  with check (public.is_admin_role(array['super_admin', 'admin', 'finance']));

drop policy if exists "super_admin/admin/finance can update pricing plans" on public.pricing_plans;
create policy "super_admin/admin/finance can update pricing plans"
  on public.pricing_plans for update to authenticated
  using (public.is_admin_role(array['super_admin', 'admin', 'finance']))
  with check (public.is_admin_role(array['super_admin', 'admin', 'finance']));

-- Deliberately no delete policy for anyone, and no write access at all for
-- counsellor/content_editor — spec: "Counsellors must not modify pricing",
-- "Content managers must not modify financial values unless explicitly
-- authorized" (this migration does not explicitly authorize it, so
-- content_editor gets none). A plan that should stop being offered is
-- deactivated (is_active = false) or has its versions archived, never
-- deleted — see docs/nextwise-pricing-offers-guide.md §3.

drop trigger if exists set_pricing_plans_updated_at on public.pricing_plans;
create trigger set_pricing_plans_updated_at before update on public.pricing_plans for each row execute function public.set_updated_at();


-- ============================================================================
-- PART 2 — pricing_plan_versions (immutable-once-published price snapshots)
--
-- "When a price changes: create a new version. Do not overwrite the
-- historical version used by an invoice." — spec. RLS alone cannot express
-- "most columns of some rows are frozen, but a status transition is still
-- allowed" — only a trigger can, so PART 2.1 below adds one. A row's
-- content is fully editable while status = 'draft'; once it becomes
-- 'published' (or 'archived'), every column except `status` itself (and
-- only the published -> archived transition) is locked for the rest of
-- that row's life. Changing anything else means creating a new row with
-- version_number + 1, which is exactly what "create a new price version"
-- means throughout the admin UI.
-- ============================================================================

create table if not exists public.pricing_plan_versions (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.pricing_plans (id) on delete cascade,
  version_number integer not null,
  public_title text not null,
  short_description text,
  detailed_description text,
  currency text not null default 'INR',
  amount_minor_units bigint not null,
  payment_type text not null default 'one_time',
  billing_interval text,
  included_services jsonb not null default '[]'::jsonb,
  exclusions jsonb not null default '[]'::jsonb,
  cta_text text,
  tax_status text not null default 'unconfigured',
  status text not null default 'draft',
  effective_from timestamptz,
  effective_until timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plan_id, version_number),
  constraint pricing_plan_versions_amount_check check (amount_minor_units >= 0),
  -- Spec: "The supplied prices are one-time prices... Do not implement
  -- recurring subscriptions." This CHECK is the actual enforcement, not
  -- just an unused enum member: no code path anywhere in this migration or
  -- the application can ever store anything but 'one_time' here without a
  -- future, separately reviewed migration deliberately loosening it.
  constraint pricing_plan_versions_payment_type_check check (payment_type in ('one_time')),
  constraint pricing_plan_versions_billing_interval_check check (billing_interval is null),
  constraint pricing_plan_versions_tax_status_check check (tax_status in ('unconfigured', 'tax_exclusive', 'tax_inclusive')),
  constraint pricing_plan_versions_status_check check (status in ('draft', 'published', 'archived')),
  constraint pricing_plan_versions_effective_range_check check (effective_from is null or effective_until is null or effective_until > effective_from)
);

create index if not exists pricing_plan_versions_plan_idx on public.pricing_plan_versions (plan_id);
create index if not exists pricing_plan_versions_status_idx on public.pricing_plan_versions (status);
create index if not exists pricing_plan_versions_effective_idx on public.pricing_plan_versions (effective_from, effective_until);

comment on table public.pricing_plan_versions is
  'Milestone 10 — one row per priced revision of a pricing_plans row. `amount_minor_units` is an integer in `currency`''s minor unit (paise for INR) — same convention as public.invoices. `payment_type` is constrained to ''one_time'' only and `billing_interval` to null only: this migration deliberately does not implement subscriptions or instalments (spec). `included_services`/`exclusions` are jsonb arrays of {label, description} objects, always admin-entered — application code never fabricates a default benefit list; until an admin fills these in, the public pricing page shows neutral wording ("Contact NextWise for the detailed service scope") instead of an invented one. `tax_status` is a descriptive flag for accountant/legal review only (whether this plan''s stated price is meant to be tax-exclusive or tax-inclusive once GST is actually configured) — see PART 7''s purchase_pricing_plan(), which always computes any configured tax as an ADDITION on top of amount_minor_units, matching how every other invoice in this system already computes tax (src/lib/payments/invoice-math.ts); a true tax-inclusive back-calculation is deliberately not implemented (see docs/nextwise-pricing-offers-guide.md §9 for why). Immutable once status leaves ''draft'' — see PART 2.1''s trigger.';

alter table public.pricing_plan_versions enable row level security;

drop policy if exists "Anyone can read published, currently effective plan versions" on public.pricing_plan_versions;
create policy "Anyone can read published, currently effective plan versions"
  on public.pricing_plan_versions for select to anon, authenticated
  using (
    status = 'published'
    and (effective_from is null or effective_from <= now())
    and (effective_until is null or effective_until >= now())
    and exists (select 1 from public.pricing_plans p where p.id = pricing_plan_versions.plan_id and p.is_active = true)
  );

drop policy if exists "super_admin/admin/finance/analyst can read all plan versions" on public.pricing_plan_versions;
create policy "super_admin/admin/finance/analyst can read all plan versions"
  on public.pricing_plan_versions for select to authenticated
  using (public.is_admin_role(array['super_admin', 'admin', 'finance', 'analyst']));

drop policy if exists "super_admin/admin/finance can create plan versions" on public.pricing_plan_versions;
create policy "super_admin/admin/finance can create plan versions"
  on public.pricing_plan_versions for insert to authenticated
  with check (public.is_admin_role(array['super_admin', 'admin', 'finance']));

drop policy if exists "super_admin/admin/finance can update plan versions" on public.pricing_plan_versions;
create policy "super_admin/admin/finance can update plan versions"
  on public.pricing_plan_versions for update to authenticated
  using (public.is_admin_role(array['super_admin', 'admin', 'finance']))
  with check (public.is_admin_role(array['super_admin', 'admin', 'finance']));

-- No delete policy for anyone — a version is archived, never deleted, so an
-- invoice's pricing_purchases row can always be traced back to the version
-- it was purchased from (on delete set null on that foreign key is a last
-- resort, not the expected path).

drop trigger if exists set_pricing_plan_versions_updated_at on public.pricing_plan_versions;
create trigger set_pricing_plan_versions_updated_at before update on public.pricing_plan_versions for each row execute function public.set_updated_at();


-- ----------------------------------------------------------------------------
-- PART 2.1 — Immutability trigger: once a version leaves 'draft', every
-- column except a published -> archived status transition is frozen.
-- ----------------------------------------------------------------------------

create or replace function public.prevent_pricing_version_mutation()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'draft' then
    return new; -- freely editable while still a draft
  end if;

  if not (old.status = 'published' and new.status = 'archived') and new.status <> old.status then
    raise exception 'Pricing plan versions are immutable once published — create a new version instead of changing status from % to %.', old.status, new.status;
  end if;

  if new.plan_id is distinct from old.plan_id
    or new.version_number is distinct from old.version_number
    or new.public_title is distinct from old.public_title
    or new.short_description is distinct from old.short_description
    or new.detailed_description is distinct from old.detailed_description
    or new.currency is distinct from old.currency
    or new.amount_minor_units is distinct from old.amount_minor_units
    or new.payment_type is distinct from old.payment_type
    or new.billing_interval is distinct from old.billing_interval
    or new.included_services is distinct from old.included_services
    or new.exclusions is distinct from old.exclusions
    or new.cta_text is distinct from old.cta_text
    or new.tax_status is distinct from old.tax_status
    or new.effective_from is distinct from old.effective_from
    or new.effective_until is distinct from old.effective_until
    or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at
  then
    raise exception 'A published or archived pricing plan version is immutable — create a new version instead of editing this one.';
  end if;

  return new;
end;
$$;

comment on function public.prevent_pricing_version_mutation() is
  'BEFORE UPDATE guard on pricing_plan_versions: once a row leaves status=''draft'', every column is frozen except the single published -> archived status transition (updated_by/updated_at still move via set_updated_at()). This is the actual enforcement of "immutable pricing versions" / "never overwrite the historical version used by an invoice" — RLS (row-level) cannot express a per-column freeze, only a trigger can. SECURITY INVOKER (the default) is correct here: it runs as whichever role the UPDATE statement itself runs as, which is fine since it only ever inspects OLD/NEW of the row already being written, and grants no elevated access of its own.';

drop trigger if exists prevent_pricing_plan_versions_mutation on public.pricing_plan_versions;
create trigger prevent_pricing_plan_versions_mutation
  before update on public.pricing_plan_versions
  for each row execute function public.prevent_pricing_version_mutation();


-- ----------------------------------------------------------------------------
-- PART 2.2 — Deferred link back from pricing_plans to its current version.
--
-- Genuinely optional (every read in this migration resolves "the current
-- version" by querying pricing_plan_versions directly — see PART 7 and the
-- RLS policy above), but kept as a fast, explicit pointer the admin UI uses
-- to show "what''s live right now" on the plan list without a subquery per
-- row. Nullable and on delete set null: a plan with no published version
-- yet (or one whose only published version was, hypothetically, removed)
-- is a perfectly valid, simply not-yet-purchasable state.
-- ----------------------------------------------------------------------------

alter table public.pricing_plans
  add column if not exists current_version_id uuid references public.pricing_plan_versions (id) on delete set null;

comment on column public.pricing_plans.current_version_id is
  'Convenience pointer to the pricing_plan_versions row currently being treated as "live" by the admin UI (set when an admin publishes a version — see src/lib/supabase/admin/pricing.ts''s publishPricingVersion). NOT the authoritative source for what a purchase actually charges — public.purchase_pricing_plan() (PART 7) always re-derives the live version itself by querying pricing_plan_versions directly (status=''published'' and currently effective), independent of this column, so a stale pointer here can never cause an incorrect charge.';


-- ============================================================================
-- PART 3 — pricing_offers (optional, plan-scoped discounts)
--
-- "No offer should be active by default." — is_active defaults to false.
-- Every offer is scoped to exactly one plan (`plan_id not null`) — the
-- spec''s "fixed discount currency must match the plan currency" only makes
-- sense against a single, specific plan, so this migration does not support
-- an offer spanning multiple plans.
-- ============================================================================

create table if not exists public.pricing_offers (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.pricing_plans (id) on delete cascade,
  public_offer_name text not null,
  internal_description text,
  discount_type text not null,
  -- Basis points, e.g. 1000 = 10.00% — same convention as
  -- invoice_line_items.tax_rate_bps, only ever set when discount_type = 'percentage'.
  discount_percent_bps integer,
  -- Integer minor units, only ever set when discount_type = 'fixed'.
  discount_amount_minor_units bigint,
  discount_currency text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  is_active boolean not null default false,
  status text not null default 'draft',
  coupon_code text,
  max_redemptions integer,
  per_user_limit integer,
  redemption_count integer not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pricing_offers_discount_type_check check (discount_type in ('fixed', 'percentage')),
  constraint pricing_offers_percentage_shape_check check (
    discount_type <> 'percentage'
    or (discount_percent_bps is not null and discount_percent_bps > 0 and discount_percent_bps <= 10000
        and discount_amount_minor_units is null and discount_currency is null)
  ),
  constraint pricing_offers_fixed_shape_check check (
    discount_type <> 'fixed'
    or (discount_amount_minor_units is not null and discount_amount_minor_units > 0
        and discount_currency is not null and discount_percent_bps is null)
  ),
  constraint pricing_offers_date_range_check check (ends_at > starts_at),
  constraint pricing_offers_status_check check (status in ('draft', 'published', 'archived')),
  constraint pricing_offers_max_redemptions_check check (max_redemptions is null or max_redemptions > 0),
  constraint pricing_offers_per_user_limit_check check (per_user_limit is null or per_user_limit > 0),
  constraint pricing_offers_redemption_count_check check (redemption_count >= 0),
  constraint pricing_offers_coupon_code_format_check check (coupon_code is null or coupon_code ~ '^[A-Z0-9_-]{3,32}$')
);

create index if not exists pricing_offers_plan_idx on public.pricing_offers (plan_id);
create index if not exists pricing_offers_status_idx on public.pricing_offers (status);
create unique index if not exists pricing_offers_coupon_code_unique on public.pricing_offers (coupon_code) where coupon_code is not null;

comment on table public.pricing_offers is
  'Milestone 10 — an optional, plan-scoped discount. is_active defaults to false and status defaults to ''draft'' — no offer is ever live the moment it is created (spec: "No offer should be active by default"). "Fixed discount cannot exceed the eligible plan amount" and "Percentage must be greater than 0 and no more than 100" are enforced twice: at write time by src/lib/pricing/offers.ts''s pure validator (used by the admin form) and, authoritatively, at purchase time inside public.purchase_pricing_plan() (PART 7), which re-checks against the CURRENT live plan price regardless of what the plan cost when this offer was created. `coupon_code` is never fabricated by seed data or application code — every coupon in this system is one an admin deliberately typed in.';

alter table public.pricing_offers enable row level security;

drop policy if exists "Anyone can read active, published, currently running offers" on public.pricing_offers;
create policy "Anyone can read active, published, currently running offers"
  on public.pricing_offers for select to anon, authenticated
  using (is_active = true and status = 'published' and now() >= starts_at and now() <= ends_at);

drop policy if exists "super_admin/admin/finance/analyst can read all pricing offers" on public.pricing_offers;
create policy "super_admin/admin/finance/analyst can read all pricing offers"
  on public.pricing_offers for select to authenticated
  using (public.is_admin_role(array['super_admin', 'admin', 'finance', 'analyst']));

drop policy if exists "super_admin/admin/finance can create pricing offers" on public.pricing_offers;
create policy "super_admin/admin/finance can create pricing offers"
  on public.pricing_offers for insert to authenticated
  with check (public.is_admin_role(array['super_admin', 'admin', 'finance']));

drop policy if exists "super_admin/admin/finance can update pricing offers" on public.pricing_offers;
create policy "super_admin/admin/finance can update pricing offers"
  on public.pricing_offers for update to authenticated
  using (public.is_admin_role(array['super_admin', 'admin', 'finance']))
  with check (public.is_admin_role(array['super_admin', 'admin', 'finance']));

-- No delete policy — an offer that should stop running is archived
-- (status = 'archived') or deactivated (is_active = false), never deleted,
-- so pricing_purchases.offer_id and invoices.pricing_offer_id can always be
-- traced back to what was actually redeemed.
--
-- No client-facing UPDATE path ever increments redemption_count — the only
-- writer of that column is public.purchase_pricing_plan() (PART 7), which
-- runs as SECURITY DEFINER and so does not need (and is not granted) a
-- permissive UPDATE policy for `authenticated` covering that column.

drop trigger if exists set_pricing_offers_updated_at on public.pricing_offers;
create trigger set_pricing_offers_updated_at before update on public.pricing_offers for each row execute function public.set_updated_at();


-- ============================================================================
-- PART 4 — pricing_purchases (immutable purchase snapshots)
--
-- "Never calculate a historical invoice using the current plan price." This
-- table is the durable record of exactly what a student was actually
-- charged, frozen the moment public.purchase_pricing_plan() runs — it is
-- never recomputed, and nothing in this migration ever UPDATEs a row here.
-- ============================================================================

create table if not exists public.pricing_purchases (
  id uuid primary key default gen_random_uuid(),
  student_user_id uuid references auth.users (id) on delete set null,
  plan_id uuid references public.pricing_plans (id) on delete set null,
  plan_version_id uuid references public.pricing_plan_versions (id) on delete set null,
  plan_name_at_purchase text not null,
  included_services_at_purchase jsonb not null default '[]'::jsonb,
  original_amount_minor_units bigint not null,
  discount_minor_units bigint not null default 0,
  tax_minor_units bigint not null default 0,
  final_amount_minor_units bigint not null,
  currency text not null,
  offer_id uuid references public.pricing_offers (id) on delete set null,
  coupon_code_used text,
  invoice_id uuid references public.invoices (id) on delete set null,
  purchased_at timestamptz not null default now(),
  constraint pricing_purchases_amounts_check check (
    original_amount_minor_units >= 0 and discount_minor_units >= 0 and tax_minor_units >= 0 and final_amount_minor_units >= 0
  ),
  constraint pricing_purchases_discount_bound_check check (discount_minor_units <= original_amount_minor_units)
);

create index if not exists pricing_purchases_student_idx on public.pricing_purchases (student_user_id);
create index if not exists pricing_purchases_plan_idx on public.pricing_purchases (plan_id);
create index if not exists pricing_purchases_invoice_idx on public.pricing_purchases (invoice_id);
create index if not exists pricing_purchases_offer_idx on public.pricing_purchases (offer_id);

comment on table public.pricing_purchases is
  'Milestone 10 — one immutable row per successful plan purchase, written only by public.purchase_pricing_plan() (PART 7). Freezes plan_name_at_purchase and included_services_at_purchase (copied verbatim from the pricing_plan_versions row at that moment) plus the full original/discount/tax/final price breakdown — a later price change, plan rename, or benefit edit never alters an existing row here, mirroring exactly how public.invoices.billing_snapshot freezes billing details at issuance (src/lib/payments/snapshot.ts). `invoice_id` links to the real invoice in the existing Milestone 8 ledger — this table is a purchase-intent record layered on top of that ledger, never a second ledger: the actual money movement is still tracked exclusively by invoices/payment_attempts/payment_transactions/refunds.';

alter table public.pricing_purchases enable row level security;

drop policy if exists "Students can read their own purchases" on public.pricing_purchases;
create policy "Students can read their own purchases"
  on public.pricing_purchases for select to authenticated
  using (auth.uid() = student_user_id);

drop policy if exists "super_admin/admin/finance/analyst can read all purchases" on public.pricing_purchases;
create policy "super_admin/admin/finance/analyst can read all purchases"
  on public.pricing_purchases for select to authenticated
  using (public.is_admin_role(array['super_admin', 'admin', 'finance', 'analyst']));

drop policy if exists "counsellor can read their assigned students' purchases" on public.pricing_purchases;
create policy "counsellor can read their assigned students' purchases"
  on public.pricing_purchases for select to authenticated
  using (
    public.is_admin_role(array['counsellor'])
    and exists (
      select 1 from public.admin_student_meta m
      where m.student_user_id = pricing_purchases.student_user_id and m.assigned_counsellor_id = public.current_counsellor_id()
    )
  );

-- Deliberately NO insert/update/delete policy for any role, including
-- super_admin — same pattern as admin_audit_log and invoice_number_sequences.
-- The only write path is public.purchase_pricing_plan() (PART 7), which runs
-- SECURITY DEFINER and so does not need a permissive policy to write here.
-- Even a super_admin cannot hand-edit a purchase snapshot through the normal
-- API/dashboard-as-client — if a purchase record is ever wrong, the fix is a
-- new, separate correcting record (e.g. a refund in the existing ledger),
-- never an edit to what actually happened.


-- ============================================================================
-- PART 5 — pricing_analytics_events (narrow, non-sensitive funnel log)
--
-- Deliberately separate from public.conversion_events (0004_admin_system.sql),
-- which is documented as admin-action-only with "no unauthenticated write
-- path" by design — pricing funnel signals (a visitor viewing the pricing
-- page, selecting a plan, starting checkout) legitimately happen from an
-- anonymous or student browser session, which conversion_events was never
-- meant to accept. This table is intentionally narrow: three harmless event
-- types only, no amount, no offer discount detail, no payment data of any
-- kind — see docs/nextwise-pricing-offers-guide.md §11 for why successful/
-- failed purchase and revenue analytics are deliberately NOT events logged
-- here, and are instead derived live from pricing_purchases/invoices/
-- payment_transactions (the one authoritative ledger) so there is no second,
-- driftable source of truth for money.
-- ============================================================================

create table if not exists public.pricing_analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  plan_id uuid references public.pricing_plans (id) on delete set null,
  offer_id uuid references public.pricing_offers (id) on delete set null,
  student_user_id uuid references auth.users (id) on delete set null,
  session_ref text,
  occurred_at timestamptz not null default now(),
  constraint pricing_analytics_events_type_check check (event_type in ('plan_view', 'plan_selected', 'checkout_started')),
  constraint pricing_analytics_events_session_ref_length_check check (session_ref is null or length(session_ref) <= 64)
);

create index if not exists pricing_analytics_events_type_idx on public.pricing_analytics_events (event_type);
create index if not exists pricing_analytics_events_plan_idx on public.pricing_analytics_events (plan_id);
create index if not exists pricing_analytics_events_occurred_at_idx on public.pricing_analytics_events (occurred_at);

comment on table public.pricing_analytics_events is
  'Milestone 10 — first-party funnel-signal log for the pricing page, restricted by CHECK to exactly three harmless event types (plan_view, plan_selected, checkout_started) — never a purchase outcome or an amount. `session_ref` is an optional, non-identifying random token generated client-side per browser tab (see src/lib/pricing/analytics-client.ts) purely to de-duplicate/group events for a conversion-by-plan report — never a cookie, IP address, or device fingerprint. `student_user_id` and `occurred_at` are always server-stamped by the trigger below from auth.uid()/now(), never trusted from the client, so a browser cannot forge who performed an event or backdate when.';

alter table public.pricing_analytics_events enable row level security;

drop policy if exists "Anyone can record a pricing funnel event" on public.pricing_analytics_events;
create policy "Anyone can record a pricing funnel event"
  on public.pricing_analytics_events for insert to anon, authenticated
  with check (true);
-- The event_type CHECK constraint above is the real restriction on what can
-- ever land in this table — this policy only decides who may attempt an
-- insert at all (anyone, since a pricing-page view is not a privileged act).

drop policy if exists "super_admin/admin/analyst can read pricing analytics events" on public.pricing_analytics_events;
create policy "super_admin/admin/analyst can read pricing analytics events"
  on public.pricing_analytics_events for select to authenticated
  using (public.is_admin_role(array['super_admin', 'admin', 'analyst']));

-- No update/delete policy for anyone — append-only, same as conversion_events.

create or replace function public.stamp_pricing_analytics_event()
returns trigger
language plpgsql
as $$
begin
  new.student_user_id := auth.uid();
  new.occurred_at := now();
  return new;
end;
$$;

comment on function public.stamp_pricing_analytics_event() is
  'BEFORE INSERT trigger on pricing_analytics_events: unconditionally overwrites student_user_id with auth.uid() (null for an anonymous visitor) and occurred_at with now(), regardless of whatever the client sent in either column — so a signed-in student can never be spoofed as someone else, and no event can be backdated. Plain SECURITY INVOKER (the default): it needs no elevated privilege, since auth.uid()/now() are readable by any role and it only ever touches the one row already being inserted.';

drop trigger if exists stamp_pricing_analytics_event on public.pricing_analytics_events;
create trigger stamp_pricing_analytics_event
  before insert on public.pricing_analytics_events
  for each row execute function public.stamp_pricing_analytics_event();


-- ============================================================================
-- PART 6 — Additive columns on the existing invoices table
--
-- Two new, nullable columns tagging an invoice as "generated from a plan
-- purchase" — additive only, no existing column touched, every existing
-- invoice simply has both null. Used by public.purchase_pricing_plan()'s
-- idempotent "reuse an already-issued unpaid invoice for this plan" check
-- (PART 7) and by the student/admin UI to show which plan an invoice was
-- for.
-- ============================================================================

alter table public.invoices add column if not exists pricing_plan_id uuid references public.pricing_plans (id) on delete set null;
alter table public.invoices add column if not exists pricing_offer_id uuid references public.pricing_offers (id) on delete set null;

create index if not exists invoices_pricing_plan_idx on public.invoices (pricing_plan_id);

comment on column public.invoices.pricing_plan_id is
  'Milestone 10 — set only for an invoice created by public.purchase_pricing_plan() (PART 7); null for every invoice created the Milestone 8 admin way (src/lib/supabase/admin/invoices.ts). Never required, never backfilled for historical rows.';


-- ============================================================================
-- PART 7 — purchase_pricing_plan(): the one path from "student selects a
-- plan" to "a real, numbered, correctly priced invoice exists"
--
-- WHY THIS IS SECURITY DEFINER (read this before anything else in this
-- part): public.invoices/invoice_line_items only grant INSERT to
-- super_admin/admin/finance (0005_payments_billing.sql PART 3/4) — a
-- student has no RLS path to create their own invoice directly, by design
-- (an admin/finance user is the one who decides what gets billed, for
-- every OTHER invoice in this system). A self-service plan purchase is a
-- deliberate, narrow exception: this function still enforces exactly the
-- same "only ever this caller''s own data" boundary a normal RLS policy
-- would, just written as an explicit in-body check instead of a table
-- policy — see the four-column safety review at the end of this part,
-- matching the one 0005_payments_billing.sql PART 9.5 keeps for its own
-- three SECURITY DEFINER functions.
--
-- Every price figure this function uses is re-derived from the database
-- INSIDE this function — plan, offer, and tax are all re-validated from
-- scratch against current, live rows every single call. Nothing about the
-- final invoice total is ever taken from p_plan_id/p_offer_id/p_coupon_code
-- beyond which ROWS to look up — the browser supplies identifiers, never
-- amounts (spec: "Never accept authoritative amount from the browser").
-- ============================================================================

create or replace function public.purchase_pricing_plan(
  p_plan_id uuid,
  p_offer_id uuid default null,
  p_coupon_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_version public.pricing_plan_versions;
  v_offer public.pricing_offers;
  v_existing_invoice_id uuid;
  v_discount_minor bigint := 0;
  v_settings public.billing_settings;
  v_gst_configured boolean;
  v_tax_rate_bps integer;
  v_tax_minor bigint := 0;
  v_total_minor bigint;
  v_student_name text;
  v_student_email text;
  v_snapshot jsonb;
  v_invoice_id uuid;
  v_purchase_id uuid;
  v_prefix text;
  v_next bigint;
  v_invoice_number text;
  v_per_user_count integer;
  v_offer_redeem_ok uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'You must be signed in to purchase a plan.';
  end if;

  -- Duplicate-checkout / idempotency guard: if this student already has an
  -- issued-but-unpaid invoice for this exact plan, hand back that SAME
  -- invoice rather than creating a second one — mirrors
  -- payment_attempts_one_active_per_invoice's "reuse, don't duplicate"
  -- pattern one level up the stack (0005_payments_billing.sql PART 5).
  select id into v_existing_invoice_id
  from public.invoices
  where student_user_id = v_uid and pricing_plan_id = p_plan_id and status in ('issued', 'partially_paid', 'overdue')
  order by created_at desc
  limit 1;

  if v_existing_invoice_id is not null then
    return jsonb_build_object('invoice_id', v_existing_invoice_id, 'reused', true);
  end if;

  if not exists (select 1 from public.pricing_plans where id = p_plan_id and is_active = true) then
    raise exception 'This plan is not currently offered.';
  end if;

  select * into v_version
  from public.pricing_plan_versions
  where plan_id = p_plan_id
    and status = 'published'
    and (effective_from is null or effective_from <= now())
    and (effective_until is null or effective_until >= now())
  order by version_number desc
  limit 1;

  if v_version.id is null then
    raise exception 'This plan is not currently available for purchase.';
  end if;

  if p_offer_id is not null or p_coupon_code is not null then
    select * into v_offer
    from public.pricing_offers
    where plan_id = p_plan_id
      and (id = p_offer_id or (p_coupon_code is not null and coupon_code = p_coupon_code))
    limit 1;

    if v_offer.id is null then
      raise exception 'This offer is not valid for this plan.';
    end if;
    if not (v_offer.is_active and v_offer.status = 'published' and now() >= v_offer.starts_at and now() <= v_offer.ends_at) then
      raise exception 'This offer is not currently active.';
    end if;
    if v_offer.max_redemptions is not null and v_offer.redemption_count >= v_offer.max_redemptions then
      raise exception 'This offer has reached its redemption limit.';
    end if;
    if v_offer.per_user_limit is not null then
      select count(*) into v_per_user_count from public.pricing_purchases where offer_id = v_offer.id and student_user_id = v_uid;
      if v_per_user_count >= v_offer.per_user_limit then
        raise exception 'You have already used this offer the maximum number of times.';
      end if;
    end if;

    if v_offer.discount_type = 'percentage' then
      v_discount_minor := round(v_version.amount_minor_units * v_offer.discount_percent_bps / 10000.0);
    else
      if v_offer.discount_currency <> v_version.currency then
        raise exception 'This offer''s currency does not match the plan''s currency.';
      end if;
      v_discount_minor := v_offer.discount_amount_minor_units;
    end if;
    -- Defensive clamp: "Fixed discount cannot exceed the eligible plan
    -- amount" / "Final price cannot be negative" — re-checked here against
    -- the CURRENT live price even though the admin form also validates this
    -- at offer-creation time, because the plan may have since been
    -- re-versioned to a lower price than when the offer was created.
    if v_discount_minor > v_version.amount_minor_units then
      v_discount_minor := v_version.amount_minor_units;
    end if;
  end if;

  select * into v_settings from public.billing_settings where id = 1;
  v_gst_configured := v_settings.gst_registered and v_settings.gstin is not null and length(trim(v_settings.gstin)) > 0;
  v_tax_rate_bps := case when v_gst_configured then v_settings.default_tax_rate_bps else null end;
  v_tax_minor := case when v_tax_rate_bps is not null then round((v_version.amount_minor_units - v_discount_minor) * v_tax_rate_bps / 10000.0) else 0 end;
  v_total_minor := (v_version.amount_minor_units - v_discount_minor) + v_tax_minor;
  if v_total_minor < 0 then
    raise exception 'Computed price is invalid.';
  end if;

  select full_name, email into v_student_name, v_student_email from public.profiles where id = v_uid;

  v_snapshot := jsonb_build_object(
    'studentName', coalesce(nullif(trim(v_student_name), ''), 'Student'),
    'studentEmail', v_student_email,
    'legalEntityName', v_settings.legal_entity_name,
    'businessAddress', v_settings.business_address,
    'gstin', case when v_gst_configured then v_settings.gstin else null end,
    'gstRegisteredAtIssuance', v_gst_configured
  );

  -- Atomic invoice numbering — deliberately inline against the SAME
  -- public.invoice_number_sequences table 0005_payments_billing.sql PART 2
  -- defines, using the identical insert-on-conflict-do-update pattern, NOT
  -- a call to public.next_invoice_number() (that function raises unless
  -- public.current_admin_role() is not null, which is correct for it to
  -- keep doing for admin-issued invoices and would incorrectly reject
  -- every student self-checkout). One shared sequence, one gap-free
  -- per-year numbering scheme, regardless of which path issued the
  -- invoice.
  v_prefix := 'INV-' || to_char(now(), 'YYYY');
  insert into public.invoice_number_sequences (prefix, last_value, updated_at)
  values (v_prefix, 1, now())
  on conflict (prefix) do update
    set last_value = public.invoice_number_sequences.last_value + 1,
        updated_at = now()
  returning last_value into v_next;
  v_invoice_number := v_prefix || '-' || lpad(v_next::text, 5, '0');

  insert into public.invoices (
    invoice_number, student_user_id, application_id, status, currency,
    subtotal_minor_units, discount_minor_units, tax_minor_units, total_minor_units,
    issue_date, due_date, internal_notes, student_notes, billing_snapshot,
    pricing_plan_id, pricing_offer_id,
    created_by, issued_by, issued_at
  ) values (
    v_invoice_number, v_uid, null, 'issued', v_version.currency,
    v_version.amount_minor_units, v_discount_minor, v_tax_minor, v_total_minor,
    current_date, null, null, null, v_snapshot,
    p_plan_id, v_offer.id,
    v_uid, v_uid, now()
  ) returning id into v_invoice_id;

  insert into public.invoice_line_items (
    invoice_id, description, quantity, unit_amount_minor_units, discount_minor_units,
    tax_rate_bps, tax_minor_units, line_total_minor_units, sort_order
  ) values (
    v_invoice_id, v_version.public_title, 1, v_version.amount_minor_units, v_discount_minor,
    v_tax_rate_bps, v_tax_minor, v_total_minor, 0
  );

  insert into public.pricing_purchases (
    student_user_id, plan_id, plan_version_id, plan_name_at_purchase, included_services_at_purchase,
    original_amount_minor_units, discount_minor_units, tax_minor_units, final_amount_minor_units, currency,
    offer_id, coupon_code_used, invoice_id
  ) values (
    v_uid, p_plan_id, v_version.id, v_version.public_title, v_version.included_services,
    v_version.amount_minor_units, v_discount_minor, v_tax_minor, v_total_minor, v_version.currency,
    v_offer.id, p_coupon_code, v_invoice_id
  ) returning id into v_purchase_id;

  if v_offer.id is not null then
    update public.pricing_offers
      set redemption_count = redemption_count + 1
      where id = v_offer.id and (max_redemptions is null or redemption_count < max_redemptions)
      returning id into v_offer_redeem_ok;
    if v_offer_redeem_ok is null then
      -- Someone else redeemed the last slot in the moment between our
      -- earlier check and this UPDATE. Raising here rolls back the entire
      -- transaction — the invoice/line item/purchase rows inserted above
      -- are undone too, so no invoice is ever issued with a discount that
      -- was not actually honored.
      raise exception 'This offer just reached its redemption limit — please try again without the offer.';
    end if;
  end if;

  return jsonb_build_object(
    'invoice_id', v_invoice_id,
    'purchase_id', v_purchase_id,
    'reused', false,
    'total_minor_units', v_total_minor,
    'currency', v_version.currency,
    'invoice_number', v_invoice_number
  );
end;
$$;

comment on function public.purchase_pricing_plan(uuid, uuid, text) is
  'The only way a student''s own browser can turn a plan selection into a real invoice. Re-validates the plan (active, has a published+currently-effective version), the offer if one is given (active, published, in date range, redemption limits, currency match, discount-vs-price bound), and any configured tax — entirely from live database rows, never from a client-supplied amount. Idempotent: a second call for a plan the student already has an unpaid invoice for returns that SAME invoice rather than creating another. Writes exactly one invoice/line-item pair into the EXISTING Milestone 8 ledger (never a second ledger) plus one immutable pricing_purchases snapshot row. SECURITY DEFINER because student-initiated invoice/line-item creation has no RLS path otherwise (see PART 7''s header comment for the full justification) — EXECUTE is restricted to `authenticated` only (PART 7.1), and the function never returns or accepts data outside auth.uid()''s own scope.';


-- ----------------------------------------------------------------------------
-- PART 7.1 — Explicit function execution privileges (same discipline as
-- 0005_payments_billing.sql PART 10 applies to its own four functions).
-- ----------------------------------------------------------------------------

revoke execute on function public.purchase_pricing_plan(uuid, uuid, text) from public;
revoke execute on function public.prevent_pricing_version_mutation() from public;
revoke execute on function public.stamp_pricing_analytics_event() from public;

-- Called only from an authenticated student's own session
-- (src/lib/supabase/payments/pricing-checkout.ts's purchasePricingPlan) —
-- never from `anon` (there is no unauthenticated checkout in this
-- application; the function itself also raises if auth.uid() is null, so
-- this grant is defense in depth, not the only check).
grant execute on function public.purchase_pricing_plan(uuid, uuid, text) to authenticated;

-- Trigger functions do not need an explicit EXECUTE grant to run as part of
-- an INSERT/UPDATE on their table (Postgres invokes a trigger function
-- directly, not via a role''s own EXECUTE privilege) — the two REVOKEs
-- above simply close off the (irrelevant but otherwise-default) ability to
-- call them directly as a standalone RPC, following the same "revoke from
-- PUBLIC, grant only what''s needed" discipline as every DEFINER/trigger
-- function in this codebase, even though neither does anything privileged
-- if invoked directly.


-- ============================================================================
-- PART 7.2 — SECURITY DEFINER safety review (SECURITY CORRECTION-style
-- summary, matching 0005_payments_billing.sql PART 9.5''s table for its own
-- three DEFINER functions)
--
--                              fixed safe   internal auth/     cannot bypass    cannot act
--                              search_path  crypto check        RLS to expose    outside caller's
--                                                                data             own scope
-- purchase_pricing_plan()          yes      auth.uid() is not   only reads       yes — every
--                                            null, or raises     pricing_plans/   write is
--                                                                 _versions/       student_user_id
--                                                                 _offers/         = auth.uid() (the
--                                                                 billing_         invoice, its line
--                                                                 settings/        item, and the
--                                                                 profiles (all    purchase snapshot)
--                                                                 either already   or a row keyed by
--                                                                 public-visible   an id already on
--                                                                 or the caller''s  file (the offer
--                                                                 own profile      being redeemed);
--                                                                 row); writes     p_plan_id/
--                                                                 only invoices/   p_offer_id only
--                                                                 line items/      ever SELECT which
--                                                                 purchases tied   plan/offer to
--                                                                 to auth.uid()    charge for, never
--                                                                                  an amount
--
-- Unlike verify_checkout_payment()/apply_webhook_event() (0005 PART 6.5/6.6/8),
-- this function has no cryptographic signature to re-derive — its
-- authorization is simply "the caller is a real signed-in user acting on
-- their own account", which is exactly what auth.uid() is not null plus
-- "every write is scoped to that same auth.uid()" establishes.
-- ============================================================================


-- ============================================================================
-- PART 8 — Verification queries (run manually after applying this
-- migration; not executed automatically by this file). Same pattern as
-- 0005_payments_billing.sql PART 11.
--
-- 1) `authenticated` should be able to execute purchase_pricing_plan();
--    `anon` and PUBLIC should not:
--
-- select
--   has_function_privilege('authenticated', 'public.purchase_pricing_plan(uuid,uuid,text)', 'execute') as authenticated_can,
--   has_function_privilege('anon', 'public.purchase_pricing_plan(uuid,uuid,text)', 'execute') as anon_can,
--   has_function_privilege('public', 'public.purchase_pricing_plan(uuid,uuid,text)', 'execute') as public_can;
-- -- expected: true, false, false
--
-- 2) A signed-out (anon) client should see zero rows for a draft/unpublished
--    plan or offer, and zero rows for an inactive plan, when queried through
--    the normal publishable-key client:
--
-- select count(*) from public.pricing_plan_versions where status = 'draft';        -- expect 0 as anon
-- select count(*) from public.pricing_offers where is_active = false;              -- expect 0 as anon
--
-- 3) Confirm the immutability trigger actually blocks a mutation, as a
--    super_admin, against any already-published version:
--
-- update public.pricing_plan_versions set amount_minor_units = amount_minor_units + 1
--   where status = 'published' limit 1;
-- -- expected: raises "A published or archived pricing plan version is
-- -- immutable — create a new version instead of editing this one."
-- ============================================================================


-- ============================================================================
-- BOOTSTRAP — no manual step required beyond the one already documented in
-- 0005_payments_billing.sql (payment_gateway_config). billing_settings
-- already exists and is reused as-is: this migration reads its
-- gst_registered/gstin/default_tax_rate_bps fields but never writes to it
-- and never requires it to be filled in — with all three unset (the
-- default), every plan purchase simply computes zero tax, matching "Do not
-- automatically add tax" until an admin genuinely configures GST at
-- /admin/billing-settings.
--
-- After running this file, run supabase/seed/0004_pricing_offers_seed.sql
-- once to load the nine official NextWise plans as published, purchasable
-- pricing_plans/pricing_plan_versions rows with zero active offers.
-- ============================================================================
