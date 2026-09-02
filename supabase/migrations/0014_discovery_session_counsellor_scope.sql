-- ============================================================================
-- Milestone 11-B2 — Discovery Session Counsellor Workspace: counsellor RLS
-- scope correction for student_profile_section_provenance and
-- student_recommendation_verifications.
--
-- HOW TO RUN THIS (no SQL knowledge required):
--   1. Open your Supabase project dashboard (supabase.com/dashboard).
--   2. Click "SQL Editor" in the left sidebar.
--   3. Click "New query".
--   4. Paste the entire contents of this file.
--   5. Click "Run".
--
-- Safe to run once. Re-running is also safe (DROP POLICY IF EXISTS before
-- CREATE POLICY throughout; no table/column changes at all in this file).
--
-- WHY THIS EXISTS (a design gap found while building M11-B2, fixed with a
-- new additive migration rather than editing 0013 after it already
-- shipped — same "never rewrite a migration once committed" discipline
-- this codebase follows everywhere else):
--
-- 0013 PART 4/5 scoped a counsellor's write access to student_profile_
-- section_provenance/student_recommendation_verifications through
-- admin_student_meta.assigned_counsellor_id (mirroring admin_student_
-- notes' existing pattern). But admin_student_meta only accepts an INSERT
-- from super_admin/admin (0004_admin_system.sql PART 4's "Admins can
-- insert student meta" policy) — a counsellor can never become a
-- student's admin_student_meta-assigned counsellor by themselves. That
-- makes the realistic Discovery Session flow impossible under 0013's
-- policies alone: a counsellor who is legitimately running a student's
-- (unassigned-in-admin_student_meta) Discovery Session would have no way
-- to record what they learned against that student's profile.
--
-- Rather than loosening admin_student_meta's own INSERT policy (a
-- deliberate Milestone 7 security decision this milestone has no mandate
-- to revisit), this migration widens ONLY the two M11-C policies to ALSO
-- accept a counsellor who is discovery_sessions.assigned_counsellor_id for
-- SOME Discovery Session belonging to that student — i.e., "you ran (or
-- are running) this student's Discovery Session" is its own, independent,
-- sufficient basis for provenance/verification access, on top of (not
-- instead of) the existing admin_student_meta-assignment basis.
-- ============================================================================

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

-- ============================================================================
-- Verification queries (run manually after applying this migration):
--
-- 1) Confirm both tables still have exactly one read + one write policy for
--    "authenticated" (no duplicate/orphaned policy left behind):
--      select tablename, policyname, cmd from pg_policies
--      where tablename in ('student_profile_section_provenance', 'student_recommendation_verifications')
--      order by tablename, cmd;
--
-- 2) As a counsellor who is discovery_sessions.assigned_counsellor_id for a
--    student but NOT admin_student_meta.assigned_counsellor_id for them,
--    confirm an insert into student_profile_section_provenance for that
--    student now succeeds (it would have been rejected under 0013 alone).
-- ============================================================================
