-- ============================================================================
-- CC-26 0025 — Inactive counsellors lose access; client roles lose table
-- privileges that RLS cannot govern.
--
-- STATUS: PROPOSED. Not applied to QA or production. Needs explicit approval.
-- ORDER: after cc25/0023 (revision 2) and cc25/0024. Independent of NW07/NW09
-- (works with or without them).
--
-- WHAT IT FIXES
--   F1 (P1) Deactivated counsellors kept caseload access. Deactivation is the
--      documented way to remove a counsellor (0004: "deactivate via is_active
--      instead of destructive delete"), but public.current_counsellor_id()
--      ignored counsellors.is_active, and almost every counsellor policy
--      (profiles, the 11 student_* tables, applications, invoices, payments,
--      agreements, leads, outcomes, notes …) is keyed on it. It now returns
--      null for an inactive counsellor, which closes all of those paths at
--      once.
--   F2 (P2) A counsellor with no active counsellor record could still read and
--      update every UNASSIGNED Discovery Session (student id, notes, times):
--      the "assigned_counsellor_id is null" branch did not depend on
--      current_counsellor_id(). That branch now requires an active counsellor.
--   F3 (P2) Supabase's default privileges give anon and authenticated
--      TRUNCATE, TRIGGER and REFERENCES on every public table. TRUNCATE
--      bypasses row-level security entirely. PostgREST never issues these
--      statements, so nothing in the app uses them; they are revoked from
--      the two client roles (service_role and the owner keep them), now and
--      for tables the owner creates later.
--
-- WHAT IT DOES NOT CHANGE
--   - SELECT / INSERT / UPDATE / DELETE privileges and every other policy.
--   - Active counsellors: behaviour is identical (regression-tested).
--   - The counsellors table, admin roles and any data.
--   current_counsellor_id() is re-created with search_path = pg_catalog,
--   public, pg_temp (0004 had search_path = public; NW-F01 03 pins it with
--   pg_temp last too), so neither apply order loses that hardening.
--
-- APPLY (QA only, after approval):
--   select set_config('nextwise.cc26_0025_approval', 'APPROVED-QA-ynwzijulzksmrcwdhudv', false);
--   then run this whole file in ONE execution (atomic, re-runnable).
-- ROLLBACK: 0025_cc26_ROLLBACK.sql
-- ============================================================================

begin;
set local lock_timeout = '5s';
set local statement_timeout = '120s';

do $pre$
begin
  if coalesce(current_setting('nextwise.cc26_0025_approval', true), '')
     not in ('APPROVED-QA-ynwzijulzksmrcwdhudv', 'LOCAL-DISPOSABLE-TEST') then
    raise exception 'CC26-0025 refused: set nextwise.cc26_0025_approval to the approved value first. Production is never an approved target.';
  end if;
  if to_regprocedure('public.current_counsellor_id()') is null
     or to_regclass('public.counsellors') is null
     or to_regclass('public.discovery_sessions') is null then
    raise exception 'CC26-0025 refused: migration 0004/0013 objects are missing.';
  end if;
  if to_regprocedure('public.counsellor_has_active_session_for_student(uuid)') is null then
    raise exception 'CC26-0025 refused: apply cc25/0023 (revision 2) first.';
  end if;
  if (select count(*) from pg_policies where schemaname = 'public' and tablename = 'discovery_sessions'
      and policyname in ('Admins/counsellors can read discovery sessions', 'Admins/counsellors can update discovery sessions')) <> 2 then
    raise exception 'CC26-0025 refused: discovery_sessions policies are not in the expected state (drift).';
  end if;
end
$pre$;

-- ---------------------------------------------------------------------------
-- F1. current_counsellor_id(): active counsellors only
-- ---------------------------------------------------------------------------
create or replace function public.current_counsellor_id()
returns uuid
language sql
security definer
stable
set search_path = pg_catalog, public, pg_temp
as $$
  select id from public.counsellors where user_id = auth.uid() and is_active;
$$;

comment on function public.current_counsellor_id() is
  'The calling user''s own ACTIVE counsellors.id, or null (CC-26: an inactive counsellor resolves to null, so every counsellor policy keyed on this function denies them). Used to scope a counsellor''s RLS visibility to only their assigned students/leads/applications.';

-- ---------------------------------------------------------------------------
-- F2. Unassigned Discovery Sessions: active counsellors only
-- ---------------------------------------------------------------------------
drop policy if exists "Admins/counsellors can read discovery sessions" on public.discovery_sessions;
create policy "Admins/counsellors can read discovery sessions"
  on public.discovery_sessions for select to authenticated
  using (
    public.is_admin_role(array['super_admin', 'admin'])
    or (
      public.is_admin_role(array['counsellor'])
      and public.current_counsellor_id() is not null
      and (assigned_counsellor_id is null or assigned_counsellor_id = public.current_counsellor_id())
    )
  );

drop policy if exists "Admins/counsellors can update discovery sessions" on public.discovery_sessions;
create policy "Admins/counsellors can update discovery sessions"
  on public.discovery_sessions for update to authenticated
  using (
    public.is_admin_role(array['super_admin', 'admin'])
    or (
      public.is_admin_role(array['counsellor'])
      and public.current_counsellor_id() is not null
      and (assigned_counsellor_id is null or assigned_counsellor_id = public.current_counsellor_id())
    )
  )
  with check (
    public.is_admin_role(array['super_admin', 'admin'])
    or (public.is_admin_role(array['counsellor']) and assigned_counsellor_id = public.current_counsellor_id())
  );

-- ---------------------------------------------------------------------------
-- F3. Table privileges RLS cannot govern
-- ---------------------------------------------------------------------------
do $grants$
declare
  v_table regclass;
begin
  for v_table in
    select c.oid::regclass
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p')
  loop
    execute format('revoke truncate, trigger, references on table %s from anon, authenticated', v_table);
  end loop;
end
$grants$;

-- Tables the migration owner creates later (Supabase: role postgres).
alter default privileges in schema public revoke truncate, trigger, references on tables from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Postconditions
-- ---------------------------------------------------------------------------
do $post$
begin
  if exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
             where n.nspname = 'public' and c.relkind in ('r', 'p')
               and (has_table_privilege('anon', c.oid, 'TRUNCATE')
                    or has_table_privilege('authenticated', c.oid, 'TRUNCATE')
                    or has_table_privilege('authenticated', c.oid, 'TRIGGER')
                    or has_table_privilege('authenticated', c.oid, 'REFERENCES'))) then
    raise exception 'CC26-0025 postcondition: a client role still holds TRUNCATE/TRIGGER/REFERENCES';
  end if;
  if (select prosrc from pg_proc where oid = 'public.current_counsellor_id()'::regprocedure) not like '%is_active%' then
    raise exception 'CC26-0025 postcondition: current_counsellor_id() does not check is_active';
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'discovery_sessions'
             and policyname in ('Admins/counsellors can read discovery sessions', 'Admins/counsellors can update discovery sessions')
             and qual not like '%current_counsellor_id() IS NOT NULL%') then
    raise exception 'CC26-0025 postcondition: unassigned-session branch is not gated on an active counsellor';
  end if;
end
$post$;

notify pgrst, 'reload schema';

commit;
