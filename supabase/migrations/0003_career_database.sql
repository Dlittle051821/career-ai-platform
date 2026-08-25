-- ============================================================================
-- Milestone 4 — Career Knowledge Base
--
-- HOW TO RUN THIS (no SQL knowledge required):
--   1. Open your Supabase project dashboard (supabase.com/dashboard).
--   2. Click "SQL Editor" in the left sidebar.
--   3. Click "New query".
--   4. Paste the entire contents of this file.
--   5. Click "Run".
--
-- Safe to run once. Re-running is also safe (IF NOT EXISTS / OR REPLACE /
-- DROP POLICY IF EXISTS before CREATE POLICY throughout).
--
-- This migration does NOT touch 0001_profiles.sql or 0002_student_profile.sql
-- — nothing here reads from or writes to `profiles` or any `student_*`
-- table. Career data is deliberately separate MASTER data: it belongs to
-- the product, not to any one student, so it is never protected by an
-- `auth.uid() = user_id` policy the way Milestones 2–3 are. Instead every
-- table here is public-read (approved/active rows only) and has NO write
-- policy at all for `anon`/`authenticated` — the only way to write to
-- these tables is via the Supabase SQL Editor / service role, i.e. you,
-- not the app. See docs/career-data-guide.md for the full explanation.
--
-- This is seed-DATA-free. Career records themselves live in
-- supabase/seed/0001_careers_seed.sql (generated from src/data/careers/ —
-- run `npm run seed:generate` after editing seed data, then paste that
-- file into the SQL Editor the same way as this one).
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. career_families — top-level groupings (Engineering, Technology & Computing, ...)
-- ----------------------------------------------------------------------------
create table if not exists public.career_families (
  id uuid primary key default gen_random_uuid(),
  family_key text not null unique,
  name text not null,
  description text,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.career_families is
  'Milestone 4 master data — top-level career family groupings. Not student-owned; RLS is public-read, admin-write only.';


-- ----------------------------------------------------------------------------
-- 2. careers — the core career record
-- ----------------------------------------------------------------------------
create table if not exists public.careers (
  id uuid primary key default gen_random_uuid(),
  career_key text not null unique,
  family_id uuid not null references public.career_families (id) on delete restrict,
  title text not null,
  short_title text,
  slug text not null unique,
  summary text not null,
  what_you_do text not null,
  typical_environment text not null,
  career_outlook_summary text,
  typical_entry_level text not null,
  minimum_education_key text,
  international_mobility_score smallint,
  remote_work_score smallint,
  entrepreneurship_score smallint,
  salary_potential_score smallint,
  job_security_score smallint,
  creativity_score smallint,
  social_impact_score smallint,
  leadership_opportunity_score smallint,
  travel_score smallint,
  research_intensity_score smallint,
  technical_depth_score smallint,
  is_active boolean not null default true,
  is_featured boolean not null default false,
  data_quality_status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint careers_data_quality_status_check
    check (data_quality_status in ('draft', 'reviewed', 'approved')),
  constraint careers_scores_range_check check (
    (international_mobility_score is null or international_mobility_score between 1 and 5) and
    (remote_work_score is null or remote_work_score between 1 and 5) and
    (entrepreneurship_score is null or entrepreneurship_score between 1 and 5) and
    (salary_potential_score is null or salary_potential_score between 1 and 5) and
    (job_security_score is null or job_security_score between 1 and 5) and
    (creativity_score is null or creativity_score between 1 and 5) and
    (social_impact_score is null or social_impact_score between 1 and 5) and
    (leadership_opportunity_score is null or leadership_opportunity_score between 1 and 5) and
    (travel_score is null or travel_score between 1 and 5) and
    (research_intensity_score is null or research_intensity_score between 1 and 5) and
    (technical_depth_score is null or technical_depth_score between 1 and 5)
  )
);
create index if not exists careers_family_id_idx on public.careers (family_id);
create index if not exists careers_slug_idx on public.careers (slug);
create index if not exists careers_active_approved_idx on public.careers (is_active, data_quality_status);

comment on table public.careers is
  'Milestone 4 master data — one row per career. The *_score columns (1-5) are curated internal matching heuristics for the future Milestone 5 recommendation engine, not psychometric facts or verified market data — never surface them to students as scientific measurements. Only is_active=true AND data_quality_status=''approved'' rows are visible to students (see RLS below).';


-- ----------------------------------------------------------------------------
-- 3. career_subject_requirements — M3 subject_key fit
-- ----------------------------------------------------------------------------
create table if not exists public.career_subject_requirements (
  id uuid primary key default gen_random_uuid(),
  career_id uuid not null references public.careers (id) on delete cascade,
  subject_key text not null,
  importance smallint not null,
  minimum_strength smallint,
  created_at timestamptz not null default now(),
  constraint career_subject_requirements_importance_check check (importance between 1 and 5),
  constraint career_subject_requirements_min_strength_check
    check (minimum_strength is null or minimum_strength between 1 and 5),
  unique (career_id, subject_key)
);
create index if not exists career_subject_requirements_career_id_idx on public.career_subject_requirements (career_id);


-- ----------------------------------------------------------------------------
-- 4. career_interest_requirements — M3 interest_key fit
-- ----------------------------------------------------------------------------
create table if not exists public.career_interest_requirements (
  id uuid primary key default gen_random_uuid(),
  career_id uuid not null references public.careers (id) on delete cascade,
  interest_key text not null,
  importance smallint not null,
  created_at timestamptz not null default now(),
  constraint career_interest_requirements_importance_check check (importance between 1 and 5),
  unique (career_id, interest_key)
);
create index if not exists career_interest_requirements_career_id_idx on public.career_interest_requirements (career_id);


-- ----------------------------------------------------------------------------
-- 5. career_skill_requirements — M3 skill_key fit (useful/relevant skills, not hard entry barriers)
-- ----------------------------------------------------------------------------
create table if not exists public.career_skill_requirements (
  id uuid primary key default gen_random_uuid(),
  career_id uuid not null references public.careers (id) on delete cascade,
  skill_key text not null,
  importance smallint not null,
  recommended_level text not null,
  created_at timestamptz not null default now(),
  constraint career_skill_requirements_importance_check check (importance between 1 and 5),
  constraint career_skill_requirements_level_check
    check (recommended_level in ('beginner', 'intermediate', 'advanced')),
  unique (career_id, skill_key)
);
create index if not exists career_skill_requirements_career_id_idx on public.career_skill_requirements (career_id);


-- ----------------------------------------------------------------------------
-- 6. career_work_preference_profile — M3 work-preference_key tendency scores
-- ----------------------------------------------------------------------------
create table if not exists public.career_work_preference_profile (
  id uuid primary key default gen_random_uuid(),
  career_id uuid not null references public.careers (id) on delete cascade,
  preference_key text not null,
  score smallint not null,
  created_at timestamptz not null default now(),
  constraint career_work_preference_profile_score_check check (score between 1 and 5),
  unique (career_id, preference_key)
);
create index if not exists career_work_preference_profile_career_id_idx on public.career_work_preference_profile (career_id);


-- ----------------------------------------------------------------------------
-- 7. career_priority_profile — M3 career-priority_key tendency scores
-- ----------------------------------------------------------------------------
create table if not exists public.career_priority_profile (
  id uuid primary key default gen_random_uuid(),
  career_id uuid not null references public.careers (id) on delete cascade,
  priority_key text not null,
  score smallint not null,
  created_at timestamptz not null default now(),
  constraint career_priority_profile_score_check check (score between 1 and 5),
  unique (career_id, priority_key)
);
create index if not exists career_priority_profile_career_id_idx on public.career_priority_profile (career_id);


-- ----------------------------------------------------------------------------
-- 8. career_education_routes — common routes into a career (NOT university matching)
-- ----------------------------------------------------------------------------
create table if not exists public.career_education_routes (
  id uuid primary key default gen_random_uuid(),
  career_id uuid not null references public.careers (id) on delete cascade,
  education_level text not null,
  field_key text not null,
  specialization_key text,
  relevance text not null,
  notes text,
  created_at timestamptz not null default now(),
  constraint career_education_routes_level_check
    check (education_level in ('class_10', 'class_12', 'diploma', 'bachelors', 'masters', 'phd', 'other')),
  constraint career_education_routes_relevance_check
    check (relevance in ('primary', 'common', 'alternative'))
);
create index if not exists career_education_routes_career_id_idx on public.career_education_routes (career_id);


-- ----------------------------------------------------------------------------
-- 9. industries — reusable industry taxonomy
-- ----------------------------------------------------------------------------
create table if not exists public.industries (
  id uuid primary key default gen_random_uuid(),
  industry_key text not null unique,
  name text not null,
  description text,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- ----------------------------------------------------------------------------
-- 10. career_industries — a career may belong to multiple industries
-- ----------------------------------------------------------------------------
create table if not exists public.career_industries (
  career_id uuid not null references public.careers (id) on delete cascade,
  industry_id uuid not null references public.industries (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (career_id, industry_id)
);
create index if not exists career_industries_industry_id_idx on public.career_industries (industry_id);


-- ----------------------------------------------------------------------------
-- 11. career_tags / career_tag_map — simple filtering facets (deliberately minimal)
-- ----------------------------------------------------------------------------
create table if not exists public.career_tags (
  id uuid primary key default gen_random_uuid(),
  tag_key text not null unique,
  label text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.career_tag_map (
  career_id uuid not null references public.careers (id) on delete cascade,
  tag_id uuid not null references public.career_tags (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (career_id, tag_id)
);
create index if not exists career_tag_map_tag_id_idx on public.career_tag_map (tag_id);


-- ----------------------------------------------------------------------------
-- 12. career_aliases — search synonyms
-- ----------------------------------------------------------------------------
create table if not exists public.career_aliases (
  id uuid primary key default gen_random_uuid(),
  career_id uuid not null references public.careers (id) on delete cascade,
  alias text not null,
  normalized_alias text not null,
  created_at timestamptz not null default now(),
  unique (career_id, normalized_alias)
);
create index if not exists career_aliases_normalized_alias_idx on public.career_aliases (normalized_alias);


-- ----------------------------------------------------------------------------
-- 13. career_related — manually curated related careers (no algorithm)
-- ----------------------------------------------------------------------------
create table if not exists public.career_related (
  career_id uuid not null references public.careers (id) on delete cascade,
  related_career_id uuid not null references public.careers (id) on delete cascade,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (career_id, related_career_id),
  constraint career_related_not_self check (career_id <> related_career_id)
);


-- ----------------------------------------------------------------------------
-- 14. updated_at housekeeping — reuses public.set_updated_at() from 0001
-- ----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  for t in
    select unnest(array['career_families', 'careers', 'industries'])
  loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      t
    );
  end loop;
end $$;


-- ----------------------------------------------------------------------------
-- 15. Row Level Security — public-read master data, admin-write only
--
-- Unlike Milestones 2-3 (owner-only `auth.uid() = user_id`), this data
-- belongs to nobody in particular — it is the product's career catalogue.
-- Every table gets RLS enabled and exactly one SELECT policy for `anon`
-- and `authenticated`. Deliberately, NO insert/update/delete policy is
-- created for those roles: with RLS enabled and no write policy, Postgres
-- denies all writes from the app (both logged-out visitors and logged-in
-- students) by default. The only way to write this data is the Supabase
-- SQL Editor (or a service-role key), which only you control.
-- ----------------------------------------------------------------------------

-- 15a. Reference/lookup tables — readable whenever the row itself is active.
do $$
declare
  t text;
begin
  for t in
    select unnest(array['career_families', 'industries', 'career_tags'])
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "Public can read active rows" on public.%I', t);
  end loop;
end $$;

create policy "Public can read active rows" on public.career_families
  for select to anon, authenticated using (is_active = true);

create policy "Public can read active rows" on public.industries
  for select to anon, authenticated using (is_active = true);

create policy "Public can read active rows" on public.career_tags
  for select to anon, authenticated using (true);

-- 15b. careers — readable only when active AND approved.
alter table public.careers enable row level security;
drop policy if exists "Public can read approved careers" on public.careers;
create policy "Public can read approved careers" on public.careers
  for select to anon, authenticated
  using (is_active = true and data_quality_status = 'approved');

-- 15c. Career detail/child tables — readable only when the parent career is
-- itself visible (active + approved). Every one of these tables has a
-- `career_id` column, so the same EXISTS check works for all of them.
do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'career_subject_requirements',
      'career_interest_requirements',
      'career_skill_requirements',
      'career_work_preference_profile',
      'career_priority_profile',
      'career_education_routes',
      'career_industries',
      'career_tag_map',
      'career_aliases'
    ])
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "Public can read rows for visible careers" on public.%I', t);
    execute format(
      'create policy "Public can read rows for visible careers" on public.%I ' ||
      'for select to anon, authenticated using (' ||
      'exists (select 1 from public.careers c where c.id = %I.career_id ' ||
      'and c.is_active = true and c.data_quality_status = ''approved''))',
      t, t
    );
  end loop;
end $$;

-- 15d. career_related — has TWO career_id-style columns (career_id and
-- related_career_id); both endpoints must be visible careers.
alter table public.career_related enable row level security;
drop policy if exists "Public can read rows for visible careers" on public.career_related;
create policy "Public can read rows for visible careers" on public.career_related
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.careers c
      where c.id = career_related.career_id and c.is_active = true and c.data_quality_status = 'approved'
    )
    and exists (
      select 1 from public.careers c2
      where c2.id = career_related.related_career_id and c2.is_active = true and c2.data_quality_status = 'approved'
    )
  );

-- No policies of any kind exist for insert/update/delete on any table in
-- this migration for `anon` or `authenticated` — writes are impossible
-- from the app itself by construction, satisfying "students cannot edit
-- career master data" without needing a separate admin-role system yet.
