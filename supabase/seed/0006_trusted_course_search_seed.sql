-- ============================================================================
-- Trusted Global Course Search — provider/mapping seed
--
-- HOW TO RUN THIS:
--   1. Run supabase/migrations/0009_trusted_course_search.sql FIRST (this
--      seed depends on the tables it creates).
--   2. Open the Supabase SQL Editor, paste this entire file, click "Run".
--
-- IDEMPOTENT AND SAFE TO RE-RUN:
--   - external_search_providers: `on conflict (slug) do nothing` — never
--     overwrites an admin's later edits (e.g. activating a provider after
--     manual verification, or correcting a domain).
--   - external_search_mappings: guarded by `where not exists (...)` against
--     the same (provider_id, destination_country_code, canonical_subject_id,
--     degree_level) tuple the migration's own partial unique index protects
--     — never inserts a duplicate, and never touches an existing row (so an
--     admin's later edit to instructions/status is never reverted).
--
-- WHAT THIS FILE DELIBERATELY DOES NOT DO — READ BEFORE EDITING:
--   The client specification gives a CONCRETE, ready-to-use URL for exactly
--   five things:
--     1. The DAAD "Bachelor's Mechanical Engineering" filtered result URL
--        (Germany — international programmes).
--     2. The DAAD Degree Programmes broader-catalogue base URL.
--     3. The UCAS Course Search base URL.
--     4. The CRICOS course-search base URL.
--     5. The NCES College Navigator base URL.
--   These five are the ONLY providers seeded `active = true` below, and
--   only DAAD International Programmes gets a `mapping_status = 'active'`
--   row with a real `verified_url` (the exact Mechanical Engineering
--   Bachelor's link) — see PART 2. UCAS gets one `mapping_status =
--   'active'` row too, but with `verified_url = null` and
--   `manual_instructions` set to the spec's own worked example text — a
--   reviewed manual-search instruction, never a guessed deep link.
--
--   Every OTHER provider in the spec is given only a bare domain name, or
--   (Spain, Belgium French-speaking) not even that — with instructions to
--   "verify... before activation". This file NEVER invents a plausible-
--   looking URL for any of them. Each is seeded `active = false`,
--   `strategy = 'official_landing_page'`, `base_url = 'https://' ||
--   <the exact domain string from the spec> || '/'`, `last_verified_at =
--   null`. An admin must open /admin/trusted-portals, confirm the real
--   official URL, set last_verified_at, record who verified it, and only
--   THEN flip `active` to true. Spain and Belgium (French-speaking) have
--   no domain at all in the spec — see PART 1's own comments at those two
--   rows for the obviously-fake `.example` placeholder domain used so this
--   file can still create their provider records without inventing a
--   real-looking domain string.
-- ============================================================================


-- ============================================================================
-- PART 1 — Providers
-- ============================================================================

insert into public.external_search_providers
  (slug, display_name, country_code, region, provider_type, official_domain, base_url, fallback_url, strategy, description, warning_text, warning_effective_at, warning_review_at, language, active, last_verified_at, supported_degree_levels)
values
  -- --- Germany — international programmes (ACTIVE, one verified deep link; see PART 2) ---
  (
    'daad-international-programmes', 'DAAD International Programmes', 'DE', 'Europe', 'course_search',
    'www2.daad.de', 'https://www2.daad.de/deutschland/studienangebote/international-programmes/en/result/',
    'https://www.daad.de/en/studying-in-germany/universities/all-degree-programmes/',
    'verified_deep_link',
    'Internationally oriented and commonly English-taught programmes in Germany.',
    null, null, null, 'en', true, current_date, '{}'::text[]
  ),
  -- --- Germany — broader catalogue (ACTIVE, landing page only) ---
  (
    'daad-degree-programmes', 'DAAD Degree Programmes', 'DE', 'Europe', 'course_search',
    'daad.de', 'https://www.daad.de/en/studying-in-germany/universities/all-degree-programmes/',
    null, 'official_landing_page',
    'Broader German degree-programme search. The programme information in this catalogue is supplied to DAAD by the German Rectors'' Conference. Confirm current details with the institution.',
    null, null, null, 'en', true, current_date, '{}'::text[]
  ),
  -- --- United Kingdom (ACTIVE, landing page + one manual-instructions mapping; see PART 2) ---
  (
    'ucas-course-search', 'UCAS Course Search', 'GB', 'Europe', 'course_search',
    'ucas.com', 'https://www.ucas.com/explore/search/courses',
    null, 'official_landing_page',
    'Primary UK course-search and application portal.',
    null, null, null, 'en', true, current_date, '{}'::text[]
  ),
  -- --- Canada (INACTIVE — only a bare domain was given; required temporary warning is seeded now so it is ready the moment an admin verifies and activates) ---
  (
    'educanada-program-search', 'EduCanada Program Search', 'CA', 'Americas', 'course_search',
    'educanada.ca', 'https://www.educanada.ca/',
    null, 'official_landing_page',
    null,
    'EduCanada has stated that programme and tuition information may not currently be updated during its data-system transition. Confirm programme availability and fees directly with the institution.',
    current_date, (current_date + interval '6 months')::date, 'en', false, null, '{}'::text[]
  ),
  -- --- Australia (ACTIVE, landing page only) ---
  (
    'cricos', 'CRICOS', 'AU', 'Oceania', 'course_search',
    'cricos.education.gov.au', 'https://cricos.education.gov.au/course/CourseSearch.aspx',
    null, 'official_landing_page',
    'Courses and providers registered for international students in Australia.',
    null, null, null, 'en', true, current_date, '{}'::text[]
  ),
  -- --- United States (ACTIVE, landing page only) ---
  (
    'college-navigator', 'College Navigator', 'US', 'Americas', 'course_search',
    'nces.ed.gov', 'https://nces.ed.gov/collegenavigator/',
    null, 'official_landing_page',
    'US Department of Education/NCES institution and programme search.',
    null, null, null, 'en', true, current_date, '{}'::text[]
  ),
  -- --- India — course discovery (INACTIVE, bare domain only) ---
  (
    'study-in-india', 'Study in India', 'IN', 'Asia', 'course_search',
    'studyinindia.gov.in', 'https://studyinindia.gov.in/',
    null, 'official_landing_page',
    null, null, null, null, 'en', false, null, '{}'::text[]
  ),
  -- --- India — institution verification (INACTIVE, bare domain only) ---
  (
    'university-grants-commission', 'University Grants Commission', 'IN', 'Asia', 'institution_verification',
    'ugc.gov.in', 'https://www.ugc.gov.in/',
    null, 'official_landing_page',
    'Verify institution recognition with UGC.',
    null, null, null, 'en', false, null, '{}'::text[]
  ),
  -- --- France (INACTIVE, bare domain only) ---
  (
    'campus-france', 'Campus France', 'FR', 'Europe', 'course_search',
    'campusfrance.org', 'https://www.campusfrance.org/',
    null, 'official_landing_page',
    null, null, null, null, 'fr', false, null, '{}'::text[]
  ),
  -- --- Netherlands (INACTIVE, bare domain only) ---
  (
    'study-in-nl', 'Study in NL', 'NL', 'Europe', 'course_search',
    'studyinnl.org', 'https://www.studyinnl.org/',
    null, 'official_landing_page',
    null, null, null, null, 'en', false, null, '{}'::text[]
  ),
  -- --- Ireland (INACTIVE, bare domain only) ---
  (
    'cao-course-search', 'CAO Course Search', 'IE', 'Europe', 'course_search',
    'cao.ie', 'https://www.cao.ie/',
    null, 'official_landing_page',
    null, null, null, null, 'en', false, null, '{}'::text[]
  ),
  -- --- Sweden (INACTIVE, bare domain only) ---
  (
    'universityadmissions-se', 'UniversityAdmissions.se', 'SE', 'Europe', 'course_search',
    'universityadmissions.se', 'https://www.universityadmissions.se/',
    null, 'official_landing_page',
    null, null, null, null, 'en', false, null, '{}'::text[]
  ),
  -- --- Finland (INACTIVE, bare domain only) ---
  (
    'studyinfo-fi', 'Studyinfo', 'FI', 'Europe', 'course_search',
    'studyinfo.fi', 'https://studyinfo.fi/',
    null, 'official_landing_page',
    null, null, null, null, 'en', false, null, '{}'::text[]
  ),
  -- --- Denmark (INACTIVE, bare domain only) ---
  (
    'study-in-denmark', 'Study in Denmark', 'DK', 'Europe', 'course_search',
    'studyindenmark.dk', 'https://studyindenmark.dk/',
    null, 'official_landing_page',
    null, null, null, null, 'en', false, null, '{}'::text[]
  ),
  -- --- Norway (INACTIVE, bare domain only) ---
  (
    'study-in-norway', 'Study in Norway', 'NO', 'Europe', 'course_search',
    'studyinnorway.no', 'https://www.studyinnorway.no/',
    null, 'official_landing_page',
    null, null, null, null, 'en', false, null, '{}'::text[]
  ),
  -- --- Switzerland (INACTIVE — spec itself flags the domain as uncertain: "studyprogrammes.ch or the current official Swissuniversities-owned search domain after verification") ---
  (
    'swissuniversities-study-programmes', 'Swissuniversities Study Programmes', 'CH', 'Europe', 'course_search',
    'studyprogrammes.ch', 'https://www.studyprogrammes.ch/',
    null, 'official_landing_page',
    null, null, null, null, 'de', false, null, '{}'::text[]
  ),
  -- --- Austria (INACTIVE, bare domain only) ---
  (
    'study-in-austria', 'Study in Austria', 'AT', 'Europe', 'course_search',
    'studyinaustria.at', 'https://www.studyinaustria.at/',
    null, 'official_landing_page',
    null, null, null, null, 'en', false, null, '{}'::text[]
  ),
  -- --- Italy (INACTIVE, bare domain only) ---
  (
    'universitaly', 'Universitaly', 'IT', 'Europe', 'course_search',
    'universitaly.it', 'https://www.universitaly.it/',
    null, 'official_landing_page',
    null, null, null, null, 'it', false, null, '{}'::text[]
  ),
  -- --- Spain (INACTIVE — the spec gives NO domain at all for QEDU, only
  --      "Official Spanish government domain must be verified before
  --      activation." An obviously-fake .example placeholder domain is
  --      used here ONLY so this row can exist and be found/edited in the
  --      admin UI — this is never to be mistaken for a real QEDU URL, and
  --      the domain-format CHECK constraint would reject a bare "unknown"
  --      string, which is why a syntactically-valid but clearly-fake
  --      .example domain was chosen instead of, say, leaving base_url
  --      empty (base_url is NOT NULL).) ---
  (
    'qedu', 'QEDU', 'ES', 'Europe', 'course_search',
    'unverified-pending-domain-es.example', 'https://unverified-pending-domain-es.example/',
    null, 'official_landing_page',
    'Placeholder record — the spec gives no domain for QEDU at all, only "Official Spanish government domain must be verified before activation." An administrator must locate, verify, and replace this placeholder domain/URL before this provider can ever be activated.',
    null, null, null, 'es', false, null, '{}'::text[]
  ),
  -- --- Poland (INACTIVE, bare domain only) ---
  (
    'study-gov-pl', 'Study.gov.pl', 'PL', 'Europe', 'course_search',
    'study.gov.pl', 'https://study.gov.pl/',
    null, 'official_landing_page',
    null, null, null, null, 'en', false, null, '{}'::text[]
  ),
  -- --- Czechia (INACTIVE, bare domain only) ---
  (
    'study-in-czechia', 'Study in Czechia', 'CZ', 'Europe', 'course_search',
    'studyin.cz', 'https://studyin.cz/',
    null, 'official_landing_page',
    null, null, null, null, 'en', false, null, '{}'::text[]
  ),
  -- --- Portugal (INACTIVE, bare domain only) ---
  (
    'dges', 'DGES', 'PT', 'Europe', 'course_search',
    'dges.gov.pt', 'https://www.dges.gov.pt/',
    null, 'official_landing_page',
    null, null, null, null, 'pt', false, null, '{}'::text[]
  ),
  -- --- Belgium — Flanders (INACTIVE, bare domain only) ---
  (
    'study-in-flanders', 'Study in Flanders', 'BE', 'Flanders', 'course_search',
    'studyinflanders.be', 'https://www.studyinflanders.be/',
    null, 'official_landing_page',
    null, null, null, null, 'en', false, null, '{}'::text[]
  ),
  -- --- Belgium — French-speaking (INACTIVE — the spec gives NO domain at
  --      all here either, only "Use only the verified official
  --      French-speaking Belgian higher-education portal." Same
  --      obviously-fake .example placeholder approach as Spain, above,
  --      and for the same reason. This row exists specifically to satisfy
  --      "Belgium must have two separate provider records because the
  --      Flemish and French-speaking systems maintain separate
  --      catalogues" — it is a real, distinct, admin-editable row, just
  --      not yet pointed at a real URL.) ---
  (
    'study-in-belgium', 'Study in Belgium', 'BE', 'French-speaking', 'course_search',
    'unverified-pending-domain-be-fr.example', 'https://unverified-pending-domain-be-fr.example/',
    null, 'official_landing_page',
    'Placeholder record — the spec gives no domain for the French-speaking Belgian higher-education portal, only "Use only the verified official French-speaking Belgian higher-education portal." An administrator must locate, verify, and replace this placeholder domain/URL before this provider can ever be activated. Kept as a SEPARATE provider record from Study in Flanders (studyinflanders.be) because the Flemish and French-speaking systems maintain separate catalogues.',
    null, null, null, 'fr', false, null, '{}'::text[]
  ),
  -- --- Europe-wide joint master's programmes (INACTIVE — only a bare
  --      domain was given, no specific programme-search path; Master's-only
  --      gating is enforced regardless of activation state via
  --      supported_degree_levels, so this is safe to activate the moment an
  --      admin verifies the real search URL) ---
  (
    'erasmus-mundus-joint-masters', 'Erasmus Mundus Joint Masters', null, 'Europe-wide', 'joint_programme',
    'erasmus-plus.ec.europa.eu', 'https://erasmus-plus.ec.europa.eu/',
    null, 'official_landing_page',
    'These are joint international Master''s programmes delivered by multiple institutions. Scholarship availability and eligibility vary by programme.',
    null, null, null, 'en', false, null, array['masters']::text[]
  )
on conflict (slug) do nothing;


-- ============================================================================
-- PART 2 — Mappings
--
-- Exactly two rows, matching the two worked examples the spec actually
-- gives in full: DAAD's one verified Bachelor's Mechanical Engineering deep
-- link, and UCAS's own manual-search-instructions example. Every other
-- provider/subject/degree combination deliberately has NO mapping row at
-- all — a student searching e.g. "Australia + Master's + Mechanical
-- Engineering" sees the CRICOS landing page and a generic, honest
-- instruction ("Open CRICOS and use its own search; select Master's as the
-- course level"), built at read time by
-- src/lib/education/external-search/adapter.ts, never a fabricated CRICOS
-- deep link or fabricated CRICOS-specific instruction text.
-- ============================================================================

-- Germany + Bachelor's + Mechanical Engineering -> DAAD International
-- Programmes' exact, verified filtered result URL (given verbatim in the
-- client specification). This is the ONLY verified_deep_link-eligible
-- mapping seeded anywhere in this file.
insert into public.external_search_mappings
  (provider_id, canonical_subject_id, degree_level, destination_country_code, verified_url, provider_subject_code, provider_degree_code, search_term, manual_instructions, mapping_status, last_verified_at, verified_by)
select
  p.id, 'mechanical-engineering', 'bachelors', 'DE',
  'https://www2.daad.de/deutschland/studienangebote/international-programmes/en/result/?degree%5B0%5D=1&fos%5B0%5D=96&subjectGroup%5B0%5D=56',
  'fos[0]=96, subjectGroup[0]=56 — admin-facing documentation only, never re-used to build another URL (see this table''s own comment on the migration).',
  'degree[0]=1',
  'Mechanical Engineering',
  null,
  'active',
  current_date,
  null -- seeded programmatically, not by a specific named admin — see supabase/seed/0006_trusted_course_search_seed.sql header and TRUSTED-COURSE-PORTALS-INSTALL.md for why verified_by is left null here; an admin re-confirming this link through /admin/trusted-portals will stamp their own user id going forward.
from public.external_search_providers p
where p.slug = 'daad-international-programmes'
  and not exists (
    select 1 from public.external_search_mappings m
    where m.provider_id = p.id and m.destination_country_code = 'DE' and m.canonical_subject_id = 'mechanical-engineering' and m.degree_level = 'bachelors'
  );

-- United Kingdom + Bachelor's + Mechanical Engineering -> UCAS Course
-- Search, manual-search-instructions strategy, using the spec's own
-- worked example text verbatim. verified_url is deliberately null — this
-- is NOT a deep link, it is reviewed guidance for using UCAS's own search.
insert into public.external_search_mappings
  (provider_id, canonical_subject_id, degree_level, destination_country_code, verified_url, provider_subject_code, provider_degree_code, search_term, manual_instructions, mapping_status, last_verified_at, verified_by)
select
  p.id, 'mechanical-engineering', 'bachelors', 'GB',
  null, null, null,
  'Mechanical Engineering',
  'Open UCAS Course Search and search for ''Mechanical Engineering''; select Undergraduate as the course level.',
  'active',
  current_date,
  null
from public.external_search_providers p
where p.slug = 'ucas-course-search'
  and not exists (
    select 1 from public.external_search_mappings m
    where m.provider_id = p.id and m.destination_country_code = 'GB' and m.canonical_subject_id = 'mechanical-engineering' and m.degree_level = 'bachelors'
  );


-- ============================================================================
-- BOOTSTRAP NOTE — after running this file:
--   - 5 providers are live (active = true): DAAD International Programmes,
--     DAAD Degree Programmes, UCAS Course Search, CRICOS, College Navigator.
--   - 20 providers exist but are INACTIVE, pending a human admin verifying
--     their real official URL at /admin/trusted-portals and flipping
--     `active` to true. Two of those (QEDU / Spain, Study in Belgium /
--     French-speaking) don't even have a real domain yet — see PART 1's
--     comments on those two rows.
--   - Exactly 2 mapping rows exist, both mapping_status='active': the one
--     real DAAD deep link, and the one UCAS manual-instructions example.
-- See PROVIDER-MATRIX.md for the full country-by-country table this seed
-- produces.
-- ============================================================================
