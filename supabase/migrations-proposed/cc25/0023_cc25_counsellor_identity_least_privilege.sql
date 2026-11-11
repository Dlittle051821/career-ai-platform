-- ============================================================================
-- CC-25 — Least-privilege counsellor access to Discovery Session students
--
-- STATUS: PROPOSED. Not applied to QA or production. Needs explicit approval.
-- Replaces the REJECTED CC-24 proposal
-- supabase/migrations-proposed/cc24/0023_counsellor_discovery_session_profile_read.sql
-- (that file must never be applied).
--
-- WHAT IT FIXES
--   F1  "Unnamed student": an assigned counsellor could not see who they are
--       meeting. Fixed WITHOUT widening public.profiles: a narrow, hardened
--       RPC returns only session id, student id, full name and email.
--   F2  Self-claim = access: a counsellor could assign an unassigned session
--       to themselves and immediately gain the student's section provenance,
--       recommendation verifications and the session workspace (0013/0014).
--       Now every session-based right requires an assignment APPROVED by an
--       admin, recorded by the database (never trusted from the browser).
--   F3  student_user_id hijack: a counsellor could change student_user_id on
--       a session they hold (and on their admin_student_meta caseload row) and
--       so obtain another student's data. student_user_id is now immutable on
--       both tables, for every role.
--   F4  Historical access: completed / cancelled / no-show sessions kept
--       granting student-level access. Student-level session rights now need
--       an ACTIVE (requested or scheduled) approved assignment.
--   F5  Inactive counsellors kept session-based access. Session-based checks
--       now require counsellors.is_active.
--
-- WHAT IT DOES NOT CHANGE
--   - public.profiles RLS (no new or changed policy).
--   - Caseload (admin_student_meta) access paths: unchanged.
--   - Admin rights; student booking (insert) rights; the counsellor triage
--     queue (counsellors still see and may claim unassigned requests — a claim
--     simply grants nothing until an admin approves it).
--   - No data is backfilled: assignments that exist before this migration are
--     UNAPPROVED until an admin approves them (one click, audited).
--
-- APPLY (QA only, after approval):
--   select set_config('nextwise.cc25_0023_approval', 'APPROVED-QA-ynwzijulzksmrcwdhudv', false);
--   then run this whole file in ONE execution. It is atomic (BEGIN/COMMIT),
--   re-runnable, checks its preconditions and postconditions, and aborts
--   with no change if any check fails.
-- ROLLBACK: 0023_cc25_ROLLBACK.sql (restores the exact 0013/0014 state).
-- ============================================================================

begin;
set local lock_timeout = '5s';
set local statement_timeout = '120s';

-- ---------------------------------------------------------------------------
-- 0. Operator approval and preconditions (fail closed)
-- ---------------------------------------------------------------------------
do $pre$
declare
  v_approval text := coalesce(current_setting('nextwise.cc25_0023_approval', true), '');
begin
  if v_approval not in ('APPROVED-QA-ynwzijulzksmrcwdhudv', 'LOCAL-DISPOSABLE-TEST') then
    raise exception 'CC25-0023 refused: set nextwise.cc25_0023_approval to the approved value first. Production is never an approved target.';
  end if;
  if to_regclass('public.discovery_sessions') is null
     or to_regclass('public.discovery_session_workspace') is null
     or to_regclass('public.student_profile_section_provenance') is null
     or to_regclass('public.student_recommendation_verifications') is null
     or to_regclass('public.counsellors') is null
     or to_regclass('public.admin_student_meta') is null
     or to_regclass('public.profiles') is null
     or to_regclass('public.admin_audit_log') is null
     or to_regclass('public.discovery_sessions_one_active_per_student') is null then
    raise exception 'CC25-0023 refused: migrations 0001-0015 are not all present.';
  end if;
  if to_regprocedure('public.is_admin_role(text[])') is null
     or to_regprocedure('public.current_counsellor_id()') is null
     or to_regprocedure('public.record_admin_audit_log(text,text,text,text,jsonb,jsonb)') is null
     or to_regprocedure('auth.uid()') is null then
    raise exception 'CC25-0023 refused: required helper functions are missing.';
  end if;
  -- Expected state: exactly 0014 (first run) or exactly CC-25 0023 (re-run).
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'student_profile_section_provenance'
      and policyname = 'Admins/assigned counsellor can write section provenance'
      and (with_check like '%discovery_sessions%'
           or with_check like '%counsellor_has_active_session_for_student%')
  ) then
    raise exception 'CC25-0023 refused: migration 0014 is not in the expected state (drift).';
  end if;
end
$pre$;

-- The rejected CC-24 policy must never survive (no-op when it was never applied).
drop policy if exists "Assigned DS counsellor can read student profile (cc24)" on public.profiles;

-- ---------------------------------------------------------------------------
-- 1. Database-controlled assignment approval
-- ---------------------------------------------------------------------------
alter table public.discovery_sessions
  add column if not exists assignment_approved_counsellor_id uuid references public.counsellors (id) on delete set null,
  add column if not exists assignment_approved_by uuid references auth.users (id) on delete set null,
  add column if not exists assignment_approved_at timestamptz;

comment on column public.discovery_sessions.assignment_approved_counsellor_id is
  'CC-25 — the counsellor whose assignment an admin approved. Session-based rights exist only while this equals assigned_counsellor_id. Written only by the guard trigger / admin approval RPC.';
comment on column public.discovery_sessions.assignment_approved_by is
  'CC-25 — admin user who approved the current assignment (stamped by the database from auth.uid(), never from the request body).';
comment on column public.discovery_sessions.assignment_approved_at is
  'CC-25 — when the current assignment was approved (stamped by the database).';

alter table public.discovery_sessions drop constraint if exists discovery_sessions_assignment_approval_consistency;
alter table public.discovery_sessions add constraint discovery_sessions_assignment_approval_consistency check (
  (assignment_approved_counsellor_id is null and assignment_approved_at is null and assignment_approved_by is null)
  or (assignment_approved_counsellor_id is not null
      and assignment_approved_at is not null
      and assignment_approved_counsellor_id = assigned_counsellor_id)
);

-- ---------------------------------------------------------------------------
-- 2. Guard trigger: immutable student, admin-only approval, inert self-claims
-- ---------------------------------------------------------------------------
create or replace function public.discovery_sessions_guard_cc25()
returns trigger
language plpgsql
set search_path = ''
as $fn$
declare
  v_uid uuid := auth.uid();
  v_privileged boolean := auth.uid() is null and current_user not in ('anon', 'authenticated');
  v_is_admin boolean := auth.uid() is not null and public.is_admin_role(array['super_admin', 'admin']);
  v_cid uuid;
  v_assignment_changed boolean;
  v_approval_touched boolean;
  v_ignore text[] := array['updated_at'];
begin
  if tg_op = 'INSERT' then
    if v_is_admin and new.assigned_counsellor_id is not null then
      new.assignment_approved_counsellor_id := new.assigned_counsellor_id;
      new.assignment_approved_by := v_uid;
      new.assignment_approved_at := now();
    elsif v_privileged and new.assignment_approved_counsellor_id is not null then
      new.assignment_approved_at := coalesce(new.assignment_approved_at, now());
    else
      new.assignment_approved_counsellor_id := null;
      new.assignment_approved_by := null;
      new.assignment_approved_at := null;
    end if;
    return new;
  end if;

  -- UPDATE ------------------------------------------------------------------
  if new.id is distinct from old.id or new.student_user_id is distinct from old.student_user_id then
    raise exception 'The student attached to a Discovery Session cannot be changed.' using errcode = '42501';
  end if;

  v_assignment_changed := new.assigned_counsellor_id is distinct from old.assigned_counsellor_id;
  v_approval_touched := new.assignment_approved_counsellor_id is distinct from old.assignment_approved_counsellor_id
    or new.assignment_approved_by is distinct from old.assignment_approved_by
    or new.assignment_approved_at is distinct from old.assignment_approved_at;

  if not (v_is_admin or v_privileged) then
    -- Counsellor (or any other non-admin JWT holder that RLS let through).
    if v_approval_touched and new.assignment_approved_counsellor_id is not null then
      raise exception 'Only an admin can approve a Discovery Session assignment.' using errcode = '42501';
    end if;
    v_cid := public.current_counsellor_id();
    if not (
      v_cid is not null
      and old.assigned_counsellor_id = v_cid
      and old.assignment_approved_counsellor_id = v_cid
      and old.assignment_approved_at is not null
    ) then
      -- Not approved for this counsellor: only a no-op or a pure claim of an
      -- unassigned request is allowed. The claim grants nothing by itself.
      if (to_jsonb(new) - v_ignore) <> (to_jsonb(old) - v_ignore) and not (
        old.assigned_counsellor_id is null
        and v_cid is not null
        and new.assigned_counsellor_id = v_cid
        and (to_jsonb(new) - (v_ignore || array['assigned_counsellor_id']))
            = (to_jsonb(old) - (v_ignore || array['assigned_counsellor_id']))
      ) then
        raise exception 'This Discovery Session assignment has not been approved by an admin. You can only claim an unassigned request.'
          using errcode = '42501';
      end if;
    end if;
  end if;

  if v_assignment_changed then
    if v_is_admin and new.assigned_counsellor_id is not null then
      -- An admin choosing the counsellor IS the approval.
      new.assignment_approved_counsellor_id := new.assigned_counsellor_id;
      new.assignment_approved_by := v_uid;
      new.assignment_approved_at := now();
    elsif v_privileged and v_approval_touched and new.assigned_counsellor_id is not null
          and new.assignment_approved_counsellor_id is not distinct from new.assigned_counsellor_id then
      new.assignment_approved_at := coalesce(new.assignment_approved_at, now());
    else
      -- Reassignment, unassignment or self-claim: any earlier approval lapses.
      new.assignment_approved_counsellor_id := null;
      new.assignment_approved_by := null;
      new.assignment_approved_at := null;
    end if;
  elsif v_approval_touched then
    if new.assignment_approved_counsellor_id is null then
      new.assignment_approved_by := null;
      new.assignment_approved_at := null;
    elsif new.assignment_approved_counsellor_id is distinct from new.assigned_counsellor_id then
      raise exception 'An approval must name the currently assigned counsellor.' using errcode = '22023';
    elsif v_is_admin then
      new.assignment_approved_by := v_uid;
      new.assignment_approved_at := now();
    else
      new.assignment_approved_at := coalesce(new.assignment_approved_at, now());
    end if;
  end if;

  return new;
end
$fn$;

comment on function public.discovery_sessions_guard_cc25() is
  'CC-25 — BEFORE INSERT/UPDATE guard on discovery_sessions: student_user_id is immutable; only admins (or privileged server roles without a user JWT) can approve an assignment; an admin assigning a counsellor approves it; any other assignment change clears the approval; a counsellor whose assignment is not approved may only claim an unassigned request (or submit a no-op).';

drop trigger if exists discovery_sessions_guard_cc25 on public.discovery_sessions;
create trigger discovery_sessions_guard_cc25
  before insert or update on public.discovery_sessions
  for each row execute function public.discovery_sessions_guard_cc25();

-- Caseload rows: the student on a caseload record is immutable as well.
create or replace function public.admin_student_meta_guard_cc25()
returns trigger
language plpgsql
set search_path = ''
as $fn$
begin
  if new.student_user_id is distinct from old.student_user_id then
    raise exception 'The student on a caseload record cannot be changed.' using errcode = '42501';
  end if;
  return new;
end
$fn$;

comment on function public.admin_student_meta_guard_cc25() is
  'CC-25 — BEFORE UPDATE guard on admin_student_meta: student_user_id is immutable (closes a caseload hijack where a counsellor could repoint their own caseload row at any student).';

drop trigger if exists admin_student_meta_guard_cc25 on public.admin_student_meta;
create trigger admin_student_meta_guard_cc25
  before update on public.admin_student_meta
  for each row execute function public.admin_student_meta_guard_cc25();

-- ---------------------------------------------------------------------------
-- 3. Session-based access predicates (SECURITY DEFINER, empty search_path)
-- ---------------------------------------------------------------------------
create or replace function public.counsellor_has_approved_session(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select auth.uid() is not null and exists (
    select 1
    from public.discovery_sessions s
    join public.counsellors c on c.id = s.assigned_counsellor_id
    where s.id = p_session_id
      and c.user_id = auth.uid()
      and c.is_active
      and s.assignment_approved_counsellor_id = s.assigned_counsellor_id
      and s.assignment_approved_at is not null
  );
$fn$;

comment on function public.counsellor_has_approved_session(uuid) is
  'CC-25 — true when the calling user is the active counsellor holding an admin-approved assignment of this Discovery Session (any status). Session-level rights (the workspace).';

create or replace function public.counsellor_has_active_session_for_student(p_student_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select auth.uid() is not null and exists (
    select 1
    from public.discovery_sessions s
    join public.counsellors c on c.id = s.assigned_counsellor_id
    where s.student_user_id = p_student_user_id
      and c.user_id = auth.uid()
      and c.is_active
      and s.assignment_approved_counsellor_id = s.assigned_counsellor_id
      and s.assignment_approved_at is not null
      and s.status in ('requested', 'scheduled')
  );
$fn$;

comment on function public.counsellor_has_active_session_for_student(uuid) is
  'CC-25 — true when the calling user is the active counsellor holding an admin-approved assignment of an ACTIVE (requested/scheduled) Discovery Session for this student. Student-level session rights (provenance, verifications). Completed, cancelled and no-show sessions grant nothing; long-term access is the caseload (admin_student_meta).';

-- ---------------------------------------------------------------------------
-- 4. Least-privilege identity lookup
-- ---------------------------------------------------------------------------
create or replace function public.staff_discovery_session_student_identities(p_session_ids uuid[])
returns table (session_id uuid, student_user_id uuid, full_name text, email text)
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_uid uuid := auth.uid();
  v_is_admin boolean;
  v_cid uuid;
begin
  if v_uid is null then
    raise exception 'Sign in to view student details.' using errcode = '42501';
  end if;
  if p_session_ids is null or cardinality(p_session_ids) = 0 then
    return;
  end if;
  if cardinality(p_session_ids) > 100 then
    raise exception 'At most 100 sessions can be looked up at once.' using errcode = '22023';
  end if;

  v_is_admin := public.is_admin_role(array['super_admin', 'admin']);
  if not v_is_admin then
    if not public.is_admin_role(array['counsellor']) then
      raise exception 'Not authorized to view student details.' using errcode = '42501';
    end if;
    select c.id into v_cid from public.counsellors c where c.user_id = v_uid;
    if v_cid is null then
      return;
    end if;
  end if;

  return query
    select s.id, p.id, p.full_name, p.email
    from public.discovery_sessions s
    join public.profiles p on p.id = s.student_user_id
    where s.id = any (p_session_ids)
      and (
        v_is_admin
        or (
          -- Session basis: approved, active, held by an active counsellor.
          s.assigned_counsellor_id = v_cid
          and s.assignment_approved_counsellor_id = v_cid
          and s.assignment_approved_at is not null
          and s.status in ('requested', 'scheduled')
          and exists (select 1 from public.counsellors c where c.id = v_cid and c.is_active)
        )
        or exists (
          -- Caseload basis: identical to the existing profiles (m7) policy.
          select 1 from public.admin_student_meta m
          where m.student_user_id = s.student_user_id
            and m.assigned_counsellor_id = v_cid
        )
      );
end
$fn$;

comment on function public.staff_discovery_session_student_identities(uuid[]) is
  'CC-25 — returns ONLY session_id, student_user_id, full_name and email for the given Discovery Sessions the caller may identify: admins (all); a counsellor for an approved assignment of an active session while the counsellor is active; a counsellor whose caseload (admin_student_meta) holds the student. Never returns other profile columns. Max 100 ids per call.';

-- ---------------------------------------------------------------------------
-- 5. Admin approval RPC (audited in the database)
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_discovery_session_assignment_approval(
  p_session_id uuid,
  p_counsellor_id uuid,
  p_approved boolean
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $fn$
declare
  v_row public.discovery_sessions;
  v_before uuid;
begin
  if auth.uid() is null or not public.is_admin_role(array['super_admin', 'admin']) then
    raise exception 'Only an admin can approve or revoke a Discovery Session assignment.' using errcode = '42501';
  end if;
  if p_session_id is null or p_counsellor_id is null or p_approved is null then
    raise exception 'Session, counsellor and decision are required.' using errcode = '22023';
  end if;

  select * into v_row from public.discovery_sessions where id = p_session_id for update;
  if not found then
    raise exception 'Discovery Session not found.' using errcode = 'P0002';
  end if;
  if v_row.assigned_counsellor_id is distinct from p_counsellor_id then
    raise exception 'This session is no longer assigned to that counsellor. Reload the page and try again.' using errcode = '40001';
  end if;
  if p_approved then
    if v_row.status not in ('requested', 'scheduled') then
      raise exception 'Only a requested or scheduled session can be approved.' using errcode = '22023';
    end if;
    if not exists (select 1 from public.counsellors c where c.id = p_counsellor_id and c.is_active) then
      raise exception 'That counsellor is inactive.' using errcode = '22023';
    end if;
  end if;

  v_before := v_row.assignment_approved_counsellor_id;
  update public.discovery_sessions
    set assignment_approved_counsellor_id = case when p_approved then p_counsellor_id else null end
    where id = p_session_id
    returning * into v_row;

  perform public.record_admin_audit_log(
    case when p_approved then 'Approved' else 'Revoked' end,
    'discovery_session',
    p_session_id::text,
    case when p_approved
      then 'Approved the counsellor assignment for a Discovery Session'
      else 'Revoked approval of the counsellor assignment for a Discovery Session' end,
    jsonb_build_object('assignmentApprovedCounsellorId',
      jsonb_build_object('before', v_before, 'after', v_row.assignment_approved_counsellor_id)),
    jsonb_build_object('source', 'admin_set_discovery_session_assignment_approval', 'counsellorId', p_counsellor_id)
  );

  return jsonb_build_object(
    'session_id', v_row.id,
    'approved', v_row.assignment_approved_counsellor_id is not null,
    'approved_at', v_row.assignment_approved_at
  );
end
$fn$;

comment on function public.admin_set_discovery_session_assignment_approval(uuid, uuid, boolean) is
  'CC-25 — admin-only: approve (or revoke) the CURRENT counsellor assignment of a Discovery Session. Refuses stale requests (the session must still be assigned to p_counsellor_id), inactive counsellors and inactive sessions. Writes admin_audit_log in the same transaction. Runs as the caller (RLS applies).';

-- ---------------------------------------------------------------------------
-- 6. Replace the session-based branches of 0013 PART 3 and 0014
-- ---------------------------------------------------------------------------
drop policy if exists "Admins/assigned counsellor can read the workspace" on public.discovery_session_workspace;
create policy "Admins/assigned counsellor can read the workspace"
  on public.discovery_session_workspace for select to authenticated
  using (
    public.is_admin_role(array['super_admin', 'admin'])
    or (
      public.is_admin_role(array['counsellor'])
      and public.counsellor_has_approved_session(discovery_session_workspace.session_id)
    )
  );

drop policy if exists "Admins/assigned counsellor can write the workspace" on public.discovery_session_workspace;
create policy "Admins/assigned counsellor can write the workspace"
  on public.discovery_session_workspace for all to authenticated
  using (
    public.is_admin_role(array['super_admin', 'admin'])
    or (
      public.is_admin_role(array['counsellor'])
      and public.counsellor_has_approved_session(discovery_session_workspace.session_id)
    )
  )
  with check (
    public.is_admin_role(array['super_admin', 'admin'])
    or (
      public.is_admin_role(array['counsellor'])
      and public.counsellor_has_approved_session(discovery_session_workspace.session_id)
    )
  );

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
        or public.counsellor_has_active_session_for_student(student_profile_section_provenance.student_user_id)
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
        or public.counsellor_has_active_session_for_student(student_profile_section_provenance.student_user_id)
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
          or public.counsellor_has_active_session_for_student(student_profile_section_provenance.student_user_id)
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
        or public.counsellor_has_active_session_for_student(student_recommendation_verifications.student_user_id)
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
        or public.counsellor_has_active_session_for_student(student_recommendation_verifications.student_user_id)
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
          or public.counsellor_has_active_session_for_student(student_recommendation_verifications.student_user_id)
        )
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 7. Function privileges (Supabase grants EXECUTE to anon by default)
-- ---------------------------------------------------------------------------
revoke all on function public.discovery_sessions_guard_cc25() from public, anon, authenticated;
revoke all on function public.admin_student_meta_guard_cc25() from public, anon, authenticated;
revoke all on function public.counsellor_has_approved_session(uuid) from public, anon;
revoke all on function public.counsellor_has_active_session_for_student(uuid) from public, anon;
revoke all on function public.staff_discovery_session_student_identities(uuid[]) from public, anon;
revoke all on function public.admin_set_discovery_session_assignment_approval(uuid, uuid, boolean) from public, anon;
grant execute on function public.counsellor_has_approved_session(uuid) to authenticated;
grant execute on function public.counsellor_has_active_session_for_student(uuid) to authenticated;
grant execute on function public.staff_discovery_session_student_identities(uuid[]) to authenticated;
grant execute on function public.admin_set_discovery_session_assignment_approval(uuid, uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 8. Postconditions (abort the whole transaction if any fails)
-- ---------------------------------------------------------------------------
do $post$
declare
  v_fn text;
begin
  foreach v_fn in array array[
    'public.counsellor_has_approved_session(uuid)',
    'public.counsellor_has_active_session_for_student(uuid)',
    'public.staff_discovery_session_student_identities(uuid[])',
    'public.admin_set_discovery_session_assignment_approval(uuid,uuid,boolean)',
    'public.discovery_sessions_guard_cc25()',
    'public.admin_student_meta_guard_cc25()'
  ] loop
    if has_function_privilege('anon', v_fn, 'execute') then
      raise exception 'CC25-0023 postcondition: anon can execute %', v_fn;
    end if;
    if exists (select 1 from pg_proc where oid = v_fn::regprocedure
               and coalesce(array_to_string(proconfig, ','), '') <> 'search_path=""') then
      raise exception 'CC25-0023 postcondition: % does not pin an empty search_path', v_fn;
    end if;
  end loop;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles'
             and (coalesce(qual, '') || coalesce(with_check, '')) like '%discovery_sessions%') then
    raise exception 'CC25-0023 postcondition: a profiles policy references discovery_sessions';
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public'
             and tablename in ('discovery_session_workspace', 'student_profile_section_provenance', 'student_recommendation_verifications')
             and (coalesce(qual, '') || coalesce(with_check, '')) like '%discovery_sessions%') then
    raise exception 'CC25-0023 postcondition: an unapproved discovery_sessions basis is still present';
  end if;
  if (select count(*) from pg_trigger where not tgisinternal
      and tgname in ('discovery_sessions_guard_cc25', 'admin_student_meta_guard_cc25')) <> 2 then
    raise exception 'CC25-0023 postcondition: guard triggers missing';
  end if;
end
$post$;

-- Ask PostgREST to reload its schema cache (delivered at COMMIT) so the API
-- sees the changed functions immediately.
notify pgrst, 'reload schema';

commit;
