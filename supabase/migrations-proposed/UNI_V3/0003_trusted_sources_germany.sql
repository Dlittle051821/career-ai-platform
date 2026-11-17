-- ============================================================================
-- UNI_V3 / 0003 — add two official German portals to the trusted-source registry
-- STATUS: PROPOSED seed. Tested only on a disposable local database.
-- The same two entries can instead be created by hand in
--   Admin -> Education -> Sources   (/admin/education/sources)
-- which is the preferred route, because it stamps the admin who verified them.
-- Rollback: 0003_trusted_sources_germany.rollback.sql
--
-- Both are inserted INACTIVE. They appear to students only after an admin opens
-- each one in /admin/education/sources, checks the link and switches it on.
--
-- Hochschulkompass  — operated by the German Rectors' Conference (HRK).
-- Study in Germany  — operated by the DAAD.
-- Domain ownership checked 17 Nov 2026 against HRK/DAAD and German government pages
-- (see docs/university-discovery-v3/GERMANY-IMPORT-AUDIT.md, "Trusted portals").
-- ============================================================================
begin;
insert into public.external_search_providers
  (slug, display_name, country_code, provider_type, official_domain, base_url, strategy, description, language, active, supported_degree_levels)
values
  ('hochschulkompass', 'Hochschulkompass', 'DE', 'course_search', 'hochschulkompass.de',
   'https://www.hochschulkompass.de/', 'official_landing_page',
   'The German Rectors'' Conference (HRK) directory of degree programmes at state and state-recognised universities in Germany.',
   'en', false, array['bachelors', 'masters', 'doctorate']),
  ('study-in-germany', 'Study in Germany', 'DE', 'course_search', 'study-in-germany.de',
   'https://www.study-in-germany.de/en/', 'official_landing_page',
   'The DAAD''s official guide for international students: planning, requirements, and finding a programme.',
   'en', false, array['bachelors', 'masters', 'doctorate'])
on conflict (slug) do nothing;
commit;
