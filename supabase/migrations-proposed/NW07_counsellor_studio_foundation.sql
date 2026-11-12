-- ============================================================================
-- NW07 — Counsellor Studio Foundation
--
-- HOW TO RUN THIS (no SQL knowledge required):
--   1. Open your Supabase project dashboard (supabase.com/dashboard).
--   2. Click "SQL Editor" in the left sidebar.
--   3. Click "New query".
--   4. Paste the entire contents of this file.
--   5. Click "Run".
--
-- THIS FILE HAS NOT BEEN APPLIED TO ANY DATABASE. It lives in
-- supabase/migrations-proposed/ pending a founder/admin review and
-- promotion into supabase/migrations/ with the next sequential number
-- (0023, since 0022/NW06_application_tasks.sql is the last one this
-- session found, itself also still unapplied/proposed). Safe to run once;
-- re-running is also safe (IF NOT EXISTS / OR REPLACE / DROP POLICY IF
-- EXISTS throughout, same convention as every prior migration).
--
-- Two independent parts, documented separately in NW07_DATABASE_CHANGE_PLAN.md:
--
--   CC-26 SECURITY REVISION (2026-11-11): the original PART 1 granted case
--   access through ANY Discovery Session assignment, so an unapproved
--   counsellor self-claim exposed the student's profile and case notes. PART 1
--   now runs the CC-26 shared block (identical to cc25/0023 revision 2
--   section 7b): profiles stays caseload-only (0004); the other policies and
--   counsellor_has_case_access require a caseload assignment or an
--   admin-APPROVED, ACTIVE session held by an ACTIVE counsellor. Without
--   cc25/0023 (its approval helper is missing) NW07 grants case access through
--   the caseload assignment ONLY and leaves the 0004 policies untouched;
--   applying 0023 revision 2 afterwards adds the approved-session basis. Every
--   apply order converges to the same catalog (tested).
--
--   PART 1 — fixes a real, confirmed gap found in NW07.1's audit: the
--   "dual-basis" counsellor-case-access rule Milestone 11-B2 established
--   (0014_discovery_session_counsellor_scope.sql) was only ever applied to
--   two narrow tables. This extends the SAME, already-reviewed pattern to
--   the tables that actually carry the student's identity and case record
--   — see NW07_01_AUDIT.md §3 for the full "why" before reading this part.
--
--   PART 2 — the genuinely new schema this milestone needs: a counsellor-
--   authored Recommendation Workflow (draft -> submit -> review ->
--   approve/changes-requested -> release -> archive), RPC-only (matching
--   this codebase's own established pattern for a state machine at this
--   level of sensitivity — application_documents/application_submissions/
--   application_tasks all take the same "no plain write RLS, every
--   mutation is a re-checking SECURITY DEFINER function" shape). No
--   existing table is touched by PART 2 beyond one read-only reference to
--   admin_student_meta/discovery_sessions for the same dual-basis check
--   PART 1 restores elsewhere.
-- ============================================================================


-- ============================================================================
-- PART 1 — Counsellor case-access widening (profiles, the 11-table Student
-- Digital Profile family, admin_student_meta SELECT, admin_student_notes
-- SELECT+INSERT). CC-26: the session basis below is APPROVAL-GATED (see the
-- header); the original text that follows describes the superseded rule: add the discovery_sessions.assigned_counsellor_id basis
-- alongside the existing admin_student_meta.assigned_counsellor_id basis,
-- exactly mirroring 0014's own two already-shipped policies. Deliberately
-- NOT touching any INSERT/UPDATE policy on the 11 student_* tables (student-
-- only, untouched) or admin_student_meta's own UPDATE policy (status/
-- counsellor REASSIGNMENT stays super_admin/admin-only, or the counsellor
-- ALREADY holding the admin_student_meta assignment — a counsellor who only
-- has the discovery-session basis can now SEE the case and act on it via
-- every RPC/table NW07 adds, but cannot grant themselves the stronger,
-- permanent admin_student_meta assignment merely by having run one session).
-- ============================================================================

do $nw07$
declare
  v_table text;
begin
  if to_regprocedure('public.counsellor_has_active_session_for_student(uuid)') is null then
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
    return;
  end if;
  -- CC-26 shared block (byte-identical in cc25/0023 revision 2 section 7 and in
  -- the patched NW07 PART 1). Counsellor case access = caseload assignment OR an
  -- admin-APPROVED assignment of an ACTIVE Discovery Session held by an ACTIVE
  -- counsellor. An unapproved self-claim, a finished session or an inactive
  -- counsellor grants nothing.
  execute $sql$
    create or replace function public.counsellor_has_case_access(p_student_user_id uuid)
    returns boolean
    language sql
    stable
    security definer
    set search_path = pg_catalog, public, pg_temp
    as $fn$
      select auth.uid() is not null and (
        exists (
          select 1 from public.admin_student_meta m
          where m.student_user_id = p_student_user_id
            and m.assigned_counsellor_id = public.current_counsellor_id()
        )
        or public.counsellor_has_active_session_for_student(p_student_user_id)
      );
    $fn$
  $sql$;
  execute $sql$
    comment on function public.counsellor_has_case_access(uuid) is
      'CC-26 — true if the calling counsellor has case access to this student: a caseload assignment (admin_student_meta) OR an admin-approved assignment of an active (requested/scheduled) Discovery Session (counsellor_has_active_session_for_student). An unapproved self-claim grants nothing. Callers still combine this with is_admin_role(''counsellor'').'
  $sql$;
  execute 'revoke all on function public.counsellor_has_case_access(uuid) from public, anon, service_role';
  execute 'grant execute on function public.counsellor_has_case_access(uuid) to authenticated';

  execute $sql$drop policy if exists "Admins/assigned counsellor can read student profiles (m7)" on public.profiles$sql$;
  -- profiles: back to the exact 0004 caseload-only rule. A Discovery Session
  -- counsellor gets the student's name and e-mail only through
  -- staff_discovery_session_student_identities (no table-level widening).
  execute $sql$
create policy "Admins/assigned counsellor can read student profiles (m7)"
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
  )
  $sql$;

  foreach v_table in array array[
    'student_profiles', 'student_education', 'student_subject_strengths', 'student_interests',
    'student_skills', 'student_work_preferences', 'student_career_priorities', 'student_career_goals',
    'student_study_preferences', 'student_funding_preferences', 'student_experience'
  ] loop
    execute format('drop policy if exists "Admins/assigned counsellor can read %1$s (m7)" on public.%1$I', v_table);
    execute format(
      $f$create policy "Admins/assigned counsellor can read %1$s (m7)"
        on public.%1$I for select to authenticated
        using (
          public.is_admin_role(array['super_admin', 'admin', 'analyst'])
          or (public.is_admin_role(array['counsellor']) and public.counsellor_has_case_access(%1$I.user_id))
        )$f$,
      v_table
    );
  end loop;

  execute $sql$drop policy if exists "Admins/assigned counsellor can read student meta" on public.admin_student_meta$sql$;
  execute $sql$
    create policy "Admins/assigned counsellor can read student meta"
      on public.admin_student_meta for select to authenticated
      using (
        public.is_admin_role(array['super_admin', 'admin', 'analyst'])
        or (public.is_admin_role(array['counsellor']) and public.counsellor_has_case_access(admin_student_meta.student_user_id))
      )
  $sql$;

  execute $sql$drop policy if exists "Admins/assigned counsellor can read student notes" on public.admin_student_notes$sql$;
  execute $sql$
    create policy "Admins/assigned counsellor can read student notes"
      on public.admin_student_notes for select to authenticated
      using (
        public.is_admin_role(array['super_admin', 'admin'])
        or (public.is_admin_role(array['counsellor']) and public.counsellor_has_case_access(admin_student_notes.student_user_id))
      )
  $sql$;

  execute $sql$drop policy if exists "Admins/assigned counsellor can add student notes" on public.admin_student_notes$sql$;
  execute $sql$
    create policy "Admins/assigned counsellor can add student notes"
      on public.admin_student_notes for insert to authenticated
      with check (
        author_user_id = auth.uid()
        and (
          public.is_admin_role(array['super_admin', 'admin'])
          or (public.is_admin_role(array['counsellor']) and public.counsellor_has_case_access(admin_student_notes.student_user_id))
        )
      )
  $sql$;
end
$nw07$;


-- ============================================================================
-- PART 2 — Recommendation Workflow
--
-- recommendation_drafts: one row per counsellor-authored recommendation
-- report for one student. recommendation_draft_versions: the authored
-- content itself, versioned and immutable once superseded — a draft's
-- current_version_id always points at the latest version; prior versions
-- are kept, never overwritten, for the audit trail the brief requires.
--
-- Status lifecycle (fixed, mirrors application_tasks' own fixed-transition-
-- table discipline): draft -> submitted_for_review -> changes_requested ->
-- (back to draft or submitted_for_review) -> approved -> released_to_student
-- -> archived. A student is NEVER a party to any transition — the table has
-- ZERO student write policy and ZERO student plain-SELECT policy; a
-- student's only access is the two get_my_recommendation_report*() RPCs at
-- the end of this PART, whose RETURNS TABLE shapes structurally exclude
-- every internal-only column (review_notes, created_by, every *_by actor
-- column) — not merely omitted from a SELECT list, same discipline NW06's
-- get_my_application_tasks() already established.
-- ============================================================================

create table if not exists public.recommendation_drafts (
  id uuid primary key default gen_random_uuid(),
  student_user_id uuid not null references auth.users (id) on delete cascade,
  recommendation_type text,
  title text not null,
  status text not null default 'draft',
  current_version_id uuid,
  created_by uuid not null references auth.users (id) on delete set null,
  author_counsellor_id uuid references public.counsellors (id) on delete set null,
  submitted_at timestamptz,
  submitted_by uuid references auth.users (id) on delete set null,
  review_notes text,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users (id) on delete set null,
  approved_at timestamptz,
  approved_by uuid references auth.users (id) on delete set null,
  released_at timestamptz,
  released_by uuid references auth.users (id) on delete set null,
  archived_at timestamptz,
  archived_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recommendation_drafts_status_check check (status in (
    'draft', 'submitted_for_review', 'changes_requested', 'approved', 'released_to_student', 'archived'
  )),
  constraint recommendation_drafts_type_check
    check (recommendation_type is null or recommendation_type in ('career', 'course', 'college', 'pathway')),
  constraint recommendation_drafts_title_check check (length(trim(title)) > 0 and length(title) <= 200),
  constraint recommendation_drafts_review_notes_check check (review_notes is null or length(review_notes) <= 4000),
  -- A released report must carry its release/approval provenance; an
  -- un-released one must not claim to have any. Mirrors application_tasks'
  -- own "payment fields scoped to one task type" CHECK discipline.
  constraint recommendation_drafts_released_consistency check (
    (status = 'released_to_student' and released_at is not null and released_by is not null and approved_at is not null and approved_by is not null)
    or (status <> 'released_to_student')
  ),
  constraint recommendation_drafts_approved_consistency check (
    (status in ('approved', 'released_to_student') and approved_at is not null and approved_by is not null)
    or (status not in ('approved', 'released_to_student'))
  )
);
create index if not exists recommendation_drafts_student_idx on public.recommendation_drafts (student_user_id);
create index if not exists recommendation_drafts_status_idx on public.recommendation_drafts (status);
create index if not exists recommendation_drafts_author_idx on public.recommendation_drafts (created_by);

comment on table public.recommendation_drafts is
  'NW07.6 — one row per counsellor-authored recommendation report. RPC-only (zero plain write policy for anyone, including super_admin/admin — every mutation goes through a SECURITY DEFINER function below so the fixed status-transition table and the self-approval/self-release prevention rule are enforced in exactly one place). ZERO student policy of any kind — a student reaches a released report only via get_my_recommendation_report()/get_my_recommendation_report_content() at the end of this PART, never this table directly.';

alter table public.recommendation_drafts enable row level security;

drop policy if exists "Admins/author/case counsellor can read recommendation drafts" on public.recommendation_drafts;
create policy "Admins/author/case counsellor can read recommendation drafts"
  on public.recommendation_drafts for select to authenticated
  using (
    public.is_admin_role(array['super_admin', 'admin'])
    or (
      public.is_admin_role(array['counsellor'])
      and (created_by = auth.uid() or public.counsellor_has_case_access(student_user_id))
    )
  );
-- Deliberately no insert/update/delete policy for ANY role — see table comment.

drop trigger if exists set_recommendation_drafts_updated_at on public.recommendation_drafts;
create trigger set_recommendation_drafts_updated_at before update on public.recommendation_drafts for each row execute function public.set_updated_at();


create table if not exists public.recommendation_draft_versions (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.recommendation_drafts (id) on delete cascade,
  version_number integer not null,
  content jsonb not null default '{}'::jsonb,
  authored_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint recommendation_draft_versions_content_is_object check (jsonb_typeof(content) = 'object'),
  constraint recommendation_draft_versions_number_check check (version_number >= 1),
  constraint recommendation_draft_versions_unique_number unique (draft_id, version_number)
);
create index if not exists recommendation_draft_versions_draft_idx on public.recommendation_draft_versions (draft_id);

alter table public.recommendation_drafts
  add constraint recommendation_drafts_current_version_fk
  foreign key (current_version_id) references public.recommendation_draft_versions (id) on delete set null;

comment on table public.recommendation_draft_versions is
  'NW07.6 — one immutable row per authored revision of a recommendation_drafts row. Never updated or deleted once written (no update/delete policy for anyone, including staff) — the version history itself is the audit trail the brief requires. content is a free-form jsonb bag (summary/career guidance/course guidance/college guidance/pathway, shape documented in src/types/recommendation-drafts.ts, same "type-checked in TS, not by a DB CHECK" tradeoff this codebase already made for discovery_session_workspace''s own jsonb sections) — never fabricated admissions eligibility or a guarantee of admission; authored from the counsellor''s own professional judgement plus the student''s verified profile/readiness/discovery-session record.';

alter table public.recommendation_draft_versions enable row level security;

drop policy if exists "Admins/author/case counsellor can read recommendation draft versions" on public.recommendation_draft_versions;
create policy "Admins/author/case counsellor can read recommendation draft versions"
  on public.recommendation_draft_versions for select to authenticated
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
-- Deliberately no insert/update/delete policy for anyone — RPC-only, see table comment.


-- ----------------------------------------------------------------------------
-- staff_create_recommendation_draft(): the only way a recommendation_drafts
-- row (and its first version) comes into existence. Re-checks admin role OR
-- counsellor dual-basis case access directly (never trusts RLS on another
-- table, since this function is SECURITY DEFINER and therefore bypasses RLS
-- entirely on every table it touches) — same discipline as every other
-- SECURITY DEFINER function in this codebase re-validating its own caller.
-- ----------------------------------------------------------------------------

create or replace function public.staff_create_recommendation_draft(
  p_student_user_id uuid,
  p_title text,
  p_recommendation_type text,
  p_content jsonb
)
returns public.recommendation_drafts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_staff boolean;
  v_draft public.recommendation_drafts;
  v_version public.recommendation_draft_versions;
begin
  v_is_staff := public.is_admin_role(array['super_admin', 'admin'])
    or (public.is_admin_role(array['counsellor']) and public.counsellor_has_case_access(p_student_user_id));
  if not v_is_staff then
    raise exception 'Not authorized to create a recommendation draft for this student.';
  end if;

  if p_title is null or length(trim(p_title)) = 0 then
    raise exception 'A title is required.';
  end if;
  if p_recommendation_type is not null and p_recommendation_type not in ('career', 'course', 'college', 'pathway') then
    raise exception 'Invalid recommendation type.';
  end if;

  insert into public.recommendation_drafts (student_user_id, title, recommendation_type, created_by, author_counsellor_id, status)
  values (p_student_user_id, trim(p_title), p_recommendation_type, auth.uid(), public.current_counsellor_id(), 'draft')
  returning * into v_draft;

  insert into public.recommendation_draft_versions (draft_id, version_number, content, authored_by)
  values (v_draft.id, 1, coalesce(p_content, '{}'::jsonb), auth.uid())
  returning * into v_version;

  update public.recommendation_drafts set current_version_id = v_version.id where id = v_draft.id
  returning * into v_draft;

  return v_draft;
end;
$$;

comment on function public.staff_create_recommendation_draft(uuid, text, text, jsonb) is
  'The only way a recommendation_drafts row is created. Caller must be super_admin/admin, or a counsellor with dual-basis case access (public.counsellor_has_case_access()) to the target student — re-checked here directly, never assumed from RLS. Inserts the draft AND its first version atomically.';


-- ----------------------------------------------------------------------------
-- staff_update_recommendation_draft_content(): only while status is 'draft'
-- or 'changes_requested' — locks the draft row first (same lock-then-
-- validate ordering as staff_update_application_task_status()), re-checks
-- access against the FRESHLY LOCKED row, never a value read earlier.
-- ----------------------------------------------------------------------------

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

comment on function public.staff_update_recommendation_draft_content(uuid, jsonb) is
  'Adds a NEW, immutable version and points current_version_id at it — never updates an existing version row. Only while status is draft or changes_requested. Locks the target row first, then re-validates both authorization and status against the locked row.';


-- ----------------------------------------------------------------------------
-- staff_submit_recommendation_draft_for_review(): draft|changes_requested
-- -> submitted_for_review.
-- ----------------------------------------------------------------------------

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

comment on function public.staff_submit_recommendation_draft_for_review(uuid) is
  'draft|changes_requested -> submitted_for_review. Requires current_version_id to be set (some content has actually been authored). Author or any admin/case-counsellor may submit.';


-- ----------------------------------------------------------------------------
-- staff_review_recommendation_draft(): the ONE function that moves a draft
-- to 'changes_requested' or 'approved' from 'submitted_for_review'. This is
-- the approval gate the brief calls out as the single most sensitive
-- action in this milestone: "a student must never approve their own
-- report" (structurally impossible — no student RPC/policy exists at all)
-- and "counsellors prepare guidance, authorised reviewers approve it" —
-- enforced here as SELF-APPROVAL PREVENTION: the reviewer may never be the
-- SAME auth.uid() that authored the draft (created_by), regardless of role.
-- super_admin/admin may always review (a second pair of eyes by
-- construction, since the author is normally a counsellor, not an admin);
-- a counsellor may review only a colleague's draft for a case they have
-- their own access to, never their own.
-- ----------------------------------------------------------------------------

create or replace function public.staff_review_recommendation_draft(
  p_draft_id uuid,
  p_decision text,
  p_review_notes text default null
)
returns public.recommendation_drafts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_draft public.recommendation_drafts;
begin
  if p_decision not in ('approve', 'request_changes') then
    raise exception 'Invalid review decision.';
  end if;

  select * into v_draft from public.recommendation_drafts where id = p_draft_id for update;
  if v_draft.id is null then
    raise exception 'Recommendation draft not found.';
  end if;

  if v_draft.created_by = auth.uid() then
    raise exception 'A recommendation draft cannot be reviewed by its own author.';
  end if;

  if not (
    public.is_admin_role(array['super_admin', 'admin'])
    or (public.is_admin_role(array['counsellor']) and public.counsellor_has_case_access(v_draft.student_user_id))
  ) then
    raise exception 'Not authorized to review this recommendation draft.';
  end if;

  if v_draft.status <> 'submitted_for_review' then
    raise exception 'Cannot review a recommendation draft from status "%" — it must be submitted_for_review.', v_draft.status;
  end if;

  if p_decision = 'request_changes' and (p_review_notes is null or length(trim(p_review_notes)) = 0) then
    raise exception 'Review notes are required when requesting changes.';
  end if;
  if p_review_notes is not null and length(p_review_notes) > 4000 then
    raise exception 'Review notes are too long (4000 characters max).';
  end if;

  if p_decision = 'approve' then
    update public.recommendation_drafts
      set status = 'approved', reviewed_at = now(), reviewed_by = auth.uid(),
          approved_at = now(), approved_by = auth.uid(), review_notes = p_review_notes
      where id = p_draft_id
      returning * into v_draft;
  else
    update public.recommendation_drafts
      set status = 'changes_requested', reviewed_at = now(), reviewed_by = auth.uid(), review_notes = p_review_notes
      where id = p_draft_id
      returning * into v_draft;
  end if;

  return v_draft;
end;
$$;

comment on function public.staff_review_recommendation_draft(uuid, text, text) is
  'submitted_for_review -> approved (p_decision=''approve'') or changes_requested (p_decision=''request_changes'', review_notes required). SELF-APPROVAL PREVENTION: raises if the caller is the draft''s own author, with no role-based exception — this is the one rule in this function that is never bypassed, including by super_admin/admin. See NW07_SECURITY_THREAT_MODEL.md for the full rationale.';


-- ----------------------------------------------------------------------------
-- staff_release_recommendation_draft(): approved -> released_to_student.
-- This is what makes the report reachable by get_my_recommendation_
-- report()/get_my_recommendation_report_content() below — before this call,
-- those two functions return nothing for this draft, structurally (their
-- own WHERE clause requires status = 'released_to_student').
-- ----------------------------------------------------------------------------

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

comment on function public.staff_release_recommendation_draft(uuid) is
  'approved -> released_to_student ONLY — the status CHECK constraint and this guard are two independent enforcements of "only an approved report can ever be released". Once released, no edit function in this file accepts a released_to_student draft (staff_update_recommendation_draft_content() only accepts draft/changes_requested) — a released report''s content is frozen.';


-- ----------------------------------------------------------------------------
-- staff_withdraw_recommendation_draft(): submitted_for_review -> draft. Lets
-- an author pull back a draft before anyone reviews it (e.g. they noticed a
-- mistake) without waiting for a reviewer to send it back.
-- ----------------------------------------------------------------------------

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

comment on function public.staff_withdraw_recommendation_draft(uuid) is
  'submitted_for_review -> draft. Author or any admin/case-counsellor may withdraw a draft before it is reviewed.';


-- ----------------------------------------------------------------------------
-- staff_archive_recommendation_draft(): approved|released_to_student ->
-- archived. Terminal; no function in this file transitions out of archived.
-- ----------------------------------------------------------------------------

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

comment on function public.staff_archive_recommendation_draft(uuid) is
  'approved|released_to_student -> archived (terminal). A draft/submitted_for_review/changes_requested report is withdrawn or edited back to draft instead of archived — archiving is for a report that reached a real conclusion.';


-- ----------------------------------------------------------------------------
-- Student-facing reads — the ENTIRE student access surface for this
-- feature. Both RETURNS TABLE shapes structurally exclude review_notes,
-- created_by, submitted_by, reviewed_by, approved_by, archived_by,
-- author_counsellor_id — a student never learns WHO reviewed/approved
-- their report, only that it was, and when, and by whom it was released
-- (released_by is also excluded — "released to you" needs no name).
-- ----------------------------------------------------------------------------

create or replace function public.get_my_recommendation_reports()
returns table (
  id uuid,
  title text,
  recommendation_type text,
  released_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select d.id, d.title, d.recommendation_type, d.released_at, d.updated_at
  from public.recommendation_drafts d
  where d.student_user_id = auth.uid() and d.status = 'released_to_student'
  order by d.released_at desc;
$$;

comment on function public.get_my_recommendation_reports() is
  'The student''s own list of RELEASED recommendation reports only — draft/submitted_for_review/changes_requested/approved/archived rows are structurally invisible (the WHERE clause, not a client filter). No internal column is ever in this function''s own return type.';

create or replace function public.get_my_recommendation_report_content(p_draft_id uuid)
returns table (
  id uuid,
  title text,
  recommendation_type text,
  content jsonb,
  released_at timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select d.id, d.title, d.recommendation_type, v.content, d.released_at
  from public.recommendation_drafts d
  join public.recommendation_draft_versions v on v.id = d.current_version_id
  where d.student_user_id = auth.uid() and d.status = 'released_to_student' and d.id = p_draft_id;
$$;

comment on function public.get_my_recommendation_report_content(uuid) is
  'Returns the CURRENT (i.e. the one that was approved and released) version''s content for one of the student''s own released reports — empty if the id does not belong to them or is not released, never an error that would distinguish "not yours" from "not released" from "does not exist" (anti-enumeration, same posture as every other student-facing function in this codebase).';


revoke execute on function public.staff_create_recommendation_draft(uuid, text, text, jsonb) from public;
revoke execute on function public.staff_update_recommendation_draft_content(uuid, jsonb) from public;
revoke execute on function public.staff_submit_recommendation_draft_for_review(uuid) from public;
revoke execute on function public.staff_review_recommendation_draft(uuid, text, text) from public;
revoke execute on function public.staff_release_recommendation_draft(uuid) from public;
revoke execute on function public.staff_withdraw_recommendation_draft(uuid) from public;
revoke execute on function public.staff_archive_recommendation_draft(uuid) from public;
revoke execute on function public.get_my_recommendation_reports() from public;
revoke execute on function public.get_my_recommendation_report_content(uuid) from public;

grant execute on function public.staff_create_recommendation_draft(uuid, text, text, jsonb) to authenticated;
grant execute on function public.staff_update_recommendation_draft_content(uuid, jsonb) to authenticated;
grant execute on function public.staff_submit_recommendation_draft_for_review(uuid) to authenticated;
grant execute on function public.staff_review_recommendation_draft(uuid, text, text) to authenticated;
grant execute on function public.staff_release_recommendation_draft(uuid) to authenticated;
grant execute on function public.staff_withdraw_recommendation_draft(uuid) to authenticated;
grant execute on function public.staff_archive_recommendation_draft(uuid) to authenticated;
grant execute on function public.get_my_recommendation_reports() to authenticated;
grant execute on function public.get_my_recommendation_report_content(uuid) to authenticated;


-- ============================================================================
-- Verification queries (run manually after applying this migration; not
-- executed automatically):
--
-- 1) Confirm every new/changed table has RLS enabled:
--      select relname, relrowsecurity from pg_class
--      where relname in ('recommendation_drafts', 'recommendation_draft_versions')
--      and relnamespace = 'public'::regnamespace;
--    -> both rows should show relrowsecurity = true.
--
-- 2) Confirm a draft's own author cannot approve it:
--      -- as the authoring counsellor:
--      select public.staff_review_recommendation_draft('<draft-id>', 'approve');
--      -- expected: raises "cannot be reviewed by its own author"
--
-- 3) Confirm a student sees nothing for a draft/submitted_for_review/
--    approved report, and exactly its content once released:
--      select * from public.get_my_recommendation_reports(); -- as the student
--
-- 4) Confirm the PART 1 widening: as a counsellor who is only
--    discovery_sessions.assigned_counsellor_id (never admin_student_meta-
--    assigned) for a student, confirm select on public.profiles for that
--    student''s id now returns a row (it would have returned zero rows
--    before this migration).
-- ============================================================================
