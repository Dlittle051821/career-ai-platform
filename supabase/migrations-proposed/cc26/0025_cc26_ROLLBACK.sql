-- ============================================================================
-- ROLLBACK for 0025_cc26_inactive_counsellor_and_grant_hardening.sql
--
-- Restores the exact pre-0025 state: current_counsellor_id() from 0004, the
-- two discovery_sessions policies from 0013 and, on NW07 databases, the NW07
-- recommendation draft rules (all verbatim), and gives anon and
-- authenticated back TRUNCATE, TRIGGER and REFERENCES on every public table
-- and in the owner's default privileges.
--
-- CONSEQUENCES: deactivated counsellors regain their caseload access and the
-- unassigned-session queue; client roles regain TRUNCATE/TRIGGER/REFERENCES;
-- on NW07 databases, former authors regain access to their recommendation
-- drafts (F4). Run it only to recover from a failed release.
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

-- F4: NW07 recommendation draft rules (verbatim) ---------------------------------
-- Restores authorship-based access. Only bodies that are exactly the CC-26
-- version are restored; NW-F01 03 bodies (applied after 0025) are left alone.
do $f4$
begin
  if to_regclass('public.recommendation_drafts') is null then
    return;
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'recommendation_drafts'
             and policyname = 'Admins/author/case counsellor can read recommendation drafts' and qual not like '%created_by%') then
    alter policy "Admins/author/case counsellor can read recommendation drafts" on public.recommendation_drafts
      using (
        public.is_admin_role(array['super_admin', 'admin'])
        or (
          public.is_admin_role(array['counsellor'])
          and (created_by = auth.uid() or public.counsellor_has_case_access(student_user_id))
        )
      );
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'recommendation_draft_versions'
             and policyname = 'Admins/author/case counsellor can read recommendation draft ver' and qual not like '%created_by%') then
    alter policy "Admins/author/case counsellor can read recommendation draft ver" on public.recommendation_draft_versions
      using (
        exists (
          select 1 from public.recommendation_drafts d
          where d.id = recommendation_draft_versions.draft_id
            and (
              public.is_admin_role(array['super_admin', 'admin'])
              or (
                public.is_admin_role(array['counsellor'])
                and (d.created_by = auth.uid() or public.counsellor_has_case_access(d.student_user_id))
              )
            )
        )
      );
  end if;

  if (select md5(replace(prosrc, chr(13), '')) from pg_proc where oid = 'public.staff_update_recommendation_draft_content(uuid,jsonb)'::regprocedure) = '8d76caf129e0b33c6b70956ccf3be211' then
    execute $f4_update_content$
create or replace function public.staff_update_recommendation_draft_content(
  p_draft_id uuid,
  p_content jsonb
)
returns public.recommendation_drafts
language plpgsql
security definer
set search_path = public
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
    or (public.is_admin_role(array['counsellor']) and (v_draft.created_by = auth.uid() or public.counsellor_has_case_access(v_draft.student_user_id)))
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

  if (select md5(replace(prosrc, chr(13), '')) from pg_proc where oid = 'public.staff_submit_recommendation_draft_for_review(uuid)'::regprocedure) = '1a69bbfe9644efd7d8996275cc45fbf9' then
    execute $f4_submit_for_review$
create or replace function public.staff_submit_recommendation_draft_for_review(p_draft_id uuid)
returns public.recommendation_drafts
language plpgsql
security definer
set search_path = public
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
    or (public.is_admin_role(array['counsellor']) and (v_draft.created_by = auth.uid() or public.counsellor_has_case_access(v_draft.student_user_id)))
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

  if (select md5(replace(prosrc, chr(13), '')) from pg_proc where oid = 'public.staff_release_recommendation_draft(uuid)'::regprocedure) = 'dc4d3efb964868219c208369adb05ce6' then
    execute $f4_release$
create or replace function public.staff_release_recommendation_draft(p_draft_id uuid)
returns public.recommendation_drafts
language plpgsql
security definer
set search_path = public
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
    or (public.is_admin_role(array['counsellor']) and (v_draft.created_by = auth.uid() or public.counsellor_has_case_access(v_draft.student_user_id)))
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

  if (select md5(replace(prosrc, chr(13), '')) from pg_proc where oid = 'public.staff_withdraw_recommendation_draft(uuid)'::regprocedure) = '3d65d505806b342f0e2659f618145dbd' then
    execute $f4_withdraw$
create or replace function public.staff_withdraw_recommendation_draft(p_draft_id uuid)
returns public.recommendation_drafts
language plpgsql
security definer
set search_path = public
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
    or (public.is_admin_role(array['counsellor']) and (v_draft.created_by = auth.uid() or public.counsellor_has_case_access(v_draft.student_user_id)))
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

  if (select md5(replace(prosrc, chr(13), '')) from pg_proc where oid = 'public.staff_archive_recommendation_draft(uuid)'::regprocedure) = '9d0f5dcbc0ecd98cedbc669552feec2f' then
    execute $f4_archive$
create or replace function public.staff_archive_recommendation_draft(p_draft_id uuid)
returns public.recommendation_drafts
language plpgsql
security definer
set search_path = public
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
    or (public.is_admin_role(array['counsellor']) and (v_draft.created_by = auth.uid() or public.counsellor_has_case_access(v_draft.student_user_id)))
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
