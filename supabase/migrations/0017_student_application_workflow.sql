-- ============================================================================
-- Milestone 16 — Student Application Workflow
-- ============================================================================
--
-- BASELINE: this migration is written against the REAL current repository
-- state (release/m10 @ c4bf5a6 "Fix Razorpay receipt length for checkout"),
-- verified by cloning the branch fresh and reading every migration file
-- directly before writing a line of SQL here — see M16_COMPLETION_REPORT.md
-- §1 for the full audit trail. 0001-0016 are untouched by this file.
--
-- THE CORE FINDING THIS MIGRATION BUILDS ON: `public.applications` and
-- `public.application_status_history` ALREADY EXIST — created in Milestone 7
-- (0004_admin_system.sql PART 6) and extended for students in Milestone 9
-- (0006_global_university_course_data.sql PART 16). There is exactly one
-- canonical application record in this codebase already; M16 does NOT
-- create a second one. This migration only:
--
--   1. Widens `applications_stage_check` to add one new stage,
--      'ready_to_submit', between 'preparing' and 'submitted' — the same
--      "widen an existing CHECK constraint, never rename/remove a value"
--      pattern 0016_refund_operations.sql used for the refund lifecycle.
--   2. Adds columns 0004 never needed because students could not yet act on
--      their own application: `course_intake_id` (a real FK to
--      `course_intakes`, preferred over the free-text `intake` column per
--      spec — `intake` itself is left exactly as-is for the existing
--      admin-authored free-text case), `student_note`, `submitted_at`,
--      `decision_at`, `withdrawn_at`.
--   3. Adds two SECURITY DEFINER RPCs — `student_advance_application()` and
--      `student_update_application_note()` — the ONLY way a student can
--      ever mutate their own application row. No new broad student UPDATE
--      RLS policy is added (see PART 3's own comment for why a policy alone
--      cannot safely express "this column only, and only these stage
--      values").
--   4. CLOSES TWO PRE-EXISTING IDOR GAPS found during the audit in
--      `application_status_history`'s RLS (its SELECT and INSERT policies,
--      written in 0004 before students could read their own applications at
--      all, check only "does this application exist", never "is it MINE")
--      — see PART 4 for the exact gap and fix. This is squarely inside
--      M16's own "RLS/IDOR protection" requirement: the student-facing
--      timeline this milestone builds depends on this exact table.
--   5. Adds a partial-unique duplicate-active-application guard (PART 5),
--      new `application_status_history` columns for a genuine
--      student-facing timeline (`actor_type`, `student_visible_message` —
--      PART 2.2), and widens `product_events_event_name_check` with three
--      new, real (non-reserved) analytics event names (PART 6).
--
-- Nothing here touches payments, invoices, refunds, pricing, or any
-- Razorpay-related table/function/policy. Nothing here touches migrations
-- 0001-0016.
-- ============================================================================


-- ============================================================================
-- PART 1 — Widen the stage lifecycle: add 'ready_to_submit'
-- ============================================================================
--
-- Spec's own guidance: "If existing schema already uses equivalent names,
-- preserve established conventions where reasonable." The existing 10-value
-- stage vocabulary (inquiry/preparing/submitted/under_review/interview/
-- decision_pending/offer_received/enrolled/rejected/withdrawn) already
-- covers everything the M16 spec's own simplified lifecycle needs EXCEPT a
-- distinct "prepared and ready, about to submit" signal between 'preparing'
-- and 'submitted' — the one genuine gap. Every other existing stage is kept
-- completely unchanged; interview/decision_pending/enrolled stay exactly as
-- Milestone 7 defined them (a strict subset of what the spec's own simpler
-- lifecycle allows, per the spec's own "preserve established conventions"
-- instruction).

alter table public.applications drop constraint if exists applications_stage_check;
alter table public.applications add constraint applications_stage_check check (
  stage in ('inquiry', 'preparing', 'ready_to_submit', 'submitted', 'under_review', 'interview', 'decision_pending', 'offer_received', 'enrolled', 'rejected', 'withdrawn')
);


-- ============================================================================
-- PART 2 — New columns
-- ============================================================================

-- 2.1 — `applications` itself.
alter table public.applications
  add column if not exists course_intake_id uuid references public.course_intakes (id) on delete set null,
  add column if not exists student_note text,
  add column if not exists submitted_at timestamptz,
  add column if not exists decision_at timestamptz,
  add column if not exists withdrawn_at timestamptz;

alter table public.applications drop constraint if exists applications_student_note_length_check;
alter table public.applications add constraint applications_student_note_length_check
  check (student_note is null or length(student_note) <= 2000);

-- `course_intake_id`, when set, must actually belong to the same course this
-- application is for — otherwise a student's application could point at
-- some other course's intake dates, silently showing the wrong deadline.
-- A plain CHECK constraint cannot express this (Postgres CHECK constraints
-- may not contain subqueries or reference another table), so this is a
-- trigger instead — same reasoning as every other cross-row invariant in
-- this codebase that isn't a plain same-row CHECK (e.g. 0016_refund_
-- operations.sql's prevent_refund_amount_change).
--
-- SECURITY/DATA-INTEGRITY PATCH (post-review): the original version of this
-- function only validated when BOTH course_intake_id AND course_id were
-- non-null — `course_intake_id is not null and course_id is not null`. That
-- silently accepted the nonsensical combination `course_intake_id != null,
-- course_id = null` (an intake with no course to belong to at all), because
-- the whole `if` block was skipped whenever course_id was null. Fixed to
-- validate unconditionally whenever course_intake_id is set: course_id must
-- be present, AND the intake must belong to it. A null course_intake_id
-- still always passes, unchanged.
create or replace function public.validate_application_course_intake()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.course_intake_id is not null then
    if new.course_id is null then
      raise exception 'course_intake_id requires a matching course_id on the same application.' using errcode = '23514';
    end if;
    if not exists (select 1 from public.course_intakes ci where ci.id = new.course_intake_id and ci.course_id = new.course_id) then
      raise exception 'course_intake_id does not belong to the application''s course_id.' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

comment on function public.validate_application_course_intake() is
  'Milestone 16 — BEFORE INSERT/UPDATE guard ensuring applications.course_intake_id, when set, actually belongs to applications.course_id (a plain CHECK constraint cannot express a cross-table lookup). SECURITY DEFINER so it can read course_intakes regardless of the calling role''s own RLS grants on that table.';

drop trigger if exists validate_applications_course_intake on public.applications;
create trigger validate_applications_course_intake
  before insert or update of course_intake_id, course_id on public.applications
  for each row execute function public.validate_application_course_intake();

create index if not exists applications_course_intake_idx on public.applications (course_intake_id);
create index if not exists applications_submitted_at_idx on public.applications (submitted_at);

comment on column public.applications.course_intake_id is
  'Milestone 16 — optional link to a real public.course_intakes row, preferred over the free-text `intake` column when a real intake record exists (spec: "prefer linking application to course_intake_id rather than storing free-text intake"). Left null by startApplicationFromCourse() today (no intake-picker UI exists yet — see M16_COMPLETION_REPORT.md known limitations); settable by an admin/counsellor via the existing admin application form.';
comment on column public.applications.student_note is
  'Milestone 16 — the STUDENT''s own note, editable only by the student who owns this application (via student_update_application_note() below) and visible to both the student and any admin/counsellor who can already read this application. Entirely separate from `internal_notes` (Milestone 7, admin/counsellor-authored, NEVER shown to the student) — the two are never conflated.';
comment on column public.applications.submitted_at is
  'Milestone 16 — the timestamp THIS SYSTEM recorded the stage moving to ''submitted'', set atomically by whichever path performed that transition (student_advance_application() or the admin update path). Distinct from the pre-existing `submission_date` (a plain date an admin/counsellor may type in by hand, e.g. backfilling a submission that happened before this system tracked it) — `submitted_at` is never hand-editable.';
comment on column public.applications.decision_at is
  'Milestone 16 — set atomically when the stage moves to a terminal decision outcome (''offer_received'' or ''rejected''). Null otherwise.';
comment on column public.applications.withdrawn_at is
  'Milestone 16 — set atomically when the stage moves to ''withdrawn'', by either the student (student_advance_application()) or an admin/counsellor.';

-- 2.2 — `application_status_history`: two additive columns so the SAME
-- table can honestly serve as both "admin audit trail" (already true since
-- Milestone 7) and "student-facing lifecycle timeline" (the new
-- requirement) without duplicating a second history table — spec's own
-- instruction: "Do not duplicate admin audit logging if the existing
-- architecture already provides the necessary history... keep the
-- distinction clear." The distinction here is column-level, not
-- table-level: `note` (existing, Milestone 7) stays whatever an admin
-- privately records and is NEVER read by the student-facing code path added
-- in this milestone; `student_visible_message` is the one thing ever shown
-- to the student, written by the exact same path (student RPC or admin
-- update) that performed the transition.
alter table public.application_status_history
  add column if not exists actor_type text not null default 'system',
  add column if not exists student_visible_message text;

alter table public.application_status_history drop constraint if exists application_status_history_actor_type_check;
alter table public.application_status_history add constraint application_status_history_actor_type_check
  check (actor_type in ('student', 'admin', 'counsellor', 'system'));

alter table public.application_status_history drop constraint if exists application_status_history_message_length_check;
alter table public.application_status_history add constraint application_status_history_message_length_check
  check (student_visible_message is null or length(student_visible_message) <= 500);

comment on column public.application_status_history.actor_type is
  'Milestone 16 — coarse category of who made this change (student self-service action, an admin, a counsellor, or ''system'' for pre-existing rows written before this column existed / any future automated transition). Defaults to ''system'' for backward compatibility with every row Milestone 7-9 code already writes without setting it explicitly.';
comment on column public.application_status_history.student_visible_message is
  'Milestone 16 — the ONLY free-text field on this table ever surfaced on the student-facing application timeline (src/lib/supabase/education/applications.ts''s getMyApplicationHistory()). The pre-existing `note` column is never read by that path and stays admin/counsellor-internal, exactly like `applications.internal_notes`.';


-- ============================================================================
-- PART 3 — Student self-service RPCs (the ONLY way a student can mutate
-- their own application)
-- ============================================================================
--
-- Why an RPC instead of a plain RLS UPDATE policy: a plain policy's `USING`/
-- `WITH CHECK` clauses can restrict WHICH ROWS a student may touch, but
-- cannot cheaply restrict WHICH COLUMNS an UPDATE is allowed to change or
-- WHICH STAGE VALUES it may set (that would need a BEFORE UPDATE trigger
-- comparing every OLD/NEW column pair, which is exactly what a narrow RPC
-- does more simply and more legibly). This mirrors Milestone 13's own
-- claim_refund_for_processing()/finalize_refund() precedent: a narrow,
-- SECURITY DEFINER, search_path-pinned RPC is the safe place to put "row
-- ownership + a fixed, small action vocabulary + an atomic multi-table
-- write", where a bare RLS policy cannot express the same guarantee.
--
-- Both RPCs below: validate auth.uid() themselves (never trust a
-- caller-supplied student id), touch only their own single application row
-- (re-checked by student_user_id = auth.uid() inside the UPDATE's own WHERE
-- clause, not just a preceding SELECT), and are granted to `authenticated`
-- only — never PUBLIC/anon.

-- ---------------------------------------------------------------------------
-- 3.1 — student_advance_application(): the fixed, small action vocabulary a
-- student may ever move their OWN application through. Deliberately does
-- NOT accept a raw target stage string — only one of four named actions,
-- each with an exact, hardcoded (from-stage set -> to-stage) pair, so it is
-- structurally impossible for a student to reach 'under_review',
-- 'offer_received', 'rejected', 'interview', 'decision_pending', or
-- 'enrolled' through this function no matter what string is passed in.
--
-- Withdrawal rule (spec: "withdraw application before final decision if
-- appropriate... ONLY if product/business rules already allow it"): this
-- reuses the EXACT set of stages the Milestone 7
-- APPLICATION_STAGE_TRANSITIONS graph (src/lib/admin/status.ts) already
-- allows moving to 'withdrawn' from, MINUS 'decision_pending' — the one
-- stage whose entire meaning is "a decision is imminent", which this
-- migration treats as the practical reading of "before final decision".
-- Every one of {inquiry, preparing, ready_to_submit, submitted,
-- under_review, interview} already has a documented withdrawn edge in that
-- graph today (interview/under_review/submitted withdrawal is pre-existing
-- Milestone 7 product behavior, not a new M16 policy choice) — this
-- function does not invent a new business rule, it exposes an existing one
-- to the student themselves for the pre-decision states, exactly as the
-- spec's own conditional ("ONLY if product/business rules already allow
-- it") requires.
-- ---------------------------------------------------------------------------
-- SECURITY PATCH (v3 — database-boundary hardening): this function used to
-- `returns public.applications` — the FULL row, including staff-only
-- columns (`internal_notes`, `assigned_counsellor_id`, `last_contact_date`).
-- Even though the TypeScript caller (advanceMyApplication()) discards the
-- returned row entirely, that was only an application-layer convention, not
-- a database-authoritative boundary: any authenticated caller invoking this
-- RPC directly (e.g. via supabase-js/PostgREST, bypassing this codebase's
-- own TypeScript) would receive those staff-only fields on their own
-- response. Narrowed to a `RETURNS TABLE` of exactly the five columns a
-- caller has any legitimate reason to see — structurally, not just by
-- convention, since the composite type this returns simply does not have
-- an `internal_notes`/`assigned_counsellor_id`/`last_contact_date` field at
-- all.
create or replace function public.student_advance_application(p_application_id uuid, p_action text)
returns table (
  id uuid,
  stage text,
  submitted_at timestamptz,
  withdrawn_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_from_stages text[];
  v_to_stage text;
  v_message text;
  v_old_stage text;
  v_row public.applications;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated.' using errcode = '28000';
  end if;

  case p_action
    when 'start_preparing' then
      v_from_stages := array['inquiry'];
      v_to_stage := 'preparing';
      v_message := 'You started preparing this application.';
    when 'mark_ready_to_submit' then
      v_from_stages := array['preparing'];
      v_to_stage := 'ready_to_submit';
      v_message := 'You marked this application ready to submit.';
    when 'submit' then
      v_from_stages := array['ready_to_submit'];
      v_to_stage := 'submitted';
      v_message := 'You marked this application as submitted.';
    when 'withdraw' then
      v_from_stages := array['inquiry', 'preparing', 'ready_to_submit', 'submitted', 'under_review', 'interview'];
      v_to_stage := 'withdrawn';
      v_message := 'You withdrew this application.';
    else
      raise exception 'Unknown application action: %', p_action using errcode = '22023';
  end case;

  -- Lock the row FIRST — the same "SELECT ... FOR UPDATE, then validate in
  -- PL/pgSQL, then write, all inside one SECURITY DEFINER function" pattern
  -- claim_refund_for_processing() uses in 0016_refund_operations.sql. The
  -- row lock blocks any concurrent call touching the same application until
  -- this one commits or rolls back, so the from-stage check just below can
  -- never race against another transition to the same row — this is what
  -- makes the whole function atomic from a concurrent caller's point of
  -- view, not just the final UPDATE statement in isolation.
  --
  -- Ownership (student_user_id = auth.uid()) is checked in this SAME select
  -- — never in an earlier, separate read — and "not yours" vs "already
  -- changed" resolve to the same generic error below, so a student can
  -- never distinguish "this application doesn't exist / isn't mine" from
  -- "it exists, is mine, but has already moved on" by probing this RPC.
  select * into v_row from public.applications where id = p_application_id and student_user_id = auth.uid() for update;

  if v_row.id is null then
    raise exception 'This application could not be updated — it may not be yours, or its status may have already changed. Please refresh and try again.' using errcode = 'P0001';
  end if;

  if not (v_row.stage = any(v_from_stages)) then
    raise exception 'This application could not be updated — it may not be yours, or its status may have already changed. Please refresh and try again.' using errcode = 'P0001';
  end if;

  v_old_stage := v_row.stage;

  -- SECURITY PATCH (post-review): this UPDATE previously read `where id =
  -- p_application_id` only — relying entirely on the preceding `SELECT ...
  -- FOR UPDATE` above to have already confirmed ownership and stage. That
  -- SELECT's row lock does make a genuine concurrent race safe (no other
  -- transaction can be mutating this same row between the lock and this
  -- UPDATE), but it is not defense in depth: if this function were ever
  -- copied, refactored, or the SELECT's own WHERE clause were ever loosened
  -- by a future change without this UPDATE being reviewed at the same time,
  -- the UPDATE alone would no longer independently guarantee ownership.
  -- Every other write path in this migration (student_update_application_note()
  -- below, both application_status_history RLS policies) re-checks ownership
  -- in the same statement that performs the write, not only in a preceding
  -- read — this brings student_advance_application() in line with that same
  -- discipline: student_user_id = auth.uid() and stage = v_old_stage (the
  -- exact row this function already validated) are both re-asserted here,
  -- so the UPDATE can only ever affect the row this function locked and
  -- validated, never a different one.
  update public.applications
  set
    stage = v_to_stage,
    submitted_at = case when v_to_stage = 'submitted' then now() else submitted_at end,
    withdrawn_at = case when v_to_stage = 'withdrawn' then now() else withdrawn_at end
  where id = p_application_id
    and student_user_id = auth.uid()
    and stage = v_old_stage
  returning * into v_row;

  -- Should be unreachable given the row lock above, but if this UPDATE ever
  -- unexpectedly affects zero rows, fail safely with the same generic,
  -- anti-enumeration error rather than inserting a history row for a
  -- transition that did not actually happen.
  if v_row.id is null then
    raise exception 'This application could not be updated — it may not be yours, or its status may have already changed. Please refresh and try again.' using errcode = 'P0001';
  end if;

  insert into public.application_status_history (application_id, from_status, to_status, changed_by, actor_type, student_visible_message)
  values (p_application_id, v_old_stage, v_to_stage, auth.uid(), 'student', v_message);

  return query select v_row.id, v_row.stage, v_row.submitted_at, v_row.withdrawn_at, v_row.updated_at;
end;
$$;

comment on function public.student_advance_application(uuid, text) is
  'Milestone 16 — the ONLY path by which a student may move their OWN application forward or withdraw it. Fixed action vocabulary (start_preparing/mark_ready_to_submit/submit/withdraw), each with a hardcoded exact source-stage set — structurally cannot reach under_review/interview/decision_pending/offer_received/enrolled/rejected. SECURITY DEFINER is safe here because every write is re-scoped to student_user_id = auth.uid() inside the UPDATE''s own WHERE clause, and auth.uid() is read server-side, never accepted as a parameter. (v3) RETURNS TABLE (id, stage, submitted_at, withdrawn_at, updated_at) only — structurally excludes internal_notes/assigned_counsellor_id/last_contact_date, never merely omits them by convention.';

revoke all on function public.student_advance_application(uuid, text) from public;
grant execute on function public.student_advance_application(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3.2 — student_update_application_note(): the ONLY path by which a student
-- may write `student_note`. Never touches stage, decision_status, or any
-- other column.
-- ---------------------------------------------------------------------------
-- SECURITY PATCH (v3 — database-boundary hardening): narrowed from `returns
-- public.applications` (the full row, including staff-only columns) to a
-- `RETURNS TABLE` of exactly the three columns a caller has any legitimate
-- reason to see — see student_advance_application()'s own comment above for
-- the full reasoning, which applies identically here.
create or replace function public.student_update_application_note(p_application_id uuid, p_note text)
returns table (
  id uuid,
  student_note text,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_note text;
  v_row public.applications;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated.' using errcode = '28000';
  end if;

  v_note := nullif(btrim(coalesce(p_note, '')), '');
  if v_note is not null and length(v_note) > 2000 then
    raise exception 'Note is too long (2000 characters max).' using errcode = '22001';
  end if;

  update public.applications
  set student_note = v_note
  where id = p_application_id
    and student_user_id = auth.uid()
  returning * into v_row;

  if v_row.id is null then
    raise exception 'This application could not be updated — it may not be yours.' using errcode = 'P0001';
  end if;

  return query select v_row.id, v_row.student_note, v_row.updated_at;
end;
$$;

comment on function public.student_update_application_note(uuid, text) is
  'Milestone 16 — the ONLY path by which a student may set `student_note`. Trims whitespace, collapses blank input to null, caps length at 2000 chars (also enforced by applications_student_note_length_check as defense in depth), and touches no other column. SECURITY DEFINER for the same reason as student_advance_application() above — the write is re-scoped to auth.uid() inside the UPDATE itself. (v3) RETURNS TABLE (id, student_note, updated_at) only — structurally excludes internal_notes/assigned_counsellor_id/last_contact_date.';

revoke all on function public.student_update_application_note(uuid, text) from public;
grant execute on function public.student_update_application_note(uuid, text) to authenticated;


-- ============================================================================
-- PART 4 — Close three pre-existing/introduced IDOR gaps on
-- application_status_history
-- ============================================================================
--
-- THE ORIGINAL GAP (0004_admin_system.sql): its policies on
-- application_status_history check only "does an application with this id
-- exist" — never "is it an application I (the caller) actually own or
-- administer". That was harmless in Milestone 7 (only admin/counsellor
-- roles could reach `applications` at all), but Milestone 9 then gave
-- students their own SELECT access to `applications`, at which point "any
-- authenticated user can read or insert a history row for ANY application"
-- becomes a real IDOR.
--
-- POST-REVIEW PATCH — two further issues found in the first version of this
-- same PART 4 (which added a `a.student_user_id = auth.uid()` branch to
-- both policies below) are fixed here instead of shipping a policy that
-- still let a student query or write this table directly:
--
-- ISSUE 1 (student direct INSERT): the first version's INSERT policy let a
-- student insert a row for their own application directly — e.g. via
-- PostgREST/supabase-js, not just through student_advance_application().
-- That contradicts the whole point of the RPC: a student could forge a
-- history row (any from_status/to_status pair, any student_visible_message)
-- WITHOUT the application itself changing, since RLS only checks "is this
-- my application", never "did this insert come from the RPC". Fixed by
-- removing the student_user_id branch from the INSERT policy entirely — a
-- student can no longer INSERT into this table under any circumstance.
-- Their own history rows are written exclusively by
-- student_advance_application() (PART 3.1), which is SECURITY DEFINER and
-- therefore executes as the function owner, not as the calling student, so
-- it is unaffected by this narrowing.
--
-- ISSUE 2 (student direct SELECT can read `note`): RLS restricts which
-- ROWS a policy allows, never which COLUMNS a permitted row exposes. The
-- first version's SELECT policy correctly limited a student to rows on
-- their OWN application — but for those rows, a student who queries the
-- table directly (again, via PostgREST/supabase-js with their own session,
-- not necessarily through this codebase's own TypeScript, which never asks
-- for `note`) could still request the `note` and `changed_by` columns,
-- which are staff-internal (see this table's own updated comment below).
-- The application code choosing not to SELECT those columns is not a
-- database-authoritative boundary. Fixed by removing the student_user_id
-- branch from the SELECT policy too — an ordinary student now gets zero
-- rows querying this table directly, full stop — and adding
-- get_my_application_status_history() (PART 4.1 below), a SECURITY DEFINER
-- function whose RETURNS TABLE only lists the columns that are safe to show
-- a student. It is architecturally impossible for that function to leak
-- `note`/`changed_by`: they are never part of its return shape, not merely
-- omitted by convention.
--
-- What stays exactly as the first version intended: admin/counsellor reads
-- and writes are unaffected (super_admin/admin/finance/analyst for read;
-- super_admin/admin/counsellor — matching applications:write — for insert,
-- with a counsellor further scoped to their own assigned applications via
-- current_counsellor_id()); this remains a strict NARROWING relative to
-- 0004's original "any authenticated user, any application" policies.

drop policy if exists "Application history follows application visibility (read)" on public.application_status_history;
create policy "Application history follows application visibility (read)"
  on public.application_status_history for select to authenticated
  using (
    public.is_admin_role(array['super_admin', 'admin', 'finance', 'analyst'])
    or (
      public.is_admin_role(array['counsellor'])
      and exists (
        select 1 from public.applications a
        where a.id = application_status_history.application_id
          and a.assigned_counsellor_id = public.current_counsellor_id()
      )
    )
  );

drop policy if exists "Application history follows application visibility (insert)" on public.application_status_history;
create policy "Application history follows application visibility (insert)"
  on public.application_status_history for insert to authenticated
  with check (
    changed_by = auth.uid()
    and (
      public.is_admin_role(array['super_admin', 'admin'])
      or (
        public.is_admin_role(array['counsellor'])
        and exists (
          select 1 from public.applications a
          where a.id = application_status_history.application_id
            and a.assigned_counsellor_id = public.current_counsellor_id()
        )
      )
    )
  );

comment on table public.application_status_history is
  'Milestone 7, RLS tightened in Milestone 16: direct table SELECT/INSERT are admin/counsellor-only (super_admin/admin/finance/analyst for read; super_admin/admin/counsellor — matching applications:write — for insert; a counsellor is further scoped to their own assigned applications via current_counsellor_id()). A student has NO direct SELECT or INSERT access to this table at all — RLS restricts rows, not columns, so a row-level "is this my application" policy could not stop a student from requesting the staff-internal `note`/`changed_by` columns on their own rows, and could not stop a student from directly forging a history row (any from/to status pair) without the application itself actually changing. Students instead get: (a) their own history rows written exclusively by the SECURITY DEFINER RPC student_advance_application() (PART 3.1), which runs as the function owner and is unaffected by these policies, and (b) their own history READ exclusively through get_my_application_status_history() (PART 4.1 below), a SECURITY DEFINER function whose return shape structurally excludes `note` and `changed_by`. `note` stays admin/counsellor-internal, exactly like `applications.internal_notes`.';

-- ---------------------------------------------------------------------------
-- PART 4.1 — get_my_application_status_history(): the ONLY way a student may
-- read their own application's history. A narrow SECURITY DEFINER function
-- rather than a view, matching this migration's existing "SECURITY DEFINER
-- RPC, not a bare policy, wherever a plain RLS policy cannot cheaply express
-- the same guarantee" pattern (PART 3's own reasoning) — here, the guarantee
-- a bare policy could never express is "expose these columns and no
-- others", since RLS operates on rows only.
-- ---------------------------------------------------------------------------
create or replace function public.get_my_application_status_history(p_application_id uuid)
returns table (
  id uuid,
  from_status text,
  to_status text,
  actor_type text,
  student_visible_message text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select h.id, h.from_status, h.to_status, h.actor_type, h.student_visible_message, h.created_at
  from public.application_status_history h
  join public.applications a on a.id = h.application_id
  where h.application_id = p_application_id
    and a.student_user_id = auth.uid()
  order by h.created_at desc;
$$;

comment on function public.get_my_application_status_history(uuid) is
  'Milestone 16 (post-review patch) — the ONLY path by which a student reads their own application_status_history rows. Verifies application.student_user_id = auth.uid() itself (never trusts RLS on the underlying tables — it runs SECURITY DEFINER precisely so it does not depend on the caller having any direct grant on either table). Its RETURNS TABLE never lists `note` or `changed_by`, so unlike a view over `select *` it is structurally incapable of leaking either column, not merely coded not to select them. Returns zero rows (never an error) for an application id that does not exist or is not the caller''s, matching this migration''s existing anti-enumeration posture.';

revoke all on function public.get_my_application_status_history(uuid) from public;
grant execute on function public.get_my_application_status_history(uuid) to authenticated;


-- ============================================================================
-- PART 5 — Duplicate active application protection (spec §7/§38)
-- ============================================================================
--
-- Rule chosen (documented per spec's own "document the chosen rule"
-- instruction): a student may have AT MOST ONE non-terminal ("active")
-- application per (course, and course_intake when one is actually linked).
-- 'rejected' and 'withdrawn' are the two terminal-and-reapplicable outcomes
-- (a student may legitimately want to try again after either); every other
-- stage (including 'enrolled' — reapplying to a course you're already
-- enrolled in makes no sense, so it stays blocked too, matching the spirit
-- of "prevent accidental duplicate active applications" for a case that
-- would only ever be an accident, never a legitimate reapplication) counts
-- as "active" for this constraint's purposes.
--
-- Two partial unique indexes, not one, because Postgres treats every NULL
-- in a unique index as distinct from every other NULL — a single index on
-- (student_user_id, course_id, course_intake_id) would NEVER actually
-- collide for the common case where course_intake_id is null (today's
-- reality: no code path sets it yet), silently providing no protection at
-- all. Splitting the "no intake linked" and "a specific intake linked"
-- cases into their own partial indexes closes that gap.

drop index if exists public.applications_one_active_per_student_course_no_intake;
create unique index applications_one_active_per_student_course_no_intake
  on public.applications (student_user_id, course_id)
  where course_id is not null and course_intake_id is null and stage not in ('rejected', 'withdrawn');

drop index if exists public.applications_one_active_per_student_course_intake;
create unique index applications_one_active_per_student_course_intake
  on public.applications (student_user_id, course_id, course_intake_id)
  where course_id is not null and course_intake_id is not null and stage not in ('rejected', 'withdrawn');

comment on index public.applications_one_active_per_student_course_no_intake is
  'Milestone 16 — at most one non-terminal (not rejected/withdrawn) application per (student, course) when no specific intake is linked. See this migration''s PART 5 for the full rule and why this is split into two indexes.';
comment on index public.applications_one_active_per_student_course_intake is
  'Milestone 16 — at most one non-terminal (not rejected/withdrawn) application per (student, course, course_intake) once a specific intake IS linked.';


-- ============================================================================
-- PART 6 — Analytics: three new, real event names
-- ============================================================================
--
-- Additive widening of the existing CHECK constraint, same pattern as every
-- other widened constraint in this migration — see
-- src/lib/analytics/events.ts (PRODUCT_EVENTS) for the TypeScript side of
-- this same vocabulary, which this constraint must always be a superset of.
-- Deliberately does NOT touch the pre-existing 'offer_received' name (that
-- one stays RESERVED, per its own documented reasoning in 0010 — it means
-- something different: a reconstructed outcome-stage signal, not a raw
-- lifecycle transition). New event names use an unambiguous
-- 'application_' prefix instead.

-- The full list below is copied VERBATIM from 0012_electronic_stamping_and_
-- assisted_onboarding.sql's own redefinition of this same constraint (the
-- most recent prior one — confirmed by grepping every migration for
-- "product_events_event_name_check": only 0010 and 0012 ever touch it,
-- 0011/0013-0016 do not), with only the three new Milestone 16 names
-- appended at the end. A CHECK constraint has no ALTER ... ADD VALUE the
-- way a Postgres enum type does, so the whole vocabulary must always be
-- restated in full — copying it exactly (rather than reconstructing it from
-- memory/assumption) is what keeps this constraint a strict superset of
-- every name any prior milestone's code can still insert. Milestone
-- 12 (Pricing) and Milestone 13 (Refunds) never added names here — both use
-- their own dedicated analytics tables (pricing_analytics_events) instead,
-- per 0010's own documented "package_viewed/package_selected... already
-- fully covered by pricing_analytics_events" convention.
alter table public.product_events drop constraint if exists product_events_event_name_check;
alter table public.product_events add constraint product_events_event_name_check check (event_name in (
  -- Auth / account
  'user_registered',
  'user_logged_in',
  -- Student profile
  'profile_started',
  'profile_completed',
  -- Assessment / quiz — RESERVED, never fired.
  'assessment_started',
  'assessment_answered',
  'assessment_completed',
  'assessment_result_viewed',
  -- Career discovery
  'career_recommendations_generated',
  'career_viewed',
  'career_compared',
  'career_saved',
  -- Course discovery
  'course_viewed',
  'course_compared',
  'course_saved',
  'application_started',
  -- College / university discovery
  'college_viewed',
  'college_compared',
  'college_saved',
  -- Lead / conversion
  'lead_created',
  'counselling_requested',
  -- Commercial
  'package_viewed',
  'package_selected',
  'payment_started',
  'payment_completed',
  -- Outcome
  'offer_received',
  'enrollment_confirmed',
  -- Milestone 10 (F-122) — Electronic Signature Integration
  'agreement_signature_requested',
  'agreement_signature_viewed',
  'agreement_signature_completed',
  'agreement_signature_declined',
  'agreement_signature_cancelled',
  -- Milestone 11-A (F-123) — Electronic Stamping
  'agreement_stamp_requested',
  'agreement_stamp_completed',
  'agreement_stamp_failed',
  'agreement_stamp_cancelled',
  -- Milestone 11-B — Assisted Onboarding Revision
  'onboarding_choice_viewed',
  'onboarding_discovery_selected',
  'onboarding_self_profile_selected',
  'discovery_session_booked',
  'discovery_session_started',
  'discovery_session_completed',
  -- Milestone 11-C — Profile verification + recommendation readiness
  'profile_field_counsellor_updated',
  'profile_field_counsellor_verified',
  'profile_completeness_changed',
  'recommendation_readiness_changed',
  'recommendations_unlocked',
  'personal_strategy_cta_viewed',
  'personal_strategy_selected',
  -- Milestone 16 — Student Application Workflow. Deliberately does NOT
  -- touch the pre-existing 'offer_received' name above (that one stays
  -- RESERVED — see 0010's own comment: it means a reconstructed
  -- outcome-stage signal, not a raw lifecycle transition). New names use an
  -- unambiguous 'application_' prefix instead.
  'application_status_changed',
  'application_submitted',
  'application_withdrawn'
));


-- ============================================================================
-- PART 7 — v3: remove ordinary-student direct table access to `applications`
-- ============================================================================
--
-- AUDIT FINDING (v3): 0006_global_university_course_data.sql PART 16 granted
-- students two direct RLS policies on `applications` back in Milestone 9,
-- before this migration's own student RPCs existed —
-- "Students can read their own applications" (SELECT, `auth.uid() =
-- student_user_id`) and "Students can start their own application from a
-- course" (INSERT, `with check (auth.uid() = student_user_id)`). Both are
-- the exact same class of bug PART 4 above already fixed for
-- `application_status_history`:
--
--   - The SELECT policy restricts ROWS, not COLUMNS. A student's own
--     session can request `internal_notes`, `assigned_counsellor_id`, and
--     `last_contact_date` — staff-only operational fields — on their OWN
--     application row via direct PostgREST/supabase-js access, regardless
--     of what src/lib/supabase/education/applications.ts chooses to
--     `.select()`. That is not a database-authoritative boundary.
--
--   - The INSERT policy's `WITH CHECK` clause constrains ONLY
--     `student_user_id = auth.uid()` — it places no restriction whatsoever
--     on `stage`, `decision_status`, `internal_notes`,
--     `assigned_counsellor_id`, or any other column. A student could
--     currently INSERT an `applications` row with `stage = 'enrolled'`,
--     `assigned_counsellor_id` pointed at an arbitrary counsellor, or
--     arbitrary `internal_notes`, as long as `student_user_id` matches their
--     own `auth.uid()`.
--
-- These two policies are defined in 0006 (Milestone 9), not 0017, and per
-- this patch's own explicit instruction migrations 0001-0016 are never
-- edited — so, exactly like PART 4's narrowing of the two
-- application_status_history policies (also originally defined in 0004),
-- they are dropped HERE, from within 0017, with no corresponding
-- `create policy`. A plain `drop policy if exists ...` is itself idempotent
-- and additive-safe: re-running this migration on a database that has
-- already had these policies dropped is a no-op, never an error.
--
-- What a student gets instead: get_my_applications()/get_my_application()
-- (PART 8 below) for reads, and student_start_application() (PART 9 below)
-- for creation — both narrow SECURITY DEFINER RPCs whose return/insert
-- shapes structurally exclude every staff-only field, the same
-- "RLS restricts rows, not columns; an RPC's fixed shape can restrict
-- columns too" pattern PART 3/PART 4.1 already established.
--
-- What is UNCHANGED: the three original admin/counsellor RLS policies on
-- `applications` from 0004_admin_system.sql ("Admins/assigned counsellor/
-- finance/analyst can read applications", "Admins/counsellor can create
-- applications", "Admins/assigned counsellor can update applications") —
-- none of them have a student_user_id branch to begin with, so dropping the
-- two STUDENT-only policies above cannot affect them. Every admin/counsellor
-- workflow (src/lib/supabase/admin/applications.ts) keeps working exactly as
-- it did before this patch.

drop policy if exists "Students can read their own applications" on public.applications;
drop policy if exists "Students can start their own application from a course" on public.applications;

comment on table public.applications is
  'Milestone 7, extended by Milestone 16 and hardened by this migration''s v3 patch: an ordinary authenticated student has NO direct SELECT or INSERT access to this table at all (both student-only RLS policies from 0006 are dropped above with no replacement). RLS restricts rows, not columns — a row-level "is this my application" policy could not stop a student who queries this table directly from requesting internal_notes/assigned_counsellor_id/last_contact_date, and could not stop a student from directly inserting a row with a caller-chosen stage/decision_status/assigned_counsellor_id. Students instead get: get_my_applications()/get_my_application() (PART 8) for reads and student_start_application() (PART 9) for creation — all three are narrow SECURITY DEFINER functions whose return/insert shapes structurally exclude staff-only fields. Admin/counsellor SELECT/INSERT/UPDATE access (0004_admin_system.sql) is completely unaffected — none of those three policies have ever had a student_user_id branch.';


-- ============================================================================
-- PART 8 — v3: get_my_applications() / get_my_application() — the ONLY way
-- a student reads their own application row(s) directly (not history —
-- that is PART 4.1's get_my_application_status_history(), unchanged)
-- ============================================================================
--
-- Same reasoning as PART 4.1: a bare RLS policy can restrict which ROWS a
-- student may read, but cannot cheaply restrict which COLUMNS of an
-- permitted row are exposed. Both functions below share one narrow,
-- explicit column list — the same 18 columns
-- src/lib/supabase/education/applications.ts's own MY_APPLICATION_COLUMNS
-- already named as "safe" (this migration is simply the database-
-- authoritative version of that same list) — deliberately excluding
-- `internal_notes`, `assigned_counsellor_id`, and `last_contact_date`.
--
-- Both: derive identity from auth.uid() only (never accept a
-- student_user_id/owner parameter — get_my_application() takes only the
-- application id), are STABLE + SECURITY DEFINER + `set search_path =
-- public`, are revoked from PUBLIC and granted to `authenticated` only, and
-- return zero rows (never an error, never a distinguishable "exists but
-- isn't yours" vs. "doesn't exist" signal) for anything not genuinely
-- owned by the caller — the same anti-enumeration posture as every other
-- RPC in this migration.

create or replace function public.get_my_applications()
returns table (
  id uuid,
  university_id uuid,
  course_id uuid,
  course_intake_id uuid,
  stage text,
  intake text,
  submission_date date,
  decision_status text,
  offer_type text,
  deadlines jsonb,
  next_action text,
  next_action_date date,
  student_note text,
  submitted_at timestamptz,
  decision_at timestamptz,
  withdrawn_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    a.id, a.university_id, a.course_id, a.course_intake_id, a.stage, a.intake,
    a.submission_date, a.decision_status, a.offer_type, a.deadlines,
    a.next_action, a.next_action_date, a.student_note, a.submitted_at,
    a.decision_at, a.withdrawn_at, a.created_at, a.updated_at
  from public.applications a
  where a.student_user_id = auth.uid()
  order by a.created_at desc;
$$;

comment on function public.get_my_applications() is
  'Milestone 16 (v3 patch) — the ONLY path by which a student lists their OWN applications directly. Takes no parameters — identity comes entirely from auth.uid(), never a caller-supplied student id. RETURNS TABLE structurally excludes internal_notes/assigned_counsellor_id/last_contact_date. SECURITY DEFINER so it does not depend on any direct table grant for the calling role.';

revoke all on function public.get_my_applications() from public;
grant execute on function public.get_my_applications() to authenticated;

create or replace function public.get_my_application(p_application_id uuid)
returns table (
  id uuid,
  university_id uuid,
  course_id uuid,
  course_intake_id uuid,
  stage text,
  intake text,
  submission_date date,
  decision_status text,
  offer_type text,
  deadlines jsonb,
  next_action text,
  next_action_date date,
  student_note text,
  submitted_at timestamptz,
  decision_at timestamptz,
  withdrawn_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    a.id, a.university_id, a.course_id, a.course_intake_id, a.stage, a.intake,
    a.submission_date, a.decision_status, a.offer_type, a.deadlines,
    a.next_action, a.next_action_date, a.student_note, a.submitted_at,
    a.decision_at, a.withdrawn_at, a.created_at, a.updated_at
  from public.applications a
  where a.id = p_application_id
    and a.student_user_id = auth.uid();
$$;

comment on function public.get_my_application(uuid) is
  'Milestone 16 (v3 patch) — the ONLY path by which a student reads a single OWN application directly. Ownership is enforced inside the function itself (a.student_user_id = auth.uid()), never trusted to RLS alone. Returns zero rows — never an error, never a distinguishable signal — for another student''s application id, so a caller probing by id can never tell "does not exist" apart from "exists but is not mine". RETURNS TABLE structurally excludes internal_notes/assigned_counsellor_id/last_contact_date.';

revoke all on function public.get_my_application(uuid) from public;
grant execute on function public.get_my_application(uuid) to authenticated;


-- ============================================================================
-- PART 9 — v3: student_start_application() — database-authoritative
-- application creation
-- ============================================================================
--
-- AUDIT FINDING (v3): startApplicationFromCourse() (src/lib/supabase/
-- education/applications.ts) performed a direct INSERT into `applications`
-- via the (now-dropped, PART 7) student INSERT policy, which placed no
-- restriction on any column besides student_user_id. Replaced with this
-- narrow SECURITY DEFINER RPC, which sets every protected/admin field
-- itself — a caller can supply only p_course_id/p_university_id, nothing
-- else:
--
--   - student_user_id: always auth.uid(), never a parameter.
--   - stage: always 'inquiry' (the fixed, hardcoded initial value — cannot
--     be any other value).
--   - decision_status: always 'pending' (the same canonical initial value
--     0004_admin_system.sql's applications_decision_status_check and the
--     pre-existing TypeScript insert already used).
--   - assigned_counsellor_id, internal_notes, last_contact_date: always
--     null.
--
-- Course/university verification (spec Issue 4 — "audit the actual courses
-- schema... do not guess"): confirmed by reading
-- 0004_admin_system.sql's own `public.courses` table definition that the
-- ONE authoritative course->university relationship is the direct, NOT
-- NULL `courses.university_id` foreign key — there is no campus-mediated
-- indirection anywhere in this schema. The "is this course applicable-to"
-- gate reused below (`courses.is_active = true and courses.
-- publication_status = 'published'`, plus the identical two conditions on
-- the parent `universities` row) is copied verbatim from
-- 0006_global_university_course_data.sql's own pre-existing public policy
-- "Public can read published active courses of published unis" — the
-- single, real, already-established definition of "currently
-- applicable-to", not an invented rule. A student can therefore never
-- start an application against a course/university pair they could not
-- already see on the public site. One generic error covers every distinct
-- failure reason (course does not exist / belongs to a different
-- university / not currently published+active) — the same
-- anti-enumeration discipline as student_advance_application()'s "may not
-- be yours, or its status may have already changed" message.
--
-- Reapplication / duplicate handling: mirrors startApplicationFromCourse()'s
-- own pre-patch pre-check exactly (reuse a NON-TERMINAL existing
-- application for this course; 'rejected'/'withdrawn' are never reused, so
-- a fresh row is always created after either) — this RPC is now the
-- single, database-authoritative place that rule lives, so the TypeScript
-- caller's own pre-check becomes redundant and is removed (see
-- src/lib/supabase/education/applications.ts). Concurrency is handled the
-- same way the pre-existing partial unique indexes (PART 5 above) were
-- always meant to be used: a `unique_violation` exception handler re-selects
-- the now-existing row rather than surfacing the raw constraint violation.
create or replace function public.student_start_application(p_course_id uuid, p_university_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_id uuid;
  v_existing_id uuid;
  v_new_id uuid;
begin
  v_student_id := auth.uid();
  if v_student_id is null then
    raise exception 'Not authenticated.' using errcode = '28000';
  end if;

  if p_course_id is null or p_university_id is null then
    raise exception 'This course could not be found or is not currently accepting applications.' using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from public.courses c
    join public.universities u on u.id = c.university_id
    where c.id = p_course_id
      and c.university_id = p_university_id
      and c.is_active = true
      and c.publication_status = 'published'
      and u.is_active = true
      and u.publication_status = 'published'
  ) then
    raise exception 'This course could not be found or is not currently accepting applications.' using errcode = 'P0001';
  end if;

  select id into v_existing_id
  from public.applications
  where student_user_id = v_student_id
    and course_id = p_course_id
    and stage not in ('rejected', 'withdrawn')
  order by created_at desc
  limit 1;

  if v_existing_id is not null then
    return v_existing_id;
  end if;

  begin
    insert into public.applications (
      student_user_id, university_id, course_id, assigned_counsellor_id,
      stage, intake, submission_date, decision_status, offer_type, deadlines,
      next_action, next_action_date, last_contact_date, internal_notes
    ) values (
      v_student_id, p_university_id, p_course_id, null,
      'inquiry', null, null, 'pending', null, '[]'::jsonb,
      null, null, null, null
    )
    returning id into v_new_id;
  exception when unique_violation then
    -- Genuine concurrent race (double-click, or racing a reapplication) —
    -- the two partial unique indexes in PART 5 are the authoritative
    -- backstop; re-select the row the other transaction just committed
    -- rather than surfacing the raw constraint violation to the caller.
    select id into v_new_id
    from public.applications
    where student_user_id = v_student_id
      and course_id = p_course_id
      and stage not in ('rejected', 'withdrawn')
    order by created_at desc
    limit 1;
    if v_new_id is null then
      raise;
    end if;
  end;

  return v_new_id;
end;
$$;

comment on function public.student_start_application(uuid, uuid) is
  'Milestone 16 (v3 patch) — the ONLY path by which a student creates their OWN application. student_user_id is always auth.uid() (never a parameter); stage is always ''inquiry''; decision_status is always ''pending''; assigned_counsellor_id/internal_notes/last_contact_date are always null — none of these are settable by the caller. Verifies the course/university pair using the exact same published+active gate as the public course-browsing RLS policy (0006_global_university_course_data.sql). Reuses an existing non-terminal application for the same course; a rejected/withdrawn one is never reused, so reapplication always succeeds. Returns only the application id, never the full row. A unique_violation on the backing partial index (PART 5) is caught and resolved by re-selecting rather than erroring.';

revoke all on function public.student_start_application(uuid, uuid) from public;
grant execute on function public.student_start_application(uuid, uuid) to authenticated;


-- ============================================================================
-- PART 10 — v3: course_id/university_id consistency — shared by BOTH the
-- new student RPC (PART 9) and the pre-existing admin create/update path
-- ============================================================================
--
-- AUDIT FINDING (v3): student_start_application() (PART 9) already verifies
-- course_id/university_id consistency for its own INSERT, but the
-- pre-existing admin path (src/lib/supabase/admin/applications.ts's
-- createApplication()/updateApplication()) performs its own direct INSERT/
-- UPDATE with no equivalent check at all — an admin form bug, a stale
-- dropdown selection, or a manipulated form submission could silently
-- persist "University A + Course belonging to University B". Per this
-- patch's own instruction ("prefer a database invariant/trigger if
-- appropriate so both student and admin paths receive the same
-- protection"), this is a single BEFORE INSERT/UPDATE trigger — the same
-- "cross-table check needs a trigger, not a CHECK constraint" pattern PART
-- 2.1's validate_application_course_intake() already established — applied
-- unconditionally to every write path, admin or RPC alike.
--
-- AUDIT FINDING (admin code, src/lib/supabase/admin/applications.ts): both
-- createApplication() and updateApplication() take `university_id`/
-- `course_id` independently from raw form fields (parseApplicationForm()),
-- with NO correlation enforced between them today — an admin can
-- legitimately submit a university with no course yet selected (an early
-- "inquiry" stage lead the counsellor hasn't matched to a specific course),
-- or, in principle, either one alone. Making this trigger REQUIRE both
-- together would risk breaking that already-real, un-audited admin
-- workflow. So — mirroring validate_application_course_intake()'s own
-- "skip entirely whenever the referenced column is null" precedent for the
-- intake case — this trigger validates the pairing ONLY when BOTH
-- course_id AND university_id are non-null; either one alone (or both null)
-- always passes untouched. This closes the actual vulnerability the spec
-- describes (a manipulated caller pairing a real course with the WRONG,
-- also-real university) without narrowing any existing admin capability.
create or replace function public.validate_application_course_university()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.course_id is not null and new.university_id is not null then
    if not exists (select 1 from public.courses c where c.id = new.course_id and c.university_id = new.university_id) then
      raise exception 'course_id does not belong to the application''s university_id.' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

comment on function public.validate_application_course_university() is
  'Milestone 16 (v3 patch) — BEFORE INSERT/UPDATE guard ensuring applications.course_id, when set together with applications.university_id, actually belongs to that university (courses.university_id is the sole, direct, NOT NULL FK relationship — confirmed by auditing 0004_admin_system.sql''s own public.courses definition; there is no campus-mediated indirection). Skips validation entirely whenever EITHER column is null, matching the admin form''s own existing (un-audited-until-now) ability to submit one without the other — this closes the "University A + Course of University B" gap without narrowing any existing admin capability. Applies to every write path (student_start_application() and the admin create/update path) equally, since it is a table-level trigger, not something either caller could bypass individually.';

drop trigger if exists validate_applications_course_university on public.applications;
create trigger validate_applications_course_university
  before insert or update of course_id, university_id on public.applications
  for each row execute function public.validate_application_course_university();
