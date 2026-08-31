-- ============================================================================
-- Milestone 9 — Global University and Course Data Platform
--
-- HOW TO RUN THIS (no SQL knowledge required):
--   1. Open your Supabase project dashboard (supabase.com/dashboard).
--   2. Click "SQL Editor" in the left sidebar.
--   3. Click "New query".
--   4. Paste the entire contents of this file.
--   5. Click "Run".
--
-- Safe to run once. Re-running is also safe — every statement is written to
-- not fail if already applied (`if not exists` / `add column if not exists`
-- / `drop policy if exists` before `create policy` / a guarded `do $$ ...`
-- block before any `add constraint`, since PostgreSQL has no
-- `add constraint if not exists`).
--
-- This migration does NOT modify 0001-0005 in place. It only ADDS new
-- tables, ADDS new nullable columns to the existing Milestone 7
-- `public.universities`/`public.courses` tables (never renaming or
-- repurposing an existing column), and ADDS new RLS policies alongside the
-- ones 0004_admin_system.sql already defined (PostgreSQL RLS policies are
-- permissive/OR'd together — adding a new policy only ever WIDENS who can
-- see/do something, it can never silently narrow an existing grant). See
-- docs/global-education-data-guide.md for the full design rationale.
--
-- SECURITY DESIGN NOTE: this migration defines ZERO new SECURITY DEFINER
-- functions. Every table below is written/read through the calling admin's
-- or student's own authenticated session, respecting RLS directly — the
-- same pattern every M7 admin module already uses. This was a deliberate
-- choice (see the spec's own "avoid SECURITY DEFINER unless absolutely
-- required"): duplicate-record merges are handled by marking the losing
-- record inactive with a `merged_into_id` pointer (PART 15) rather than by
-- rewriting foreign keys across tables the caller doesn't otherwise have
-- write access to, which is what would have required elevated privilege.
--
-- No service-role key is used or required anywhere in this migration.
-- ============================================================================


-- ============================================================================
-- PART 0 — Extensions
-- ============================================================================

create extension if not exists pg_trgm;


-- ============================================================================
-- PART 1 — Countries (reference data; new countries need only a new row,
-- never a schema change — see docs/global-education-data-guide.md §"how to
-- add a new country")
-- ============================================================================

create table if not exists public.countries (
  id uuid primary key default gen_random_uuid(),
  iso_alpha2 text not null unique,
  iso_alpha3 text not null unique,
  name text not null,
  region text,
  subregion text,
  currency_code text,
  default_language text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint countries_iso_alpha2_format check (iso_alpha2 ~ '^[A-Z]{2}$'),
  constraint countries_iso_alpha3_format check (iso_alpha3 ~ '^[A-Z]{3}$'),
  constraint countries_currency_code_format check (currency_code is null or currency_code ~ '^[A-Z]{3}$')
);
create index if not exists countries_active_idx on public.countries (is_active);
create index if not exists countries_name_idx on public.countries (name);

comment on table public.countries is
  'Milestone 9 — ISO 3166-1 reference data. Adding a country is always just a new row here (insert ... on conflict (iso_alpha2) do nothing) — nothing about this schema, or any table that references countries.id, ever needs to change to support a new country.';

alter table public.countries enable row level security;

drop policy if exists "Anyone can read active countries" on public.countries;
create policy "Anyone can read active countries"
  on public.countries for select to anon, authenticated
  using (is_active = true);

drop policy if exists "Admins can read all countries" on public.countries;
create policy "Admins can read all countries"
  on public.countries for select to authenticated
  using (public.is_any_admin());

drop policy if exists "super_admin/admin can write countries" on public.countries;
create policy "super_admin/admin can write countries"
  on public.countries for insert to authenticated
  with check (public.is_admin_role(array['super_admin', 'admin']));

drop policy if exists "super_admin/admin can update countries" on public.countries;
create policy "super_admin/admin can update countries"
  on public.countries for update to authenticated
  using (public.is_admin_role(array['super_admin', 'admin']))
  with check (public.is_admin_role(array['super_admin', 'admin']));

drop trigger if exists set_countries_updated_at on public.countries;
create trigger set_countries_updated_at before update on public.countries for each row execute function public.set_updated_at();

-- Seed the initial geographic coverage the spec asks for. Real, verifiable
-- ISO 3166-1 / ISO 4217 facts — not fabricated. `on conflict do nothing`
-- keeps this idempotent and never overwrites an admin's later edit to one
-- of these rows (e.g. if they deactivate a country).
insert into public.countries (iso_alpha2, iso_alpha3, name, region, subregion, currency_code, default_language) values
  ('DE', 'DEU', 'Germany', 'Europe', 'Western Europe', 'EUR', 'German'),
  ('GB', 'GBR', 'United Kingdom', 'Europe', 'Northern Europe', 'GBP', 'English'),
  ('CA', 'CAN', 'Canada', 'Americas', 'Northern America', 'CAD', 'English'),
  ('AU', 'AUS', 'Australia', 'Oceania', 'Australia and New Zealand', 'AUD', 'English'),
  ('US', 'USA', 'United States', 'Americas', 'Northern America', 'USD', 'English'),
  ('IN', 'IND', 'India', 'Asia', 'Southern Asia', 'INR', 'English'),
  ('IE', 'IRL', 'Ireland', 'Europe', 'Northern Europe', 'EUR', 'English'),
  ('FR', 'FRA', 'France', 'Europe', 'Western Europe', 'EUR', 'French'),
  ('NL', 'NLD', 'Netherlands', 'Europe', 'Western Europe', 'EUR', 'Dutch'),
  ('SE', 'SWE', 'Sweden', 'Europe', 'Northern Europe', 'SEK', 'Swedish'),
  ('FI', 'FIN', 'Finland', 'Europe', 'Northern Europe', 'EUR', 'Finnish'),
  ('DK', 'DNK', 'Denmark', 'Europe', 'Northern Europe', 'DKK', 'Danish'),
  ('NO', 'NOR', 'Norway', 'Europe', 'Northern Europe', 'NOK', 'Norwegian'),
  ('CH', 'CHE', 'Switzerland', 'Europe', 'Western Europe', 'CHF', 'German'),
  ('AT', 'AUT', 'Austria', 'Europe', 'Western Europe', 'EUR', 'German'),
  ('BE', 'BEL', 'Belgium', 'Europe', 'Western Europe', 'EUR', 'Dutch'),
  ('IT', 'ITA', 'Italy', 'Europe', 'Southern Europe', 'EUR', 'Italian'),
  ('ES', 'ESP', 'Spain', 'Europe', 'Southern Europe', 'EUR', 'Spanish'),
  ('PL', 'POL', 'Poland', 'Europe', 'Eastern Europe', 'PLN', 'Polish'),
  ('CZ', 'CZE', 'Czech Republic', 'Europe', 'Eastern Europe', 'CZK', 'Czech'),
  ('PT', 'PRT', 'Portugal', 'Europe', 'Southern Europe', 'EUR', 'Portuguese')
on conflict (iso_alpha2) do nothing;


-- ============================================================================
-- PART 2 — Extend public.universities (Milestone 7 table)
--
-- Every new column is nullable (or has a safe default) and added with
-- `add column if not exists` — existing rows and existing application code
-- that only knows the Milestone 7 columns keep working unchanged. Existing
-- columns (name, slug, country [free text], city, website, institution_type,
-- summary, accreditation_status, is_active, is_visible, internal_notes,
-- created_by, updated_by, created_at, updated_at) are NOT touched.
--
-- `country` (free text) is left as-is for backward compatibility; the new
-- `country_id` is the normalized FK new records should use going forward.
-- `summary` continues to serve as the description field the spec asks for
-- — a second `description` column was deliberately not added to avoid two
-- competing free-text fields meaning the same thing.
-- ============================================================================

alter table public.universities
  add column if not exists country_id uuid references public.countries (id) on delete set null,
  add column if not exists state_region text,
  add column if not exists street_address text,
  add column if not exists postal_code text,
  add column if not exists admissions_url text,
  add column if not exists international_admissions_url text,
  add column if not exists ownership_type text,
  add column if not exists founding_year integer,
  add column if not exists accreditation_organization text,
  add column if not exists ranking jsonb not null default '[]'::jsonb,
  add column if not exists study_levels text[] not null default '{}'::text[],
  add column if not exists study_modes text[] not null default '{}'::text[],
  add column if not exists campus_info text,
  add column if not exists logo_url text,
  add column if not exists international_student_support text,
  add column if not exists scholarships_available boolean,
  add column if not exists application_fee_minor_units bigint,
  add column if not exists application_fee_currency text,
  add column if not exists publication_status text not null default 'draft',
  add column if not exists data_source text,
  add column if not exists source_url text,
  add column if not exists source_access_date date,
  add column if not exists last_verified_at date,
  add column if not exists verification_status text not null default 'unverified',
  add column if not exists merged_into_id uuid references public.universities (id) on delete set null;

comment on column public.universities.ranking is 'Array of {provider, year, rank, rankType} objects — never fabricated; only populated when a specific provider/year/rank is verifiable from a cited source.';
comment on column public.universities.merged_into_id is 'Set by an admin duplicate-merge decision (see education_duplicate_candidates): when set, this record is the LOSING side of a confirmed duplicate and the surviving record is merged_into_id. A merged record is always also set is_active = false. Never hard-deleted.';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'universities_publication_status_check') then
    alter table public.universities add constraint universities_publication_status_check
      check (publication_status in ('draft', 'in_review', 'published', 'archived'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'universities_verification_status_check') then
    alter table public.universities add constraint universities_verification_status_check
      check (verification_status in ('unverified', 'needs_review', 'verified'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'universities_ownership_type_check') then
    alter table public.universities add constraint universities_ownership_type_check
      check (ownership_type is null or ownership_type in ('public', 'private', 'other'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'universities_application_fee_currency_format') then
    alter table public.universities add constraint universities_application_fee_currency_format
      check (application_fee_currency is null or application_fee_currency ~ '^[A-Z]{3}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'universities_application_fee_check') then
    alter table public.universities add constraint universities_application_fee_check
      check (application_fee_minor_units is null or application_fee_minor_units >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'universities_founding_year_check') then
    alter table public.universities add constraint universities_founding_year_check
      check (founding_year is null or (founding_year >= 800 and founding_year <= 2100));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'universities_ranking_is_array') then
    alter table public.universities add constraint universities_ranking_is_array
      check (jsonb_typeof(ranking) = 'array');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'universities_not_self_merged') then
    alter table public.universities add constraint universities_not_self_merged
      check (merged_into_id is null or merged_into_id <> id);
  end if;
end $$;

create index if not exists universities_country_id_idx on public.universities (country_id);
create index if not exists universities_publication_status_idx on public.universities (publication_status, is_active);
create index if not exists universities_verification_status_idx on public.universities (verification_status);
create index if not exists universities_last_verified_at_idx on public.universities (last_verified_at);
create index if not exists universities_name_trgm_idx on public.universities using gin (name gin_trgm_ops);

-- Full-text search over the university's own fields (no cross-table lookup
-- — the search layer joins country name in separately, see
-- src/lib/education/search.ts). `generated ... stored` keeps this in sync
-- automatically on every insert/update; the 'english' config is a fixed
-- constant so this is a valid generated-column expression.
alter table public.universities
  add column if not exists search_vector tsvector generated always as (
    setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(city, '') || ' ' || coalesce(state_region, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(summary, '') || ' ' || coalesce(campus_info, '')), 'C')
  ) stored;
create index if not exists universities_search_vector_idx on public.universities using gin (search_vector);

-- New RLS: public (anon + any authenticated user, including students) may
-- read a university once it is genuinely published and active. This is
-- ADDITIVE to 0004's "Any admin can read universities" policy — an admin
-- keeps seeing everything (including drafts) via that policy regardless.
drop policy if exists "Public can read published active universities" on public.universities;
create policy "Public can read published active universities"
  on public.universities for select to anon, authenticated
  using (is_active = true and publication_status = 'published');

-- content_editor (the "content manager" role the spec refers to) may create
-- and edit records, but ONLY while they stay in draft/in_review — they
-- cannot use this policy to publish or archive a record themselves. This is
-- ADDITIVE to 0004's super_admin/admin insert/update policies.
drop policy if exists "content_editor can create draft/in_review universities" on public.universities;
create policy "content_editor can create draft/in_review universities"
  on public.universities for insert to authenticated
  with check (public.is_admin_role(array['content_editor']) and publication_status in ('draft', 'in_review'));

drop policy if exists "content_editor can update draft/in_review universities" on public.universities;
create policy "content_editor can update draft/in_review universities"
  on public.universities for update to authenticated
  using (public.is_admin_role(array['content_editor']) and publication_status in ('draft', 'in_review'))
  with check (public.is_admin_role(array['content_editor']) and publication_status in ('draft', 'in_review'));

-- Counsellor read access to universities/courses is already covered by
-- 0004's "Any admin can read universities/courses" policy (is_any_admin()
-- includes every admin_roles row regardless of specific role) — counsellors
-- get full read visibility (including drafts, for advising purposes)
-- without any new policy needed here. They still have no write policy
-- anywhere (0004 nor this file), matching "cannot modify authoritative data
-- unless explicitly authorized".


-- ============================================================================
-- PART 3 — Campuses (new — supports multiple campuses per university)
-- ============================================================================

create table if not exists public.campuses (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities (id) on delete cascade,
  name text not null,
  country_id uuid references public.countries (id) on delete set null,
  state_region text,
  city text,
  address text,
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  is_main boolean not null default false,
  is_active boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint campuses_latitude_range check (latitude is null or (latitude >= -90 and latitude <= 90)),
  constraint campuses_longitude_range check (longitude is null or (longitude >= -180 and longitude <= 180))
);
create index if not exists campuses_university_id_idx on public.campuses (university_id);
create index if not exists campuses_country_id_idx on public.campuses (country_id);
create unique index if not exists campuses_one_main_per_university on public.campuses (university_id) where is_main;

comment on table public.campuses is
  'Milestone 9 — one row per physical/branch campus of a university. `campuses_one_main_per_university` allows at most one is_main = true row per university (not a hard requirement to have one at all). Coordinates are nullable and only ever populated from a legitimate, citeable source — never estimated or geocoded automatically.';

alter table public.campuses enable row level security;

drop policy if exists "Any admin can read campuses" on public.campuses;
create policy "Any admin can read campuses"
  on public.campuses for select to authenticated
  using (public.is_any_admin());

drop policy if exists "Public can read campuses of published active universities" on public.campuses;
create policy "Public can read campuses of published active universities"
  on public.campuses for select to anon, authenticated
  using (
    is_active = true
    and exists (select 1 from public.universities u where u.id = campuses.university_id and u.is_active = true and u.publication_status = 'published')
  );

drop policy if exists "super_admin/admin can write campuses" on public.campuses;
create policy "super_admin/admin can write campuses"
  on public.campuses for insert to authenticated
  with check (public.is_admin_role(array['super_admin', 'admin']));

drop policy if exists "super_admin/admin can update campuses" on public.campuses;
create policy "super_admin/admin can update campuses"
  on public.campuses for update to authenticated
  using (public.is_admin_role(array['super_admin', 'admin']))
  with check (public.is_admin_role(array['super_admin', 'admin']));

drop policy if exists "content_editor can write campuses of its own draft universities" on public.campuses;
create policy "content_editor can write campuses of its own draft universities"
  on public.campuses for insert to authenticated
  with check (
    public.is_admin_role(array['content_editor'])
    and exists (select 1 from public.universities u where u.id = campuses.university_id and u.publication_status in ('draft', 'in_review'))
  );

drop policy if exists "content_editor can update campuses of own draft universities" on public.campuses;
create policy "content_editor can update campuses of own draft universities"
  on public.campuses for update to authenticated
  using (
    public.is_admin_role(array['content_editor'])
    and exists (select 1 from public.universities u where u.id = campuses.university_id and u.publication_status in ('draft', 'in_review'))
  )
  with check (
    public.is_admin_role(array['content_editor'])
    and exists (select 1 from public.universities u where u.id = campuses.university_id and u.publication_status in ('draft', 'in_review'))
  );

drop trigger if exists set_campuses_updated_at on public.campuses;
create trigger set_campuses_updated_at before update on public.campuses for each row execute function public.set_updated_at();


-- ============================================================================
-- PART 4 — Extend public.courses (Milestone 7 table)
--
-- Existing columns (university_id, name, slug, education_level,
-- field_of_study, duration_text, delivery_mode, campus_location,
-- intake_info, tuition_amount_minor_units, tuition_currency,
-- tuition_period, entry_requirements_summary, application_url, is_active,
-- is_visible, data_quality_status, internal_notes, created_at, updated_at)
-- are NOT touched. `education_level` continues to serve as the
-- "qualification level" field the spec asks for (undergraduate/
-- postgraduate/diploma/certificate/doctorate/other) — a second column with
-- the same meaning was deliberately not added. `delivery_mode` continues to
-- serve as "on-campus/online/hybrid". `entry_requirements_summary`
-- continues to hold a short free-text summary; the STRUCTURED requirements
-- the spec asks for live in the new public.course_admission_requirements
-- table (PART 7) plus the narrowly-scoped JSONB columns below for the
-- specific, well-known shape of language/standardized test scores.
-- ============================================================================

alter table public.courses
  add column if not exists campus_id uuid references public.campuses (id) on delete set null,
  add column if not exists program_code text,
  add column if not exists subject_area text,
  add column if not exists discipline text,
  add column if not exists qualification_title text,
  add column if not exists award text,
  add column if not exists duration_value numeric,
  add column if not exists duration_unit text,
  add column if not exists study_pace text,
  add column if not exists teaching_language text,
  add column if not exists tuition_domestic_or_international text,
  add column if not exists additional_fees_summary text,
  add column if not exists application_fee_minor_units bigint,
  add column if not exists application_fee_currency text,
  add column if not exists course_url text,
  add column if not exists intake_periods text[] not null default '{}'::text[],
  add column if not exists min_academic_requirement text,
  add column if not exists english_requirements jsonb,
  add column if not exists standardized_test_requirements jsonb,
  add column if not exists work_experience_required text,
  add column if not exists portfolio_required boolean,
  add column if not exists interview_required boolean,
  add column if not exists study_gap_policy text,
  add column if not exists additional_documents_required text[] not null default '{}'::text[],
  add column if not exists scholarships_available boolean,
  add column if not exists career_outcomes text,
  add column if not exists professional_accreditation text,
  add column if not exists publication_status text not null default 'draft',
  add column if not exists data_source text,
  add column if not exists source_url text,
  add column if not exists last_verified_at date,
  add column if not exists verification_status text not null default 'unverified',
  add column if not exists merged_into_id uuid references public.courses (id) on delete set null;

comment on column public.courses.english_requirements is 'JSONB object, keys optionally among ielts/toefl/pte/duolingo, each an object like {"overall": 6.5, "minComponent": 6.0} — validated for basic shape by courses_english_requirements_shape below; only populated from an officially documented source, never estimated.';
comment on column public.courses.standardized_test_requirements is 'JSONB object, keys optionally among gre/gmat, each an object like {"required": true, "minScore": 300} — same validation/provenance rules as english_requirements.';
comment on column public.courses.merged_into_id is 'Same merge-pointer pattern as universities.merged_into_id (PART 2) — see education_duplicate_candidates.';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'courses_publication_status_check') then
    alter table public.courses add constraint courses_publication_status_check
      check (publication_status in ('draft', 'in_review', 'published', 'archived'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'courses_verification_status_check') then
    alter table public.courses add constraint courses_verification_status_check
      check (verification_status in ('unverified', 'needs_review', 'verified'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'courses_duration_unit_check') then
    alter table public.courses add constraint courses_duration_unit_check
      check (duration_unit is null or duration_unit in ('years', 'months', 'weeks'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'courses_duration_value_check') then
    alter table public.courses add constraint courses_duration_value_check
      check (duration_value is null or duration_value > 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'courses_study_pace_check') then
    alter table public.courses add constraint courses_study_pace_check
      check (study_pace is null or study_pace in ('full_time', 'part_time', 'full_time_or_part_time'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'courses_tuition_category_check') then
    alter table public.courses add constraint courses_tuition_category_check
      check (tuition_domestic_or_international is null or tuition_domestic_or_international in ('domestic', 'international', 'not_distinguished'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'courses_application_fee_currency_format') then
    alter table public.courses add constraint courses_application_fee_currency_format
      check (application_fee_currency is null or application_fee_currency ~ '^[A-Z]{3}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'courses_application_fee_check') then
    alter table public.courses add constraint courses_application_fee_check
      check (application_fee_minor_units is null or application_fee_minor_units >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'courses_english_requirements_shape') then
    alter table public.courses add constraint courses_english_requirements_shape
      check (english_requirements is null or jsonb_typeof(english_requirements) = 'object');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'courses_standardized_test_requirements_shape') then
    alter table public.courses add constraint courses_standardized_test_requirements_shape
      check (standardized_test_requirements is null or jsonb_typeof(standardized_test_requirements) = 'object');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'courses_not_self_merged') then
    alter table public.courses add constraint courses_not_self_merged
      check (merged_into_id is null or merged_into_id <> id);
  end if;
end $$;

create index if not exists courses_campus_id_idx on public.courses (campus_id);
create index if not exists courses_subject_area_idx on public.courses (subject_area);
create index if not exists courses_discipline_idx on public.courses (discipline);
create index if not exists courses_education_level_idx on public.courses (education_level);
create index if not exists courses_publication_status_idx on public.courses (publication_status, is_active);
create index if not exists courses_verification_status_idx on public.courses (verification_status);
create index if not exists courses_last_verified_at_idx on public.courses (last_verified_at);
create index if not exists courses_name_trgm_idx on public.courses using gin (name gin_trgm_ops);

alter table public.courses
  add column if not exists search_vector tsvector generated always as (
    setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(subject_area, '') || ' ' || coalesce(discipline, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(qualification_title, '') || ' ' || coalesce(career_outcomes, '')), 'C')
  ) stored;
create index if not exists courses_search_vector_idx on public.courses using gin (search_vector);

drop policy if exists "Public can read published active courses of published unis" on public.courses;
create policy "Public can read published active courses of published unis"
  on public.courses for select to anon, authenticated
  using (
    is_active = true and publication_status = 'published'
    and exists (select 1 from public.universities u where u.id = courses.university_id and u.is_active = true and u.publication_status = 'published')
  );

drop policy if exists "content_editor can create draft/in_review courses" on public.courses;
create policy "content_editor can create draft/in_review courses"
  on public.courses for insert to authenticated
  with check (public.is_admin_role(array['content_editor']) and publication_status in ('draft', 'in_review'));

drop policy if exists "content_editor can update draft/in_review courses" on public.courses;
create policy "content_editor can update draft/in_review courses"
  on public.courses for update to authenticated
  using (public.is_admin_role(array['content_editor']) and publication_status in ('draft', 'in_review'))
  with check (public.is_admin_role(array['content_editor']) and publication_status in ('draft', 'in_review'));

drop trigger if exists set_courses_search_updated_at on public.courses;
-- (courses already has set_courses_updated_at from 0004 — nothing to add here.)


-- ============================================================================
-- PART 5 — Course intakes
-- ============================================================================

create table if not exists public.course_intakes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  intake_name text not null,
  start_month smallint,
  start_year integer,
  applications_open_at date,
  priority_deadline date,
  final_deadline date,
  international_deadline date,
  capacity_status text not null default 'unknown',
  intake_status text not null default 'upcoming',
  data_source text,
  source_url text,
  last_verified_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint course_intakes_start_month_check check (start_month is null or (start_month >= 1 and start_month <= 12)),
  constraint course_intakes_capacity_status_check check (capacity_status in ('open', 'limited', 'waitlist', 'closed', 'unknown')),
  constraint course_intakes_status_check check (intake_status in ('upcoming', 'open', 'closed', 'cancelled')),
  constraint course_intakes_deadline_order_check check (
    (priority_deadline is null or applications_open_at is null or priority_deadline >= applications_open_at)
    and (final_deadline is null or applications_open_at is null or final_deadline >= applications_open_at)
    and (final_deadline is null or priority_deadline is null or final_deadline >= priority_deadline)
  )
);
create index if not exists course_intakes_course_id_idx on public.course_intakes (course_id);
create index if not exists course_intakes_start_year_month_idx on public.course_intakes (start_year, start_month);
create index if not exists course_intakes_status_idx on public.course_intakes (intake_status);

comment on table public.course_intakes is
  'Milestone 9 — one row per intake/enrolment window for a course. course_intakes_deadline_order_check enforces the data-quality rule "deadline before opening date" at the database level, not just in the admin UI. "Intake date in the past but still marked upcoming" is a computed data-quality flag (src/lib/education/data-quality.ts), not a DB constraint — a database CHECK cannot reference the current date at insert/update time in a way that stays correct as time passes, so this is checked at read/dashboard time instead.';

alter table public.course_intakes enable row level security;

drop policy if exists "Any admin can read course intakes" on public.course_intakes;
create policy "Any admin can read course intakes"
  on public.course_intakes for select to authenticated
  using (public.is_any_admin());

drop policy if exists "Public can read intakes of published active courses" on public.course_intakes;
create policy "Public can read intakes of published active courses"
  on public.course_intakes for select to anon, authenticated
  using (
    exists (
      select 1 from public.courses c
      join public.universities u on u.id = c.university_id
      where c.id = course_intakes.course_id
        and c.is_active = true and c.publication_status = 'published'
        and u.is_active = true and u.publication_status = 'published'
    )
  );

drop policy if exists "super_admin/admin can write course intakes" on public.course_intakes;
create policy "super_admin/admin can write course intakes"
  on public.course_intakes for insert to authenticated
  with check (public.is_admin_role(array['super_admin', 'admin']));

drop policy if exists "super_admin/admin can update course intakes" on public.course_intakes;
create policy "super_admin/admin can update course intakes"
  on public.course_intakes for update to authenticated
  using (public.is_admin_role(array['super_admin', 'admin']))
  with check (public.is_admin_role(array['super_admin', 'admin']));

drop policy if exists "content_editor can write intakes of its own draft courses" on public.course_intakes;
create policy "content_editor can write intakes of its own draft courses"
  on public.course_intakes for insert to authenticated
  with check (
    public.is_admin_role(array['content_editor'])
    and exists (select 1 from public.courses c where c.id = course_intakes.course_id and c.publication_status in ('draft', 'in_review'))
  );

drop policy if exists "content_editor can update intakes of its own draft courses" on public.course_intakes;
create policy "content_editor can update intakes of its own draft courses"
  on public.course_intakes for update to authenticated
  using (
    public.is_admin_role(array['content_editor'])
    and exists (select 1 from public.courses c where c.id = course_intakes.course_id and c.publication_status in ('draft', 'in_review'))
  )
  with check (
    public.is_admin_role(array['content_editor'])
    and exists (select 1 from public.courses c where c.id = course_intakes.course_id and c.publication_status in ('draft', 'in_review'))
  );

drop trigger if exists set_course_intakes_updated_at on public.course_intakes;
create trigger set_course_intakes_updated_at before update on public.course_intakes for each row execute function public.set_updated_at();


-- ============================================================================
-- PART 6 — Tuition and fees (historical + future records; currency is NEVER
-- converted — see courses_tuition_fees_currency_format below)
-- ============================================================================

create table if not exists public.course_tuition_fees (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  student_category text not null,
  amount_minor_units bigint not null,
  currency_code text not null,
  academic_year text not null,
  billing_period text,
  mandatory_fees_minor_units bigint not null default 0,
  estimated_living_costs_minor_units bigint,
  estimated_living_costs_period text,
  data_source text,
  source_url text,
  last_verified_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint course_tuition_fees_category_check check (student_category in ('domestic', 'international', 'eu', 'other')),
  constraint course_tuition_fees_currency_format check (currency_code ~ '^[A-Z]{3}$'),
  constraint course_tuition_fees_amount_check check (amount_minor_units >= 0),
  constraint course_tuition_fees_mandatory_fees_check check (mandatory_fees_minor_units >= 0),
  constraint course_tuition_fees_living_costs_check check (estimated_living_costs_minor_units is null or estimated_living_costs_minor_units >= 0),
  constraint course_tuition_fees_living_costs_period_check check (estimated_living_costs_period is null or estimated_living_costs_period in ('per_year', 'per_month')),
  constraint course_tuition_fees_billing_period_check check (billing_period is null or billing_period in ('per_year', 'per_semester', 'per_program', 'per_credit', 'per_module'))
);
create index if not exists course_tuition_fees_course_id_idx on public.course_tuition_fees (course_id);
create index if not exists course_tuition_fees_academic_year_idx on public.course_tuition_fees (academic_year);

comment on table public.course_tuition_fees is
  'Milestone 9 — one row per (course, student category, academic year) tuition record, so both historical and future/announced fees can coexist without overwriting each other. `currency_code` always preserves the institution''s own original currency — this system never auto-converts or displays a converted-as-if-equivalent amount anywhere (spec requirement); a future FX-rate feature, if ever added, must be a clearly labelled separate display layer, not a rewrite of this column.';

alter table public.course_tuition_fees enable row level security;

drop policy if exists "Any admin can read tuition fees" on public.course_tuition_fees;
create policy "Any admin can read tuition fees"
  on public.course_tuition_fees for select to authenticated
  using (public.is_any_admin());

drop policy if exists "Public can read tuition fees of published active courses" on public.course_tuition_fees;
create policy "Public can read tuition fees of published active courses"
  on public.course_tuition_fees for select to anon, authenticated
  using (
    exists (
      select 1 from public.courses c
      join public.universities u on u.id = c.university_id
      where c.id = course_tuition_fees.course_id
        and c.is_active = true and c.publication_status = 'published'
        and u.is_active = true and u.publication_status = 'published'
    )
  );

drop policy if exists "super_admin/admin can write tuition fees" on public.course_tuition_fees;
create policy "super_admin/admin can write tuition fees"
  on public.course_tuition_fees for insert to authenticated
  with check (public.is_admin_role(array['super_admin', 'admin']));

drop policy if exists "super_admin/admin can update tuition fees" on public.course_tuition_fees;
create policy "super_admin/admin can update tuition fees"
  on public.course_tuition_fees for update to authenticated
  using (public.is_admin_role(array['super_admin', 'admin']))
  with check (public.is_admin_role(array['super_admin', 'admin']));

drop policy if exists "content_editor can write tuition fees of its own draft courses" on public.course_tuition_fees;
create policy "content_editor can write tuition fees of its own draft courses"
  on public.course_tuition_fees for insert to authenticated
  with check (
    public.is_admin_role(array['content_editor'])
    and exists (select 1 from public.courses c where c.id = course_tuition_fees.course_id and c.publication_status in ('draft', 'in_review'))
  );

drop policy if exists "content_editor can update tuition fees of its own draft courses" on public.course_tuition_fees;
create policy "content_editor can update tuition fees of its own draft courses"
  on public.course_tuition_fees for update to authenticated
  using (
    public.is_admin_role(array['content_editor'])
    and exists (select 1 from public.courses c where c.id = course_tuition_fees.course_id and c.publication_status in ('draft', 'in_review'))
  )
  with check (
    public.is_admin_role(array['content_editor'])
    and exists (select 1 from public.courses c where c.id = course_tuition_fees.course_id and c.publication_status in ('draft', 'in_review'))
  );

drop trigger if exists set_course_tuition_fees_updated_at on public.course_tuition_fees;
create trigger set_course_tuition_fees_updated_at before update on public.course_tuition_fees for each row execute function public.set_updated_at();


-- ============================================================================
-- PART 7 — Admission requirements (structured, course-anchored; a course can
-- have several rows to describe different accepted-qualification pathways,
-- optionally scoped to the applicant's home country via country_context_id)
-- ============================================================================

create table if not exists public.course_admission_requirements (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  country_context_id uuid references public.countries (id) on delete set null,
  accepted_qualification text not null,
  minimum_grade text,
  minimum_gpa numeric(5, 2),
  required_subjects text[] not null default '{}'::text[],
  language_test text,
  language_test_min_score numeric(5, 2),
  standardized_test text,
  standardized_test_min_score numeric(6, 2),
  work_experience_required text,
  portfolio_required boolean not null default false,
  interview_required boolean not null default false,
  additional_documents text[] not null default '{}'::text[],
  data_source text,
  source_url text,
  last_verified_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint course_admission_requirements_gpa_range check (minimum_gpa is null or (minimum_gpa >= 0 and minimum_gpa <= 100)),
  constraint course_admission_requirements_lang_score_range check (language_test_min_score is null or (language_test_min_score >= 0 and language_test_min_score <= 990))
);
create index if not exists course_admission_requirements_course_id_idx on public.course_admission_requirements (course_id);
create index if not exists course_admission_requirements_country_idx on public.course_admission_requirements (country_context_id);

comment on table public.course_admission_requirements is
  'Milestone 9 — structured, per-pathway admission requirements for a course. `minimum_gpa` is stored on whatever scale the source document uses (4.0, 10.0, or a 0-100 percentage) — the 0-100 range check is intentionally generous to cover all of these rather than assuming one scale; the actual scale should be documented in `minimum_grade` or the source. `country_context_id` lets the same course carry different accepted-qualification rows for different applicant home countries (e.g. "Indian Standard XII, 85%+" vs "UK A-Levels, BBB") without needing a separate table.';

alter table public.course_admission_requirements enable row level security;

drop policy if exists "Any admin can read admission requirements" on public.course_admission_requirements;
create policy "Any admin can read admission requirements"
  on public.course_admission_requirements for select to authenticated
  using (public.is_any_admin());

drop policy if exists "Public can read admission requirements of published courses" on public.course_admission_requirements;
create policy "Public can read admission requirements of published courses"
  on public.course_admission_requirements for select to anon, authenticated
  using (
    exists (
      select 1 from public.courses c
      join public.universities u on u.id = c.university_id
      where c.id = course_admission_requirements.course_id
        and c.is_active = true and c.publication_status = 'published'
        and u.is_active = true and u.publication_status = 'published'
    )
  );

drop policy if exists "super_admin/admin can write admission requirements" on public.course_admission_requirements;
create policy "super_admin/admin can write admission requirements"
  on public.course_admission_requirements for insert to authenticated
  with check (public.is_admin_role(array['super_admin', 'admin']));

drop policy if exists "super_admin/admin can update admission requirements" on public.course_admission_requirements;
create policy "super_admin/admin can update admission requirements"
  on public.course_admission_requirements for update to authenticated
  using (public.is_admin_role(array['super_admin', 'admin']))
  with check (public.is_admin_role(array['super_admin', 'admin']));

drop policy if exists "content_editor can write requirements of its own draft courses" on public.course_admission_requirements;
create policy "content_editor can write requirements of its own draft courses"
  on public.course_admission_requirements for insert to authenticated
  with check (
    public.is_admin_role(array['content_editor'])
    and exists (select 1 from public.courses c where c.id = course_admission_requirements.course_id and c.publication_status in ('draft', 'in_review'))
  );

drop policy if exists "content_editor can update requirements of its own draft courses" on public.course_admission_requirements;
create policy "content_editor can update requirements of its own draft courses"
  on public.course_admission_requirements for update to authenticated
  using (
    public.is_admin_role(array['content_editor'])
    and exists (select 1 from public.courses c where c.id = course_admission_requirements.course_id and c.publication_status in ('draft', 'in_review'))
  )
  with check (
    public.is_admin_role(array['content_editor'])
    and exists (select 1 from public.courses c where c.id = course_admission_requirements.course_id and c.publication_status in ('draft', 'in_review'))
  );

drop trigger if exists set_course_admission_requirements_updated_at on public.course_admission_requirements;
create trigger set_course_admission_requirements_updated_at before update on public.course_admission_requirements for each row execute function public.set_updated_at();


-- ============================================================================
-- PART 8 — Scholarships
-- ============================================================================

create table if not exists public.scholarships (
  id uuid primary key default gen_random_uuid(),
  scope text not null,
  university_id uuid references public.universities (id) on delete cascade,
  course_id uuid references public.courses (id) on delete cascade,
  name text not null,
  eligibility text,
  award_amount_minor_units bigint,
  award_description text,
  currency_code text,
  deadline date,
  scholarship_url text,
  international_eligible boolean,
  is_active boolean not null default true,
  data_source text,
  source_url text,
  last_verified_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint scholarships_scope_check check (scope in ('university', 'course')),
  constraint scholarships_scope_target_check check (
    (scope = 'university' and university_id is not null and course_id is null)
    or (scope = 'course' and course_id is not null)
  ),
  constraint scholarships_currency_format check (currency_code is null or currency_code ~ '^[A-Z]{3}$'),
  constraint scholarships_award_amount_check check (award_amount_minor_units is null or award_amount_minor_units >= 0)
);
create index if not exists scholarships_university_id_idx on public.scholarships (university_id);
create index if not exists scholarships_course_id_idx on public.scholarships (course_id);
create index if not exists scholarships_active_idx on public.scholarships (is_active);

comment on table public.scholarships is
  'Milestone 9 — a scholarship attached to either a university (scope=university) or a specific course (scope=course), never both. Award amounts are stored in the scholarship''s own stated currency, never converted.';

alter table public.scholarships enable row level security;

drop policy if exists "Any admin can read scholarships" on public.scholarships;
create policy "Any admin can read scholarships"
  on public.scholarships for select to authenticated
  using (public.is_any_admin());

drop policy if exists "Public can read active scholarships of published records" on public.scholarships;
create policy "Public can read active scholarships of published records"
  on public.scholarships for select to anon, authenticated
  using (
    is_active = true
    and (
      (scope = 'university' and exists (select 1 from public.universities u where u.id = scholarships.university_id and u.is_active = true and u.publication_status = 'published'))
      or (scope = 'course' and exists (
        select 1 from public.courses c join public.universities u on u.id = c.university_id
        where c.id = scholarships.course_id and c.is_active = true and c.publication_status = 'published' and u.is_active = true and u.publication_status = 'published'
      ))
    )
  );

drop policy if exists "super_admin/admin can write scholarships" on public.scholarships;
create policy "super_admin/admin can write scholarships"
  on public.scholarships for insert to authenticated
  with check (public.is_admin_role(array['super_admin', 'admin']));

drop policy if exists "super_admin/admin can update scholarships" on public.scholarships;
create policy "super_admin/admin can update scholarships"
  on public.scholarships for update to authenticated
  using (public.is_admin_role(array['super_admin', 'admin']))
  with check (public.is_admin_role(array['super_admin', 'admin']));

drop policy if exists "content_editor can write scholarships of its own draft records" on public.scholarships;
create policy "content_editor can write scholarships of its own draft records"
  on public.scholarships for insert to authenticated
  with check (
    public.is_admin_role(array['content_editor'])
    and (
      (scope = 'university' and exists (select 1 from public.universities u where u.id = scholarships.university_id and u.publication_status in ('draft', 'in_review')))
      or (scope = 'course' and exists (select 1 from public.courses c where c.id = scholarships.course_id and c.publication_status in ('draft', 'in_review')))
    )
  );

drop policy if exists "content_editor can update scholarships of its own draft records" on public.scholarships;
create policy "content_editor can update scholarships of its own draft records"
  on public.scholarships for update to authenticated
  using (
    public.is_admin_role(array['content_editor'])
    and (
      (scope = 'university' and exists (select 1 from public.universities u where u.id = scholarships.university_id and u.publication_status in ('draft', 'in_review')))
      or (scope = 'course' and exists (select 1 from public.courses c where c.id = scholarships.course_id and c.publication_status in ('draft', 'in_review')))
    )
  )
  with check (
    public.is_admin_role(array['content_editor'])
    and (
      (scope = 'university' and exists (select 1 from public.universities u where u.id = scholarships.university_id and u.publication_status in ('draft', 'in_review')))
      or (scope = 'course' and exists (select 1 from public.courses c where c.id = scholarships.course_id and c.publication_status in ('draft', 'in_review')))
    )
  );

drop trigger if exists set_scholarships_updated_at on public.scholarships;
create trigger set_scholarships_updated_at before update on public.scholarships for each row execute function public.set_updated_at();


-- ============================================================================
-- PART 9 — Data provenance (generic, one current-state row per entity;
-- historical change-events are recorded via the EXISTING
-- public.admin_audit_log / record_admin_audit_log() from 0004 — see
-- src/lib/supabase/admin/education-audit.ts — never a second bespoke
-- history table competing with it)
-- ============================================================================

create table if not exists public.education_data_provenance (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  source_provider text,
  source_type text not null default 'manual_admin_entry',
  source_url text,
  source_record_id text,
  retrieved_at date,
  last_verified_at date,
  import_batch_id uuid,
  raw_record_checksum text,
  verification_status text not null default 'unverified',
  data_quality_status text not null default 'unknown',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint education_data_provenance_entity_type_check check (
    entity_type in ('university', 'campus', 'course', 'course_intake', 'course_tuition_fee', 'course_admission_requirement', 'scholarship')
  ),
  constraint education_data_provenance_source_type_check check (
    source_type in ('official_university', 'government', 'licensed_provider', 'manual_admin_entry', 'csv_import', 'other')
  ),
  constraint education_data_provenance_verification_status_check check (verification_status in ('unverified', 'needs_review', 'verified')),
  constraint education_data_provenance_data_quality_status_check check (data_quality_status in ('current', 'review_soon', 'stale', 'unknown')),
  constraint education_data_provenance_unique_entity unique (entity_type, entity_id)
);
create index if not exists education_data_provenance_import_batch_idx on public.education_data_provenance (import_batch_id);
create index if not exists education_data_provenance_quality_idx on public.education_data_provenance (data_quality_status);

comment on table public.education_data_provenance is
  'Milestone 9 — one current-state provenance/verification record per (entity_type, entity_id). The public-safe subset of this (last verified date, source URL, verification status) is ALSO mirrored as plain columns directly on universities/courses/etc. so public pages can display it under the existing per-table RLS without needing read access to this table itself (which also holds internal-only fields like raw_record_checksum and import_batch_id) — this table itself is admin-only. See docs/global-education-data-guide.md for the full provenance model.';

alter table public.education_data_provenance enable row level security;

drop policy if exists "Any admin can read data provenance" on public.education_data_provenance;
create policy "Any admin can read data provenance"
  on public.education_data_provenance for select to authenticated
  using (public.is_any_admin());

drop policy if exists "super_admin/admin/content_editor can write data provenance" on public.education_data_provenance;
create policy "super_admin/admin/content_editor can write data provenance"
  on public.education_data_provenance for insert to authenticated
  with check (public.is_admin_role(array['super_admin', 'admin', 'content_editor']));

drop policy if exists "super_admin/admin/content_editor can update data provenance" on public.education_data_provenance;
create policy "super_admin/admin/content_editor can update data provenance"
  on public.education_data_provenance for update to authenticated
  using (public.is_admin_role(array['super_admin', 'admin', 'content_editor']))
  with check (public.is_admin_role(array['super_admin', 'admin', 'content_editor']));

drop trigger if exists set_education_data_provenance_updated_at on public.education_data_provenance;
create trigger set_education_data_provenance_updated_at before update on public.education_data_provenance for each row execute function public.set_updated_at();


-- ============================================================================
-- PART 10 — Import batches
-- ============================================================================

create table if not exists public.education_import_batches (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  file_name text,
  file_size_bytes bigint,
  status text not null default 'uploaded',
  total_records integer not null default 0,
  successful_records integer not null default 0,
  rejected_records integer not null default 0,
  warning_count integer not null default 0,
  dry_run boolean not null default true,
  duplicate_strategy text not null default 'review',
  started_at timestamptz,
  completed_at timestamptz,
  initiated_by uuid references auth.users (id) on delete set null,
  raw_file_checksum text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint education_import_batches_entity_type_check check (
    entity_type in ('universities', 'campuses', 'courses', 'course_intakes', 'course_tuition_fees', 'course_admission_requirements', 'scholarships')
  ),
  constraint education_import_batches_status_check check (
    status in ('uploaded', 'validating', 'validated', 'importing', 'completed', 'completed_with_errors', 'failed', 'cancelled')
  ),
  constraint education_import_batches_duplicate_strategy_check check (duplicate_strategy in ('skip', 'update', 'review')),
  constraint education_import_batches_counts_check check (
    total_records >= 0 and successful_records >= 0 and rejected_records >= 0 and warning_count >= 0
  )
);
create index if not exists education_import_batches_status_idx on public.education_import_batches (status);
create index if not exists education_import_batches_initiated_by_idx on public.education_import_batches (initiated_by);
create index if not exists education_import_batches_created_at_idx on public.education_import_batches (created_at);

comment on table public.education_import_batches is
  'Milestone 9 — one row per CSV import attempt (dry-run or real). Every batch is auditable: who started it, what file, how many rows succeeded/were rejected/warned, and its final status. A batch is never partially applied without a status reflecting that (completed_with_errors, not completed) — see docs/global-education-data-guide.md for the full workflow.';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'education_data_provenance_import_batch_fk'
  ) then
    alter table public.education_data_provenance
      add constraint education_data_provenance_import_batch_fk
      foreign key (import_batch_id) references public.education_import_batches (id) on delete set null;
  end if;
end $$;

alter table public.education_import_batches enable row level security;

drop policy if exists "super_admin/admin/analyst can read import batches" on public.education_import_batches;
create policy "super_admin/admin/analyst can read import batches"
  on public.education_import_batches for select to authenticated
  using (public.is_admin_role(array['super_admin', 'admin', 'analyst']));

drop policy if exists "super_admin/admin can create import batches" on public.education_import_batches;
create policy "super_admin/admin can create import batches"
  on public.education_import_batches for insert to authenticated
  with check (public.is_admin_role(array['super_admin', 'admin']) and initiated_by = auth.uid());

drop policy if exists "super_admin/admin can update import batches" on public.education_import_batches;
create policy "super_admin/admin can update import batches"
  on public.education_import_batches for update to authenticated
  using (public.is_admin_role(array['super_admin', 'admin']))
  with check (public.is_admin_role(array['super_admin', 'admin']));

drop trigger if exists set_education_import_batches_updated_at on public.education_import_batches;
create trigger set_education_import_batches_updated_at before update on public.education_import_batches for each row execute function public.set_updated_at();


-- ============================================================================
-- PART 11 — Import rows (row-level validation results)
-- ============================================================================

create table if not exists public.education_import_rows (
  id uuid primary key default gen_random_uuid(),
  import_batch_id uuid not null references public.education_import_batches (id) on delete cascade,
  row_number integer not null,
  raw_data jsonb not null,
  status text not null default 'pending',
  errors jsonb not null default '[]'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  duplicate_of_entity_id uuid,
  resulting_entity_id uuid,
  created_at timestamptz not null default now(),
  constraint education_import_rows_status_check check (
    status in ('pending', 'valid', 'warning', 'error', 'imported', 'skipped', 'duplicate')
  ),
  constraint education_import_rows_errors_is_array check (jsonb_typeof(errors) = 'array'),
  constraint education_import_rows_warnings_is_array check (jsonb_typeof(warnings) = 'array'),
  constraint education_import_rows_unique_row unique (import_batch_id, row_number)
);
create index if not exists education_import_rows_batch_idx on public.education_import_rows (import_batch_id);
create index if not exists education_import_rows_status_idx on public.education_import_rows (status);

comment on table public.education_import_rows is
  'Milestone 9 — one row per parsed CSV row within an import batch. `raw_data` is the sanitized (formula-injection-stripped — see src/lib/education/csv.ts) parsed row, kept for audit purposes even for rejected rows, so an admin can download exactly what was submitted alongside why it failed.';

alter table public.education_import_rows enable row level security;

drop policy if exists "super_admin/admin/analyst can read import rows" on public.education_import_rows;
create policy "super_admin/admin/analyst can read import rows"
  on public.education_import_rows for select to authenticated
  using (public.is_admin_role(array['super_admin', 'admin', 'analyst']));

drop policy if exists "super_admin/admin can write import rows" on public.education_import_rows;
create policy "super_admin/admin can write import rows"
  on public.education_import_rows for insert to authenticated
  with check (public.is_admin_role(array['super_admin', 'admin']));

drop policy if exists "super_admin/admin can update import rows" on public.education_import_rows;
create policy "super_admin/admin can update import rows"
  on public.education_import_rows for update to authenticated
  using (public.is_admin_role(array['super_admin', 'admin']))
  with check (public.is_admin_role(array['super_admin', 'admin']));


-- ============================================================================
-- PART 12 — Duplicate candidates
-- ============================================================================

create table if not exists public.education_duplicate_candidates (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  primary_entity_id uuid not null,
  candidate_entity_id uuid not null,
  match_score numeric(4, 3) not null,
  match_signals jsonb not null default '[]'::jsonb,
  status text not null default 'pending',
  resolved_by uuid references auth.users (id) on delete set null,
  resolved_at timestamptz,
  resolution_notes text,
  created_at timestamptz not null default now(),
  constraint education_duplicate_candidates_entity_type_check check (entity_type in ('university', 'course')),
  constraint education_duplicate_candidates_status_check check (status in ('pending', 'confirmed_duplicate', 'rejected', 'merged')),
  constraint education_duplicate_candidates_score_range check (match_score >= 0 and match_score <= 1),
  constraint education_duplicate_candidates_not_self check (primary_entity_id <> candidate_entity_id),
  constraint education_duplicate_candidates_unique_pair unique (entity_type, primary_entity_id, candidate_entity_id)
);
create index if not exists education_duplicate_candidates_status_idx on public.education_duplicate_candidates (entity_type, status);

comment on table public.education_duplicate_candidates is
  'Milestone 9 — a suggested duplicate pair awaiting admin review. Never auto-merged (spec requirement) — status starts ''pending'' and only ever changes via an explicit admin decision recorded here plus an admin_audit_log entry (src/lib/supabase/admin/education-duplicates.ts). A confirmed merge sets status=''merged'' and marks the losing record''s merged_into_id (universities/courses PART 2/4) — it never deletes or rewrites foreign keys elsewhere.';

alter table public.education_duplicate_candidates enable row level security;

drop policy if exists "super_admin/admin/content_editor/analyst can read duplicates" on public.education_duplicate_candidates;
create policy "super_admin/admin/content_editor/analyst can read duplicates"
  on public.education_duplicate_candidates for select to authenticated
  using (public.is_admin_role(array['super_admin', 'admin', 'content_editor', 'analyst']));

drop policy if exists "super_admin/admin can write duplicate candidates" on public.education_duplicate_candidates;
create policy "super_admin/admin can write duplicate candidates"
  on public.education_duplicate_candidates for insert to authenticated
  with check (public.is_admin_role(array['super_admin', 'admin']));

drop policy if exists "super_admin/admin can update duplicate candidates" on public.education_duplicate_candidates;
create policy "super_admin/admin can update duplicate candidates"
  on public.education_duplicate_candidates for update to authenticated
  using (public.is_admin_role(array['super_admin', 'admin']))
  with check (public.is_admin_role(array['super_admin', 'admin']));


-- ============================================================================
-- PART 13 — Student-facing: saved universities/courses
-- ============================================================================

create table if not exists public.education_saved_items (
  id uuid primary key default gen_random_uuid(),
  student_user_id uuid not null references auth.users (id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  created_at timestamptz not null default now(),
  constraint education_saved_items_entity_type_check check (entity_type in ('university', 'course')),
  constraint education_saved_items_unique unique (student_user_id, entity_type, entity_id)
);
create index if not exists education_saved_items_student_idx on public.education_saved_items (student_user_id);

comment on table public.education_saved_items is
  'Milestone 9 — a student''s own saved universities/courses. Fully student-owned: a student can only ever see/create/delete their own rows (RLS below); no admin write path exists because this is the student''s personal list, not authoritative data.';

alter table public.education_saved_items enable row level security;

drop policy if exists "Students can read their own saved items" on public.education_saved_items;
create policy "Students can read their own saved items"
  on public.education_saved_items for select to authenticated
  using (auth.uid() = student_user_id);

drop policy if exists "Admins can read all saved items" on public.education_saved_items;
create policy "Admins can read all saved items"
  on public.education_saved_items for select to authenticated
  using (public.is_admin_role(array['super_admin', 'admin', 'analyst']));

drop policy if exists "Students can save their own items" on public.education_saved_items;
create policy "Students can save their own items"
  on public.education_saved_items for insert to authenticated
  with check (auth.uid() = student_user_id);

drop policy if exists "Students can remove their own saved items" on public.education_saved_items;
create policy "Students can remove their own saved items"
  on public.education_saved_items for delete to authenticated
  using (auth.uid() = student_user_id);


-- ============================================================================
-- PART 14 — Student-facing: recorded interest in an upcoming intake
-- ============================================================================

create table if not exists public.education_intake_interests (
  id uuid primary key default gen_random_uuid(),
  student_user_id uuid not null references auth.users (id) on delete cascade,
  course_intake_id uuid not null references public.course_intakes (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint education_intake_interests_unique unique (student_user_id, course_intake_id)
);
create index if not exists education_intake_interests_student_idx on public.education_intake_interests (student_user_id);
create index if not exists education_intake_interests_intake_idx on public.education_intake_interests (course_intake_id);

comment on table public.education_intake_interests is
  'Milestone 9 — a student flagging interest in a specific upcoming intake (e.g. so the dashboard can remind them as the deadline nears). Same fully-student-owned RLS pattern as education_saved_items.';

alter table public.education_intake_interests enable row level security;

drop policy if exists "Students can read their own intake interests" on public.education_intake_interests;
create policy "Students can read their own intake interests"
  on public.education_intake_interests for select to authenticated
  using (auth.uid() = student_user_id);

drop policy if exists "Admins can read all intake interests" on public.education_intake_interests;
create policy "Admins can read all intake interests"
  on public.education_intake_interests for select to authenticated
  using (public.is_admin_role(array['super_admin', 'admin', 'analyst', 'counsellor']));

drop policy if exists "Students can record their own intake interest" on public.education_intake_interests;
create policy "Students can record their own intake interest"
  on public.education_intake_interests for insert to authenticated
  with check (auth.uid() = student_user_id);

drop policy if exists "Students can remove their own intake interest" on public.education_intake_interests;
create policy "Students can remove their own intake interest"
  on public.education_intake_interests for delete to authenticated
  using (auth.uid() = student_user_id);


-- ============================================================================
-- PART 15 — Student-facing: share a course with a counsellor
--
-- Deliberately a new, narrow table rather than granting students insert
-- access to the Milestone 7 admin_student_notes table (that table's
-- append-only, admin-authored semantics stay exactly as 0004 defined them —
-- see 0004's own comment on that table). `counsellor_id` is nullable and,
-- from the student-facing flow, is always left null: neither `counsellors`
-- nor `admin_student_meta` (where a student's assigned counsellor would be
-- looked up) has a student-self-read RLS policy, so a student's own session
-- has no RLS-permitted way to resolve which counsellor to address — and
-- granting one, or bridging into `admin_student_notes`, was judged out of
-- scope for the additive, narrowly-scoped RLS this migration otherwise adds
-- (see PART 16 below for the pattern this deliberately does NOT extend
-- here). A share is still fully visible admin-side without any of that:
-- the "Assigned counsellor/admins can read shares directed at them" policy
-- below already lets any super_admin/admin/analyst read every row
-- regardless of `counsellor_id`, so nothing is silently lost — a share just
-- surfaces as an unrouted item for staff to triage rather than being
-- auto-addressed to one counsellor. src/lib/supabase/education/shares.ts
-- is the only writer.
-- ============================================================================

create table if not exists public.education_course_shares (
  id uuid primary key default gen_random_uuid(),
  student_user_id uuid not null references auth.users (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  counsellor_id uuid references public.counsellors (id) on delete set null,
  message text,
  created_at timestamptz not null default now()
);
create index if not exists education_course_shares_student_idx on public.education_course_shares (student_user_id);
create index if not exists education_course_shares_counsellor_idx on public.education_course_shares (counsellor_id);

alter table public.education_course_shares enable row level security;

drop policy if exists "Students can read their own course shares" on public.education_course_shares;
create policy "Students can read their own course shares"
  on public.education_course_shares for select to authenticated
  using (auth.uid() = student_user_id);

drop policy if exists "Assigned counsellor/admins can read shares directed at them" on public.education_course_shares;
create policy "Assigned counsellor/admins can read shares directed at them"
  on public.education_course_shares for select to authenticated
  using (
    public.is_admin_role(array['super_admin', 'admin', 'analyst'])
    or (public.is_admin_role(array['counsellor']) and counsellor_id = public.current_counsellor_id())
  );

drop policy if exists "Students can share their own courses" on public.education_course_shares;
create policy "Students can share their own courses"
  on public.education_course_shares for insert to authenticated
  with check (auth.uid() = student_user_id);


-- ============================================================================
-- PART 16 — Students can start an application from a course
--
-- public.applications already has a nullable course_id column (0004,
-- courses were referenced from day one) — no schema change needed there.
-- What was missing is that 0004 only granted read/write on `applications`
-- to admin roles; a student could not see or create their OWN application
-- at all. These two ADDITIVE policies (permissive, OR'd with 0004's
-- existing ones) grant exactly that, and nothing more — a student still has
-- no UPDATE policy (stage/decision_status changes remain
-- admin/counsellor-only, unchanged from 0004).
-- ============================================================================

drop policy if exists "Students can read their own applications" on public.applications;
create policy "Students can read their own applications"
  on public.applications for select to authenticated
  using (auth.uid() = student_user_id);

drop policy if exists "Students can start their own application from a course" on public.applications;
create policy "Students can start their own application from a course"
  on public.applications for insert to authenticated
  with check (auth.uid() = student_user_id);


-- ============================================================================
-- Done. See docs/global-education-data-guide.md for the full data model,
-- RLS matrix, import workflow, duplicate-resolution workflow, and how to
-- add a new country or a future data-provider adapter.
-- ============================================================================
