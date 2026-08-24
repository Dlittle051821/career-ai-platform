-- ============================================================================
-- Milestone 3 — Student Digital Profile
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
-- This migration does NOT touch 0001_profiles.sql or its data — the
-- account-level `profiles` table (name/email/phone/account_type) is
-- untouched. Everything here lives in new tables namespaced `student_*`.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. student_profiles — core profile (1:1 with auth.users)
--
-- Deliberately narrow: identity/status/progress fields only. Career-facing
-- data (education, interests, skills, ...) lives in its own tables below —
-- see the design note in the Milestone 3 summary for why this table stays
-- small instead of growing dozens of unrelated columns.
-- ----------------------------------------------------------------------------
create table if not exists public.student_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  date_of_birth date,
  gender text,
  city text,
  state text,
  country text not null default 'India',
  preferred_language text,
  current_status text,
  profile_status text not null default 'not_started',
  profile_completion_percent integer not null default 0,
  onboarding_current_step integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_profiles_status_check
    check (profile_status in ('not_started', 'in_progress', 'completed')),
  constraint student_profiles_current_status_check
    check (current_status is null or current_status in
      ('school_10', 'school_12', 'diploma', 'undergraduate', 'postgraduate', 'working', 'gap_year', 'other')),
  constraint student_profiles_completion_check
    check (profile_completion_percent between 0 and 100),
  constraint student_profiles_step_check
    check (onboarding_current_step between 1 and 12),
  constraint student_profiles_dob_check
    check (date_of_birth is null or date_of_birth <= current_date)
);

comment on table public.student_profiles is
  'Core Student Digital Profile — identity, stage, and onboarding progress only. Education/interests/skills/etc. are in their own student_* tables. Milestone 3.';


-- ----------------------------------------------------------------------------
-- 2. student_education — multiple records per student
-- ----------------------------------------------------------------------------
create table if not exists public.student_education (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  education_level text not null,
  institution_name text,
  board_or_university text,
  field_of_study text,
  specialization text,
  start_year integer,
  end_year integer,
  status text not null default 'ongoing',
  score_type text,
  score_value numeric,
  backlogs integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_education_level_check
    check (education_level in ('class_10', 'class_12', 'diploma', 'bachelors', 'masters', 'phd', 'other')),
  constraint student_education_status_check
    check (status in ('ongoing', 'completed', 'discontinued')),
  constraint student_education_score_type_check
    check (score_type is null or score_type in ('percentage', 'cgpa_10', 'cgpa_4', 'grade', 'other')),
  constraint student_education_score_value_check check (
    score_value is null or (
      (score_type = 'percentage' and score_value between 0 and 100) or
      (score_type = 'cgpa_10' and score_value between 0 and 10) or
      (score_type = 'cgpa_4' and score_value between 0 and 4) or
      (score_type in ('grade', 'other'))
    )
  ),
  constraint student_education_start_year_check
    check (start_year is null or start_year between 1990 and 2100),
  constraint student_education_end_year_check
    check (end_year is null or end_year between 1990 and 2100),
  constraint student_education_backlogs_check
    check (backlogs is null or backlogs >= 0)
);
create index if not exists student_education_user_id_idx on public.student_education (user_id);


-- ----------------------------------------------------------------------------
-- 3. student_subject_strengths — one row per subject the student rated
-- ----------------------------------------------------------------------------
create table if not exists public.student_subject_strengths (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  subject_key text not null,
  rating smallint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_subject_strengths_rating_check check (rating between 1 and 5),
  unique (user_id, subject_key)
);
create index if not exists student_subject_strengths_user_id_idx on public.student_subject_strengths (user_id);


-- ----------------------------------------------------------------------------
-- 4. student_interests — one row per interest the student selected
-- ----------------------------------------------------------------------------
create table if not exists public.student_interests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  interest_key text not null,
  strength smallint,
  other_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_interests_strength_check check (strength is null or strength between 1 and 5),
  unique (user_id, interest_key)
);
create index if not exists student_interests_user_id_idx on public.student_interests (user_id);


-- ----------------------------------------------------------------------------
-- 5. student_skills — one row per skill the student selected
-- ----------------------------------------------------------------------------
create table if not exists public.student_skills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  skill_key text not null,
  level text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_skills_level_check check (level in ('beginner', 'intermediate', 'advanced')),
  unique (user_id, skill_key)
);
create index if not exists student_skills_user_id_idx on public.student_skills (user_id);


-- ----------------------------------------------------------------------------
-- 6. student_work_preferences — one row per Likert statement the student rated
--
-- preference_key values are the stable scoring keys defined in
-- src/data/profile-options.ts (e.g. 'technical_problem_solving') — never the
-- display sentence, so wording/translation can change without touching data.
-- ----------------------------------------------------------------------------
create table if not exists public.student_work_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  preference_key text not null,
  rating smallint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_work_preferences_rating_check check (rating between 1 and 5),
  unique (user_id, preference_key)
);
create index if not exists student_work_preferences_user_id_idx on public.student_work_preferences (user_id);


-- ----------------------------------------------------------------------------
-- 7. student_career_priorities — one row per priority the student rated
-- ----------------------------------------------------------------------------
create table if not exists public.student_career_priorities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  priority_key text not null,
  rating smallint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_career_priorities_rating_check check (rating between 1 and 5),
  unique (user_id, priority_key)
);
create index if not exists student_career_priorities_user_id_idx on public.student_career_priorities (user_id);


-- ----------------------------------------------------------------------------
-- 8. student_career_goals — one row per student
-- ----------------------------------------------------------------------------
create table if not exists public.student_career_goals (
  user_id uuid primary key references auth.users (id) on delete cascade,
  clarity text,
  dream_job_title text,
  dream_industry text,
  dream_reason text,
  career_ideas text[] not null default '{}',
  life_goals_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_career_goals_clarity_check
    check (clarity is null or clarity in ('clear', 'some_ideas', 'not_sure')),
  constraint student_career_goals_ideas_check
    check (cardinality(career_ideas) <= 3)
);


-- ----------------------------------------------------------------------------
-- 9. student_study_preferences — one row per student
-- ----------------------------------------------------------------------------
create table if not exists public.student_study_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  study_further text,
  study_abroad text,
  preferred_study_destinations text[] not null default '{}',
  preferred_work_destinations text[] not null default '{}',
  relocate_within_india text,
  relocate_international text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_study_preferences_enum_check check (
    (study_further is null or study_further in ('yes', 'no', 'maybe')) and
    (study_abroad is null or study_abroad in ('yes', 'no', 'maybe')) and
    (relocate_within_india is null or relocate_within_india in ('yes', 'no', 'maybe')) and
    (relocate_international is null or relocate_international in ('yes', 'no', 'maybe'))
  )
);


-- ----------------------------------------------------------------------------
-- 10. student_funding_preferences — one row per student
--
-- Deliberately basic (band/source/openness only) — see Milestone 3 summary
-- for why CIBIL/income/lender data is explicitly out of scope here.
-- ----------------------------------------------------------------------------
create table if not exists public.student_funding_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  budget_band text,
  funding_source text,
  loan_openness text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_funding_preferences_budget_check
    check (budget_band is null or budget_band in
      ('below_5l', '5_10l', '10_20l', '20_30l', '30_50l', '50l_plus', 'not_sure')),
  constraint student_funding_preferences_funding_check
    check (funding_source is null or funding_source in
      ('family_self_funded', 'scholarship_dependent', 'education_loan_expected', 'combination', 'not_sure')),
  constraint student_funding_preferences_loan_check
    check (loan_openness is null or loan_openness in ('yes', 'no', 'maybe'))
);


-- ----------------------------------------------------------------------------
-- 11. student_experience — optional, multiple records per student
-- ----------------------------------------------------------------------------
create table if not exists public.student_experience (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null,
  title text not null,
  organization text,
  description text,
  year integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_experience_type_check
    check (type in ('internship', 'project', 'competition', 'certification', 'work_experience', 'extracurricular')),
  constraint student_experience_year_check
    check (year is null or year between 1990 and 2100)
);
create index if not exists student_experience_user_id_idx on public.student_experience (user_id);


-- ----------------------------------------------------------------------------
-- 12. Row Level Security — every table above, owner-only
--
-- Each table is fully student-owned (unlike M2's `profiles`, which only
-- allowed a few editable columns) — students insert/read/update/delete
-- their own rows directly from the app as they fill in the wizard, so each
-- gets one FOR ALL policy rather than split select/update policies.
-- ----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'student_profiles',
      'student_education',
      'student_subject_strengths',
      'student_interests',
      'student_skills',
      'student_work_preferences',
      'student_career_priorities',
      'student_career_goals',
      'student_study_preferences',
      'student_funding_preferences',
      'student_experience'
    ])
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "Students manage their own rows" on public.%I', t);
    execute format(
      'create policy "Students manage their own rows" on public.%I for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)',
      t
    );
  end loop;
end $$;

-- Anonymous (logged-out) users get no policy at all on these tables, so
-- with RLS enabled they can read/write nothing — the secure default.


-- ----------------------------------------------------------------------------
-- 13. updated_at housekeeping — reuses public.set_updated_at() from 0001
-- ----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'student_profiles',
      'student_education',
      'student_subject_strengths',
      'student_interests',
      'student_skills',
      'student_work_preferences',
      'student_career_priorities',
      'student_career_goals',
      'student_study_preferences',
      'student_funding_preferences',
      'student_experience'
    ])
  loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      t
    );
  end loop;
end $$;


-- ----------------------------------------------------------------------------
-- 14. Reliable student_profiles creation on signup
--
-- Same rationale as 0001's handle_new_user(): create the row in the same
-- transaction as the auth account so there's no window where a student is
-- logged in but has no student_profiles row. This is a SEPARATE trigger
-- function from 0001's — Postgres allows multiple AFTER INSERT triggers on
-- auth.users, so 0001 doesn't need to be touched.
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user_student_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.student_profiles (user_id, profile_status, onboarding_current_step)
  values (new.id, 'not_started', 1)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_student_profile on auth.users;
create trigger on_auth_user_created_student_profile
  after insert on auth.users
  for each row
  execute function public.handle_new_user_student_profile();

-- Backfill: give any student who registered before this migration ran a
-- student_profiles row too, so Milestone 3 works for existing M2 accounts
-- without asking them to re-register.
insert into public.student_profiles (user_id, profile_status, onboarding_current_step)
select id, 'not_started', 1 from auth.users
on conflict (user_id) do nothing;
