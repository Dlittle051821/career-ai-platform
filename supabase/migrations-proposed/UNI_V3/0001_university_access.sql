-- ============================================================================
-- UNI_V3 / 0001 — University Discovery V3: access rules at the database level
-- STATUS: PROPOSED. Tested only on a disposable local database (see
--         docs/university-discovery-v3/TEST-REPORT.md). Never applied to
--         staging or production. Requires owner approval before any use.
-- Rollback: 0001_university_access.rollback.sql
--
-- Contents
--   A. university_access_grants   — admin-controlled Verified access, audited
--   B. grant / revoke functions   — the only write path, admin-only
--   C. has_university_directory_access()
--   D. Read policies              — universities, campuses, scholarships:
--                                   Verified students and staff only
--                                   courses and their child tables: staff only
--   E. Narrow student read paths  — names for a student's OWN applications and
--                                   OWN saved courses (so existing records keep
--                                   working without reopening the catalogue)
-- No table, row or existing staff policy is deleted. Purchases stay immutable.
-- ============================================================================

begin;

-- ---------------------------------------------------------------- A. grants
create table if not exists public.university_access_grants (
  id uuid primary key default gen_random_uuid(),
  student_user_id uuid not null references auth.users (id) on delete cascade,
  scope text not null default 'university_directory',
  reason text not null,
  granted_by uuid references auth.users (id) on delete set null,
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid references auth.users (id) on delete set null,
  revoke_reason text,
  constraint university_access_grants_scope_check check (scope in ('university_directory')),
  constraint university_access_grants_reason_check check (char_length(btrim(reason)) between 5 and 500),
  constraint university_access_grants_expiry_check check (expires_at is null or expires_at > granted_at),
  constraint university_access_grants_revoke_check check (
    (revoked_at is null and revoked_by is null and revoke_reason is null)
    or (revoked_at is not null and revoke_reason is not null and char_length(btrim(revoke_reason)) between 5 and 500)
  )
);
create index if not exists university_access_grants_student_idx on public.university_access_grants (student_user_id);
-- At most one grant that has not been revoked per student and scope.
create unique index if not exists university_access_grants_one_open_idx
  on public.university_access_grants (student_user_id, scope) where revoked_at is null;

comment on table public.university_access_grants is
  'UNI_V3 — Verified university-directory access granted by an administrator while online purchase is switched off. One row per grant; a revocation stamps the same row and is never deleted. Written only by grant_university_access() / revoke_university_access(). Scope is deliberately a single value: it grants the university directory and nothing else (never course records, never an admin role).';

alter table public.university_access_grants enable row level security;

drop policy if exists "Students can read their own university access grants" on public.university_access_grants;
create policy "Students can read their own university access grants"
  on public.university_access_grants for select to authenticated
  using (auth.uid() = student_user_id);

drop policy if exists "super_admin/admin can read university access grants" on public.university_access_grants;
create policy "super_admin/admin can read university access grants"
  on public.university_access_grants for select to authenticated
  using (public.is_admin_role(array['super_admin', 'admin']));

-- No insert/update/delete policy for anyone, and no table privileges beyond SELECT.
revoke all on public.university_access_grants from anon, authenticated;
grant select on public.university_access_grants to authenticated;

-- ------------------------------------------------- B. grant / revoke (admin)
create or replace function public.grant_university_access(p_student_user_id uuid, p_reason text, p_expires_at timestamptz default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if auth.uid() is null or not public.is_admin_role(array['super_admin', 'admin']) then
    raise exception 'Only a super_admin or admin can grant university access.' using errcode = '42501';
  end if;
  if p_student_user_id is null or not exists (select 1 from auth.users u where u.id = p_student_user_id) then
    raise exception 'Student account not found.' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.admin_roles ar where ar.user_id = p_student_user_id) then
    raise exception 'Staff accounts already have access; a grant is for student accounts only.' using errcode = '22023';
  end if;
  if char_length(v_reason) < 5 or char_length(v_reason) > 500 then
    raise exception 'A reason of 5 to 500 characters is required.' using errcode = '22023';
  end if;
  if p_expires_at is not null and p_expires_at <= now() then
    raise exception 'The expiry must be in the future.' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.university_access_grants g
    where g.student_user_id = p_student_user_id and g.scope = 'university_directory' and g.revoked_at is null
      and (g.expires_at is null or g.expires_at > now())
  ) then
    raise exception 'This student already has an active grant.' using errcode = '23505';
  end if;

  -- An expired, never-revoked grant is closed first so the one-open-grant index stays truthful.
  update public.university_access_grants g
     set revoked_at = now(), revoked_by = auth.uid(), revoke_reason = 'Closed automatically: expired before a new grant was issued.'
   where g.student_user_id = p_student_user_id and g.scope = 'university_directory' and g.revoked_at is null;

  insert into public.university_access_grants (student_user_id, scope, reason, granted_by, expires_at)
  values (p_student_user_id, 'university_directory', v_reason, auth.uid(), p_expires_at)
  returning id into v_id;

  insert into public.admin_audit_log (actor_user_id, actor_role, action, entity_type, entity_id, summary, changes, context)
  values (auth.uid(), public.current_admin_role(), 'university_access_granted', 'university_access_grant', v_id::text,
          'Granted Verified university directory access',
          jsonb_build_object('scope', 'university_directory', 'expires_at', p_expires_at),
          jsonb_build_object('student_user_id', p_student_user_id, 'reason', v_reason));
  return v_id;
end;
$$;

create or replace function public.revoke_university_access(p_grant_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student uuid;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if auth.uid() is null or not public.is_admin_role(array['super_admin', 'admin']) then
    raise exception 'Only a super_admin or admin can revoke university access.' using errcode = '42501';
  end if;
  if char_length(v_reason) < 5 or char_length(v_reason) > 500 then
    raise exception 'A reason of 5 to 500 characters is required.' using errcode = '22023';
  end if;
  update public.university_access_grants g
     set revoked_at = now(), revoked_by = auth.uid(), revoke_reason = v_reason
   where g.id = p_grant_id and g.revoked_at is null
  returning g.student_user_id into v_student;
  if v_student is null then
    raise exception 'Grant not found or already revoked.' using errcode = 'P0002';
  end if;
  insert into public.admin_audit_log (actor_user_id, actor_role, action, entity_type, entity_id, summary, changes, context)
  values (auth.uid(), public.current_admin_role(), 'university_access_revoked', 'university_access_grant', p_grant_id::text,
          'Revoked Verified university directory access', null,
          jsonb_build_object('student_user_id', v_student, 'reason', v_reason));
end;
$$;

revoke all on function public.grant_university_access(uuid, text, timestamptz) from public, anon;
revoke all on function public.revoke_university_access(uuid, text) from public, anon;
grant execute on function public.grant_university_access(uuid, text, timestamptz) to authenticated;
grant execute on function public.revoke_university_access(uuid, text) to authenticated;

-- ------------------------------------------------------------ C. the rule
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
      or exists (
        select 1 from public.university_access_grants g
        where g.student_user_id = auth.uid() and g.scope = 'university_directory'
          and g.revoked_at is null and (g.expires_at is null or g.expires_at > now())
      )
    );
$$;
comment on function public.has_university_directory_access() is
  'UNI_V3 — true for staff (any admin_roles row), a student with a PAID purchase of a plan that includes the directory, or a student with an active admin grant. Mirrors src/lib/education/university-discovery/access.ts. Never grants course access.';
revoke all on function public.has_university_directory_access() from public, anon;
grant execute on function public.has_university_directory_access() to authenticated;

-- ------------------------------------------------------------ D. policies
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

drop policy if exists "Public can read published active courses of published unis" on public.courses;
drop policy if exists "Public can read intakes of published active courses" on public.course_intakes;
drop policy if exists "Public can read tuition fees of published active courses" on public.course_tuition_fees;
drop policy if exists "Public can read admission requirements of published courses" on public.course_admission_requirements;

-- The anonymous role needs no privilege at all on catalogue tables.
revoke all on public.universities, public.campuses, public.scholarships, public.courses,
  public.course_intakes, public.course_tuition_fees, public.course_admission_requirements from anon;

-- ------------------------------------------- E. narrow student read paths
create or replace function public.get_my_application_labels()
returns table (
  application_id uuid,
  university_id uuid,
  university_name text,
  country_name text,
  course_id uuid,
  course_name text,
  course_intake_id uuid,
  intake_name text,
  priority_deadline date,
  final_deadline date,
  international_deadline date
)
language sql
stable
security definer
set search_path = public
as $$
  select a.id, u.id, u.name, co.name, c.id, c.name, ci.id, ci.intake_name,
         ci.priority_deadline, ci.final_deadline, ci.international_deadline
  from public.applications a
  left join public.universities u on u.id = a.university_id
  left join public.countries co on co.id = u.country_id
  left join public.courses c on c.id = a.course_id
  left join public.course_intakes ci on ci.id = a.course_intake_id
  where a.student_user_id = auth.uid();
$$;
comment on function public.get_my_application_labels() is
  'UNI_V3 — names and intake deadlines for the caller''s OWN applications only, so existing applications keep their labels after catalogue reads are closed. Identity comes from auth.uid(); no parameters. Returns names and dates only, never fees, requirements or internal fields.';

create or replace function public.get_my_saved_course_labels()
returns table (course_id uuid, course_name text, university_name text, official_url text, saved_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.name, u.name, coalesce(c.course_url, u.website), s.created_at
  from public.education_saved_items s
  join public.courses c on c.id = s.entity_id
  join public.universities u on u.id = c.university_id
  where s.student_user_id = auth.uid() and s.entity_type = 'course'
    and c.is_active = true and c.publication_status = 'published'
    and u.is_active = true and u.publication_status = 'published'
  order by s.created_at desc
  limit 200;
$$;
comment on function public.get_my_saved_course_labels() is
  'UNI_V3 — title, institution and official link for courses the caller saved BEFORE the course database became staff-only, so the saved list can point each one to its official page. Names and one public URL only.';

revoke all on function public.get_my_application_labels() from public, anon;
revoke all on function public.get_my_saved_course_labels() from public, anon;
grant execute on function public.get_my_application_labels() to authenticated;
grant execute on function public.get_my_saved_course_labels() to authenticated;

commit;

-- Ask the API layer to re-read the schema so the change is visible at once.
notify pgrst, 'reload schema';
