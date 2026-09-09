-- ============================================================================
-- Milestone 12 — Current official NextWise commercial pricing catalogue
--
-- HOW TO RUN THIS:
--   1. The tables/columns this file writes to already exist — no migration
--      is needed for M12 (supabase/migrations/0007_nextwise_pricing_offers.sql
--      and 0008_pricing_inclusions_and_presentation.sql already created
--      everything this file uses).
--   2. Open the Supabase SQL Editor for the target project, paste this
--      entire file, click "Run".
--
-- WHAT THIS IS: the eight CURRENT official NextWise plans, at their current
-- official launch prices, as PUBLISHED, immediately purchasable
-- pricing_plans + pricing_plan_versions rows — grouped India Guidance (2),
-- Bachelor Abroad (3), Master Abroad (3).
--
-- WHY A NEW SEED FILE INSTEAD OF EDITING 0004/0005 — READ THIS FIRST:
-- supabase/seed/0004_pricing_offers_seed.sql and 0005_pricing_inclusions_seed.sql
-- already exist and describe a DIFFERENT, nine-plan catalogue (School
-- Counselling / Class 11 Counselling / Class 12 Counselling / Bachelor
-- Abroad Tier 1-3 / Master Abroad Tier 1-3) at different prices. That
-- catalogue is now superseded — but per this milestone's own instructions,
-- historical seed files are never edited or deleted just because the
-- catalogue changed (doing so would destroy the record of what was
-- previously specified), and this milestone's own audit confirmed the
-- target Supabase project currently has ZERO rows in pricing_plans, so
-- 0004/0005 have never actually been run against it. This file is therefore
-- a clean, ADDITIVE, brand-new catalogue with its own new slugs — it never
-- reads, depends on, or conflicts with anything 0004/0005 would create. If
-- 0004/0005 are ever run FIRST against the same database (they should not
-- be, going forward), the two catalogues would coexist as 9 old + 8 new
-- plans, which is why 0004 and 0005 have each been given a short, header-
-- only "superseded" note pointing here — see those files' own headers. This
-- file does not touch a single SQL statement in either of them.
--
-- CATALOGUE DECISIONS MADE DURING THE M12 AUDIT (see M12_COMPLETION_REPORT.md
-- for the full writeup):
--   - New slugs, not reused old ones: 'school-counselling'/'class-11-counselling'
--     are semantically distinct products (grade-specific school guidance)
--     from the new, more general 'Launch Essential'/'Launch Pro' positioning
--     ("entry-level structured guidance/onboarding", "more comprehensive
--     India-focused counselling") — even though two of the OLD prices
--     happen to numerically match two of the NEW prices, reusing those
--     slugs/rows would misrepresent a genuinely different commercial
--     package as a mere rename. Every plan below gets its own new slug.
--   - Category reuse, not a new enum value: pricing_plans.category is
--     CHECK-constrained to ('school_counselling','class_11_counselling',
--     'class_12_counselling','bachelor_abroad','master_abroad') by
--     0007_nextwise_pricing_offers.sql — loosening that CHECK would be an
--     unnecessary schema change for what is purely a presentation grouping
--     question. Both Launch Essential and Launch Pro are seeded under the
--     EXISTING 'school_counselling' category value; src/types/pricing.ts's
--     PRICING_CATEGORY_LABELS['school_counselling'] has been relabelled
--     from "School Counselling" to "India Guidance" (a presentation-layer
--     rename only — the stored enum value is unchanged) so both plans
--     surface together under one correctly-worded "India Guidance" heading
--     on /pricing. 'class_11_counselling'/'class_12_counselling' are simply
--     not used by any currently-active plan (the public page already skips
--     rendering an empty category subsection — see src/app/(site)/pricing/page.tsx).
--   - Bachelor/Master Abroad Essential/Plus/Premium inclusions are REUSED
--     verbatim from 0005_pricing_inclusions_seed.sql's bachelor-abroad-tier-1/2/3
--     and master-abroad-tier-1/2/3 rows (session counts, comparison-table
--     limits, and every structured inclusion line) — these six new plans
--     carry the exact same name and market positioning as those six old
--     ones, only the price changed, and the old inclusion content is real,
--     previously-approved service-scope copy, not fabricated. Nothing here
--     invents a new application count, shortlist limit, SOP round count,
--     mock-interview count, or support-duration figure beyond what 0005
--     already specified for these exact package identities.
--   - Launch Essential / Launch Pro get NO inclusions and NO presentation
--     fields (session_count, audience_label, etc. all left null/empty) —
--     the spec gives only a one-line positioning statement for each, not a
--     services list, and "Launch" is a new package concept with no prior
--     approved service-scope copy to reuse. The public pricing card already
--     has a built-in, honest fallback for exactly this situation
--     (NEUTRAL_SCOPE_FALLBACK = "Contact NextWise for the detailed service
--     scope." in src/lib/pricing/plan-versions.ts) — this file relies on
--     that existing fallback rather than inventing session counts or a
--     benefits list for either Launch plan.
--   - No pricing_offers rows are created — "no fabricated coupon codes,
--     no invented offers, no fake limited-time urgency."
--
-- IDEMPOTENT AND SAFE TO RE-RUN — same discipline as 0004/0006:
--   - pricing_plans: `on conflict (slug) do nothing` — never overwrites an
--     admin's later edits (is_active, display_order, is_recommended, etc.).
--   - pricing_plan_versions: only inserted for a plan that currently has
--     ZERO version rows at all (checked via NOT EXISTS) — never touches an
--     existing version (respecting the immutability trigger).
--   - pricing_plan_inclusions: only inserted when a row with the same
--     (plan_version_id, title) does not already exist.
--   - pricing_plans.current_version_id: only set when currently null.
--   - Running this file against a database that unexpectedly ALREADY has
--     rows for one of these eight new slugs (e.g. an admin manually created
--     a plan with the same slug first) changes nothing about that existing
--     plan/version — it is left exactly as the admin configured it. This
--     file only ever fills in what is genuinely missing; it never
--     "reconciles" or force-updates a live, admin-customised plan. If the
--     database ever contains a DIFFERENT nine-plan (or any other) catalogue
--     that needs to be reconciled with this one, that is a decision for a
--     human administrator at /admin/pricing (publish new versions, archive
--     old ones) — this bootstrap script deliberately never does that
--     silently.
--
-- Currency: INR. Payment type: one_time (the only value the schema allows).
-- All eight amounts below are exactly the official minor-unit figures given
-- in the M12 commercial specification; nothing here is estimated or rounded.
-- ============================================================================


-- ============================================================================
-- PART 1 — Plans (catalog identity only)
-- ============================================================================

insert into public.pricing_plans (slug, category, internal_name, display_order, is_recommended, is_active)
values
  ('launch-essential',          'school_counselling', 'Launch Essential',           10, false, true),
  ('launch-pro',                'school_counselling', 'Launch Pro',                 20, false, true),
  ('bachelor-abroad-essential', 'bachelor_abroad',    'Bachelor Abroad Essential',  30, false, true),
  ('bachelor-abroad-plus',      'bachelor_abroad',    'Bachelor Abroad Plus',       40, false, true),
  ('bachelor-abroad-premium',   'bachelor_abroad',    'Bachelor Abroad Premium',    50, false, true),
  ('master-abroad-essential',   'master_abroad',      'Master Abroad Essential',    60, false, true),
  ('master-abroad-plus',        'master_abroad',      'Master Abroad Plus',         70, false, true),
  ('master-abroad-premium',     'master_abroad',      'Master Abroad Premium',      80, false, true)
on conflict (slug) do nothing;


-- ============================================================================
-- PART 2 — Version 1 of each plan: published, effective immediately, no
-- expiry. Prices are exactly the M12 commercial specification's minor-unit
-- figures. Bachelor/Master Abroad Essential/Plus/Premium also carry their
-- full presentation fields (session_count, etc.) and cta_text, copied from
-- the same values 0005_pricing_inclusions_seed.sql already gave the
-- identically-named/positioned old tier plans — see this file's header for
-- why that reuse is safe and non-fabricated. Launch Essential/Launch Pro get
-- only price + cta_text; every presentation field is left null (no invented
-- session count, audience, or limits for a package with no prior approved
-- service-scope copy).
-- ============================================================================

insert into public.pricing_plan_versions (
  plan_id, version_number, public_title, short_description, detailed_description,
  currency, amount_minor_units, payment_type, included_services, exclusions,
  cta_text, tax_status, status, effective_from, effective_until,
  session_count, session_duration_note, audience_label,
  university_shortlist_limit, application_support_limit, sop_review_rounds,
  scholarship_support_note, mock_interview_count, counsellor_tier, support_duration_note
)
select p.id, 1, v.public_title, null, null,
  'INR', v.amount_minor_units, 'one_time', '[]'::jsonb, '[]'::jsonb,
  'Get started', 'unconfigured', 'published', now(), null,
  v.session_count, v.session_duration_note, v.audience_label,
  v.university_shortlist_limit, v.application_support_limit, v.sop_review_rounds,
  v.scholarship_support_note, v.mock_interview_count, v.counsellor_tier, v.support_duration_note
from (values
  -- slug, public_title, amount_minor_units,
  -- session_count, session_duration_note, audience_label,
  -- university_shortlist_limit, application_support_limit, sop_review_rounds,
  -- scholarship_support_note, mock_interview_count, counsellor_tier, support_duration_note
  (
    'launch-essential', 'Launch Essential', 500000::bigint,
    null::integer, null::text, null::text,
    null::integer, null::integer, null::integer,
    null::text, null::integer, null::text, null::text
  ),
  (
    'launch-pro', 'Launch Pro', 1000000::bigint,
    null, null, null,
    null, null, null,
    null, null, null, null
  ),
  (
    'bachelor-abroad-essential', 'Bachelor Abroad Essential', 1500000::bigint,
    5, 'Each session lasts approximately 45–60 minutes', null,
    8, 3, 1,
    'Basic scholarship search', null, null,
    '90 days of email or WhatsApp support'
  ),
  (
    'bachelor-abroad-plus', 'Bachelor Abroad Plus', 7000000::bigint,
    9, 'Each session lasts approximately 45–60 minutes', null,
    12, 6, 2,
    'Scholarship identification and guidance', null, 'Dedicated counsellor',
    'Up to 6 months'
  ),
  (
    'bachelor-abroad-premium', 'Bachelor Abroad Premium', 12000000::bigint,
    15, 'Each session lasts approximately 45–60 minutes (up to 15 sessions)', null,
    18, 10, 3,
    'Scholarship application support for up to 5 opportunities', 3, 'Senior dedicated counsellor',
    'Priority email or WhatsApp support for up to 12 months'
  ),
  (
    'master-abroad-essential', 'Master Abroad Essential', 1600000::bigint,
    5, 'Each session lasts approximately 45–60 minutes', null,
    8, 3, 1,
    'Basic scholarship search', null, null,
    '90 days of follow-up support'
  ),
  (
    'master-abroad-plus', 'Master Abroad Plus', 7500000::bigint,
    9, 'Each session lasts approximately 45–60 minutes', null,
    12, 6, 2,
    'Scholarship and funding search', 1, 'Dedicated postgraduate counsellor',
    'Up to 6 months'
  ),
  (
    'master-abroad-premium', 'Master Abroad Premium', 12500000::bigint,
    15, 'Each session lasts approximately 45–60 minutes (up to 15 sessions)', null,
    18, 10, 3,
    'Scholarship or funding support for up to 5 opportunities', 3, 'Senior postgraduate admissions counsellor',
    'Priority support for up to 12 months'
  )
) as v(
  slug, public_title, amount_minor_units,
  session_count, session_duration_note, audience_label,
  university_shortlist_limit, application_support_limit, sop_review_rounds,
  scholarship_support_note, mock_interview_count, counsellor_tier, support_duration_note
)
join public.pricing_plans p on p.slug = v.slug
where not exists (select 1 from public.pricing_plan_versions existing where existing.plan_id = p.id);


-- ============================================================================
-- PART 3 — Point each plan at the version this file just created, but only
-- if it doesn't already point somewhere.
-- ============================================================================

update public.pricing_plans p
set current_version_id = pv.id
from public.pricing_plan_versions pv
where pv.plan_id = p.id
  and pv.version_number = 1
  and p.current_version_id is null;


-- ============================================================================
-- PART 4 — Ordered inclusion rows for the six Bachelor/Master Abroad plans,
-- reused verbatim from 0005_pricing_inclusions_seed.sql's bachelor-abroad-
-- tier-1/2/3 and master-abroad-tier-1/2/3 rows (see this file's header for
-- why). Launch Essential and Launch Pro deliberately get zero inclusion
-- rows — the public pricing card already renders NEUTRAL_SCOPE_FALLBACK
-- when a version has neither inclusions nor included_services.
-- ============================================================================

insert into public.pricing_plan_inclusions (plan_version_id, display_order, title, category, numeric_allowance, unit, is_highlight, is_active)
select v1.id, x.display_order, x.title, x.category, x.numeric_allowance, x.unit, x.is_highlight, true
from (
  values
    -- Bachelor Abroad Essential
    ('bachelor-abroad-essential', 1, 'Academic and study-destination assessment', null::text, null::numeric, null::text, false),
    ('bachelor-abroad-essential', 2, 'Country, course and career-path selection', null, null, null, false),
    ('bachelor-abroad-essential', 3, 'Shortlist of up to 8 universities', 'shortlist', 8, 'universities', false),
    ('bachelor-abroad-essential', 4, 'Application strategy and deadline calendar', null, null, null, false),
    ('bachelor-abroad-essential', 5, 'Support for up to 3 university applications', 'applications', 3, 'applications', false),
    ('bachelor-abroad-essential', 6, 'Review of one SOP or personal statement', 'sop', 1, 'review rounds', false),
    ('bachelor-abroad-essential', 7, 'Review of one résumé', null, null, null, false),
    ('bachelor-abroad-essential', 8, 'LOR guidance and templates', null, null, null, false),
    ('bachelor-abroad-essential', 9, 'Document checklist', null, null, null, false),
    ('bachelor-abroad-essential', 10, 'Basic scholarship search', 'scholarship', null, null, false),
    ('bachelor-abroad-essential', 11, 'Basic education-loan information', null, null, null, false),
    ('bachelor-abroad-essential', 12, 'General visa-process checklist', null, null, null, false),
    ('bachelor-abroad-essential', 13, 'One offer-comparison session', null, null, null, false),
    ('bachelor-abroad-essential', 14, '90 days of email or WhatsApp support', 'support', 90, 'days', false),

    -- Bachelor Abroad Plus
    ('bachelor-abroad-plus', 1, 'Dedicated counsellor', 'counsellor', null, null, true),
    ('bachelor-abroad-plus', 2, 'Detailed profile and admission-chance review', null, null, null, false),
    ('bachelor-abroad-plus', 3, 'Country and course selection', null, null, null, false),
    ('bachelor-abroad-plus', 4, 'Balanced shortlist of up to 12 universities', 'shortlist', 12, 'universities', false),
    ('bachelor-abroad-plus', 5, 'Support for up to 6 university applications', 'applications', 6, 'applications', false),
    ('bachelor-abroad-plus', 6, 'SOP or personal-statement development with up to 2 review rounds', 'sop', 2, 'review rounds', false),
    ('bachelor-abroad-plus', 7, 'Résumé development and review', null, null, null, false),
    ('bachelor-abroad-plus', 8, 'LOR strategy and review', null, null, null, false),
    ('bachelor-abroad-plus', 9, 'Application-form and document review', null, null, null, false),
    ('bachelor-abroad-plus', 10, 'Scholarship identification and guidance', 'scholarship', null, null, false),
    ('bachelor-abroad-plus', 11, 'Portfolio or interview preparation where applicable', null, null, null, false),
    ('bachelor-abroad-plus', 12, 'Offer comparison and selection support', null, null, null, false),
    ('bachelor-abroad-plus', 13, 'General visa-document preparation guidance', null, null, null, false),
    ('bachelor-abroad-plus', 14, 'Education-loan and financial-planning guidance', null, null, null, false),
    ('bachelor-abroad-plus', 15, 'One pre-departure orientation', null, null, null, false),
    ('bachelor-abroad-plus', 16, 'Support for up to 6 months', 'support', 6, 'months', false),

    -- Bachelor Abroad Premium
    ('bachelor-abroad-premium', 1, 'Senior dedicated counsellor', 'counsellor', null, null, true),
    ('bachelor-abroad-premium', 2, 'Comprehensive academic and profile assessment', null, null, null, false),
    ('bachelor-abroad-premium', 3, 'Personalised university-admission strategy', null, null, null, false),
    ('bachelor-abroad-premium', 4, 'Profile-building plan', null, null, null, false),
    ('bachelor-abroad-premium', 5, 'Shortlist of up to 18 universities', 'shortlist', 18, 'universities', false),
    ('bachelor-abroad-premium', 6, 'Support for up to 10 university applications', 'applications', 10, 'applications', false),
    ('bachelor-abroad-premium', 7, 'Complete SOP and personal-statement assistance with up to 3 review rounds', 'sop', 3, 'review rounds', false),
    ('bachelor-abroad-premium', 8, 'Résumé development', null, null, null, false),
    ('bachelor-abroad-premium', 9, 'LOR planning and review', null, null, null, false),
    ('bachelor-abroad-premium', 10, 'Essay and supplementary-question review', null, null, null, false),
    ('bachelor-abroad-premium', 11, 'Scholarship application support for up to 5 opportunities', 'scholarship', 5, 'opportunities', false),
    ('bachelor-abroad-premium', 12, 'Interview preparation with up to 3 mock interviews', 'interview', 3, 'mock interviews', true),
    ('bachelor-abroad-premium', 13, 'Portfolio guidance where applicable', null, null, null, false),
    ('bachelor-abroad-premium', 14, 'Application and document quality checks', null, null, null, false),
    ('bachelor-abroad-premium', 15, 'Offer, scholarship and total-cost comparison', null, null, null, false),
    ('bachelor-abroad-premium', 16, 'General visa-document and interview preparation', null, null, null, false),
    ('bachelor-abroad-premium', 17, 'Education-loan coordination guidance', null, null, null, false),
    ('bachelor-abroad-premium', 18, 'Accommodation and pre-departure guidance', null, null, null, false),
    ('bachelor-abroad-premium', 19, 'Parent progress meetings', null, null, null, false),
    ('bachelor-abroad-premium', 20, 'Priority email or WhatsApp support for up to 12 months', 'support', 12, 'months', false),

    -- Master Abroad Essential
    ('master-abroad-essential', 1, 'Academic and professional-profile assessment', null, null, null, false),
    ('master-abroad-essential', 2, 'Country, programme and specialisation selection', null, null, null, false),
    ('master-abroad-essential', 3, 'Shortlist of up to 8 universities', 'shortlist', 8, 'universities', false),
    ('master-abroad-essential', 4, 'Support for up to 3 university applications', 'applications', 3, 'applications', false),
    ('master-abroad-essential', 5, 'Review of one academic or professional résumé', null, null, null, false),
    ('master-abroad-essential', 6, 'Review of one SOP or motivation letter', 'sop', 1, 'review rounds', false),
    ('master-abroad-essential', 7, 'LOR strategy and templates', null, null, null, false),
    ('master-abroad-essential', 8, 'Application deadline and document checklist', null, null, null, false),
    ('master-abroad-essential', 9, 'Basic scholarship search', 'scholarship', null, null, false),
    ('master-abroad-essential', 10, 'General visa-process guidance', null, null, null, false),
    ('master-abroad-essential', 11, 'One offer-comparison session', null, null, null, false),
    ('master-abroad-essential', 12, '90 days of follow-up support', 'support', 90, 'days', false),

    -- Master Abroad Plus
    ('master-abroad-plus', 1, 'Dedicated postgraduate counsellor', 'counsellor', null, null, true),
    ('master-abroad-plus', 2, 'Academic, employment and research-profile review', null, null, null, false),
    ('master-abroad-plus', 3, 'Shortlist of up to 12 universities', 'shortlist', 12, 'universities', false),
    ('master-abroad-plus', 4, 'Support for up to 6 university applications', 'applications', 6, 'applications', false),
    ('master-abroad-plus', 5, 'SOP or motivation-letter development with up to 2 review rounds', 'sop', 2, 'review rounds', false),
    ('master-abroad-plus', 6, 'Academic or professional résumé development', null, null, null, false),
    ('master-abroad-plus', 7, 'LOR review', null, null, null, false),
    ('master-abroad-plus', 8, 'Application and document quality checks', null, null, null, false),
    ('master-abroad-plus', 9, 'Scholarship and funding search', 'scholarship', null, null, false),
    ('master-abroad-plus', 10, 'Interview preparation with one mock interview', 'interview', 1, 'mock interviews', true),
    ('master-abroad-plus', 11, 'Research-proposal guidance where required', null, null, null, false),
    ('master-abroad-plus', 12, 'Offer and return-on-investment comparison', null, null, null, false),
    ('master-abroad-plus', 13, 'General visa-document guidance', null, null, null, false),
    ('master-abroad-plus', 14, 'Education-loan and financial-planning guidance', null, null, null, false),
    ('master-abroad-plus', 15, 'One pre-departure session', null, null, null, false),
    ('master-abroad-plus', 16, 'Support for up to 6 months', 'support', 6, 'months', false),

    -- Master Abroad Premium
    ('master-abroad-premium', 1, 'Senior postgraduate admissions counsellor', 'counsellor', null, null, true),
    ('master-abroad-premium', 2, 'Detailed academic, professional and research-profile assessment', null, null, null, false),
    ('master-abroad-premium', 3, 'Personalised admission and profile-positioning strategy', null, null, null, false),
    ('master-abroad-premium', 4, 'Shortlist of up to 18 universities', 'shortlist', 18, 'universities', false),
    ('master-abroad-premium', 5, 'Support for up to 10 university applications', 'applications', 10, 'applications', false),
    ('master-abroad-premium', 6, 'SOP, motivation-letter and programme-specific essay support with up to 3 review rounds', 'sop', 3, 'review rounds', false),
    ('master-abroad-premium', 7, 'Professional or academic résumé development', null, null, null, false),
    ('master-abroad-premium', 8, 'LOR strategy and review', null, null, null, false),
    ('master-abroad-premium', 9, 'Research-proposal review where required', null, null, null, false),
    ('master-abroad-premium', 10, 'Scholarship or funding support for up to 5 opportunities', 'scholarship', 5, 'opportunities', false),
    ('master-abroad-premium', 11, 'Up to 3 mock interviews', 'interview', 3, 'mock interviews', true),
    ('master-abroad-premium', 12, 'Application and document quality assurance', null, null, null, false),
    ('master-abroad-premium', 13, 'Offer, funding, career-outcome and total-cost comparison', null, null, null, false),
    ('master-abroad-premium', 14, 'General visa-document and interview preparation', null, null, null, false),
    ('master-abroad-premium', 15, 'Education-loan coordination guidance', null, null, null, false),
    ('master-abroad-premium', 16, 'Accommodation and pre-departure assistance', null, null, null, false),
    ('master-abroad-premium', 17, 'Parent or family consultations when requested', null, null, null, false),
    ('master-abroad-premium', 18, 'Priority support for up to 12 months', 'support', 12, 'months', false)
) as x(slug, display_order, title, category, numeric_allowance, unit, is_highlight)
join public.pricing_plans p on p.slug = x.slug
join public.pricing_plan_versions v1 on v1.plan_id = p.id and v1.version_number = 1
where not exists (
  select 1 from public.pricing_plan_inclusions existing
  where existing.plan_version_id = v1.id and existing.title = x.title
);


-- ============================================================================
-- PART 5 — Offers: intentionally none. "No fake discounts, no fabricated
-- coupon codes, no invented offers, no fake limited-time urgency." This file
-- creates zero pricing_offers rows.
-- ============================================================================


-- ============================================================================
-- VERIFY — run manually after this file to confirm all eight landed:
--
-- select p.slug, p.category, pv.public_title, pv.amount_minor_units, pv.currency, pv.status,
--   (select count(*) from public.pricing_plan_inclusions i where i.plan_version_id = pv.id) as inclusion_count
-- from public.pricing_plans p
-- join public.pricing_plan_versions pv on pv.id = p.current_version_id
-- order by p.display_order;
-- -- expect exactly 8 rows, amounts matching (in minor units):
-- -- 500000, 1000000, 1500000, 7000000, 12000000, 1600000, 7500000, 12500000
-- -- inclusion_count 0 for launch-essential/launch-pro, and 14/16/20/12/16/18
-- -- for bachelor-essential/plus/premium and master-essential/plus/premium
-- -- respectively.
--
-- select count(*) from public.pricing_plans where is_active = true; -- expect 8
-- select count(*) from public.pricing_offers; -- expect 0 (this file creates none)
-- ============================================================================
