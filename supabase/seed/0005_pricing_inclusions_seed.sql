-- ============================================================================
-- Milestone 11 — Official NextWise pricing inclusions & presentation seed
--
-- HOW TO RUN THIS:
--   1. Run supabase/migrations/0008_pricing_inclusions_and_presentation.sql
--      FIRST (this seed depends on the table/columns it creates).
--   2. Run this file AFTER supabase/seed/0004_pricing_offers_seed.sql has
--      already been run at least once (it depends on the nine plans and
--      their version-1 rows that file creates).
--   3. Open the Supabase SQL Editor, paste this entire file, click "Run".
--
-- WHAT THIS IS: verbatim included-service lists, session allowances, and
-- comparison-table limits for the nine official NextWise plans, sourced
-- from the authoritative client specification. No benefit, price, session
-- count, or limit here is invented — every line item below matches the
-- spec text exactly (only reformatted into rows).
--
-- ARCHITECTURE — why this creates VERSION 2, not an UPDATE to version 1:
-- 0004_pricing_offers_seed.sql published every plan's version 1 directly
-- (status = 'published' from the moment it was inserted), with EMPTY
-- included_services and no presentation fields — 0004's own header
-- explicitly calls the Bachelor/Master Abroad tier names ("Bachelor Abroad
-- — Tier 1" etc.) "the 'Temporary public name' the spec calls out". Version
-- 1 rows are therefore already immutable (0007's trigger, extended by 0008
-- PART 3) — this file cannot UPDATE them, and per 0008 PART 1.1's RLS it
-- cannot attach new pricing_plan_inclusions rows to them either. So for
-- each plan this file:
--   1. Inserts a DRAFT version 2, copying price/currency/cta_text/tax
--      status/exclusions straight from version 1 (so the price genuinely
--      never changes) and adding the correct public title (the official
--      Essential/Plus/Premium name for the six Bachelor/Master Abroad
--      tiers — version 1's own "Temporary public name" is exactly what is
--      being replaced here, as anticipated) plus the ten new presentation
--      fields.
--   2. Attaches the plan's ordered pricing_plan_inclusions rows to that
--      draft version 2.
--   3. Publishes version 2 and archives version 1 — the exact
--      "publish a new version, archive the old one, repoint
--      current_version_id" sequence src/lib/supabase/admin/pricing.ts's
--      publishPricingPlanVersion() performs, just run directly in SQL for
--      this one-time bootstrap (same convention as 0004 itself, which
--      inserted its rows already-published rather than going through an
--      RPC that does not exist for anonymous seeding).
--
-- IDEMPOTENT AND SAFE TO RE-RUN:
--   - Version 2 is only ever inserted when a plan does not already have a
--     version_number = 2 row (checked via NOT EXISTS) — re-running this
--     file after it has already succeeded once changes nothing.
--   - Inclusion rows are only inserted when a row with the same
--     (plan_version_id, title) does not already exist for that version.
--   - Publishing version 2 / archiving version 1 / repointing
--     current_version_id are all guarded by a `where` clause that only
--     matches while the transition has not already happened.
--   - Every price/currency value is copied FROM the existing version-1 row
--     via a join, never retyped as a literal — this file cannot introduce a
--     price discrepancy even by typo.
-- ============================================================================


-- ============================================================================
-- PART 1 — Version 2 (draft): official public title + presentation fields,
-- price/currency/cta/tax/exclusions copied verbatim from version 1.
-- ============================================================================

insert into public.pricing_plan_versions (
  plan_id, version_number, public_title, short_description, detailed_description,
  currency, amount_minor_units, payment_type, included_services, exclusions,
  cta_text, tax_status, status, effective_from, effective_until,
  session_count, session_duration_note, audience_label,
  university_shortlist_limit, application_support_limit, sop_review_rounds,
  scholarship_support_note, mock_interview_count, counsellor_tier, support_duration_note
)
select
  p.id, 2, meta.public_title, v1.short_description, v1.detailed_description,
  v1.currency, v1.amount_minor_units, 'one_time', '[]'::jsonb, v1.exclusions,
  v1.cta_text, v1.tax_status, 'draft', null, null,
  meta.session_count, meta.session_duration_note, meta.audience_label,
  meta.university_shortlist_limit, meta.application_support_limit, meta.sop_review_rounds,
  meta.scholarship_support_note, meta.mock_interview_count, meta.counsellor_tier, meta.support_duration_note
from public.pricing_plans p
join public.pricing_plan_versions v1 on v1.plan_id = p.id and v1.version_number = 1
join (
  values
    (
      'school-counselling', 'School Counselling',
      2::integer, 'Each session lasts approximately 45–60 minutes', 'Classes 8–10',
      null::integer, null::integer, null::integer, null::text, null::integer, null::text,
      '14 days of email or WhatsApp follow-up support'
    ),
    (
      'class-11-counselling', 'Class 11 Counselling',
      4, 'Each session lasts approximately 45–60 minutes', null,
      null, null, null, null, null, null,
      '30 days of follow-up support'
    ),
    (
      'class-12-counselling', 'Class 12 Counselling',
      6, 'Each session lasts approximately 45–60 minutes', null,
      12, null, null, 'Basic scholarship guidance', null, null,
      '60 days of follow-up support'
    ),
    (
      'bachelor-abroad-tier-1', 'Bachelor Abroad Essential',
      5, 'Each session lasts approximately 45–60 minutes', null,
      8, 3, 1, 'Basic scholarship search', null, null,
      '90 days of email or WhatsApp support'
    ),
    (
      'bachelor-abroad-tier-2', 'Bachelor Abroad Plus',
      9, 'Each session lasts approximately 45–60 minutes', null,
      12, 6, 2, 'Scholarship identification and guidance', null, 'Dedicated counsellor',
      'Up to 6 months'
    ),
    (
      'bachelor-abroad-tier-3', 'Bachelor Abroad Premium',
      15, 'Each session lasts approximately 45–60 minutes (up to 15 sessions)', null,
      18, 10, 3, 'Scholarship application support for up to 5 opportunities', 3, 'Senior dedicated counsellor',
      'Priority email or WhatsApp support for up to 12 months'
    ),
    (
      'master-abroad-tier-1', 'Master Abroad Essential',
      5, 'Each session lasts approximately 45–60 minutes', null,
      8, 3, 1, 'Basic scholarship search', null, null,
      '90 days of follow-up support'
    ),
    (
      'master-abroad-tier-2', 'Master Abroad Plus',
      9, 'Each session lasts approximately 45–60 minutes', null,
      12, 6, 2, 'Scholarship and funding search', 1, 'Dedicated postgraduate counsellor',
      'Up to 6 months'
    ),
    (
      'master-abroad-tier-3', 'Master Abroad Premium',
      15, 'Each session lasts approximately 45–60 minutes (up to 15 sessions)', null,
      18, 10, 3, 'Scholarship or funding support for up to 5 opportunities', 3, 'Senior postgraduate admissions counsellor',
      'Priority support for up to 12 months'
    )
) as meta(
  slug, public_title,
  session_count, session_duration_note, audience_label,
  university_shortlist_limit, application_support_limit, sop_review_rounds,
  scholarship_support_note, mock_interview_count, counsellor_tier, support_duration_note
) on meta.slug = p.slug
where not exists (
  select 1 from public.pricing_plan_versions existing where existing.plan_id = p.id and existing.version_number = 2
);


-- ============================================================================
-- PART 2 — Ordered inclusion rows for each plan's version 2. Verbatim from
-- the spec's "Included services" bullet lists, EXCLUDING the session-count
-- and "each session lasts..." bullets (those became session_count /
-- session_duration_note in PART 1 above, shown prominently rather than
-- buried in a scrollable list) and the School Counselling "Recommended
-- audience" line (that became audience_label above). Every other bullet is
-- reproduced exactly, in the spec's original order, as one row.
-- ============================================================================

insert into public.pricing_plan_inclusions (plan_version_id, display_order, title, category, numeric_allowance, unit, is_highlight, is_active)
select v2.id, x.display_order, x.title, x.category, x.numeric_allowance, x.unit, x.is_highlight, true
from (
  values
    -- 1. School Counselling
    ('school-counselling', 1, 'Student interest and strengths assessment', null::text, null::numeric, null::text, false),
    ('school-counselling', 2, 'Career-cluster exploration', null, null, null, false),
    ('school-counselling', 3, 'Stream guidance covering Science, Commerce, Humanities and vocational options', null, null, null, false),
    ('school-counselling', 4, 'Subject-combination guidance', null, null, null, false),
    ('school-counselling', 5, 'One parent consultation', null, null, null, false),
    ('school-counselling', 6, 'Personalised career summary report', null, null, null, false),
    ('school-counselling', 7, 'Basic two-year action plan', null, null, null, false),
    ('school-counselling', 8, '14 days of email or WhatsApp follow-up support', 'support', 14, 'days', false),

    -- 2. Class 11 Counselling
    ('class-11-counselling', 1, 'Detailed interest, aptitude and personality assessment', null, null, null, false),
    ('class-11-counselling', 2, 'Career and course exploration', null, null, null, false),
    ('class-11-counselling', 3, 'Subject and eligibility review', null, null, null, false),
    ('class-11-counselling', 4, 'Indian and international study-path overview', null, null, null, false),
    ('class-11-counselling', 5, 'Entrance-exam planning', null, null, null, false),
    ('class-11-counselling', 6, 'Extracurricular and profile-building guidance', null, null, null, false),
    ('class-11-counselling', 7, 'Initial shortlist of up to 10 career or course options', 'shortlist', 10, 'career or course options', false),
    ('class-11-counselling', 8, 'Personalised academic and profile roadmap', null, null, null, false),
    ('class-11-counselling', 9, 'One parent consultation', null, null, null, false),
    ('class-11-counselling', 10, '30 days of follow-up support', 'support', 30, 'days', false),

    -- 3. Class 12 Counselling
    ('class-12-counselling', 1, 'Career, aptitude and course-fit assessment', null, null, null, false),
    ('class-12-counselling', 2, 'Academic-profile evaluation', null, null, null, false),
    ('class-12-counselling', 3, 'Course and specialisation selection', null, null, null, false),
    ('class-12-counselling', 4, 'Shortlist of up to 12 universities or colleges', 'shortlist', 12, 'universities or colleges', false),
    ('class-12-counselling', 5, 'Entrance-exam and deadline planning', null, null, null, false),
    ('class-12-counselling', 6, 'Personalised application calendar', null, null, null, false),
    ('class-12-counselling', 7, 'Basic scholarship guidance', null, null, null, false),
    ('class-12-counselling', 8, 'Review of one résumé or student profile', null, null, null, false),
    ('class-12-counselling', 9, 'Guidance for one personal statement', null, null, null, false),
    ('class-12-counselling', 10, 'Two parent consultations', null, null, null, false),
    ('class-12-counselling', 11, 'Decision-support session after offers are received', null, null, null, false),
    ('class-12-counselling', 12, '60 days of follow-up support', 'support', 60, 'days', false),

    -- 4. Bachelor Abroad Essential
    ('bachelor-abroad-tier-1', 1, 'Academic and study-destination assessment', null, null, null, false),
    ('bachelor-abroad-tier-1', 2, 'Country, course and career-path selection', null, null, null, false),
    ('bachelor-abroad-tier-1', 3, 'Shortlist of up to 8 universities', 'shortlist', 8, 'universities', false),
    ('bachelor-abroad-tier-1', 4, 'Application strategy and deadline calendar', null, null, null, false),
    ('bachelor-abroad-tier-1', 5, 'Support for up to 3 university applications', 'applications', 3, 'applications', false),
    ('bachelor-abroad-tier-1', 6, 'Review of one SOP or personal statement', 'sop', 1, 'review rounds', false),
    ('bachelor-abroad-tier-1', 7, 'Review of one résumé', null, null, null, false),
    ('bachelor-abroad-tier-1', 8, 'LOR guidance and templates', null, null, null, false),
    ('bachelor-abroad-tier-1', 9, 'Document checklist', null, null, null, false),
    ('bachelor-abroad-tier-1', 10, 'Basic scholarship search', 'scholarship', null, null, false),
    ('bachelor-abroad-tier-1', 11, 'Basic education-loan information', null, null, null, false),
    ('bachelor-abroad-tier-1', 12, 'General visa-process checklist', null, null, null, false),
    ('bachelor-abroad-tier-1', 13, 'One offer-comparison session', null, null, null, false),
    ('bachelor-abroad-tier-1', 14, '90 days of email or WhatsApp support', 'support', 90, 'days', false),

    -- 5. Bachelor Abroad Plus
    ('bachelor-abroad-tier-2', 1, 'Dedicated counsellor', 'counsellor', null, null, true),
    ('bachelor-abroad-tier-2', 2, 'Detailed profile and admission-chance review', null, null, null, false),
    ('bachelor-abroad-tier-2', 3, 'Country and course selection', null, null, null, false),
    ('bachelor-abroad-tier-2', 4, 'Balanced shortlist of up to 12 universities', 'shortlist', 12, 'universities', false),
    ('bachelor-abroad-tier-2', 5, 'Support for up to 6 university applications', 'applications', 6, 'applications', false),
    ('bachelor-abroad-tier-2', 6, 'SOP or personal-statement development with up to 2 review rounds', 'sop', 2, 'review rounds', false),
    ('bachelor-abroad-tier-2', 7, 'Résumé development and review', null, null, null, false),
    ('bachelor-abroad-tier-2', 8, 'LOR strategy and review', null, null, null, false),
    ('bachelor-abroad-tier-2', 9, 'Application-form and document review', null, null, null, false),
    ('bachelor-abroad-tier-2', 10, 'Scholarship identification and guidance', 'scholarship', null, null, false),
    ('bachelor-abroad-tier-2', 11, 'Portfolio or interview preparation where applicable', null, null, null, false),
    ('bachelor-abroad-tier-2', 12, 'Offer comparison and selection support', null, null, null, false),
    ('bachelor-abroad-tier-2', 13, 'General visa-document preparation guidance', null, null, null, false),
    ('bachelor-abroad-tier-2', 14, 'Education-loan and financial-planning guidance', null, null, null, false),
    ('bachelor-abroad-tier-2', 15, 'One pre-departure orientation', null, null, null, false),
    ('bachelor-abroad-tier-2', 16, 'Support for up to 6 months', 'support', 6, 'months', false),

    -- 6. Bachelor Abroad Premium
    ('bachelor-abroad-tier-3', 1, 'Senior dedicated counsellor', 'counsellor', null, null, true),
    ('bachelor-abroad-tier-3', 2, 'Comprehensive academic and profile assessment', null, null, null, false),
    ('bachelor-abroad-tier-3', 3, 'Personalised university-admission strategy', null, null, null, false),
    ('bachelor-abroad-tier-3', 4, 'Profile-building plan', null, null, null, false),
    ('bachelor-abroad-tier-3', 5, 'Shortlist of up to 18 universities', 'shortlist', 18, 'universities', false),
    ('bachelor-abroad-tier-3', 6, 'Support for up to 10 university applications', 'applications', 10, 'applications', false),
    ('bachelor-abroad-tier-3', 7, 'Complete SOP and personal-statement assistance with up to 3 review rounds', 'sop', 3, 'review rounds', false),
    ('bachelor-abroad-tier-3', 8, 'Résumé development', null, null, null, false),
    ('bachelor-abroad-tier-3', 9, 'LOR planning and review', null, null, null, false),
    ('bachelor-abroad-tier-3', 10, 'Essay and supplementary-question review', null, null, null, false),
    ('bachelor-abroad-tier-3', 11, 'Scholarship application support for up to 5 opportunities', 'scholarship', 5, 'opportunities', false),
    ('bachelor-abroad-tier-3', 12, 'Interview preparation with up to 3 mock interviews', 'interview', 3, 'mock interviews', true),
    ('bachelor-abroad-tier-3', 13, 'Portfolio guidance where applicable', null, null, null, false),
    ('bachelor-abroad-tier-3', 14, 'Application and document quality checks', null, null, null, false),
    ('bachelor-abroad-tier-3', 15, 'Offer, scholarship and total-cost comparison', null, null, null, false),
    ('bachelor-abroad-tier-3', 16, 'General visa-document and interview preparation', null, null, null, false),
    ('bachelor-abroad-tier-3', 17, 'Education-loan coordination guidance', null, null, null, false),
    ('bachelor-abroad-tier-3', 18, 'Accommodation and pre-departure guidance', null, null, null, false),
    ('bachelor-abroad-tier-3', 19, 'Parent progress meetings', null, null, null, false),
    ('bachelor-abroad-tier-3', 20, 'Priority email or WhatsApp support for up to 12 months', 'support', 12, 'months', false),

    -- 7. Master Abroad Essential
    ('master-abroad-tier-1', 1, 'Academic and professional-profile assessment', null, null, null, false),
    ('master-abroad-tier-1', 2, 'Country, programme and specialisation selection', null, null, null, false),
    ('master-abroad-tier-1', 3, 'Shortlist of up to 8 universities', 'shortlist', 8, 'universities', false),
    ('master-abroad-tier-1', 4, 'Support for up to 3 university applications', 'applications', 3, 'applications', false),
    ('master-abroad-tier-1', 5, 'Review of one academic or professional résumé', null, null, null, false),
    ('master-abroad-tier-1', 6, 'Review of one SOP or motivation letter', 'sop', 1, 'review rounds', false),
    ('master-abroad-tier-1', 7, 'LOR strategy and templates', null, null, null, false),
    ('master-abroad-tier-1', 8, 'Application deadline and document checklist', null, null, null, false),
    ('master-abroad-tier-1', 9, 'Basic scholarship search', 'scholarship', null, null, false),
    ('master-abroad-tier-1', 10, 'General visa-process guidance', null, null, null, false),
    ('master-abroad-tier-1', 11, 'One offer-comparison session', null, null, null, false),
    ('master-abroad-tier-1', 12, '90 days of follow-up support', 'support', 90, 'days', false),

    -- 8. Master Abroad Plus
    ('master-abroad-tier-2', 1, 'Dedicated postgraduate counsellor', 'counsellor', null, null, true),
    ('master-abroad-tier-2', 2, 'Academic, employment and research-profile review', null, null, null, false),
    ('master-abroad-tier-2', 3, 'Shortlist of up to 12 universities', 'shortlist', 12, 'universities', false),
    ('master-abroad-tier-2', 4, 'Support for up to 6 university applications', 'applications', 6, 'applications', false),
    ('master-abroad-tier-2', 5, 'SOP or motivation-letter development with up to 2 review rounds', 'sop', 2, 'review rounds', false),
    ('master-abroad-tier-2', 6, 'Academic or professional résumé development', null, null, null, false),
    ('master-abroad-tier-2', 7, 'LOR review', null, null, null, false),
    ('master-abroad-tier-2', 8, 'Application and document quality checks', null, null, null, false),
    ('master-abroad-tier-2', 9, 'Scholarship and funding search', 'scholarship', null, null, false),
    ('master-abroad-tier-2', 10, 'Interview preparation with one mock interview', 'interview', 1, 'mock interviews', true),
    ('master-abroad-tier-2', 11, 'Research-proposal guidance where required', null, null, null, false),
    ('master-abroad-tier-2', 12, 'Offer and return-on-investment comparison', null, null, null, false),
    ('master-abroad-tier-2', 13, 'General visa-document guidance', null, null, null, false),
    ('master-abroad-tier-2', 14, 'Education-loan and financial-planning guidance', null, null, null, false),
    ('master-abroad-tier-2', 15, 'One pre-departure session', null, null, null, false),
    ('master-abroad-tier-2', 16, 'Support for up to 6 months', 'support', 6, 'months', false),

    -- 9. Master Abroad Premium
    ('master-abroad-tier-3', 1, 'Senior postgraduate admissions counsellor', 'counsellor', null, null, true),
    ('master-abroad-tier-3', 2, 'Detailed academic, professional and research-profile assessment', null, null, null, false),
    ('master-abroad-tier-3', 3, 'Personalised admission and profile-positioning strategy', null, null, null, false),
    ('master-abroad-tier-3', 4, 'Shortlist of up to 18 universities', 'shortlist', 18, 'universities', false),
    ('master-abroad-tier-3', 5, 'Support for up to 10 university applications', 'applications', 10, 'applications', false),
    ('master-abroad-tier-3', 6, 'SOP, motivation-letter and programme-specific essay support with up to 3 review rounds', 'sop', 3, 'review rounds', false),
    ('master-abroad-tier-3', 7, 'Professional or academic résumé development', null, null, null, false),
    ('master-abroad-tier-3', 8, 'LOR strategy and review', null, null, null, false),
    ('master-abroad-tier-3', 9, 'Research-proposal review where required', null, null, null, false),
    ('master-abroad-tier-3', 10, 'Scholarship or funding support for up to 5 opportunities', 'scholarship', 5, 'opportunities', false),
    ('master-abroad-tier-3', 11, 'Up to 3 mock interviews', 'interview', 3, 'mock interviews', true),
    ('master-abroad-tier-3', 12, 'Application and document quality assurance', null, null, null, false),
    ('master-abroad-tier-3', 13, 'Offer, funding, career-outcome and total-cost comparison', null, null, null, false),
    ('master-abroad-tier-3', 14, 'General visa-document and interview preparation', null, null, null, false),
    ('master-abroad-tier-3', 15, 'Education-loan coordination guidance', null, null, null, false),
    ('master-abroad-tier-3', 16, 'Accommodation and pre-departure assistance', null, null, null, false),
    ('master-abroad-tier-3', 17, 'Parent or family consultations when requested', null, null, null, false),
    ('master-abroad-tier-3', 18, 'Priority support for up to 12 months', 'support', 12, 'months', false)
) as x(slug, display_order, title, category, numeric_allowance, unit, is_highlight)
join public.pricing_plans p on p.slug = x.slug
join public.pricing_plan_versions v2 on v2.plan_id = p.id and v2.version_number = 2
where not exists (
  select 1 from public.pricing_plan_inclusions existing
  where existing.plan_version_id = v2.id and existing.title = x.title
);


-- ============================================================================
-- PART 3 — Publish version 2 (only while still draft — idempotent).
-- ============================================================================

update public.pricing_plan_versions v2
set status = 'published'
where v2.version_number = 2
  and v2.status = 'draft';


-- ============================================================================
-- PART 4 — Archive version 1 for every plan whose version 2 is now
-- published (only while version 1 is still published — idempotent). This
-- is the exact same "publishing a version archives any other currently-
-- published version of the same plan" invariant
-- src/lib/supabase/admin/pricing.ts's publishPricingPlanVersion() enforces
-- in the application layer — never more than one published version live at
-- once.
-- ============================================================================

update public.pricing_plan_versions v1
set status = 'archived'
where v1.version_number = 1
  and v1.status = 'published'
  and exists (
    select 1 from public.pricing_plan_versions v2b
    where v2b.plan_id = v1.plan_id and v2b.version_number = 2 and v2b.status = 'published'
  );


-- ============================================================================
-- PART 5 — Repoint each plan's current_version_id at version 2 (only when
-- it does not already point there — idempotent).
-- ============================================================================

update public.pricing_plans p
set current_version_id = v2.id
from public.pricing_plan_versions v2
where v2.plan_id = p.id
  and v2.version_number = 2
  and v2.status = 'published'
  and p.current_version_id is distinct from v2.id;


-- ============================================================================
-- VERIFY — run manually after this file to confirm all nine landed with
-- their official names, session counts, and at least one inclusion:
--
-- select p.slug, pv.public_title, pv.amount_minor_units, pv.session_count,
--   (select count(*) from public.pricing_plan_inclusions i where i.plan_version_id = pv.id) as inclusion_count
-- from public.pricing_plans p
-- join public.pricing_plan_versions pv on pv.id = p.current_version_id
-- order by p.display_order;
-- -- expect 9 rows: public_title is the official Essential/Plus/Premium
-- -- name for the six Bachelor/Master Abroad tiers, amount_minor_units
-- -- unchanged from 0004 (500000, 1000000, 1500000, 2500000, 6000000,
-- -- 13000000, 2700000, 6500000, 14000000), session_count matching the spec
-- -- (2, 4, 6, 5, 9, 15, 5, 9, 15), inclusion_count matching PART 2's counts
-- -- per plan (8, 10, 12, 14, 16, 20, 12, 16, 18).
-- ============================================================================
