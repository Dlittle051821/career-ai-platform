-- ============================================================================
-- M20D FINAL — Launch-Source Integrity Verification Queries (SELECT-ONLY)
--
-- Run these manually, by hand, against the real database, one at a time.
-- Nothing in this file is executed by M20D. No INSERT/UPDATE/DELETE
-- statement appears anywhere below. This mirrors the existing convention
-- in supabase/migrations/0009_trusted_course_search.sql PART 4 and
-- supabase/seed/0008_m20a_launch_country_sources_seed.sql's own
-- "VERIFICATION QUERIES" footer.
--
-- PURPOSE: confirm the "KNOWN REAL DATABASE STATE" the M20D task brief
-- asserts as ground truth is actually what the live database has, without
-- M20D re-deriving or mutating anything itself.
-- ============================================================================

-- 1) All six launch-primary provider rows exist, are active, and are on
--    their correct country code + official domain (per
--    src/lib/education/external-search/launch-country-sources.ts).
select slug, display_name, country_code, official_domain, base_url, active, last_verified_at
  from public.external_search_providers
  where slug in (
    'daad-international-programmes', 'study-uk-british-council',
    'educationusa', 'government-of-canada-study',
    'study-australia', 'education-in-ireland'
  )
  order by country_code;
-- EXPECT: 6 rows, each active = true, each country_code matching
-- LAUNCH_COUNTRY_PRIMARY_SOURCES, each base_url on its own official_domain.

-- 2) No duplicate slug / no accidental second "launch-primary-shaped" row
--    for any of the six launch countries.
select country_code, count(*) as provider_count, array_agg(slug order by slug) as slugs
  from public.external_search_providers
  where country_code in ('DE', 'GB', 'US', 'CA', 'AU', 'IE') and active = true
  group by country_code
  order by country_code;
-- EXPECT: every country_code appears at least once (DAAD pair means DE may
-- show 2 active rows — daad-international-programmes AND
-- daad-degree-programmes — this is a reviewed, non-blocking duplicate pair,
-- not a defect; see M20D_AUDIT_FINDINGS.md "Provider duplicate audit").
-- The launch-PRIMARY designation itself is enforced in TypeScript
-- (LAUNCH_COUNTRY_PRIMARY_SOURCES), never in this table.

-- 3) Germany's restored DAAD deep-link mapping matches the task brief's
--    "KNOWN REAL DATABASE STATE" exactly.
select m.destination_country_code, m.canonical_subject_id, m.degree_level,
       m.mapping_status, m.verified_url, p.slug as provider_slug
  from public.external_search_mappings m
  join public.external_search_providers p on p.id = m.provider_id
  where m.destination_country_code = 'DE' and p.slug = 'daad-international-programmes';
-- EXPECT: exactly 1 row, mapping_status = 'active', degree_level =
-- 'bachelors', verified_url present and on the daad.de/www2.daad.de domain.
-- Cross-check canonical_subject_id against public.canonical_subjects for
-- 'mechanical-engineering' separately if subject id, not slug, is stored.

-- 4) Specialist providers referenced by the specialist-completeness audit
--    (M20D_AUDIT_FINDINGS.md) — presence/active-state only, no judgement
--    performed in SQL.
select slug, country_code, active, official_domain, last_verified_at
  from public.external_search_providers
  where slug in (
    'ucas-course-search', 'college-navigator', 'educanada-program-search',
    'cricos', 'cao-course-search', 'daad-degree-programmes'
  )
  order by slug;
-- EXPECT: see M20D_AUDIT_FINDINGS.md for the expected active-state of each
-- (most of these were seeded inactive pending verification by
-- supabase/seed/0006_trusted_course_search_seed.sql and have not been
-- re-verified since — do not treat "inactive" here as a defect).

-- 5) No `.example` placeholder domain is marked active (a seed-safety
--    sanity check — 0006's seed deliberately ships two .example rows,
--    qedu and study-in-belgium, that must never be active=true).
select slug, official_domain, active
  from public.external_search_providers
  where official_domain like '%.example%';
-- EXPECT: 0 rows with active = true. Any active=true row here would be a
-- genuine BLOCKER (an unsafe placeholder domain live in production).

-- 6) Historical-seed duplicate-slug sanity check — confirm 0006 and 0008
--    never collided on the same slug (both files use
--    `on conflict (slug) do nothing`, so a collision would silently keep
--    whichever row inserted first — this query only observes, it changes
--    nothing).
select slug, count(*)
  from public.external_search_providers
  group by slug
  having count(*) > 1;
-- EXPECT: 0 rows (slug has a unique constraint at the schema level per
-- 0009_trusted_course_search.sql, so this should always return empty —
-- included as a defense-in-depth sanity check, not because a violation is
-- expected).
-- ============================================================================
