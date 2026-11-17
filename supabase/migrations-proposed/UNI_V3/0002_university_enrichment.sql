-- ============================================================================
-- UNI_V3 / 0002 — student-safe profile data for the V3 directory and profile
-- STATUS: PROPOSED. Tested only on a disposable local database. Never applied
--         to staging or production. Requires owner approval before any use.
-- Requires: UNI_V3 / 0001 (uses has_university_directory_access()).
-- Rollback: 0002_university_enrichment.rollback.sql
--
-- Additive only: four nullable/defaulted columns on public.universities and one
-- new table. No existing column, row, constraint or policy is changed.
-- Existing columns reused as they are: summary, campus_info, ranking (jsonb),
-- ownership_type, state_region, city, website, source_url, last_verified_at,
-- verification_status, publication_status.
-- ============================================================================

begin;

alter table public.universities
  add column if not exists institution_category text,
  add column if not exists study_areas text[] not null default '{}'::text[],
  add column if not exists highlights jsonb not null default '[]'::jsonb,
  add column if not exists course_catalogue_url text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'universities_institution_category_check') then
    alter table public.universities add constraint universities_institution_category_check
      check (institution_category is null or institution_category in
        ('university', 'university_of_applied_sciences', 'art_music_university', 'dual_university', 'public_service_university'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'universities_study_areas_check') then
    alter table public.universities add constraint universities_study_areas_check
      check (study_areas <@ array['engineering', 'computer_science', 'natural_sciences', 'mathematics', 'medicine_health',
        'life_sciences', 'business_economics', 'social_sciences', 'humanities', 'law_public_administration', 'education',
        'arts_design_media', 'music_performing_arts', 'architecture_built_environment', 'agriculture_environment']::text[]);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'universities_highlights_is_array') then
    alter table public.universities add constraint universities_highlights_is_array check (jsonb_typeof(highlights) = 'array');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'universities_course_catalogue_url_https') then
    alter table public.universities add constraint universities_course_catalogue_url_https
      check (course_catalogue_url is null or course_catalogue_url ~ '^https://');
  end if;
end $$;

create index if not exists universities_study_areas_idx on public.universities using gin (study_areas);
create index if not exists universities_category_idx on public.universities (institution_category);
create index if not exists universities_state_region_idx on public.universities (state_region);

comment on column public.universities.institution_category is
  'UNI_V3 — student-facing category (University, University of Applied Sciences/Hochschule, ...). Separate from the older institution_type so existing values are untouched.';
comment on column public.universities.study_areas is
  'UNI_V3 — broad study areas used by the directory filter. Derived from the institution''s official programme catalogue; provisional until the record is verified.';
comment on column public.universities.highlights is
  'UNI_V3 — array of {"text","source_name","source_url","as_of"}. Every highlight must carry its source; the profile shows none without one.';
comment on column public.universities.ranking is
  'Array of {"provider","year","rank","category","scope":"overall"|"subject","source_url"}. Shown only for verified records and only with provider and year.';
comment on column public.universities.course_catalogue_url is
  'UNI_V3 — the institution''s own official programme catalogue page (where students are sent for courses).';

create table if not exists public.university_media (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities (id) on delete cascade,
  kind text not null default 'gallery',
  url text not null,
  alt_text text not null,
  caption text,
  credit_author text not null,
  credit_source_url text not null,
  licence_name text not null,
  licence_url text,
  licence_status text not null default 'pending_review',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint university_media_kind_check check (kind in ('hero', 'gallery')),
  constraint university_media_url_check check (url ~ '^(https://|/university-media/)'),
  constraint university_media_source_https check (credit_source_url ~ '^https://'),
  constraint university_media_licence_status_check check (licence_status in ('pending_review', 'cleared', 'rejected'))
);
create index if not exists university_media_university_idx on public.university_media (university_id, sort_order);
create unique index if not exists university_media_one_hero_idx on public.university_media (university_id) where kind = 'hero' and is_active;

comment on table public.university_media is
  'UNI_V3 — photographs for the directory card (hero) and profile gallery. Every row records the author, source page and licence. Students only ever see rows whose licence_status is ''cleared''.';

alter table public.university_media enable row level security;

drop policy if exists "Verified students can read cleared media of published universities" on public.university_media;
create policy "Verified students can read cleared media of published universities"
  on public.university_media for select to authenticated
  using (
    is_active = true and licence_status = 'cleared' and public.has_university_directory_access()
    and exists (select 1 from public.universities u where u.id = university_media.university_id and u.is_active = true and u.publication_status = 'published')
  );

drop policy if exists "Any admin can read university media" on public.university_media;
create policy "Any admin can read university media"
  on public.university_media for select to authenticated using (public.is_any_admin());

drop policy if exists "super_admin/admin/content_editor can write university media" on public.university_media;
create policy "super_admin/admin/content_editor can write university media"
  on public.university_media for insert to authenticated
  with check (public.is_admin_role(array['super_admin', 'admin', 'content_editor']));

drop policy if exists "super_admin/admin/content_editor can update university media" on public.university_media;
create policy "super_admin/admin/content_editor can update university media"
  on public.university_media for update to authenticated
  using (public.is_admin_role(array['super_admin', 'admin', 'content_editor']))
  with check (public.is_admin_role(array['super_admin', 'admin', 'content_editor']));

revoke all on public.university_media from anon;
revoke delete, truncate, references, trigger on public.university_media from authenticated;

commit;

-- Ask the API layer to re-read the schema so the change is visible at once.
notify pgrst, 'reload schema';
