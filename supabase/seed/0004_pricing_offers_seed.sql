-- ============================================================================
-- Milestone 10 — Official NextWise pricing seed
--
-- HOW TO RUN THIS:
--   1. Run supabase/migrations/0007_nextwise_pricing_offers.sql FIRST (this
--      seed depends on the tables it creates).
--   2. Open the Supabase SQL Editor, paste this entire file, click "Run".
--
-- WHAT THIS IS: the nine official NextWise plans, at their official launch
-- prices, as PUBLISHED, immediately purchasable pricing_plans +
-- pricing_plan_versions rows. Unlike supabase/seed/0002_admin_dev_seed.sql
-- and 0003_global_education_dev_seed.sql (fabricated development/demo data,
-- never meant for a real deployment), this file IS meant to run once
-- against a real production database — it is a genuine INITIALIZATION
-- script, not a dev fixture. It contains no invented benefits, no
-- discounts, and no coupon codes: every pricing_plan_versions row below has
-- included_services = '[]' and exclusions = '[]' (see PART 2 for what the
-- public pricing page shows in the meantime), and zero pricing_offers rows
-- are created at all.
--
-- IDEMPOTENT AND SAFE TO RE-RUN:
--   - pricing_plans: `on conflict (slug) do nothing` — if a row with this
--     slug already exists (whether from a prior run of this file, or
--     because an admin already customized it), this file changes NOTHING
--     about it. It never overwrites an admin's edits to internal_name,
--     display_order, is_recommended, or is_active.
--   - pricing_plan_versions: only inserted for a plan that currently has
--     ZERO version rows at all (checked via NOT EXISTS below) — never
--     touches a plan that already has a version, published or draft,
--     whether that version came from an earlier run of this exact file or
--     from an admin manually creating one first. This also respects
--     pricing_plan_versions' own immutability trigger (PART 2.1 of the
--     migration): this file never attempts an UPDATE against an existing
--     version row, only a conditional INSERT.
--   - pricing_plans.current_version_id: only set when it is currently null,
--     so a later manual admin change to which version is "current" is
--     never silently reverted by re-running this file.
--
-- Currency: INR. Payment type: one_time (the only value the schema allows —
-- see 0007's pricing_plan_versions_payment_type_check). All nine amounts
-- below are exactly the official minor-unit figures supplied for this
-- launch; nothing here is estimated or rounded.
-- ============================================================================


-- ============================================================================
-- PART 1 — Plans (catalog identity only — see 0007 PART 1 for why price
-- lives on the version row, not here)
-- ============================================================================

insert into public.pricing_plans (slug, category, internal_name, display_order, is_recommended, is_active)
values
  ('school-counselling',      'school_counselling',   'School Counselling',        10, false, true),
  ('class-11-counselling',    'class_11_counselling',  'Class 11 Counselling',      20, false, true),
  ('class-12-counselling',    'class_12_counselling',  'Class 12 Counselling',      30, false, true),
  ('bachelor-abroad-tier-1',  'bachelor_abroad',        'Bachelor Abroad — Tier 1',  40, false, true),
  ('bachelor-abroad-tier-2',  'bachelor_abroad',        'Bachelor Abroad — Tier 2',  50, false, true),
  ('bachelor-abroad-tier-3',  'bachelor_abroad',        'Bachelor Abroad — Tier 3',  60, false, true),
  ('master-abroad-tier-1',    'master_abroad',          'Master Abroad — Tier 1',    70, false, true),
  ('master-abroad-tier-2',    'master_abroad',          'Master Abroad — Tier 2',    80, false, true),
  ('master-abroad-tier-3',    'master_abroad',          'Master Abroad — Tier 3',    90, false, true)
on conflict (slug) do nothing;


-- ============================================================================
-- PART 2 — Version 1 of each plan: published, effective immediately, no
-- expiry. `public_title` matches the plan's internal_name exactly at
-- launch — for the three Bachelor/Master Abroad tiers this IS the "Temporary
-- public name" the spec calls out; an admin renames it at /admin/pricing by
-- publishing a new version (see docs/nextwise-pricing-offers-guide.md §12),
-- never by editing this row (it becomes immutable the moment this INSERT
-- runs, since it is created directly as status = 'published').
--
-- included_services / exclusions are deliberately '[]' (empty) — no scope,
-- benefit, session count, or exclusion is invented here. Until an admin
-- fills these in through /admin/pricing, the public pricing page shows the
-- neutral fallback copy "Contact NextWise for the detailed service scope."
-- for every one of these nine plans.
-- ============================================================================

insert into public.pricing_plan_versions (
  plan_id, version_number, public_title, short_description, detailed_description,
  currency, amount_minor_units, payment_type, included_services, exclusions,
  cta_text, tax_status, status, effective_from, effective_until
)
select p.id, 1, v.public_title, null, null,
  'INR', v.amount_minor_units, 'one_time', '[]'::jsonb, '[]'::jsonb,
  'Get started', 'unconfigured', 'published', now(), null
from (values
  ('school-counselling',     'School Counselling',        500000::bigint),
  ('class-11-counselling',   'Class 11 Counselling',      1000000::bigint),
  ('class-12-counselling',   'Class 12 Counselling',      1500000::bigint),
  ('bachelor-abroad-tier-1', 'Bachelor Abroad — Tier 1',  2500000::bigint),
  ('bachelor-abroad-tier-2', 'Bachelor Abroad — Tier 2',  6000000::bigint),
  ('bachelor-abroad-tier-3', 'Bachelor Abroad — Tier 3', 13000000::bigint),
  ('master-abroad-tier-1',   'Master Abroad — Tier 1',    2700000::bigint),
  ('master-abroad-tier-2',   'Master Abroad — Tier 2',    6500000::bigint),
  ('master-abroad-tier-3',   'Master Abroad — Tier 3',   14000000::bigint)
) as v(slug, public_title, amount_minor_units)
join public.pricing_plans p on p.slug = v.slug
where not exists (select 1 from public.pricing_plan_versions existing where existing.plan_id = p.id);


-- ============================================================================
-- PART 3 — Point each plan at the version this file just created, but only
-- if it doesn't already point somewhere (see file header).
-- ============================================================================

update public.pricing_plans p
set current_version_id = pv.id
from public.pricing_plan_versions pv
where pv.plan_id = p.id
  and pv.version_number = 1
  and p.current_version_id is null;


-- ============================================================================
-- PART 4 — Offers: intentionally none. "No active offer is enabled by
-- default" / "Do not create fabricated coupon codes." This file creates
-- zero pricing_offers rows. An admin creates the first real offer at
-- /admin/pricing when NextWise actually wants to run one.
-- ============================================================================


-- ============================================================================
-- VERIFY — run manually after this file to confirm all nine landed:
--
-- select p.slug, p.category, pv.public_title, pv.amount_minor_units, pv.currency, pv.status
-- from public.pricing_plans p
-- join public.pricing_plan_versions pv on pv.id = p.current_version_id
-- order by p.display_order;
-- -- expect exactly 9 rows, amounts matching (in minor units):
-- -- 500000, 1000000, 1500000, 2500000, 6000000, 13000000, 2700000, 6500000, 14000000
-- ============================================================================
