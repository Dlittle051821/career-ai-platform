-- ============================================================================
-- CC-26 0025 — Inactive counsellors lose access; client roles lose table
-- privileges that RLS cannot govern.
--
-- STATUS: PROPOSED. Not applied to QA or production. Needs explicit approval.
-- ORDER: after cc25/0023 (revision 2) and cc25/0024. Works with or without
-- NW07/NW09 (F4 runs only when NW07 is applied) and before or after NW-F01.
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
--      TRUNCATE, TRIGGER and REFERENCES on every public table (the exact
--      privileges removed are recorded in schema nextwise_cc26_state for the
--      rollback). TRUNCATE
--      bypasses row-level security entirely. PostgREST never issues these
--      statements, so nothing in the app uses them; they are revoked from
--      the two client roles (service_role and the owner keep them), now and
--      for tables the owner creates later.
--   F4 (P1, NW07 databases only; added after QA confirmed NW07 is applied)
--      Authorship outlived case access on recommendation drafts: the two
--      draft SELECT policies and five draft RPCs accepted
--      "created_by = auth.uid()" as an alternative to case access. A counsellor
--      whose approval was revoked, whose session was reassigned or completed,
--      or who was deactivated kept reading and changing the drafts they wrote,
--      including drafts written under the original NW07 self-claim rule.
--      Counsellors now need current case access; admins are unchanged.
--
-- WHAT IT DOES NOT CHANGE
--   - SELECT / INSERT / UPDATE / DELETE privileges and every other policy.
--   - Active counsellors: behaviour is identical (regression-tested).
--   - The counsellors table, admin roles and any data.
--   - Recommendation draft rows, versions, function ACLs and comments (F4
--     changes authorization only).
--   It adds one schema, nextwise_cc26_state (no client access, not in the Data
--   API), holding the record the rollback needs; the rollback removes it.
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
--
-- The rollback must restore EXACTLY what this section removes and nothing
-- more, whatever the starting grants were. So before revoking, every
-- TRUNCATE/TRIGGER/REFERENCES privilege that anon or authenticated actually
-- holds (per table, with its grant option and grantor) and every matching
-- owner default privilege is recorded in schema nextwise_cc26_state. That
-- schema is not exposed by the Data API and no client role can use it. The
-- rollback re-grants only the recorded rows, then drops the record.
-- Re-runs add nothing (the privileges are already gone; ON CONFLICT keeps the
-- first record).
-- ---------------------------------------------------------------------------
create schema if not exists nextwise_cc26_state;
revoke all on schema nextwise_cc26_state from public, anon, authenticated, service_role;
comment on schema nextwise_cc26_state is
  'CC-26 migration state (not exposed to the Data API): the exact client-role privileges 0025 removed, so its rollback restores those and nothing else.';

create table if not exists nextwise_cc26_state.m0025_revoked_table_privileges (
  table_schema text not null,
  table_name text not null,
  grantee text not null,
  privilege_type text not null,
  is_grantable boolean not null,
  grantor text not null,
  recorded_at timestamptz not null default now(),
  primary key (table_schema, table_name, grantee, privilege_type)
);
create table if not exists nextwise_cc26_state.m0025_revoked_default_privileges (
  owner_role text not null,
  schema_name text not null,
  grantee text not null,
  privilege_type text not null,
  is_grantable boolean not null,
  recorded_at timestamptz not null default now(),
  primary key (owner_role, schema_name, grantee, privilege_type)
);
create table if not exists nextwise_cc26_state.m0025_apply_context (
  id integer primary key check (id = 1),
  nw_f01_present boolean not null,
  recorded_at timestamptz not null default now()
);
revoke all on all tables in schema nextwise_cc26_state from public, anon, authenticated, service_role;

insert into nextwise_cc26_state.m0025_apply_context (id, nw_f01_present)
values (1, to_regnamespace('nextwise_security') is not null)
on conflict (id) do nothing;

insert into nextwise_cc26_state.m0025_revoked_table_privileges (table_schema, table_name, grantee, privilege_type, is_grantable, grantor)
select n.nspname, c.relname, a.grantee::regrole::text, a.privilege_type, a.is_grantable, a.grantor::regrole::text
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
cross join lateral aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a
where n.nspname = 'public' and c.relkind in ('r', 'p')
  and a.grantee in ('anon'::regrole, 'authenticated'::regrole)
  and a.privilege_type in ('TRUNCATE', 'TRIGGER', 'REFERENCES')
on conflict do nothing;

insert into nextwise_cc26_state.m0025_revoked_default_privileges (owner_role, schema_name, grantee, privilege_type, is_grantable)
select d.defaclrole::regrole::text, 'public', a.grantee::regrole::text, a.privilege_type, a.is_grantable
from pg_default_acl d
cross join lateral aclexplode(d.defaclacl) a
where d.defaclrole = current_user::regrole
  and d.defaclnamespace = 'public'::regnamespace
  and d.defaclobjtype = 'r'
  and a.grantee in ('anon'::regrole, 'authenticated'::regrole)
  and a.privilege_type in ('TRUNCATE', 'TRIGGER', 'REFERENCES')
on conflict do nothing;

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
-- F4. Recommendation drafts: current case access only (NW07 databases)
--
-- NW07 let a counsellor reach a recommendation draft either through case
-- access or because they CREATED it (created_by = auth.uid()). Authorship
-- outlives case access: after an approval is revoked, a session is reassigned
-- or completed, or the counsellor is deactivated, the former author could
-- still read every version of the draft and edit, submit, withdraw, release or
-- archive it. On QA this also covers drafts written while the original NW07
-- rule let an unapproved self-claim through. A counsellor now needs CURRENT
-- case access (counsellor_has_case_access, made safe by 0023 r2 and 0025 F1);
-- admins are unchanged. A legitimate author always holds case access while
-- they work on the case, so active workflows are unaffected.
--
-- Two SELECT policies are altered in place (names kept). Five write RPCs are
-- re-created from NW07 verbatim except the authorization line and a pinned
-- search_path, ONLY when their body is still exactly the NW07 original.
-- Every body must match one of three known fingerprints (MD5 of the source,
-- CR removed): the verified NW07 original (replaced), the CC-26 version (a
-- re-run: left alone) or the NW-F01 03 hardened version (left alone). ANY other
-- body, whatever it contains, is drift and the migration refuses before it
-- changes anything. Function ACLs and comments are not touched. Skipped
-- entirely when NW07 is not applied.
-- ---------------------------------------------------------------------------
do $f4$
declare
  v_fn text;
  v_md5 text;
  -- [NW07 original, CC-26 version, NW-F01 03 version]
  v_known constant jsonb := jsonb_build_object(
    'staff_update_recommendation_draft_content', jsonb_build_array('5eef6dced30ca13c6b1354870f2e441b', '8d76caf129e0b33c6b70956ccf3be211', '98bccd1b7a5b72c049a69ce86afb12db'),
    'staff_submit_recommendation_draft_for_review', jsonb_build_array('3f365eacdd071abecbdf7a680e5d1775', '1a69bbfe9644efd7d8996275cc45fbf9', '010668295aab4a7ee5d466e8a6b4e464'),
    'staff_release_recommendation_draft', jsonb_build_array('5ddb8bc143a32a1109043b7e7cc2ef9c', 'dc4d3efb964868219c208369adb05ce6', '37eb052c70a08fb28a22231434c3597d'),
    'staff_withdraw_recommendation_draft', jsonb_build_array('adb19f89b3d97167eaa8a7fa989db725', '3d65d505806b342f0e2659f618145dbd', 'cec7f6744961e4124b9081b325147b94'),
    'staff_archive_recommendation_draft', jsonb_build_array('ebcc9aab425723c73db5784bc33b9ea2', '9d0f5dcbc0ecd98cedbc669552feec2f', '7435c90a98c41e03cff15f8b44e522d9'));
begin
  if to_regclass('public.recommendation_drafts') is null then
    raise notice 'CC26-0025 F4 skipped: NW07 is not applied.';
    return;
  end if;
  if to_regprocedure('public.counsellor_has_case_access(uuid)') is null
     or (select count(*) from pg_policies where schemaname = 'public'
           and ((tablename = 'recommendation_drafts' and policyname = 'Admins/author/case counsellor can read recommendation drafts')
             or (tablename = 'recommendation_draft_versions' and policyname = 'Admins/author/case counsellor can read recommendation draft ver'))
           and qual like '%counsellor_has_case_access%') <> 2 then
    raise exception 'CC26-0025 refused: NW07 recommendation draft policies are not in the expected state (drift).';
  end if;
  -- Drift check for all five functions before changing anything.
  for v_fn in select jsonb_object_keys(v_known) loop
    select md5(replace(p.prosrc, chr(13), '')) into v_md5 from pg_proc p
    where p.oid = to_regprocedure('public.' || v_fn || case when v_fn = 'staff_update_recommendation_draft_content' then '(uuid,jsonb)' else '(uuid)' end);
    if v_md5 is null then
      raise exception 'CC26-0025 refused: public.% is missing (drift).', v_fn;
    end if;
    if not (v_known -> v_fn) ? v_md5 then
      raise exception 'CC26-0025 refused: public.% has an unknown body (fingerprint %); only the verified NW07, CC-26 and NW-F01 versions are accepted (drift).', v_fn, v_md5;
    end if;
  end loop;

  alter policy "Admins/author/case counsellor can read recommendation drafts" on public.recommendation_drafts
    using (
      public.is_admin_role(array['super_admin', 'admin'])
      or (public.is_admin_role(array['counsellor']) and public.counsellor_has_case_access(student_user_id))
    );
  alter policy "Admins/author/case counsellor can read recommendation draft ver" on public.recommendation_draft_versions
    using (
      exists (
        select 1 from public.recommendation_drafts d
        where d.id = recommendation_draft_versions.draft_id
          and (
            public.is_admin_role(array['super_admin', 'admin'])
            or (public.is_admin_role(array['counsellor']) and public.counsellor_has_case_access(d.student_user_id))
          )
      )
    );

  if (select md5(replace(prosrc, chr(13), '')) from pg_proc where oid = 'public.staff_update_recommendation_draft_content(uuid,jsonb)'::regprocedure) = '5eef6dced30ca13c6b1354870f2e441b' then
    execute $f4_update_content$
create or replace function public.staff_update_recommendation_draft_content(
  p_draft_id uuid,
  p_content jsonb
)
returns public.recommendation_drafts
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_draft public.recommendation_drafts;
  v_next_version integer;
  v_version public.recommendation_draft_versions;
begin
  select * into v_draft from public.recommendation_drafts where id = p_draft_id for update;
  if v_draft.id is null then
    raise exception 'Recommendation draft not found.';
  end if;

  if not (
    public.is_admin_role(array['super_admin', 'admin'])
    or (public.is_admin_role(array['counsellor']) and public.counsellor_has_case_access(v_draft.student_user_id))
  ) then
    raise exception 'Not authorized to edit this recommendation draft.';
  end if;

  if v_draft.status not in ('draft', 'changes_requested') then
    raise exception 'Cannot edit a recommendation draft while it is "%"  — only draft or changes_requested.', v_draft.status;
  end if;

  select coalesce(max(version_number), 0) + 1 into v_next_version from public.recommendation_draft_versions where draft_id = p_draft_id;

  insert into public.recommendation_draft_versions (draft_id, version_number, content, authored_by)
  values (p_draft_id, v_next_version, coalesce(p_content, '{}'::jsonb), auth.uid())
  returning * into v_version;

  update public.recommendation_drafts set current_version_id = v_version.id where id = p_draft_id
  returning * into v_draft;

  return v_draft;
end;
$$;
$f4_update_content$;
  end if;

  if (select md5(replace(prosrc, chr(13), '')) from pg_proc where oid = 'public.staff_submit_recommendation_draft_for_review(uuid)'::regprocedure) = '3f365eacdd071abecbdf7a680e5d1775' then
    execute $f4_submit_for_review$
create or replace function public.staff_submit_recommendation_draft_for_review(p_draft_id uuid)
returns public.recommendation_drafts
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_draft public.recommendation_drafts;
begin
  select * into v_draft from public.recommendation_drafts where id = p_draft_id for update;
  if v_draft.id is null then
    raise exception 'Recommendation draft not found.';
  end if;

  if not (
    public.is_admin_role(array['super_admin', 'admin'])
    or (public.is_admin_role(array['counsellor']) and public.counsellor_has_case_access(v_draft.student_user_id))
  ) then
    raise exception 'Not authorized to submit this recommendation draft.';
  end if;

  if v_draft.status not in ('draft', 'changes_requested') then
    raise exception 'Cannot submit for review from status "%".', v_draft.status;
  end if;
  if v_draft.current_version_id is null then
    raise exception 'Cannot submit a recommendation draft with no authored content.';
  end if;

  update public.recommendation_drafts
    set status = 'submitted_for_review', submitted_at = now(), submitted_by = auth.uid()
    where id = p_draft_id
    returning * into v_draft;

  return v_draft;
end;
$$;
$f4_submit_for_review$;
  end if;

  if (select md5(replace(prosrc, chr(13), '')) from pg_proc where oid = 'public.staff_release_recommendation_draft(uuid)'::regprocedure) = '5ddb8bc143a32a1109043b7e7cc2ef9c' then
    execute $f4_release$
create or replace function public.staff_release_recommendation_draft(p_draft_id uuid)
returns public.recommendation_drafts
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_draft public.recommendation_drafts;
begin
  select * into v_draft from public.recommendation_drafts where id = p_draft_id for update;
  if v_draft.id is null then
    raise exception 'Recommendation draft not found.';
  end if;

  if not (
    public.is_admin_role(array['super_admin', 'admin'])
    or (public.is_admin_role(array['counsellor']) and public.counsellor_has_case_access(v_draft.student_user_id))
  ) then
    raise exception 'Not authorized to release this recommendation draft.';
  end if;

  if v_draft.status <> 'approved' then
    raise exception 'Cannot release a recommendation draft from status "%" — it must be approved first.', v_draft.status;
  end if;

  update public.recommendation_drafts
    set status = 'released_to_student', released_at = now(), released_by = auth.uid()
    where id = p_draft_id
    returning * into v_draft;

  return v_draft;
end;
$$;
$f4_release$;
  end if;

  if (select md5(replace(prosrc, chr(13), '')) from pg_proc where oid = 'public.staff_withdraw_recommendation_draft(uuid)'::regprocedure) = 'adb19f89b3d97167eaa8a7fa989db725' then
    execute $f4_withdraw$
create or replace function public.staff_withdraw_recommendation_draft(p_draft_id uuid)
returns public.recommendation_drafts
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_draft public.recommendation_drafts;
begin
  select * into v_draft from public.recommendation_drafts where id = p_draft_id for update;
  if v_draft.id is null then
    raise exception 'Recommendation draft not found.';
  end if;

  if not (
    public.is_admin_role(array['super_admin', 'admin'])
    or (public.is_admin_role(array['counsellor']) and public.counsellor_has_case_access(v_draft.student_user_id))
  ) then
    raise exception 'Not authorized to withdraw this recommendation draft.';
  end if;

  if v_draft.status <> 'submitted_for_review' then
    raise exception 'Cannot withdraw a recommendation draft from status "%".', v_draft.status;
  end if;

  update public.recommendation_drafts set status = 'draft' where id = p_draft_id returning * into v_draft;
  return v_draft;
end;
$$;
$f4_withdraw$;
  end if;

  if (select md5(replace(prosrc, chr(13), '')) from pg_proc where oid = 'public.staff_archive_recommendation_draft(uuid)'::regprocedure) = 'ebcc9aab425723c73db5784bc33b9ea2' then
    execute $f4_archive$
create or replace function public.staff_archive_recommendation_draft(p_draft_id uuid)
returns public.recommendation_drafts
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_draft public.recommendation_drafts;
begin
  select * into v_draft from public.recommendation_drafts where id = p_draft_id for update;
  if v_draft.id is null then
    raise exception 'Recommendation draft not found.';
  end if;

  if not (
    public.is_admin_role(array['super_admin', 'admin'])
    or (public.is_admin_role(array['counsellor']) and public.counsellor_has_case_access(v_draft.student_user_id))
  ) then
    raise exception 'Not authorized to archive this recommendation draft.';
  end if;

  if v_draft.status not in ('approved', 'released_to_student') then
    raise exception 'Cannot archive a recommendation draft from status "%".', v_draft.status;
  end if;

  update public.recommendation_drafts set status = 'archived', archived_at = now(), archived_by = auth.uid() where id = p_draft_id
    returning * into v_draft;
  return v_draft;
end;
$$;
$f4_archive$;
  end if;
end
$f4$;

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
  if exists (select 1 from pg_namespace n where n.nspname = 'nextwise_cc26_state'
             and (has_schema_privilege('anon', n.oid, 'USAGE') or has_schema_privilege('authenticated', n.oid, 'USAGE'))) then
    raise exception 'CC26-0025 postcondition: client roles can use the migration-state schema';
  end if;
  if exists (select 1 from nextwise_cc26_state.m0025_revoked_table_privileges where grantor <> current_user::text) then
    raise exception 'CC26-0025 postcondition: a revoked privilege was granted by another role; the rollback could not restore it exactly';
  end if;
  if to_regclass('public.recommendation_drafts') is not null and exists (
       select 1 from (values
         ('staff_update_recommendation_draft_content(uuid,jsonb)', '8d76caf129e0b33c6b70956ccf3be211', '98bccd1b7a5b72c049a69ce86afb12db'),
         ('staff_submit_recommendation_draft_for_review(uuid)', '1a69bbfe9644efd7d8996275cc45fbf9', '010668295aab4a7ee5d466e8a6b4e464'),
         ('staff_release_recommendation_draft(uuid)', 'dc4d3efb964868219c208369adb05ce6', '37eb052c70a08fb28a22231434c3597d'),
         ('staff_withdraw_recommendation_draft(uuid)', '3d65d505806b342f0e2659f618145dbd', 'cec7f6744961e4124b9081b325147b94'),
         ('staff_archive_recommendation_draft(uuid)', '9d0f5dcbc0ecd98cedbc669552feec2f', '7435c90a98c41e03cff15f8b44e522d9')
       ) v(fn, cc26, nwf01)
       left join pg_proc p on p.oid = to_regprocedure('public.' || v.fn)
       where p.oid is null or md5(replace(p.prosrc, chr(13), '')) not in (v.cc26, v.nwf01)) then
    raise exception 'CC26-0025 postcondition: a recommendation draft RPC is not the CC-26 or NW-F01 version';
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public'
             and tablename in ('recommendation_drafts', 'recommendation_draft_versions')
             and coalesce(qual, '') || coalesce(with_check, '') like '%created_by = auth.uid()%') then
    raise exception 'CC26-0025 postcondition: a recommendation draft policy still grants access by authorship';
  end if;
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.prosrc like '%created_by = auth.uid() or public.counsellor_has_case_access%') then
    raise exception 'CC26-0025 postcondition: a write RPC still grants access by authorship';
  end if;
end
$post$;

notify pgrst, 'reload schema';

commit;
