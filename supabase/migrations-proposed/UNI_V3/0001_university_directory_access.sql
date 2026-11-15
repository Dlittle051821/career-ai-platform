-- ============================================================================
-- UNI_V3 / 0001 — University Discovery V3: database-level access rules
-- STATUS: PROPOSED. Not applied anywhere. Not yet run against any database.
--         Needs the protocol §5 review: schema review, QA run on a replica,
--         authorization tests, rollout plan, owner approval.
-- Rollback: 0001_university_directory_access.rollback.sql (restores the
--           original 0006 policies exactly).
--
-- WHY
--   The application now decides access on the server (commit "University
--   Discovery V3 (1/n)"): anonymous and free accounts get official public
--   portals only; Verified students and staff get the university directory;
--   internal programme (course) records are staff-only. That rule is enforced
--   in the app's data layer. It is NOT yet enforced by the database: today
--   the 0006 policies let `anon` and every `authenticated` user SELECT every
--   published university, campus, course, intake, fee, admission requirement
--   and scholarship directly through the REST API with the publishable key.
--   This migration closes that path.
--
-- WHAT IT DOES
--   1. Adds public.has_university_directory_access(): true for any admin role,
--      or for a student holding a purchase of a qualifying plan
--      (nextwise-verified, nextwise-essential) whose invoice status is 'paid'.
--      Same rule as src/lib/education/university-discovery/access.ts.
--   2. universities, campuses, university-scope scholarships: replaces the
--      public read policy with one that requires that function.
--   3. courses, course_intakes, course_tuition_fees,
--      course_admission_requirements, course-scope scholarships: removes the
--      public read policy. Staff keep their existing "Any admin can read ..."
--      policies, which this file does not touch.
--
-- REVIEW POINTS BEFORE APPLYING (not resolved here)
--   a. Student application pages, saved courses, shares and intake interests
--      read course rows through the student's own session. After this
--      migration those reads return nothing. Decide per feature: retire it for
--      students, or serve the few needed fields through a narrow
--      SECURITY DEFINER function scoped to the student's own application.
--   b. education_saved_items rows of entity_type 'course' remain; they simply
--      resolve to nothing. No data is deleted.
--   c. The sitemap no longer lists university or course URLs (already true in
--      the app after V3).
--   d. Confirm on a replica that no trigger or RPC called by anon depends on
--      the removed policies.
-- ============================================================================

begin;

create or replace function public.has_university_directory_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    auth.uid() is not null
    and (
      exists (select 1 from public.admin_roles ar where ar.user_id = auth.uid())
      or exists (
        select 1
        from public.pricing_purchases pp
        join public.pricing_plans pl on pl.id = pp.plan_id
        join public.invoices inv on inv.id = pp.invoice_id
        where pp.student_user_id = auth.uid()
          and pl.slug in ('nextwise-verified', 'nextwise-essential')
          and inv.status = 'paid'
      )
    );
$$;

comment on function public.has_university_directory_access() is
  'UNI_V3 — true when the caller is staff (any admin_roles row) or a student with a PAID purchase of a plan that includes the university directory. Used only by SELECT policies on universities, campuses and university-scope scholarships. Never grants course access.';

revoke all on function public.has_university_directory_access() from public;
grant execute on function public.has_university_directory_access() to authenticated;

-- 2. Institution-level records: Verified students and staff only.
drop policy if exists "Public can read published active universities" on public.universities;
drop policy if exists "Verified students can read published active universities" on public.universities;
create policy "Verified students can read published active universities"
  on public.universities for select to authenticated
  using (is_active = true and publication_status = 'published' and public.has_university_directory_access());

drop policy if exists "Public can read campuses of published active universities" on public.campuses;
drop policy if exists "Verified students can read campuses of published active universities" on public.campuses;
create policy "Verified students can read campuses of published active universities"
  on public.campuses for select to authenticated
  using (
    is_active = true
    and public.has_university_directory_access()
    and exists (select 1 from public.universities u where u.id = campuses.university_id and u.is_active = true and u.publication_status = 'published')
  );

drop policy if exists "Public can read active scholarships of published records" on public.scholarships;
drop policy if exists "Verified students can read university scholarships" on public.scholarships;
create policy "Verified students can read university scholarships"
  on public.scholarships for select to authenticated
  using (
    is_active = true
    and scope = 'university'
    and public.has_university_directory_access()
    and exists (select 1 from public.universities u where u.id = scholarships.university_id and u.is_active = true and u.publication_status = 'published')
  );

-- 3. Programme-level records: no student read path at all.
drop policy if exists "Public can read published active courses of published unis" on public.courses;
drop policy if exists "Public can read intakes of published active courses" on public.course_intakes;
drop policy if exists "Public can read tuition fees of published active courses" on public.course_tuition_fees;
drop policy if exists "Public can read admission requirements of published courses" on public.course_admission_requirements;

commit;

-- Verification to run on the replica after applying (expected results in comments):
--   set role anon;            select count(*) from public.universities;  -- 0
--   set role anon;            select count(*) from public.courses;       -- 0
--   as a free student JWT:    select count(*) from public.universities;  -- 0
--   as a Verified (paid) JWT: select count(*) from public.universities;  -- published count
--   as a Verified (paid) JWT: select count(*) from public.courses;       -- 0
--   as an admin JWT:          select count(*) from public.courses;       -- all rows
