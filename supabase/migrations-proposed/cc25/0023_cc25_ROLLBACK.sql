-- ============================================================================
-- ROLLBACK for 0023_cc25_counsellor_identity_least_privilege.sql
--
-- Restores the exact pre-CC-25 state: the 0013 PART 3 workspace policies and
-- the 0014 provenance/verification policies (verbatim), and removes every
-- CC-25 object (triggers, functions, approval columns and constraint).
-- REVISION 2 (CC-26): where NW07 is applied, also restores the NW07 state
-- that 0023 replaced, before the CC-25 helpers are dropped: the ORIGINAL NW07
-- rule (verbatim, with its ACL) when 0023 narrowed it, otherwise the patched
-- NW07's caseload-only state (marker [cc26-prior:…] on the function comment).
--
-- CONSEQUENCES (read before running):
--   - Approval decisions recorded in the three assignment_approved_* columns
--     are discarded (their audit trail stays in admin_audit_log).
--   - The pre-CC-25 weaknesses return: self-claimed / historical / hijacked
--     assignments grant workspace, provenance and verification access again
--     (and, where NW07 is applied, the full student profile and case notes),
--     and counsellors see "Student details restricted" (no identity lookup).
--   - The application must be rolled back to a build that does not call
--     staff_discovery_session_student_identities / admin_set_..._approval
--     (CC-24 3d5e373), or those screens show the restricted state.
--
-- APPLY: select set_config('nextwise.cc25_0023_rollback', 'APPROVED-QA-ynwzijulzksmrcwdhudv', false);
--        then run this whole file in ONE execution. Atomic and re-runnable.
-- ============================================================================

begin;
set local lock_timeout = '5s';
set local statement_timeout = '120s';

do $pre$
begin
  if coalesce(current_setting('nextwise.cc25_0023_rollback', true), '')
     not in ('APPROVED-QA-ynwzijulzksmrcwdhudv', 'LOCAL-DISPOSABLE-TEST') then
    raise exception 'CC25-0023 rollback refused: set nextwise.cc25_0023_rollback to the approved value first.';
  end if;
end
$pre$;

-- 0013 PART 3 (verbatim) ------------------------------------------------------
drop policy if exists "Admins/assigned counsellor can read the workspace" on public.discovery_session_workspace;
create policy "Admins/assigned counsellor can read the workspace"
  on public.discovery_session_workspace for select to authenticated
  using (
    public.is_admin_role(array['super_admin', 'admin'])
    or (
      public.is_admin_role(array['counsellor'])
      and exists (
        select 1 from public.discovery_sessions s
        where s.id = discovery_session_workspace.session_id
          and s.assigned_counsellor_id = public.current_counsellor_id()
      )
    )
  );

drop policy if exists "Admins/assigned counsellor can write the workspace" on public.discovery_session_workspace;
create policy "Admins/assigned counsellor can write the workspace"
  on public.discovery_session_workspace for all to authenticated
  using (
    public.is_admin_role(array['super_admin', 'admin'])
    or (
      public.is_admin_role(array['counsellor'])
      and exists (
        select 1 from public.discovery_sessions s
        where s.id = discovery_session_workspace.session_id
          and s.assigned_counsellor_id = public.current_counsellor_id()
      )
    )
  )
  with check (
    public.is_admin_role(array['super_admin', 'admin'])
    or (
      public.is_admin_role(array['counsellor'])
      and exists (
        select 1 from public.discovery_sessions s
        where s.id = discovery_session_workspace.session_id
          and s.assigned_counsellor_id = public.current_counsellor_id()
      )
    )
  );

-- 0014 (verbatim) ---------------------------------------------------------------
drop policy if exists "Admins/assigned counsellor can read section provenance" on public.student_profile_section_provenance;
create policy "Admins/assigned counsellor can read section provenance"
  on public.student_profile_section_provenance for select to authenticated
  using (
    public.is_admin_role(array['super_admin', 'admin', 'analyst'])
    or (
      public.is_admin_role(array['counsellor'])
      and (
        exists (
          select 1 from public.admin_student_meta m
          where m.student_user_id = student_profile_section_provenance.student_user_id
            and m.assigned_counsellor_id = public.current_counsellor_id()
        )
        or exists (
          select 1 from public.discovery_sessions ds
          where ds.student_user_id = student_profile_section_provenance.student_user_id
            and ds.assigned_counsellor_id = public.current_counsellor_id()
        )
      )
    )
  );

drop policy if exists "Admins/assigned counsellor can write section provenance" on public.student_profile_section_provenance;
create policy "Admins/assigned counsellor can write section provenance"
  on public.student_profile_section_provenance for all to authenticated
  using (
    public.is_admin_role(array['super_admin', 'admin'])
    or (
      public.is_admin_role(array['counsellor'])
      and (
        exists (
          select 1 from public.admin_student_meta m
          where m.student_user_id = student_profile_section_provenance.student_user_id
            and m.assigned_counsellor_id = public.current_counsellor_id()
        )
        or exists (
          select 1 from public.discovery_sessions ds
          where ds.student_user_id = student_profile_section_provenance.student_user_id
            and ds.assigned_counsellor_id = public.current_counsellor_id()
        )
      )
    )
  )
  with check (
    last_updated_by = auth.uid()
    and (
      public.is_admin_role(array['super_admin', 'admin'])
      or (
        public.is_admin_role(array['counsellor'])
        and (
          exists (
            select 1 from public.admin_student_meta m
            where m.student_user_id = student_profile_section_provenance.student_user_id
              and m.assigned_counsellor_id = public.current_counsellor_id()
          )
          or exists (
            select 1 from public.discovery_sessions ds
            where ds.student_user_id = student_profile_section_provenance.student_user_id
              and ds.assigned_counsellor_id = public.current_counsellor_id()
          )
        )
      )
    )
  );

drop policy if exists "Admins/assigned counsellor can read recommendation verifications" on public.student_recommendation_verifications;
create policy "Admins/assigned counsellor can read recommendation verifications"
  on public.student_recommendation_verifications for select to authenticated
  using (
    public.is_admin_role(array['super_admin', 'admin', 'analyst'])
    or (
      public.is_admin_role(array['counsellor'])
      and (
        exists (
          select 1 from public.admin_student_meta m
          where m.student_user_id = student_recommendation_verifications.student_user_id
            and m.assigned_counsellor_id = public.current_counsellor_id()
        )
        or exists (
          select 1 from public.discovery_sessions ds
          where ds.student_user_id = student_recommendation_verifications.student_user_id
            and ds.assigned_counsellor_id = public.current_counsellor_id()
        )
      )
    )
  );

drop policy if exists "Admins/assigned counsellor can write recommendation verifications" on public.student_recommendation_verifications;
create policy "Admins/assigned counsellor can write recommendation verifications"
  on public.student_recommendation_verifications for all to authenticated
  using (
    public.is_admin_role(array['super_admin', 'admin'])
    or (
      public.is_admin_role(array['counsellor'])
      and (
        exists (
          select 1 from public.admin_student_meta m
          where m.student_user_id = student_recommendation_verifications.student_user_id
            and m.assigned_counsellor_id = public.current_counsellor_id()
        )
        or exists (
          select 1 from public.discovery_sessions ds
          where ds.student_user_id = student_recommendation_verifications.student_user_id
            and ds.assigned_counsellor_id = public.current_counsellor_id()
        )
      )
    )
  )
  with check (
    verified_by_counsellor_id = public.current_counsellor_id()
    and (
      public.is_admin_role(array['super_admin', 'admin'])
      or (
        public.is_admin_role(array['counsellor'])
        and (
          exists (
            select 1 from public.admin_student_meta m
            where m.student_user_id = student_recommendation_verifications.student_user_id
              and m.assigned_counsellor_id = public.current_counsellor_id()
          )
          or exists (
            select 1 from public.discovery_sessions ds
            where ds.student_user_id = student_recommendation_verifications.student_user_id
              and ds.assigned_counsellor_id = public.current_counsellor_id()
          )
        )
      )
    )
  );

-- NW07 (CC-26 revision 2; skipped when NW07 is not applied) ---------------------
do $nw07$
declare
  t text;
  v_prior text;
begin
  -- Act only while 0023's narrowed rule is in place (NW07 present, 0023 not yet
  -- rolled back); a re-run of this rollback is then a no-op here.
  if to_regprocedure('public.counsellor_has_case_access(uuid)') is null
     or not exists (select 1 from pg_proc where oid = to_regprocedure('public.counsellor_has_case_access(uuid)')
                    and prosrc like '%counsellor_has_active_session_for_student%') then
    return;
  end if;
  v_prior := coalesce(substring(coalesce(obj_description('public.counsellor_has_case_access(uuid)'::regprocedure, 'pg_proc'), '')
                                from '\[cc26-prior:([a-z]+)\]'), 'fallback');
  if v_prior = 'original' then
  -- NW07 PART 1 and counsellor_has_case_access, restored verbatim (insecure by design: this is the pre-0023 state).
  execute $nw07orig$create or replace function public.counsellor_has_case_access(p_student_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select
    exists (
      select 1 from public.admin_student_meta m
      where m.student_user_id = p_student_user_id and m.assigned_counsellor_id = public.current_counsellor_id()
    )
    or exists (
      select 1 from public.discovery_sessions ds
      where ds.student_user_id = p_student_user_id and ds.assigned_counsellor_id = public.current_counsellor_id()
    );
$$$nw07orig$;
  execute $nw07orig$comment on function public.counsellor_has_case_access(uuid) is
  'NW07 — true if the calling counsellor (current_counsellor_id()) has case access to this student under the dual-basis rule: a direct admin_student_meta assignment OR having run/been assigned one of their discovery_sessions. Does NOT itself check is_admin_role(''counsellor'') — callers combine this with that check, same as every other RLS/RPC predicate in this codebase. Used by PART 2''s RPCs below and available to any future policy that needs the same rule rather than re-deriving it.'$nw07orig$;
  execute $nw07orig$revoke execute on function public.counsellor_has_case_access(uuid) from public$nw07orig$;
  execute $nw07orig$grant execute on function public.counsellor_has_case_access(uuid) to authenticated$nw07orig$;
  -- Re-create NW07's effective ACL (Supabase default privileges) in its original order.
  execute 'revoke all on function public.counsellor_has_case_access(uuid) from anon, authenticated, service_role';
  execute 'grant execute on function public.counsellor_has_case_access(uuid) to anon, authenticated, service_role';
  -- If NW-F01 03 was applied meanwhile, keep its F7 search_path hardening.
  if to_regnamespace('nextwise_security') is not null then
    execute 'alter function public.counsellor_has_case_access(uuid) set search_path = pg_catalog, public, pg_temp';
    execute 'revoke all on function public.counsellor_has_case_access(uuid) from anon, service_role';
  end if;
  execute $nw07orig$drop policy if exists "Admins/assigned counsellor can read student profiles (m7)" on public.profiles$nw07orig$;
  execute $nw07orig$create policy "Admins/assigned counsellor can read student profiles (m7)"
  on public.profiles for select to authenticated
  using (
    public.is_admin_role(array['super_admin', 'admin', 'analyst'])
    or (
      public.is_admin_role(array['counsellor'])
      and (
        exists (
          select 1 from public.admin_student_meta m
          where m.student_user_id = profiles.id and m.assigned_counsellor_id = public.current_counsellor_id()
        )
        or exists (
          select 1 from public.discovery_sessions ds
          where ds.student_user_id = profiles.id and ds.assigned_counsellor_id = public.current_counsellor_id()
        )
      )
    )
  )$nw07orig$;
  foreach t in array array[
    'student_profiles', 'student_education', 'student_subject_strengths', 'student_interests',
    'student_skills', 'student_work_preferences', 'student_career_priorities', 'student_career_goals',
    'student_study_preferences', 'student_funding_preferences', 'student_experience'
  ]
  loop
    execute format(
      'drop policy if exists "Admins/assigned counsellor can read %1$s (m7)" on public.%1$s',
      t
    );
    execute format(
      $f$create policy "Admins/assigned counsellor can read %1$s (m7)"
        on public.%1$s for select to authenticated
        using (
          public.is_admin_role(array['super_admin', 'admin', 'analyst'])
          or (
            public.is_admin_role(array['counsellor'])
            and (
              exists (
                select 1 from public.admin_student_meta m
                where m.student_user_id = %1$s.user_id and m.assigned_counsellor_id = public.current_counsellor_id()
              )
              or exists (
                select 1 from public.discovery_sessions ds
                where ds.student_user_id = %1$s.user_id and ds.assigned_counsellor_id = public.current_counsellor_id()
              )
            )
          )
        )$f$,
      t
    );
  end loop;
  execute $nw07orig$drop policy if exists "Admins/assigned counsellor can read student meta" on public.admin_student_meta$nw07orig$;
  execute $nw07orig$create policy "Admins/assigned counsellor can read student meta"
  on public.admin_student_meta for select to authenticated
  using (
    public.is_admin_role(array['super_admin', 'admin', 'analyst'])
    or (
      public.is_admin_role(array['counsellor'])
      and (
        assigned_counsellor_id = public.current_counsellor_id()
        or exists (
          select 1 from public.discovery_sessions ds
          where ds.student_user_id = admin_student_meta.student_user_id and ds.assigned_counsellor_id = public.current_counsellor_id()
        )
      )
    )
  )$nw07orig$;
  execute $nw07orig$drop policy if exists "Admins/assigned counsellor can read student notes" on public.admin_student_notes$nw07orig$;
  execute $nw07orig$create policy "Admins/assigned counsellor can read student notes"
  on public.admin_student_notes for select to authenticated
  using (
    public.is_admin_role(array['super_admin', 'admin'])
    or (
      public.is_admin_role(array['counsellor'])
      and (
        exists (
          select 1 from public.admin_student_meta m
          where m.student_user_id = admin_student_notes.student_user_id and m.assigned_counsellor_id = public.current_counsellor_id()
        )
        or exists (
          select 1 from public.discovery_sessions ds
          where ds.student_user_id = admin_student_notes.student_user_id and ds.assigned_counsellor_id = public.current_counsellor_id()
        )
      )
    )
  )$nw07orig$;
  execute $nw07orig$drop policy if exists "Admins/assigned counsellor can add student notes" on public.admin_student_notes$nw07orig$;
  execute $nw07orig$create policy "Admins/assigned counsellor can add student notes"
  on public.admin_student_notes for insert to authenticated
  with check (
    author_user_id = auth.uid()
    and (
      public.is_admin_role(array['super_admin', 'admin'])
      or (
        public.is_admin_role(array['counsellor'])
        and (
          exists (
            select 1 from public.admin_student_meta m
            where m.student_user_id = admin_student_notes.student_user_id and m.assigned_counsellor_id = public.current_counsellor_id()
          )
          or exists (
            select 1 from public.discovery_sessions ds
            where ds.student_user_id = admin_student_notes.student_user_id and ds.assigned_counsellor_id = public.current_counsellor_id()
          )
        )
      )
    )
  )$nw07orig$;
  else
    -- Patched NW07 without 0023: caseload-only function and the 0004 policies.
    -- CC-26 caseload-only case access (NW07 without cc25/0023). Byte-identical in
    -- the patched NW07 PART 1 and the cc25/0023 rollback.
    execute $sql$
      create or replace function public.counsellor_has_case_access(p_student_user_id uuid)
      returns boolean
      language sql
      stable
      security definer
      set search_path = pg_catalog, public, pg_temp
      as $fn$
        select auth.uid() is not null and exists (
          select 1 from public.admin_student_meta m
          where m.student_user_id = p_student_user_id
            and m.assigned_counsellor_id = public.current_counsellor_id()
        );
      $fn$
    $sql$;
    execute $sql$
      comment on function public.counsellor_has_case_access(uuid) is
        'CC-26 — NW07 applied without cc25/0023: case access is the caseload assignment (admin_student_meta) only; a Discovery Session grants nothing. Applying cc25/0023 revision 2 adds the admin-approved active-session basis.'
    $sql$;
    execute 'revoke all on function public.counsellor_has_case_access(uuid) from public, anon, service_role';
    execute 'grant execute on function public.counsellor_has_case_access(uuid) to authenticated';
    -- 0004 counsellor policies, restored verbatim (caseload only).
    execute $p0004$drop policy if exists "Admins/assigned counsellor can read student profiles (m7)" on public.profiles$p0004$;
    execute $p0004$create policy "Admins/assigned counsellor can read student profiles (m7)"
  on public.profiles for select to authenticated
  using (
    public.is_admin_role(array['super_admin', 'admin', 'analyst'])
    or (
      public.is_admin_role(array['counsellor'])
      and exists (
        select 1 from public.admin_student_meta m
        where m.student_user_id = profiles.id and m.assigned_counsellor_id = public.current_counsellor_id()
      )
    )
  )$p0004$;
    execute $p0004$drop policy if exists "Admins/assigned counsellor can read student meta" on public.admin_student_meta$p0004$;
    execute $p0004$create policy "Admins/assigned counsellor can read student meta"
  on public.admin_student_meta for select to authenticated
  using (
    public.is_admin_role(array['super_admin', 'admin', 'analyst'])
    or (public.is_admin_role(array['counsellor']) and assigned_counsellor_id = public.current_counsellor_id())
  )$p0004$;
    execute $p0004$drop policy if exists "Admins/assigned counsellor can read student notes" on public.admin_student_notes$p0004$;
    execute $p0004$create policy "Admins/assigned counsellor can read student notes"
  on public.admin_student_notes for select to authenticated
  using (
    public.is_admin_role(array['super_admin', 'admin'])
    or (
      public.is_admin_role(array['counsellor'])
      and exists (
        select 1 from public.admin_student_meta m
        where m.student_user_id = admin_student_notes.student_user_id
          and m.assigned_counsellor_id = public.current_counsellor_id()
      )
    )
  )$p0004$;
    execute $p0004$drop policy if exists "Admins/assigned counsellor can add student notes" on public.admin_student_notes$p0004$;
    execute $p0004$create policy "Admins/assigned counsellor can add student notes"
  on public.admin_student_notes for insert to authenticated
  with check (
    author_user_id = auth.uid()
    and (
      public.is_admin_role(array['super_admin', 'admin'])
      or (
        public.is_admin_role(array['counsellor'])
        and exists (
          select 1 from public.admin_student_meta m
          where m.student_user_id = admin_student_notes.student_user_id
            and m.assigned_counsellor_id = public.current_counsellor_id()
        )
      )
    )
  )$p0004$;
    foreach t in array array[
      'student_profiles', 'student_education', 'student_subject_strengths', 'student_interests',
      'student_skills', 'student_work_preferences', 'student_career_priorities', 'student_career_goals',
      'student_study_preferences', 'student_funding_preferences', 'student_experience'
    ]
    loop
      execute format(
        'drop policy if exists "Admins/assigned counsellor can read %1$s (m7)" on public.%1$s',
        t
      );
      execute format(
        $f$create policy "Admins/assigned counsellor can read %1$s (m7)"
          on public.%1$s for select to authenticated
          using (
            public.is_admin_role(array['super_admin', 'admin', 'analyst'])
            or (
              public.is_admin_role(array['counsellor'])
              and exists (
                select 1 from public.admin_student_meta m
                where m.student_user_id = %1$s.user_id and m.assigned_counsellor_id = public.current_counsellor_id()
              )
            )
          )$f$,
        t
      );
    end loop;
  end if;
end
$nw07$;

-- Remove CC-25 objects ----------------------------------------------------------
drop function if exists public.admin_set_discovery_session_assignment_approval(uuid, uuid, boolean);
drop function if exists public.staff_discovery_session_student_identities(uuid[]);
drop function if exists public.counsellor_has_active_session_for_student(uuid);
drop function if exists public.counsellor_has_approved_session(uuid);
drop trigger if exists admin_student_meta_guard_cc25 on public.admin_student_meta;
drop function if exists public.admin_student_meta_guard_cc25();
drop trigger if exists discovery_sessions_guard_cc25 on public.discovery_sessions;
drop function if exists public.discovery_sessions_guard_cc25();
alter table public.discovery_sessions drop constraint if exists discovery_sessions_assignment_approval_consistency;
alter table public.discovery_sessions
  drop column if exists assignment_approved_at,
  drop column if exists assignment_approved_by,
  drop column if exists assignment_approved_counsellor_id;

do $post$
begin
  if to_regprocedure('public.staff_discovery_session_student_identities(uuid[])') is not null
     or exists (select 1 from information_schema.columns where table_schema = 'public'
                and table_name = 'discovery_sessions' and column_name like 'assignment_approved_%')
     or exists (select 1 from pg_trigger where tgname in ('discovery_sessions_guard_cc25', 'admin_student_meta_guard_cc25')) then
    raise exception 'CC25-0023 rollback postcondition failed: CC-25 objects remain';
  end if;
end
$post$;

-- Ask PostgREST to reload its schema cache (delivered at COMMIT) so the API
-- sees the changed functions immediately.
notify pgrst, 'reload schema';

commit;
