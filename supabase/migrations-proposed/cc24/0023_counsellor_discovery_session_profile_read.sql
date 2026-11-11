-- ============================================================================
-- CC-24 — Counsellor can read the identity of a student whose Discovery
-- Session is assigned to them.
--
-- STATUS: PROPOSED. Not applied to QA or production. Requires approval.
--
-- DEFECT
--   A counsellor assigned to a student's Discovery Session sees the session
--   (0013 "Admins/counsellors can read discovery sessions") but the student
--   shows as "Unnamed student" with no email: public.profiles only grants a
--   counsellor SELECT through admin_student_meta (0004 PART 12, "(m7)"
--   policy). A Discovery Session assignment is made by an admin on
--   discovery_sessions.assigned_counsellor_id and does not create an
--   admin_student_meta row, so profiles RLS silently returns no row.
--   0014 already recognised "assigned to this student's Discovery Session" as
--   a sufficient basis for two other tables (section provenance and
--   recommendation verifications) but did not extend it to profiles.
--
-- CHANGE (additive, read-only, one table)
--   Adds ONE new SELECT policy on public.profiles. Postgres ORs permissive
--   policies, so every existing policy keeps working exactly as before:
--     - students still read/update only their own row;
--     - admins/analysts and caseload counsellors keep their (m7) access.
--   The new policy grants a counsellor SELECT on a profile row only while a
--   discovery_sessions row for that student has
--   assigned_counsellor_id = current_counsellor_id().
--
-- WHAT IT DOES NOT DO
--   - No INSERT/UPDATE/DELETE rights on profiles for anyone.
--   - Unassigned Discovery Sessions do NOT reveal the student's identity to
--     counsellors (they can still see the request in the triage queue, as
--     today, but not name/email/phone until an admin assigns it to them).
--   - Reassignment removes access for the previous counsellor automatically
--     (the check is on the current assignment).
--   - student_* onboarding tables stay caseload-only (admin_student_meta);
--     the Discovery Session workspace reads only profiles for identity.
--   - No table, column, function, trigger or data change.
--
-- Safe to re-run (drop policy if exists before create policy).
-- ============================================================================

drop policy if exists "Assigned DS counsellor can read student profile (cc24)" on public.profiles;
create policy "Assigned DS counsellor can read student profile (cc24)"
  on public.profiles for select to authenticated
  using (
    public.is_admin_role(array['counsellor'])
    and exists (
      select 1 from public.discovery_sessions ds
      where ds.student_user_id = profiles.id
        and ds.assigned_counsellor_id is not null
        and ds.assigned_counsellor_id = public.current_counsellor_id()
    )
  );

comment on policy "Assigned DS counsellor can read student profile (cc24)" on public.profiles is
  'CC-24: a counsellor may read the identity row of a student whose Discovery Session is currently assigned to them. Additive to the (m7) caseload policy; read-only.';
