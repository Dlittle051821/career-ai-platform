-- ============================================================================
-- Milestone 2 — Student profiles + real authentication
--
-- HOW TO RUN THIS (no SQL knowledge required):
--   1. Open your Supabase project dashboard (supabase.com/dashboard).
--   2. Click "SQL Editor" in the left sidebar.
--   3. Click "New query".
--   4. Paste the entire contents of this file.
--   5. Click "Run".
--
-- Safe to run once. Re-running is also safe — every statement below is
-- written to not fail if it has already been applied (IF NOT EXISTS /
-- OR REPLACE / DROP POLICY IF EXISTS before CREATE POLICY).
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. profiles table
--
-- One row per student, keyed by the same UUID as their Supabase Auth
-- account (auth.users.id). Deliberately minimal for Milestone 2 — no
-- education/career/skills data yet, that's Milestone 3+.
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  email text,
  phone text,
  marketing_consent boolean not null default false,
  account_type text not null default 'student',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'One row per student account. Created automatically when a user registers (see handle_new_user trigger below). Milestone 2 scope only — no education/career/skills fields yet.';


-- ----------------------------------------------------------------------------
-- 2. Row Level Security
--
-- RLS is mandatory: without it, any authenticated user's API key could be
-- used to read or edit every student's profile. With it, Postgres itself
-- enforces "a user can only touch their own row" — no application code
-- can accidentally bypass it.
-- ----------------------------------------------------------------------------
alter table public.profiles enable row level security;

drop policy if exists "Students can read their own profile" on public.profiles;
create policy "Students can read their own profile"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "Students can update their own profile" on public.profiles;
create policy "Students can update their own profile"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- No INSERT or DELETE policy for regular users on purpose:
--   - Rows are created by the handle_new_user trigger below (runs with
--     elevated privileges as part of the signup transaction, bypassing RLS).
--   - Rows are deleted automatically via the ON DELETE CASCADE foreign key
--     above when the linked auth.users row is deleted.
-- A student's own client should never need to INSERT or DELETE this table
-- directly, so we don't grant it — smaller surface area, fewer ways for a
-- bug to turn into a security hole.

-- Column-level guard: even a legitimate "update your own row" request
-- should not be able to rewrite id / email / account_type / created_at.
-- full_name, phone, and marketing_consent are the only fields a student
-- can change themselves.
revoke update on public.profiles from authenticated;
grant update (full_name, phone, marketing_consent, updated_at) on public.profiles to authenticated;


-- ----------------------------------------------------------------------------
-- 3. Reliable profile creation on signup
--
-- Why a trigger instead of a second client-side insert: if profile
-- creation depended on a separate API call from the browser right after
-- signUp(), a dropped connection, closed tab, or failed request would
-- leave an auth user with no profile — a broken, hard-to-detect account.
-- A trigger on auth.users runs inside the SAME database transaction that
-- creates the account, so the two rows are created atomically: either
-- both exist, or (if something is fundamentally wrong) neither does.
--
-- The trigger reads full_name / phone / marketing_consent from the
-- metadata passed to supabase.auth.signUp({ options: { data: {...} } })
-- at registration time — see src/app/register and
-- src/lib/supabase/auth-errors.ts in the app code.
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, phone, marketing_consent, account_type)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.email,
    new.raw_user_meta_data ->> 'phone',
    coalesce((new.raw_user_meta_data ->> 'marketing_consent')::boolean, false),
    'student'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();


-- ----------------------------------------------------------------------------
-- 4. updated_at housekeeping
--
-- Keeps updated_at accurate even if a future update forgets to set it
-- explicitly.
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();
