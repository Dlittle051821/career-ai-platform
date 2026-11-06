-- ============================================================================
-- UX10-PR01 — New official NextWise commercial pricing catalogue
--
-- *** FOR REVIEW ONLY. NOT EXECUTED AGAINST ANY DATABASE BY this milestone. ***
-- Per the user's own explicit instruction for this milestone: create the
-- required catalog-migration SQL for review, do not run it, do not alter the
-- live database. A human administrator runs this (Supabase SQL Editor,
-- same procedure as every prior pricing seed file) after reviewing it.
--
-- HOW TO RUN THIS (when you're ready):
--   1. No new migration is needed — every table/column this file writes to
--      already exists (0007_nextwise_pricing_offers.sql,
--      0008_pricing_inclusions_and_presentation.sql).
--   2. Open the Supabase SQL Editor for the target project, paste this
--      entire file, click "Run".
--   3. Run the VERIFY query at the bottom to confirm the result.
--
-- WHAT THIS IS: the user's new 7-plan commercial catalogue, explicitly
-- instructed to supersede the M12 eight-plan catalogue
-- (0007_m12_current_pricing_catalogue_seed.sql) as the active, customer-
-- facing /pricing lineup, while preserving every historical plan, version,
-- and purchase record untouched (see "WHY THIS IS SAFE FOR HISTORY" below).
--
-- THE NEW ACTIVE CATALOGUE (7 plans):
--   1. Nextwise Explore    — FREE        (new plan)
--   2. Nextwise Verified   — ₹1,999      (new plan)
--   3. Nextwise Essential  — ₹24,999     (new plan)
--   4. Bachelor Abroad Plus    — ₹70,000   (EXISTING plan/slug/version — unchanged price, reordered + unchanged otherwise)
--   5. Master Abroad Plus      — ₹75,000   (EXISTING plan/slug/version — unchanged price, reordered + unchanged otherwise)
--   6. Bachelor Abroad Premium — ₹1,20,000 (EXISTING plan/slug/version — unchanged price, reordered, now marked recommended)
--   7. Master Abroad Premium   — ₹1,25,000 (EXISTING plan/slug/version — unchanged price, reordered, now marked recommended)
--
-- RETIRED FROM ACTIVE SALE (deactivated, not deleted):
--   - launch-essential          (₹5,000)
--   - launch-pro                (₹10,000)
--   - bachelor-abroad-essential (₹15,000)
--   - master-abroad-essential   (₹16,000)
--
-- WHY THIS IS SAFE FOR HISTORY — READ THIS FIRST:
--   - `pricing_plans.is_active = false` only removes a plan from the public
--     /pricing page and blocks NEW checkouts (getPublicPricingPlanBySlug
--     filters on is_active — see src/lib/supabase/pricing/public-plans.ts).
--     It does not delete the plan row, its published version(s), or any
--     inclusion rows. Nothing in this file deletes a single row.
--   - Every completed purchase already froze its own copy of the plan name,
--     price, and inclusions at the moment of purchase into
--     pricing_purchases (planNameAtPurchase, includedServicesAtPurchase,
--     inclusionsAtPurchase, presentationLimitsAtPurchase — see
--     src/types/pricing.ts's PricingPurchase). A deactivated plan's
--     historical purchases, invoices, and agreements read from that frozen
--     snapshot, never from the live pricing_plans/pricing_plan_versions
--     rows — so deactivating a plan changes nothing about any existing
--     customer's invoice, agreement, or purchase history.
--   - pricing_plan_versions rows are immutable once published (enforced by
--     a trigger in 0007_nextwise_pricing_offers.sql PART 2.1) — this file
--     does not attempt to edit any existing version, only (a) toggle the
--     mutable pricing_plans.is_active/is_recommended/display_order columns,
--     and (b) insert brand-new plans + their first (draft-born, then
--     published) version, exactly like every prior catalogue seed file.
--   - bachelor-abroad-plus, master-abroad-plus, bachelor-abroad-premium,
--     and master-abroad-premium keep their EXACT existing slug, plan row,
--     and published version from 0007 — their price, inclusions, and
--     checkout link are completely unchanged by this file. Only their
--     is_recommended flag (both premium plans) and display_order change.
--
-- CATALOGUE DECISIONS MADE DURING THE PR01 AUDIT:
--   - New slugs for genuinely new products, same discipline 0007 used:
--     'nextwise-explore', 'nextwise-verified', 'nextwise-essential'.
--   - Category reuse, not a new enum value (same technique 0007 used):
--     all three new plans are seeded under the EXISTING 'school_counselling'
--     category value (publicly labelled "India Guidance" — see
--     src/types/pricing.ts). This is a presentation-layer category, not
--     product content, and 'school_counselling' is vacated by this file's
--     retirement of the old Launch Essential/Launch Pro plans that
--     previously used it.
--   - Nextwise Verified's and Nextwise Essential's inclusion lists are the
--     user's own authoritative benefit copy for these new products (given
--     directly for this milestone), seeded verbatim as structured
--     pricing_plan_inclusions rows — same "never invent a benefit"
--     discipline as every prior seed file, just with the source being this
--     milestone's own brief instead of an existing seed file to reuse.
--     Nextwise Explore (the free tier) also gets its real benefit list.
--   - No presentation/comparison-table fields (session_count,
--     university_shortlist_limit, etc.) are set for the three new plans —
--     their benefit copy doesn't reduce to those specific structured
--     numbers, so those columns are honestly left null (same convention
--     Launch Essential/Launch Pro used in 0007), not back-filled with a
--     guess.
--   - Both Bachelor Abroad Premium and Master Abroad Premium are marked
--     is_recommended = true. The UI layer (not the database) is
--     responsible for their distinct public badge text ("Most Recommended"
--     / "Best for Full Support") — see src/lib/pricing/recommended-badge.ts
--     — since adding a second "badge text" column would be an unnecessary
--     schema change for a presentation-only distinction.
--   - No pricing_offers rows are created — no fabricated discounts.
--
-- IDEMPOTENT AND SAFE TO RE-RUN — same discipline as 0007:
--   - pricing_plans: `on conflict (slug) do nothing` for new rows; existing
--     rows are only ever touched by a plain `update ... where slug = ...`,
--     safe to run any number of times.
--   - pricing_plan_versions / pricing_plan_inclusions for the 3 new plans:
--     only inserted when none already exist for that slug (checked via
--     NOT EXISTS), exactly like 0007.
--
-- Currency: INR. Payment type: one_time. All amounts are exactly the
-- figures given in this milestone's commercial specification.
-- ============================================================================


-- ============================================================================
-- PART 1 — Retire the four superseded plans from active sale (deactivate,
-- never delete). Their rows, published versions, and inclusions are left
-- completely intact for historical purchases, invoices, and agreements.
-- ============================================================================

update public.pricing_plans
set is_active = false
where slug in ('launch-essential', 'launch-pro', 'bachelor-abroad-essential', 'master-abroad-essential')
  and is_active = true;


-- ============================================================================
-- PART 2 — Reorder and mark the four continuing plans. Slugs, versions,
-- prices, and inclusions are completely untouched — only the mutable
-- pricing_plans columns below change.
-- ============================================================================

update public.pricing_plans set display_order = 40 where slug = 'bachelor-abroad-plus';
update public.pricing_plans set display_order = 50 where slug = 'master-abroad-plus';
update public.pricing_plans set display_order = 60, is_recommended = true where slug = 'bachelor-abroad-premium';
update public.pricing_plans set display_order = 70, is_recommended = true where slug = 'master-abroad-premium';


-- ============================================================================
-- PART 3 — New plans (catalog identity only).
-- ============================================================================

insert into public.pricing_plans (slug, category, internal_name, display_order, is_recommended, is_active)
values
  ('nextwise-explore',  'school_counselling', 'Nextwise Explore',   10, false, true),
  ('nextwise-verified', 'school_counselling', 'Nextwise Verified',  20, false, true),
  ('nextwise-essential','school_counselling', 'Nextwise Essential', 30, false, true)
on conflict (slug) do nothing;


-- ============================================================================
-- PART 4 — Version 1 of each new plan: published, effective immediately,
-- no expiry.
-- ============================================================================

insert into public.pricing_plan_versions (
  plan_id, version_number, public_title, short_description, detailed_description,
  currency, amount_minor_units, payment_type, included_services, exclusions,
  cta_text, tax_status, status, effective_from, effective_until,
  session_count, session_duration_note, audience_label,
  university_shortlist_limit, application_support_limit, sop_review_rounds,
  scholarship_support_note, mock_interview_count, counsellor_tier, support_duration_note
)
select p.id, 1, v.public_title, v.short_description, null,
  'INR', v.amount_minor_units, 'one_time', '[]'::jsonb, '[]'::jsonb,
  v.cta_text, 'unconfigured', 'published', now(), null,
  null, null, null,
  null, null, null,
  null, null, null, null
from (values
  -- slug, public_title, short_description, amount_minor_units, cta_text
  (
    'nextwise-explore', 'Nextwise Explore',
    'Discover your possibilities.',
    0::bigint,
    'Start Exploring Free'
  ),
  (
    'nextwise-verified', 'Nextwise Verified',
    'Know which options genuinely fit you.',
    199900::bigint,
    'Get My Verified Review'
  ),
  (
    'nextwise-essential', 'Nextwise Essential',
    'Your Indian college journey, made simpler.',
    2499900::bigint,
    'Plan My India Admission'
  )
) as v(slug, public_title, short_description, amount_minor_units, cta_text)
join public.pricing_plans p on p.slug = v.slug
where not exists (select 1 from public.pricing_plan_versions existing where existing.plan_id = p.id);


-- ============================================================================
-- PART 5 — Point each new plan at the version this file just created, but
-- only if it doesn't already point somewhere.
-- ============================================================================

update public.pricing_plans p
set current_version_id = pv.id
from public.pricing_plan_versions pv
where pv.plan_id = p.id
  and pv.version_number = 1
  and p.current_version_id is null
  and p.slug in ('nextwise-explore', 'nextwise-verified', 'nextwise-essential');


-- ============================================================================
-- PART 6 — Ordered inclusion rows for the three new plans, from this
-- milestone's own authoritative benefit copy (see header).
-- ============================================================================

insert into public.pricing_plan_inclusions (plan_version_id, display_order, title, category, numeric_allowance, unit, is_highlight, is_active)
select v1.id, x.display_order, x.title, x.category, x.numeric_allowance, x.unit, x.is_highlight, true
from (
  values
    -- Nextwise Explore
    ('nextwise-explore', 1, 'AI-assisted career and interest exploration', null::text, null::numeric, null::text, false),
    ('nextwise-explore', 2, 'Course, college and university discovery', null, null, null, false),
    ('nextwise-explore', 3, 'India vs abroad comparison tools', null, null, null, false),
    ('nextwise-explore', 4, 'Indicative eligibility and study-cost insights', null, null, null, false),
    ('nextwise-explore', 5, 'Scholarship and entrance exam resources', null, null, null, false),
    ('nextwise-explore', 6, 'Personalized student dashboard and saved options', null, null, null, false),
    ('nextwise-explore', 7, 'Study-planning checklists and educational resources', null, null, null, false),

    -- Nextwise Verified
    ('nextwise-verified', 1, 'Academic profile and eligibility screening', null, null, null, false),
    ('nextwise-verified', 2, 'Career and education pathway assessment', null, null, null, false),
    ('nextwise-verified', 3, 'Up to three researched course or program recommendations', 'shortlist', 3, 'recommendations', false),
    ('nextwise-verified', 4, 'Admission requirement and skills-gap checklist', null, null, null, false),
    ('nextwise-verified', 5, 'Study-cost and affordability snapshot', null, null, null, false),
    ('nextwise-verified', 6, 'Scholarship opportunity screening', 'scholarship', null, null, false),
    ('nextwise-verified', 7, 'Personalized Nextwise Decision Summary', null, null, null, true),
    ('nextwise-verified', 8, 'One short expert clarification session', 'support', 1, 'session', false),
    ('nextwise-verified', 9, 'Official information sources and next-step roadmap', null, null, null, false),

    -- Nextwise Essential
    ('nextwise-essential', 1, 'Everything in Nextwise Verified', null, null, null, true),
    ('nextwise-essential', 2, 'Personalized shortlist of up to eight Indian colleges/programs', 'shortlist', 8, 'colleges/programs', false),
    ('nextwise-essential', 3, 'Up to five admission application workflows', 'applications', 5, 'applications', false),
    ('nextwise-essential', 4, 'Entrance exam and admission route planning', null, null, null, false),
    ('nextwise-essential', 5, 'College fee, placement-data and ROI comparison', null, null, null, false),
    ('nextwise-essential', 6, 'Application forms and document guidance', null, null, null, false),
    ('nextwise-essential', 7, 'SOP, CV or portfolio guidance where required', null, null, null, false),
    ('nextwise-essential', 8, 'Scholarship and education loan research', 'scholarship', null, null, false),
    ('nextwise-essential', 9, 'Counselling-round and seat-allotment process guidance', null, null, null, false),
    ('nextwise-essential', 10, 'Admission deadline and application tracking', null, null, null, false),
    ('nextwise-essential', 11, 'Offer comparison and college selection consultation', null, null, null, false),
    ('nextwise-essential', 12, 'Parent consultation and pre-enrolment checklist', null, null, null, false)
) as x(slug, display_order, title, category, numeric_allowance, unit, is_highlight)
join public.pricing_plans p on p.slug = x.slug
join public.pricing_plan_versions v1 on v1.plan_id = p.id and v1.version_number = 1
where not exists (
  select 1 from public.pricing_plan_inclusions existing
  where existing.plan_version_id = v1.id and existing.title = x.title
);


-- ============================================================================
-- VERIFY — run manually after this file to confirm the result:
--
-- select slug, category, display_order, is_recommended, is_active
-- from public.pricing_plans
-- order by display_order;
-- -- expect exactly 11 rows total (8 historical + 3 new), with exactly these
-- -- 7 is_active = true, in this display_order:
-- --   10 nextwise-explore            (new)
-- --   20 nextwise-verified           (new)
-- --   30 nextwise-essential          (new)
-- --   40 bachelor-abroad-plus        (existing, unchanged price/version)
-- --   50 master-abroad-plus          (existing, unchanged price/version)
-- --   60 bachelor-abroad-premium     (existing, unchanged price/version, is_recommended = true)
-- --   70 master-abroad-premium       (existing, unchanged price/version, is_recommended = true)
-- -- and exactly these 4 is_active = false (retired, not deleted):
-- --   launch-essential, launch-pro, bachelor-abroad-essential, master-abroad-essential
--
-- select p.slug, pv.public_title, pv.amount_minor_units, pv.currency, pv.status
-- from public.pricing_plans p join public.pricing_plan_versions pv on pv.id = p.current_version_id
-- where p.slug in ('nextwise-explore', 'nextwise-verified', 'nextwise-essential')
-- order by p.display_order;
-- -- expect amounts (minor units): 0, 199900, 2499900
-- ============================================================================
