-- ============================================================================
-- Milestone 11 — NextWise Pricing Inclusions & Presentation
--
-- HOW TO RUN THIS (no SQL knowledge required):
--   1. Open your Supabase project dashboard (supabase.com/dashboard).
--   2. Click "SQL Editor" in the left sidebar.
--   3. Click "New query".
--   4. Paste the entire contents of this file.
--   5. Click "Run".
--   6. Then run supabase/seed/0005_pricing_inclusions_seed.sql once (see
--      that file's own header) to load the nine official plans' inclusion
--      lists, session allowances, and comparison limits.
--
-- Safe to run once. Re-running is also safe — every statement is written
-- to not fail if already applied (`if not exists` / `or replace` / `drop
-- policy if exists` before `create policy` / `drop trigger if exists`
-- before `create trigger`), same convention as 0001-0007.
--
-- This migration does NOT modify 0001-0007 in place. It only ADDS:
--   - a new pricing_plan_inclusions table (structured, ordered service
--     lines under a plan version — PART 1);
--   - ten new nullable "presentation setting" / comparison-table columns
--     on the existing pricing_plan_versions table (PART 2);
--   - an extension of prevent_pricing_version_mutation() (0007 PART 2.1)
--     to freeze those ten new columns too, via `create or replace
--     function` (PART 3);
--   - three new nullable/default columns on the existing pricing_purchases
--     table to freeze the inclusions/session/limits snapshot at the moment
--     of purchase (PART 4);
--   - a `create or replace function public.purchase_pricing_plan(...)`
--     with the IDENTICAL signature and return shape as 0007's, extended
--     only to also populate those three new snapshot columns (PART 5).
--
-- ARCHITECTURE DECISION — why a child TABLE, not a jsonb column:
-- pricing_plan_versions.included_services (0007) is already a jsonb array
-- and could technically hold structured objects. This migration adds a
-- real child table instead because the spec's admin capabilities —
-- "add, edit, remove and reorder inclusions" as first-class actions with
-- their own stable identifiers, and "mark selected inclusions as
-- highlights" — are naturally row-level operations (one UPDATE/DELETE per
-- inclusion, one small reorder write) that a jsonb array would force into
-- read-whole-array/rewrite-whole-array admin code for every single edit,
-- with no stable id to react-key or link to from a future admin
-- deep-link. A table also lets RLS and the immutability trigger reason
-- about one inclusion at a time, exactly mirroring how
-- pricing_plan_versions itself is already modeled. included_services is
-- left untouched and still exists (0007) — this migration does not
-- repurpose or migrate data into it; the public pricing page and admin UI
-- are updated (application code, not this file) to read inclusions from
-- the new table going forward. See docs/nextwise-pricing-offers-guide.md
-- for the full writeup.
-- ============================================================================


-- ============================================================================
-- PART 1 — pricing_plan_inclusions (structured, ordered service lines)
--
-- One row per included-service line item under a specific
-- pricing_plan_versions row. Immutable once its parent version leaves
-- 'draft' (PART 1.2) — "a new inclusion for a published plan requires
-- creating a new draft version and copying inclusions forward", exactly
-- like every other version field (0007 PART 2.1's own docblock).
-- ============================================================================

create table if not exists public.pricing_plan_inclusions (
  id uuid primary key default gen_random_uuid(),
  plan_version_id uuid not null references public.pricing_plan_versions (id) on delete cascade,
  display_order integer not null default 0,
  title text not null,
  explanation text,
  category text,
  numeric_allowance numeric,
  unit text,
  is_highlight boolean not null default false,
  is_active boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pricing_plan_inclusions_title_not_blank_check check (length(trim(title)) > 0)
);

create index if not exists pricing_plan_inclusions_version_idx on public.pricing_plan_inclusions (plan_version_id, display_order);

comment on table public.pricing_plan_inclusions is
  'Milestone 11 — one row per structured, ordered included-service line under a pricing_plan_versions row (e.g. "2 individual counselling sessions", "One parent consultation"). Always admin-entered, never fabricated by application code — same "never invent a benefit" discipline as 0007''s included_services jsonb column, just row-shaped instead of array-shaped so an admin can add/edit/remove/reorder/highlight one line at a time. Immutable once the parent version''s status leaves ''draft'' — see PART 1.2''s trigger and PART 1.1''s RLS write policies, which both key off pricing_plan_versions.status for the SAME row referenced by plan_version_id.';

comment on column public.pricing_plan_inclusions.numeric_allowance is
  'Optional structured quantity for this line (e.g. 10 for "shortlist of up to 10 career or course options") — a display convenience only; the authoritative wording always lives in `title`, which is never regenerated from this number.';

comment on column public.pricing_plan_inclusions.is_active is
  'Lets an admin temporarily hide one inclusion line from the public pricing page without deleting its history — mirrors pricing_plans.is_active''s convention at the individual-line level.';

alter table public.pricing_plan_inclusions enable row level security;


-- ----------------------------------------------------------------------------
-- PART 1.1 — RLS. Public SELECT is restricted to active inclusions whose
-- parent version is published + currently effective + belongs to an active
-- plan — the exact same three-way condition 0007 PART 2's own public SELECT
-- policy applies to pricing_plan_versions itself, just one join deeper.
-- Admin WRITE (insert/update/delete) additionally requires the parent
-- version to still be status = 'draft' — this is the actual enforcement of
-- "a new inclusion for a published plan requires a new draft version"; the
-- BEFORE UPDATE trigger in PART 1.2 is defense-in-depth for the UPDATE case
-- specifically (matching 0007's belt-and-suspenders RLS-plus-trigger
-- pattern), while RLS alone is what blocks INSERT/DELETE against a
-- published parent, since a trigger cannot express "must not exist" the way
-- a WITH CHECK/USING clause can.
-- ----------------------------------------------------------------------------

drop policy if exists "Anyone can read active inclusions of a published, currently effective plan version" on public.pricing_plan_inclusions;
create policy "Anyone can read active inclusions of a published, currently effective plan version"
  on public.pricing_plan_inclusions for select to anon, authenticated
  using (
    is_active = true
    and exists (
      select 1
      from public.pricing_plan_versions v
      join public.pricing_plans p on p.id = v.plan_id
      where v.id = pricing_plan_inclusions.plan_version_id
        and v.status = 'published'
        and (v.effective_from is null or v.effective_from <= now())
        and (v.effective_until is null or v.effective_until >= now())
        and p.is_active = true
    )
  );

drop policy if exists "super_admin/admin/finance/analyst can read all pricing inclusions" on public.pricing_plan_inclusions;
create policy "super_admin/admin/finance/analyst can read all pricing inclusions"
  on public.pricing_plan_inclusions for select to authenticated
  using (public.is_admin_role(array['super_admin', 'admin', 'finance', 'analyst']));

drop policy if exists "super_admin/admin/finance can add inclusions to a draft version" on public.pricing_plan_inclusions;
create policy "super_admin/admin/finance can add inclusions to a draft version"
  on public.pricing_plan_inclusions for insert to authenticated
  with check (
    public.is_admin_role(array['super_admin', 'admin', 'finance'])
    and exists (select 1 from public.pricing_plan_versions v where v.id = plan_version_id and v.status = 'draft')
  );

drop policy if exists "super_admin/admin/finance can edit inclusions of a draft version" on public.pricing_plan_inclusions;
create policy "super_admin/admin/finance can edit inclusions of a draft version"
  on public.pricing_plan_inclusions for update to authenticated
  using (
    public.is_admin_role(array['super_admin', 'admin', 'finance'])
    and exists (select 1 from public.pricing_plan_versions v where v.id = plan_version_id and v.status = 'draft')
  )
  with check (
    public.is_admin_role(array['super_admin', 'admin', 'finance'])
    and exists (select 1 from public.pricing_plan_versions v where v.id = plan_version_id and v.status = 'draft')
  );

drop policy if exists "super_admin/admin/finance can remove inclusions of a draft version" on public.pricing_plan_inclusions;
create policy "super_admin/admin/finance can remove inclusions of a draft version"
  on public.pricing_plan_inclusions for delete to authenticated
  using (
    public.is_admin_role(array['super_admin', 'admin', 'finance'])
    and exists (select 1 from public.pricing_plan_versions v where v.id = plan_version_id and v.status = 'draft')
  );

drop trigger if exists set_pricing_plan_inclusions_updated_at on public.pricing_plan_inclusions;
create trigger set_pricing_plan_inclusions_updated_at before update on public.pricing_plan_inclusions for each row execute function public.set_updated_at();


-- ----------------------------------------------------------------------------
-- PART 1.2 — Immutability trigger (defense-in-depth alongside PART 1.1's
-- UPDATE policy): once the parent pricing_plan_versions row's status is not
-- 'draft', no UPDATE on this inclusion row is permitted at all, regardless
-- of caller role — mirrors 0007 PART 2.1's prevent_pricing_version_mutation()
-- in spirit, one join away. SECURITY INVOKER (the default) is correct: the
-- only callers who can reach this trigger at all already passed PART 1.1's
-- UPDATE policy (admin/finance, who also hold the "read all plan versions"
-- SELECT policy on pricing_plan_versions), so no elevated privilege is
-- needed to read the parent's status here.
-- ----------------------------------------------------------------------------

create or replace function public.prevent_pricing_inclusion_mutation()
returns trigger
language plpgsql
as $$
declare
  v_parent_status text;
begin
  select status into v_parent_status from public.pricing_plan_versions where id = old.plan_version_id;
  if v_parent_status is distinct from 'draft' then
    raise exception 'Pricing plan inclusions are immutable once their parent version leaves draft — create a new version and copy inclusions forward instead.';
  end if;
  return new;
end;
$$;

comment on function public.prevent_pricing_inclusion_mutation() is
  'BEFORE UPDATE guard on pricing_plan_inclusions: raises unless the parent pricing_plan_versions row (looked up by plan_version_id) is still status=''draft''. Defense-in-depth alongside PART 1.1''s own UPDATE RLS policy (which already requires the same condition) — same "RLS is the boundary, a trigger is a second independent check" discipline as 0007 PART 2.1.';

drop trigger if exists prevent_pricing_plan_inclusions_mutation on public.pricing_plan_inclusions;
create trigger prevent_pricing_plan_inclusions_mutation
  before update on public.pricing_plan_inclusions
  for each row execute function public.prevent_pricing_inclusion_mutation();


-- ============================================================================
-- PART 2 — New "presentation setting" / comparison-table columns on
-- pricing_plan_versions. Distinct from the generic included_services/
-- pricing_plan_inclusions list: these are the specific structured facts the
-- public pricing page needs to show prominently near the top of a card
-- (session count) and in the Bachelor/Master Abroad comparison table
-- (the other nine). All nullable and additive — every existing row simply
-- has all ten as null until the seed (or an admin) fills them in; a null
-- comparison-table cell renders as "not applicable" ("—"), never a
-- fabricated number (see src/lib/pricing/plan-versions.ts's
-- formatComparisonCell()).
-- ============================================================================

alter table public.pricing_plan_versions add column if not exists session_count integer;
alter table public.pricing_plan_versions add column if not exists session_duration_note text;
alter table public.pricing_plan_versions add column if not exists audience_label text;
alter table public.pricing_plan_versions add column if not exists university_shortlist_limit integer;
alter table public.pricing_plan_versions add column if not exists application_support_limit integer;
alter table public.pricing_plan_versions add column if not exists sop_review_rounds integer;
alter table public.pricing_plan_versions add column if not exists scholarship_support_note text;
alter table public.pricing_plan_versions add column if not exists mock_interview_count integer;
alter table public.pricing_plan_versions add column if not exists counsellor_tier text;
alter table public.pricing_plan_versions add column if not exists support_duration_note text;

alter table public.pricing_plan_versions
  add constraint pricing_plan_versions_session_count_check check (session_count is null or session_count >= 0);
alter table public.pricing_plan_versions
  add constraint pricing_plan_versions_university_shortlist_limit_check check (university_shortlist_limit is null or university_shortlist_limit >= 0);
alter table public.pricing_plan_versions
  add constraint pricing_plan_versions_application_support_limit_check check (application_support_limit is null or application_support_limit >= 0);
alter table public.pricing_plan_versions
  add constraint pricing_plan_versions_sop_review_rounds_check check (sop_review_rounds is null or sop_review_rounds >= 0);
alter table public.pricing_plan_versions
  add constraint pricing_plan_versions_mock_interview_count_check check (mock_interview_count is null or mock_interview_count >= 0);

comment on column public.pricing_plan_versions.session_count is
  'Milestone 11 — number of individual counselling sessions included (e.g. 2 for School Counselling, 15 for a Premium Abroad tier''s "Up to 15"). Shown prominently near the top of the public pricing card per spec ("Show the counselling-session count prominently"). Null means not yet configured by an admin — the UI shows nothing, never a fabricated count.';
comment on column public.pricing_plan_versions.university_shortlist_limit is
  'Milestone 11 — Bachelor/Master Abroad comparison-table field: "up to N universities" shortlisted. Also meaningful for Class 12 Counselling (which the spec also gives a university/college shortlist figure). Null when the source copy gives no clean fixed number for this plan — the comparison table then renders "not applicable" for that cell rather than inventing one.';
comment on column public.pricing_plan_versions.scholarship_support_note is
  'Milestone 11 — free-text scholarship-support description (e.g. "Basic scholarship search", "Scholarship application support for up to 5 opportunities") — kept as a note rather than a number because the source copy''s scholarship-support language does not reduce to one comparable integer across every tier.';
comment on column public.pricing_plan_versions.counsellor_tier is
  'Milestone 11 — e.g. "Dedicated counsellor", "Senior dedicated counsellor". Null for a tier whose included-services copy does not mention a dedicated/senior counsellor at all — never inferred or upgraded by application code.';


-- ============================================================================
-- PART 3 — Extend the immutability trigger (0007 PART 2.1) to also freeze
-- the ten new columns above. `create or replace function` with the exact
-- same name/signature — this REPLACES the body 0007 installed, it does not
-- create a second trigger function; the trigger object itself
-- (prevent_pricing_plan_versions_mutation, 0007 PART 2.1) is left entirely
-- alone and continues pointing at this same function name.
-- ============================================================================

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
    -- Milestone 11 additions (PART 2) — frozen the same way as every other
    -- content column above once a version leaves draft.
    or new.session_count is distinct from old.session_count
    or new.session_duration_note is distinct from old.session_duration_note
    or new.audience_label is distinct from old.audience_label
    or new.university_shortlist_limit is distinct from old.university_shortlist_limit
    or new.application_support_limit is distinct from old.application_support_limit
    or new.sop_review_rounds is distinct from old.sop_review_rounds
    or new.scholarship_support_note is distinct from old.scholarship_support_note
    or new.mock_interview_count is distinct from old.mock_interview_count
    or new.counsellor_tier is distinct from old.counsellor_tier
    or new.support_duration_note is distinct from old.support_duration_note
  then
    raise exception 'A published or archived pricing plan version is immutable — create a new version instead of editing this one.';
  end if;

  return new;
end;
$$;

comment on function public.prevent_pricing_version_mutation() is
  'BEFORE UPDATE guard on pricing_plan_versions: once a row leaves status=''draft'', every column is frozen except the single published -> archived status transition (updated_by/updated_at still move via set_updated_at()). Milestone 11 extended the frozen-column list to also cover session_count/session_duration_note/audience_label/university_shortlist_limit/application_support_limit/sop_review_rounds/scholarship_support_note/mock_interview_count/counsellor_tier/support_duration_note (0008 PART 2) — a published version''s presentation/comparison facts are just as immutable as its price. SECURITY INVOKER (the default) is correct here: it runs as whichever role the UPDATE statement itself runs as, which is fine since it only ever inspects OLD/NEW of the row already being written, and grants no elevated access of its own.';


-- ============================================================================
-- PART 4 — Additive columns on pricing_purchases: freeze the session
-- allowance, the ordered inclusions list, and the comparison-limit fields
-- at the moment of purchase, alongside the fields 0007 already froze there
-- (plan_name_at_purchase, included_services_at_purchase, the price
-- breakdown). Nothing here is ever recomputed after insert — same
-- "immutable, append-only" discipline as the rest of this table (0007
-- PART 4's own docblock and its "no update policy for anyone" note).
-- ============================================================================

alter table public.pricing_purchases add column if not exists session_count_at_purchase integer;
alter table public.pricing_purchases add column if not exists inclusions_at_purchase jsonb not null default '[]'::jsonb;
alter table public.pricing_purchases add column if not exists presentation_limits_at_purchase jsonb not null default '{}'::jsonb;

comment on column public.pricing_purchases.inclusions_at_purchase is
  'Milestone 11 — the plan version''s active pricing_plan_inclusions rows at the moment of purchase, copied verbatim as an ordered jsonb array of {title, explanation, category, numericAllowance, unit, isHighlight} objects (display_order preserved as array order). Frozen once, exactly like plan_name_at_purchase/included_services_at_purchase (0007) — a later admin edit to the CURRENT inclusions (which, per the immutability trigger, can only happen on a NEW version anyway) never alters this row.';
comment on column public.pricing_purchases.presentation_limits_at_purchase is
  'Milestone 11 — the plan version''s comparison-table fields (universityShortlistLimit, applicationSupportLimit, sopReviewRounds, scholarshipSupportNote, mockInterviewCount, counsellorTier, supportDurationNote, sessionDurationNote, audienceLabel) at the moment of purchase, as a single jsonb object. Frozen once, never recomputed — same discipline as every other *_at_purchase column on this table.';


-- ============================================================================
-- PART 5 — purchase_pricing_plan(): identical signature and return shape as
-- 0007 PART 7 (still purchase_pricing_plan(uuid, uuid, text) -> jsonb, still
-- returning at minimum invoice_id/purchase_id/reused/total_minor_units/
-- currency/invoice_number on a fresh purchase and {invoice_id, reused:true}
-- on a reused-invoice idempotent hit) — src/lib/supabase/pricing/checkout.ts
-- reads exactly those fields and is UNCHANGED by this migration. The only
-- behavioral addition is populating the three new pricing_purchases columns
-- from PART 4, derived the same way every other snapshot field already is:
-- read from the live, currently-effective plan version INSIDE this
-- function, never trusted from the browser.
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
  v_inclusions jsonb;
  v_limits jsonb;
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

  -- Milestone 11 — ordered, active inclusions for the live version, frozen
  -- into the purchase snapshot exactly as they read right now. Never
  -- trusted from the browser; always re-derived here from the same
  -- v_version.id already resolved above.
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'title', i.title,
        'explanation', i.explanation,
        'category', i.category,
        'numericAllowance', i.numeric_allowance,
        'unit', i.unit,
        'isHighlight', i.is_highlight
      )
      order by i.display_order
    ) filter (where i.is_active),
    '[]'::jsonb
  )
  into v_inclusions
  from public.pricing_plan_inclusions i
  where i.plan_version_id = v_version.id;

  v_limits := jsonb_build_object(
    'sessionDurationNote', v_version.session_duration_note,
    'audienceLabel', v_version.audience_label,
    'universityShortlistLimit', v_version.university_shortlist_limit,
    'applicationSupportLimit', v_version.application_support_limit,
    'sopReviewRounds', v_version.sop_review_rounds,
    'scholarshipSupportNote', v_version.scholarship_support_note,
    'mockInterviewCount', v_version.mock_interview_count,
    'counsellorTier', v_version.counsellor_tier,
    'supportDurationNote', v_version.support_duration_note
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
    offer_id, coupon_code_used, invoice_id,
    session_count_at_purchase, inclusions_at_purchase, presentation_limits_at_purchase
  ) values (
    v_uid, p_plan_id, v_version.id, v_version.public_title, v_version.included_services,
    v_version.amount_minor_units, v_discount_minor, v_tax_minor, v_total_minor, v_version.currency,
    v_offer.id, p_coupon_code, v_invoice_id,
    v_version.session_count, v_inclusions, v_limits
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
  'The only way a student''s own browser can turn a plan selection into a real invoice. Re-validates the plan (active, has a published+currently-effective version), the offer if one is given (active, published, in date range, redemption limits, currency match, discount-vs-price bound), and any configured tax — entirely from live database rows, never from a client-supplied amount. Idempotent: a second call for a plan the student already has an unpaid invoice for returns that SAME invoice rather than creating another. Writes exactly one invoice/line-item pair into the EXISTING Milestone 8 ledger (never a second ledger) plus one immutable pricing_purchases snapshot row, now also carrying (Milestone 11) the session allowance, ordered active inclusions, and comparison-limit fields exactly as they read on the live version at this moment. SECURITY DEFINER because student-initiated invoice/line-item creation has no RLS path otherwise (see 0007 PART 7''s header comment for the full justification) — EXECUTE is restricted to `authenticated` only, and the function never returns or accepts data outside auth.uid()''s own scope.';

-- Grants are unchanged from 0007 PART 7.1 (same function signature, same
-- revoke-from-PUBLIC-then-grant-to-authenticated shape) — re-stated here
-- only so this migration is fully self-contained and re-runnable even if
-- 0007 were somehow re-applied to a fresh database in a different order.
revoke execute on function public.purchase_pricing_plan(uuid, uuid, text) from public;
grant execute on function public.purchase_pricing_plan(uuid, uuid, text) to authenticated;
revoke execute on function public.prevent_pricing_inclusion_mutation() from public;


-- ============================================================================
-- PART 6 — SECURITY DEFINER safety re-review (Milestone 11 changes only —
-- see 0007 PART 7.2 for the original review, which still holds unchanged
-- for everything this migration did not touch)
--
--                              fixed safe   internal auth/     cannot bypass    cannot act
--                              search_path  crypto check        RLS to expose    outside caller's
--                                                                data             own scope
-- purchase_pricing_plan()          yes      auth.uid() is not   only reads       yes — unchanged
--   (re-reviewed, PART 5)                    null, or raises     pricing_plan_    from 0007: every
--                                                                 inclusions       write is still
--                                                                 (new read, PART  student_user_id
--                                                                 5) in addition   = auth.uid(), and
--                                                                 to the existing  the two new
--                                                                 0007 reads;      columns it writes
--                                                                 still writes     (inclusions_at_
--                                                                 only invoices/   purchase,
--                                                                 line items/      presentation_
--                                                                 purchases tied   limits_at_
--                                                                 to auth.uid()    purchase) are
--                                                                                  populated from
--                                                                                  the SAME
--                                                                                  v_version.id the
--                                                                                  caller never
--                                                                                  supplies directly
--
-- prevent_pricing_inclusion_    n/a (no      none needed —      SECURITY         only ever touches
--   mutation() (PART 1.2)        search_path  reads only the     INVOKER — runs   the single row
--                                needed;      status of the      as whatever      already being
--                                plpgsql,     row already        role the         updated by the
--                                default      referenced by      UPDATE itself    caller (who
--                                invoker)     the row being      runs as; grants  already had to
--                                             updated             no privilege     pass PART 1.1's
--                                                                 of its own       own RLS check to
--                                                                                  reach this
--                                                                                  trigger at all)
-- ============================================================================


-- ============================================================================
-- PART 7 — Verification queries (run manually after applying this
-- migration; not executed automatically by this file). Same pattern as
-- 0007 PART 8.
--
-- 1) `authenticated` should be able to execute purchase_pricing_plan();
--    `anon` and PUBLIC should not (unchanged from 0007, re-verified after
--    the create-or-replace above):
--
-- select
--   has_function_privilege('authenticated', 'public.purchase_pricing_plan(uuid,uuid,text)', 'execute') as authenticated_can,
--   has_function_privilege('anon', 'public.purchase_pricing_plan(uuid,uuid,text)', 'execute') as anon_can,
--   has_function_privilege('public', 'public.purchase_pricing_plan(uuid,uuid,text)', 'execute') as public_can;
-- -- expected: true, false, false
--
-- 2) A signed-out (anon) client should see zero rows in
--    pricing_plan_inclusions for a draft/unpublished plan version:
--
-- select count(*) from public.pricing_plan_inclusions i
--   join public.pricing_plan_versions v on v.id = i.plan_version_id
--   where v.status = 'draft';                                          -- expect 0 as anon
--
-- 3) Confirm the new inclusion-immutability trigger actually blocks a
--    mutation, as a super_admin, against an inclusion whose parent version
--    is published:
--
-- update public.pricing_plan_inclusions i
--   set title = title || ' (edited)'
--   from public.pricing_plan_versions v
--   where v.id = i.plan_version_id and v.status = 'published'
--   limit 1;
-- -- expected: raises "Pricing plan inclusions are immutable once their
-- -- parent version leaves draft — create a new version and copy
-- -- inclusions forward instead."
--
-- 4) Confirm the extended prevent_pricing_version_mutation() blocks a
--    mutation to one of the new presentation columns on a published
--    version:
--
-- update public.pricing_plan_versions set session_count = coalesce(session_count, 0) + 1
--   where status = 'published' limit 1;
-- -- expected: raises "A published or archived pricing plan version is
-- -- immutable — create a new version instead of editing this one."
--
-- 5) After running supabase/seed/0005_pricing_inclusions_seed.sql, confirm
--    every one of the nine plans now has a published version carrying a
--    session_count and at least one active inclusion:
--
-- select p.slug, pv.version_number, pv.session_count,
--   (select count(*) from public.pricing_plan_inclusions i where i.plan_version_id = pv.id and i.is_active) as inclusion_count
-- from public.pricing_plans p
-- join public.pricing_plan_versions pv on pv.id = p.current_version_id
-- order by p.display_order;
-- -- expect 9 rows, every session_count and inclusion_count non-null/> 0.
-- ============================================================================
