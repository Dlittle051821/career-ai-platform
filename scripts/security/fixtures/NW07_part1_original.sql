-- FIXTURE (CC-26 tests only, never apply): the ORIGINAL NW07 PART 1 and
-- counsellor_has_case_access as committed at 706df7d, i.e. the state QA is
-- recorded to have. scripts/security/cc26-security-closure.db.test.mjs splices
-- it into the patched NW07 to rebuild that state.
drop policy if exists "Admins/assigned counsellor can read student profiles (m7)" on public.profiles;
create policy "Admins/assigned counsellor can read student profiles (m7)"
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
  );

do $$
declare
  t text;
begin
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
end $$;

drop policy if exists "Admins/assigned counsellor can read student meta" on public.admin_student_meta;
create policy "Admins/assigned counsellor can read student meta"
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
  );
-- INSERT/UPDATE policies on admin_student_meta are UNCHANGED (still
-- super_admin/admin-only for insert; update still requires the STRONGER
-- admin_student_meta-assignment basis, not the discovery-session one) — see
-- this file's PART 1 header comment for why that asymmetry is deliberate.

drop policy if exists "Admins/assigned counsellor can read student notes" on public.admin_student_notes;
create policy "Admins/assigned counsellor can read student notes"
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
  );

drop policy if exists "Admins/assigned counsellor can add student notes" on public.admin_student_notes;
create policy "Admins/assigned counsellor can add student notes"
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
  );

-- Helper for PART 2 and for the application layer: true if the CALLING
-- counsellor has case access to this student under the dual-basis rule
-- above. SECURITY DEFINER + STABLE, same shape as current_counsellor_id()/
-- is_admin_role() — a single, reusable building block rather than repeating
-- this EXISTS/OR five times across every new RPC below.
create or replace function public.counsellor_has_case_access(p_student_user_id uuid)
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
$$;

comment on function public.counsellor_has_case_access(uuid) is
  'NW07 — true if the calling counsellor (current_counsellor_id()) has case access to this student under the dual-basis rule: a direct admin_student_meta assignment OR having run/been assigned one of their discovery_sessions. Does NOT itself check is_admin_role(''counsellor'') — callers combine this with that check, same as every other RLS/RPC predicate in this codebase. Used by PART 2''s RPCs below and available to any future policy that needs the same rule rather than re-deriving it.';

revoke execute on function public.counsellor_has_case_access(uuid) from public;
grant execute on function public.counsellor_has_case_access(uuid) to authenticated;