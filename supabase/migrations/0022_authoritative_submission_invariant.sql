-- ============================================================================
-- Milestone 19 — IN-PLACE CORRECTION: the authoritative "submitted" invariant
-- ============================================================================
--
-- BASELINE: written against the real repository at HEAD
-- aca150c1b2933f4afa357b7669ca501c841ae3ee ("M17B public SEO and search
-- presentation hardening"), branch release/m10, with 0021 already applied on
-- top (Milestone 19 as originally delivered). supabase/migrations/ contains
-- 0001-0021 at that point; this file is the next free number. 0001-0021 are
-- NOT edited by this migration — every change below is either a new object
-- (PART 1) or a `create or replace function` redefinition of an existing
-- function, which is the established way this codebase corrects an earlier
-- milestone's function without editing that migration's file in place (see
-- 0019_application_document_rpc_permissions.sql's own redefinitions of M17
-- functions for precedent). Nothing here touches payments, invoices,
-- refunds, pricing, Razorpay, robots.ts/sitemap.ts, or any other SEO-owned
-- file.
--
-- THE BUG THIS FIXES: 0021 documented (application-submission-guide.md §4)
-- that "two independent paths can reach submitted" — a student's own
-- pre-existing M16 self-service `submit` action (student_advance_application(),
-- 0017_student_application_workflow.sql), and this milestone's own
-- staff_record_application_submission(). That is an invariant violation, not
-- a harmless overlap: applications.stage = 'submitted' must mean "Nextwise
-- has recorded an actual external university/platform submission", which
-- requires a corresponding immutable application_submissions row. The
-- student self-service path can set the SAME stage value with NO submission
-- row, NO document snapshot, and NO immutable record at all. A THIRD path
-- has the identical problem: the generic admin "edit application" form
-- (updateApplication(), src/lib/supabase/admin/applications.ts) can also set
-- stage directly to 'submitted' via APPLICATION_STAGE_TRANSITIONS'
-- ready_to_submit -> submitted edge, again with no submission row created.
--
-- THE FIX, in two parts:
--
--   PART 1 — A trigger-enforced invariant on public.applications itself:
--            NO statement, from ANY caller (student RPC, admin generic
--            update, any future code path, or a direct SQL statement run by
--            someone with table access) may set stage = 'submitted' unless
--            a transaction-local flag is set — and that flag is set (and
--            immediately cleared) ONLY inside
--            staff_record_application_submission(), immediately around its
--            own stage UPDATE. This is deliberately NOT "hide the button and
--            hope" — it is a database-level backstop that holds regardless
--            of which application-layer code path is used, including ones
--            this correction did not think to find.
--
--   PART 2 — student_advance_application() is redefined (same signature, same
--            SECURITY DEFINER/search_path posture as 0017) so its 'submit'
--            case now raises a clear, honest, safe error instead of
--            performing the transition — never falls through to the shared
--            UPDATE at the bottom of the function. This is defense in depth
--            ALONGSIDE PART 1's trigger, not instead of it: even if this
--            function were ever mis-edited back to performing the UPDATE,
--            PART 1's trigger would still block it. Every other action
--            (start_preparing, mark_ready_to_submit, withdraw) is completely
--            unchanged — same from-stages, same to-stage, same message.
--
--   PART 3 — staff_record_application_submission() is redefined (same
--            signature, same behavior) with one addition: it sets the PART 1
--            flag immediately before its own stage UPDATE and clears it
--            immediately after. Every other line — locking, authorization,
--            readiness checks, the submission/document-snapshot inserts, the
--            conditional UPDATE's own WHERE clause, the status-history
--            insert — is byte-for-byte identical to 0021.
--
-- The application-layer (TypeScript) half of this fix — hiding the "Mark as
-- submitted" button so a student is never shown a control that would now
-- always fail, and rewriting the ready_to_submit next-action copy so it
-- never implies the student can perform this step — lives in
-- src/lib/applications/application-lifecycle.ts, not in this migration; see
-- that file's own comment for the corresponding change. Per this milestone's
-- own "do not rely only on hiding a student button" instruction, PART 1's
-- trigger is the actual enforcement; the UI change is a UX courtesy on top of
-- it, not a substitute for it.
-- ============================================================================


-- ============================================================================
-- PART 1 — Database-enforced invariant: only staff_record_application_
-- submission() may transition an application's stage to 'submitted'.
-- ============================================================================

create or replace function public.applications_enforce_submitted_transition()
returns trigger
language plpgsql
as $$
begin
  -- Only a genuine transition INTO 'submitted' is gated — an unrelated
  -- column update on an already-submitted row (new.stage = old.stage =
  -- 'submitted') is untouched, and so is every update that never touches
  -- 'submitted' at all (the overwhelming majority of writes to this table).
  if new.stage = 'submitted' and old.stage is distinct from new.stage then
    if coalesce(current_setting('app.allow_authoritative_submission', true), '') <> 'on' then
      raise exception 'An application can only be marked "submitted" through Nextwise''s authoritative submission-recording process. Refresh and try again.' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

comment on function public.applications_enforce_submitted_transition() is
  'Milestone 19 correction — database-level backstop for the invariant that applications.stage can only become ''submitted'' via staff_record_application_submission(). Blocks ANY other UPDATE (the student_advance_application() RPC, the admin generic updateApplication() path, a future code path, or a raw SQL statement) from performing this specific transition, regardless of the caller''s privilege level. The transaction-local app.allow_authoritative_submission flag this function checks is set, and immediately cleared, ONLY inside staff_record_application_submission() around its own stage UPDATE — no other function in this codebase sets it.';

drop trigger if exists applications_enforce_submitted_transition on public.applications;
create trigger applications_enforce_submitted_transition
  before update on public.applications
  for each row
  execute function public.applications_enforce_submitted_transition();


-- ============================================================================
-- PART 2 — student_advance_application(): 'submit' no longer transitions
-- anything. Redefinition of the 0017 function; every other action is
-- unchanged.
-- ============================================================================

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
      -- MILESTONE 19 CORRECTION: a student may no longer self-transition
      -- directly to 'submitted' — applications.stage = 'submitted' must now
      -- always correspond to an immutable application_submissions row
      -- (staff_record_application_submission()), which this RPC has no
      -- ability to create and no business creating. The action name is kept
      -- (never repurposed for a different transition) purely so any
      -- historical application_status_history/product_events row already
      -- referencing it stays meaningful; it can simply never succeed again.
      -- This raises BEFORE v_from_stages/v_to_stage are ever set, so
      -- execution never reaches the shared lock/UPDATE logic below for this
      -- action — and even if it somehow did, PART 1's trigger on
      -- public.applications would still block the UPDATE itself.
      raise exception 'This step is now completed by Nextwise staff once they record your application as actually submitted to the university. Your counsellor or Nextwise support can help with this.' using errcode = '42501';
    when 'withdraw' then
      v_from_stages := array['inquiry', 'preparing', 'ready_to_submit', 'submitted', 'under_review', 'interview'];
      v_to_stage := 'withdrawn';
      v_message := 'You withdrew this application.';
    else
      raise exception 'Unknown application action: %', p_action using errcode = '22023';
  end case;

  -- Lock the row FIRST — unchanged from 0017. See that migration's own
  -- comment for why this makes the whole function atomic from a concurrent
  -- caller's point of view.
  select * into v_row from public.applications where id = p_application_id and student_user_id = auth.uid() for update;

  if v_row.id is null then
    raise exception 'This application could not be updated — it may not be yours, or its status may have already changed. Please refresh and try again.' using errcode = 'P0001';
  end if;

  if not (v_row.stage = any(v_from_stages)) then
    raise exception 'This application could not be updated — it may not be yours, or its status may have already changed. Please refresh and try again.' using errcode = 'P0001';
  end if;

  v_old_stage := v_row.stage;

  -- Unchanged from 0017 — re-asserts ownership and stage in the same
  -- statement that performs the write, not only in the preceding SELECT.
  update public.applications
  set
    stage = v_to_stage,
    submitted_at = case when v_to_stage = 'submitted' then now() else submitted_at end,
    withdrawn_at = case when v_to_stage = 'withdrawn' then now() else withdrawn_at end
  where id = p_application_id
    and student_user_id = auth.uid()
    and stage = v_old_stage
  returning * into v_row;

  if v_row.id is null then
    raise exception 'This application could not be updated — it may not be yours, or its status may have already changed. Please refresh and try again.' using errcode = 'P0001';
  end if;

  insert into public.application_status_history (application_id, from_status, to_status, changed_by, actor_type, student_visible_message)
  values (p_application_id, v_old_stage, v_to_stage, auth.uid(), 'student', v_message);

  return query select v_row.id, v_row.stage, v_row.submitted_at, v_row.withdrawn_at, v_row.updated_at;
end;
$$;

comment on function public.student_advance_application(uuid, text) is
  'Milestone 16, corrected by Milestone 19 — the ONLY path by which a student may move their OWN application forward or withdraw it. Fixed action vocabulary (start_preparing/mark_ready_to_submit/submit/withdraw); ''submit'' is retained as a recognized action name but ALWAYS raises — see this function''s own case-branch comment and supabase/migrations/0022_authoritative_submission_invariant.sql''s header. Every other action keeps its exact 0017 from-stage set and behavior. SECURITY DEFINER is safe here because every write is re-scoped to student_user_id = auth.uid() inside the UPDATE''s own WHERE clause, and auth.uid() is read server-side, never accepted as a parameter. RETURNS TABLE (id, stage, submitted_at, withdrawn_at, updated_at) only — structurally excludes internal_notes/assigned_counsellor_id/last_contact_date, never merely omits them by convention.';

-- Privileges are unchanged from 0017 (CREATE OR REPLACE FUNCTION preserves
-- existing grants for an unchanged signature) — revoked from public/anon,
-- granted to authenticated. Restated here only as a defensive, explicit
-- assertion, matching this codebase's own "belt and suspenders" convention
-- for every SECURITY DEFINER function.
revoke all on function public.student_advance_application(uuid, text) from public;
revoke execute on function public.student_advance_application(uuid, text) from anon;
grant execute on function public.student_advance_application(uuid, text) to authenticated;


-- ============================================================================
-- PART 3 — staff_record_application_submission(): sets and clears the PART 1
-- invariant flag around its own, otherwise-unchanged, stage UPDATE.
-- Redefinition of the 0021 function; every check, insert, and error message
-- is byte-for-byte identical to 0021 except the two new `perform
-- set_config(...)` lines immediately around the UPDATE.
-- ============================================================================

create or replace function public.staff_record_application_submission(
  p_application_id uuid,
  p_submission_method text,
  p_platform_name text default null,
  p_external_reference text default null,
  p_external_url text default null,
  p_internal_note text default null
)
returns table (
  id uuid,
  application_id uuid,
  submitted_at timestamptz,
  submission_method text,
  platform_name text,
  external_reference text,
  external_url text,
  stage text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_app public.applications;
  v_is_admin boolean;
  v_actor_type text;
  v_submission_id uuid;
  v_university_label text;
  v_course_label text;
  v_new_stage text;
  v_row public.application_submissions;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated.' using errcode = '28000';
  end if;

  if p_submission_method not in ('university_portal', 'centralized_platform', 'email', 'agent_partner', 'other') then
    raise exception 'This submission method is not recognized.' using errcode = '22023';
  end if;

  if p_platform_name is not null and length(p_platform_name) > 200 then
    raise exception 'The platform/portal name is too long (200 characters max).' using errcode = '22001';
  end if;

  if p_external_reference is not null and length(p_external_reference) > 200 then
    raise exception 'The application reference is too long (200 characters max).' using errcode = '22001';
  end if;

  if p_external_url is not null then
    if length(p_external_url) > 500 then
      raise exception 'The submission URL is too long (500 characters max).' using errcode = '22001';
    end if;
    if p_external_url !~ '^https?://' then
      raise exception 'The submission URL is not valid. Please use a link starting with http:// or https://.' using errcode = '22023';
    end if;
  end if;

  if p_internal_note is not null and length(p_internal_note) > 2000 then
    raise exception 'The internal note is too long (2000 characters max).' using errcode = '22001';
  end if;

  -- Lock the parent application row for the remainder of this transaction —
  -- unchanged from 0021.
  select * into v_app from public.applications a where a.id = p_application_id for update;

  if v_app.id is null then
    raise exception 'This application could not be found, or you do not have access to it.' using errcode = 'P0001';
  end if;

  v_is_admin := public.is_admin_role(array['super_admin', 'admin']);
  if not (
    v_is_admin
    or (public.is_admin_role(array['counsellor']) and v_app.assigned_counsellor_id = public.current_counsellor_id())
  ) then
    raise exception 'You no longer have access to submit this application.' using errcode = 'P0001';
  end if;
  v_actor_type := case when v_is_admin then 'admin' else 'counsellor' end;

  if exists (select 1 from public.application_submissions s where s.application_id = p_application_id) then
    raise exception 'This application has already been recorded as submitted.' using errcode = 'P0001';
  end if;

  if v_app.stage <> 'ready_to_submit' then
    raise exception 'This application is no longer ready for submission. Refresh and review the latest details.' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.application_documents d
    where d.application_id = p_application_id and d.is_current = true and d.review_status = 'needs_correction'
  ) then
    raise exception 'This application is no longer ready for submission. Refresh and review the latest details.' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from unnest(array['academic_transcript', 'identity_document', 'resume_cv']) as req(doc_type)
    where not exists (
      select 1 from public.application_documents d
      where d.application_id = p_application_id
        and d.document_type = req.doc_type
        and d.is_current = true
        and d.review_status = 'accepted'
    )
  ) then
    raise exception 'This application is no longer ready for submission. Refresh and review the latest details.' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from unnest(array['profile_reviewed', 'eligibility_checked', 'intake_confirmed', 'details_confirmed']) as req(item_key)
    where not exists (
      select 1 from public.application_checklist_items c
      where c.application_id = p_application_id and c.item_key = req.item_key and c.completed_at is not null
    )
  ) then
    raise exception 'This application is no longer ready for submission. Refresh and review the latest details.' using errcode = 'P0001';
  end if;

  select u.name into v_university_label from public.universities u where u.id = v_app.university_id;
  select c.name into v_course_label from public.courses c where c.id = v_app.course_id;

  insert into public.application_submissions (
    application_id, submitted_by_user_id, submission_method, platform_name, external_reference,
    external_url, internal_note, application_stage_at_submission, university_id, university_label,
    course_id, course_label, course_intake_id, intake_label
  ) values (
    v_app.id, auth.uid(), p_submission_method, p_platform_name, p_external_reference,
    p_external_url, p_internal_note, v_app.stage, v_app.university_id, v_university_label,
    v_app.course_id, v_course_label, v_app.course_intake_id, v_app.intake
  )
  returning * into v_row;
  v_submission_id := v_row.id;

  insert into public.application_submission_documents (submission_id, application_document_id, document_type)
  select v_submission_id, d.id, d.document_type
  from public.application_documents d
  where d.application_id = p_application_id and d.is_current = true and d.review_status = 'accepted';

  -- MILESTONE 19 CORRECTION: this is the ONLY place in the entire codebase
  -- that ever sets app.allow_authoritative_submission to 'on'. The flag is
  -- transaction-local (set_config(..., true)) and is explicitly turned back
  -- off immediately after the UPDATE below — it is never left "on" for any
  -- statement other than this exact UPDATE, even within this same function
  -- call, let alone leaking to some other statement in a caller's session.
  perform set_config('app.allow_authoritative_submission', 'on', true);

  update public.applications
  set stage = 'submitted', submitted_at = now()
  where id = p_application_id and stage = 'ready_to_submit'
  returning stage into v_new_stage;

  perform set_config('app.allow_authoritative_submission', 'off', true);

  if v_new_stage is null then
    raise exception 'This application is no longer ready for submission. Refresh and review the latest details.' using errcode = 'P0001';
  end if;

  insert into public.application_status_history (application_id, from_status, to_status, changed_by, actor_type, student_visible_message)
  values (p_application_id, 'ready_to_submit', 'submitted', auth.uid(), v_actor_type, 'Your application has been submitted.');

  return query select v_row.id, v_row.application_id, v_row.submitted_at, v_row.submission_method, v_row.platform_name, v_row.external_reference, v_row.external_url, v_new_stage;
end;
$$;

comment on function public.staff_record_application_submission(uuid, text, text, text, text, text) is
  'Milestone 19, corrected — the ONLY way ANY caller may transition an application to ''submitted'' (enforced independently by this migration''s PART 1 trigger, not merely by this function being the only one that tries to). Locks the parent application row, re-validates authorization/stage/document/checklist state against the CURRENT database, creates the immutable submission row and its document-snapshot child rows, sets the transaction-local app.allow_authoritative_submission flag around the EXISTING ready_to_submit -> submitted stage transition, and writes a status-history entry — or raises one of a small set of safe, generic, anti-enumeration errors and rolls back everything (including, per PART 1, any attempt by any OTHER path to have snuck the same transition in). Never trusts a caller-supplied submitted_by/reviewer/assignment/stage/readiness value. This function never implies Nextwise itself submitted anything to a university system — it only records that staff already did, manually, outside this product.';

-- Privileges are unchanged from 0021 (CREATE OR REPLACE FUNCTION preserves
-- existing grants for an unchanged signature) — revoked from public/anon,
-- granted to authenticated. Restated here only as a defensive, explicit
-- assertion.
revoke all on function public.staff_record_application_submission(uuid, text, text, text, text, text) from public;
revoke execute on function public.staff_record_application_submission(uuid, text, text, text, text, text) from anon;
grant execute on function public.staff_record_application_submission(uuid, text, text, text, text, text) to authenticated;
