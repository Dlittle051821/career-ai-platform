-- ============================================================================
-- M20A — Launch Country Trusted Source Registry — provider seed
--
-- HOW TO RUN THIS:
--   1. Confirm supabase/migrations/0009_trusted_course_search.sql has
--      already been applied (this seed depends on the
--      external_search_providers table it creates — no new migration is
--      added or required by M20A; see M20A_COMPLETION_REPORT.md).
--   2. Open the Supabase SQL Editor, paste this entire file, click "Run".
--
-- IDEMPOTENT AND SAFE TO RE-RUN: every insert uses
-- `on conflict (slug) do nothing` — never overwrites an admin's later edit
-- (e.g. activating/deactivating a provider, or correcting a domain), same
-- convention as supabase/seed/0006_trusted_course_search_seed.sql.
--
-- WHAT THIS FILE ADDS: exactly five new rows in the EXISTING
-- external_search_providers table — no new table, no new column, no
-- migration. M20A's own discovery pass (see
-- docs/m20a-trusted-country-source-registry.md) confirmed
-- external_search_providers already has every field the launch-country
-- registry data model needs (country, country code, provider/source
-- name, authority, primary URL, purpose, source category, active state,
-- last-reviewed date, external-link behavior) — reusing it is this
-- milestone's own explicit instruction ("M20A MUST reuse this
-- architecture if it is suitable. Do NOT create a duplicate table or
-- subsystem.").
--
-- WHY FIVE NEW ROWS, NOT ONE PER LAUNCH COUNTRY: Germany's launch-primary
-- source (DAAD International Programmes) already exists, already active,
-- already carrying a real verified deep link — seeded by
-- 0006_trusted_course_search_seed.sql. This file does not touch it. The
-- other five Tier 1 launch countries (United Kingdom, United States,
-- Canada, Australia, Ireland) already had DIFFERENT provider rows seeded
-- for course-search purposes (UCAS, College Navigator/NCES, EduCanada,
-- CRICOS, CAO) — those remain untouched, exactly as seeded, as additional
-- specialist sources the existing architecture already supports. This
-- file adds the FIVE SPECIFIC authoritative national sources this
-- milestone's own task brief named as the launch baseline (Study UK /
-- British Council, EducationUSA, Government of Canada, Study Australia,
-- Education in Ireland) as their own new rows, each a distinct slug, so
-- the "one country, one launch-primary" designation
-- (src/lib/education/external-search/launch-country-sources.ts) can
-- point at a row that matches the task brief's own named authority and
-- domain exactly, without altering or deleting anything UX07 already
-- shipped. Having more than one provider row per country is the existing
-- architecture's own designed-in allowance ("additional specialist
-- sources can be added later") — this file does not create two
-- COMPETING PRIMARY sources for any country; exactly one source per
-- launch country is ever marked launch-primary, and that designation
-- lives in the TypeScript registry file above, not in this table.
--
-- WHY `active = true` FOR ALL FIVE, UNLIKE MOST OF 0006's SEED ROWS: most
-- of 0006's seed rows are `active = false` because the client
-- specification behind UX07 gave only a bare domain name for them
-- ("verify... before activation" — see that file's own header). These
-- five rows are different: THIS milestone's own task brief gives a
-- concrete, ready-to-use "Primary domain" for each one (daad.de,
-- study-uk.britishcouncil.org, educationusa.state.gov, canada.ca,
-- studyaustralia.gov.au, educationinireland.com) as the explicit launch
-- baseline — the same footing 0006's seed already treated as sufficient
-- to activate UCAS/CRICOS/College Navigator as landing-page providers
-- (a concrete, spec-given domain, used as an official landing page, with
-- no fabricated deep link). `last_verified_at` is stamped `current_date`
-- for the same reason those three rows were, and `verified_by` is left
-- null for the same reason theirs was ("seeded programmatically, not by
-- a specific named admin" — an admin re-confirming any of these through
-- the existing trusted-portals admin tooling will stamp their own user id
-- going forward, exactly like every other provider in this table).
--
-- WHAT THIS FILE DELIBERATELY DOES NOT DO: it adds no
-- external_search_mappings row for any of these five providers — none of
-- them has a client-given, subject+degree-filtered deep link the way
-- DAAD International Programmes/UCAS do in 0006's seed, so none is
-- claimed. Each is seeded as `strategy = 'official_landing_page'` only; a
-- future admin (or a later milestone) can add a verified deep-link
-- mapping the same way 0006's seed did, through the existing admin
-- tooling — this file does not invent one.
-- ============================================================================

insert into public.external_search_providers
  (slug, display_name, country_code, region, provider_type, official_domain, base_url, fallback_url, strategy, description, warning_text, warning_effective_at, warning_review_at, language, active, last_verified_at, supported_degree_levels)
values
  -- --- United Kingdom — M20A launch-primary source ---
  (
    'study-uk-british-council', 'Study UK — British Council', 'GB', 'Europe', 'course_search',
    'study-uk.britishcouncil.org', 'https://study-uk.britishcouncil.org/',
    null, 'official_landing_page',
    'National study guidance, course and university guidance, and application guidance for international students considering the UK.',
    null, null, null, 'en', true, current_date, '{}'::text[]
  ),
  -- --- United States — M20A launch-primary source ---
  (
    'educationusa', 'EducationUSA', 'US', 'Americas', 'course_search',
    'educationusa.state.gov', 'https://educationusa.state.gov/',
    null, 'official_landing_page',
    'Official U.S. Department of State network providing higher-education guidance for international students considering the United States.',
    null, null, null, 'en', true, current_date, '{}'::text[]
  ),
  -- --- Canada — M20A launch-primary source (distinct from the existing,
  --      still-inactive EduCanada row — see this file's header for why
  --      both rows exist) ---
  (
    'government-of-canada-study', 'Government of Canada — International Student Guidance', 'CA', 'Americas', 'course_search',
    'canada.ca', 'https://www.canada.ca/en/services/immigration-citizenship/visit-canada/study.html',
    null, 'official_landing_page',
    'Official Government of Canada guidance on international student study: school selection, study permits, and planning to study in Canada.',
    null, null, null, 'en', true, current_date, '{}'::text[]
  ),
  -- --- Australia — M20A launch-primary source (distinct from the
  --      existing, already-active CRICOS row — see this file's header for
  --      why both rows exist) ---
  (
    'study-australia', 'Study Australia — Australian Government', 'AU', 'Oceania', 'course_search',
    'studyaustralia.gov.au', 'https://www.studyaustralia.gov.au/',
    null, 'official_landing_page',
    'Official Australian Government guidance for international students: course and provider discovery, study guidance, student life, and visa preparation.',
    null, null, null, 'en', true, current_date, '{}'::text[]
  ),
  -- --- Ireland — M20A launch-primary source (distinct from the existing,
  --      still-inactive CAO row — see this file's header for why both
  --      rows exist) ---
  (
    'education-in-ireland', 'Education in Ireland', 'IE', 'Europe', 'course_search',
    'educationinireland.com', 'https://www.educationinireland.com/',
    null, 'official_landing_page',
    'Official national guidance for international students: institution discovery, study planning, and guidance for studying in Ireland.',
    null, null, null, 'en', true, current_date, '{}'::text[]
  )
on conflict (slug) do nothing;


-- ============================================================================
-- VERIFICATION QUERIES (run manually after applying; not executed
-- automatically — same convention as 0006_trusted_course_search_seed.sql
-- and 0009_trusted_course_search.sql PART 4).
--
-- 1) Exactly five new rows exist, all active, all https, all on their
--    named domain:
--
-- select slug, country_code, official_domain, base_url, active, last_verified_at
--   from public.external_search_providers
--   where slug in (
--     'study-uk-british-council', 'educationusa',
--     'government-of-canada-study', 'study-australia', 'education-in-ireland'
--   )
--   order by country_code;
-- -- expect 5 rows, each active = true, each base_url starting with
-- -- 'https://' and ending inside its own official_domain.
--
-- 2) Germany's launch-primary source is untouched by this file:
--
-- select slug, active, last_verified_at
--   from public.external_search_providers
--   where slug = 'daad-international-programmes';
-- -- expect the same row 0006_trusted_course_search_seed.sql already
-- -- produced — this file does not insert, update, or reference it.
--
-- 3) No country now has two rows both claimed as THIS milestone's
--    launch-primary — that designation is enforced in TypeScript, not
--    SQL; see src/lib/education/external-search/
--    launch-country-sources.test.ts for the actual assertion. This query
--    only confirms the slugs that TypeScript file points at actually
--    exist and are active:
--
-- select slug, active from public.external_search_providers
--   where slug in (
--     'daad-international-programmes', 'study-uk-british-council',
--     'educationusa', 'government-of-canada-study', 'study-australia',
--     'education-in-ireland'
--   );
-- -- expect 6 rows, all active = true.
-- ============================================================================
