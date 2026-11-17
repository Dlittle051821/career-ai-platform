-- UNI_V3 / 0002 rollback. STATUS: PROPOSED. Tested only on a disposable local database.
-- WARNING: this drops the four UNI_V3 columns and the university_media table, including any data entered into them.
--          Export them first if they hold reviewed content:
--            copy (select id, slug, institution_category, study_areas, highlights, course_catalogue_url from public.universities) to stdout csv header;
--            copy public.university_media to stdout csv header;
begin;
drop table if exists public.university_media;
drop index if exists public.universities_study_areas_idx;
drop index if exists public.universities_category_idx;
drop index if exists public.universities_state_region_idx;
alter table public.universities
  drop constraint if exists universities_institution_category_check,
  drop constraint if exists universities_study_areas_check,
  drop constraint if exists universities_highlights_is_array,
  drop constraint if exists universities_course_catalogue_url_https,
  drop column if exists institution_category,
  drop column if exists study_areas,
  drop column if exists highlights,
  drop column if exists course_catalogue_url;
commit;

-- Ask the API layer to re-read the schema so the change is visible at once.
notify pgrst, 'reload schema';
