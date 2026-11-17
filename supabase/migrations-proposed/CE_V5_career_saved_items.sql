-- ============================================================================
-- CE_V5_career_saved_items.sql — PROPOSED, NOT APPLIED
-- Career Explorer V5: a student's own saved careers.
--
-- Additive only. Creates ONE new table and its RLS policies. It does not
-- alter, read or write public.education_saved_items (saved universities and
-- courses), so University Discovery V3's shortlist and dashboard are
-- untouched. Safe to run more than once. Rollback: drop table
-- public.career_saved_items;
--
-- Until this is applied, the save button reports "Saving careers isn't
-- switched on yet" and nothing else in Career Explorer is affected.
-- Review and apply on staging first, then production, per the release notes.
-- ============================================================================

create table if not exists public.career_saved_items (
  id uuid primary key default gen_random_uuid(),
  student_user_id uuid not null references auth.users (id) on delete cascade,
  career_id uuid not null references public.careers (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint career_saved_items_unique unique (student_user_id, career_id)
);
create index if not exists career_saved_items_student_idx on public.career_saved_items (student_user_id, created_at desc);

comment on table public.career_saved_items is
  'Career Explorer V5 — a student''s own saved careers. Fully student-owned: a student can only see, create and delete their own rows. Free feature: needs an account, never a paid plan.';

alter table public.career_saved_items enable row level security;

drop policy if exists "Students can read their own saved careers" on public.career_saved_items;
create policy "Students can read their own saved careers"
  on public.career_saved_items for select to authenticated
  using (auth.uid() = student_user_id);

drop policy if exists "Admins can read all saved careers" on public.career_saved_items;
create policy "Admins can read all saved careers"
  on public.career_saved_items for select to authenticated
  using (public.is_admin_role(array['super_admin', 'admin', 'analyst']));

drop policy if exists "Students can save their own careers" on public.career_saved_items;
create policy "Students can save their own careers"
  on public.career_saved_items for insert to authenticated
  with check (auth.uid() = student_user_id);

drop policy if exists "Students can remove their own saved careers" on public.career_saved_items;
create policy "Students can remove their own saved careers"
  on public.career_saved_items for delete to authenticated
  using (auth.uid() = student_user_id);

-- No update policy: a saved career is only ever added or removed.
grant select, insert, delete on public.career_saved_items to authenticated;
revoke all on public.career_saved_items from anon;
