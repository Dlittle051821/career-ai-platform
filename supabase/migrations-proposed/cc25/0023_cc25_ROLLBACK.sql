-- ============================================================================
-- ROLLBACK for 0023_cc25_counsellor_identity_least_privilege.sql
--
-- Restores the exact pre-CC-25 state: the 0013 PART 3 workspace policies and
-- the 0014 provenance/verification policies (verbatim), and removes every
-- CC-25 object (triggers, functions, approval columns and constraint).
--
-- CONSEQUENCES (read before running):
--   - Approval decisions recorded in the three assignment_approved_* columns
--     are discarded (their audit trail stays in admin_audit_log).
--   - The pre-CC-25 weaknesses return: self-claimed / historical / hijacked
--     assignments grant workspace, provenance and verification access again,
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
