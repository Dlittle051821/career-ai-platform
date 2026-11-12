-- ============================================================================
-- ROLLBACK for 0025_cc26_inactive_counsellor_and_grant_hardening.sql
--
-- Restores the exact pre-0025 state: current_counsellor_id() from 0004 and
-- the two discovery_sessions policies from 0013 (verbatim), and gives anon and
-- authenticated back TRUNCATE, TRIGGER and REFERENCES on every public table
-- and in the owner's default privileges.
--
-- CONSEQUENCES: deactivated counsellors regain their caseload access and the
-- unassigned-session queue; client roles regain TRUNCATE/TRIGGER/REFERENCES.
--
-- APPLY: select set_config('nextwise.cc26_0025_rollback', 'APPROVED-QA-ynwzijulzksmrcwdhudv', false);
--        then run this whole file in ONE execution. Atomic and re-runnable.
-- ============================================================================

begin;
set local lock_timeout = '5s';
set local statement_timeout = '120s';

do $pre$
begin
  if coalesce(current_setting('nextwise.cc26_0025_rollback', true), '')
     not in ('APPROVED-QA-ynwzijulzksmrcwdhudv', 'LOCAL-DISPOSABLE-TEST') then
    raise exception 'CC26-0025 rollback refused: set nextwise.cc26_0025_rollback to the approved value first.';
  end if;
end
$pre$;

-- 0004 (verbatim) ---------------------------------------------------------------
create or replace function public.current_counsellor_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select id from public.counsellors where user_id = auth.uid();
$$;

comment on function public.current_counsellor_id() is
  'The calling user''s own counsellors.id, or null. Used to scope a counsellor''s RLS visibility to only their assigned students/leads/applications.';

-- If NW-F01 03 was applied meanwhile, keep its F7 search_path hardening.
do $f7$
begin
  if to_regnamespace('nextwise_security') is not null then
    alter function public.current_counsellor_id() set search_path = pg_catalog, extensions, public, pg_temp;
  end if;
end
$f7$;

-- 0013 (verbatim) ---------------------------------------------------------------
drop policy if exists "Admins/counsellors can read discovery sessions" on public.discovery_sessions;
create policy "Admins/counsellors can read discovery sessions"
  on public.discovery_sessions for select to authenticated
  using (
    public.is_admin_role(array['super_admin', 'admin'])
    or (
      public.is_admin_role(array['counsellor'])
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
      and (assigned_counsellor_id is null or assigned_counsellor_id = public.current_counsellor_id())
    )
  )
  with check (
    public.is_admin_role(array['super_admin', 'admin'])
    or (public.is_admin_role(array['counsellor']) and assigned_counsellor_id = public.current_counsellor_id())
  );

-- Supabase default table privileges ----------------------------------------------
do $grants$
declare
  v_table regclass;
begin
  for v_table in
    select c.oid::regclass
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p')
  loop
    execute format('grant truncate, trigger, references on table %s to anon, authenticated', v_table);
  end loop;
end
$grants$;

alter default privileges in schema public grant truncate, trigger, references on tables to anon, authenticated;

notify pgrst, 'reload schema';

commit;
