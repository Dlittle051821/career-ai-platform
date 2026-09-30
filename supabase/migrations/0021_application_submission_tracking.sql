-- ============================================================================
-- Milestone 19 — Application Submission Preparation & Manual Submission
-- Tracking
-- ============================================================================
--
-- BASELINE: written against the real repository at HEAD
-- aca150c1b2933f4afa357b7669ca501c841ae3ee ("M17B public SEO and search
-- presentation hardening"), branch release/m10. supabase/migrations/
-- contains 0001-0020 at that HEAD; this file is the next free number. 0018,
-- 0019, and 0020 are NOT edited by this migration — every change below is
-- additive/new-object-only. Nothing here touches payments, invoices,
-- refunds, pricing, Razorpay, robots.ts/sitemap.ts, or any other SEO-owned
-- file.
--
-- M19 is explicitly NOT a new application architecture, NOT a generic
-- workflow engine, and NOT a university-portal integration (task's own
-- words) — the actual application submission remains a MANUAL action by an
-- authorized staff member outside this product. What this migration adds is
-- the operational layer AFTER an application is internally reviewed (M16
-- lifecycle + M17 documents + M18 processing workspace) and BEFORE/AT the
-- moment staff record that the manual external submission already happened:
--
--   PART 1 — public.application_submissions: one immutable row per
--            application recording that an external submission was
--            performed, by whom (server-derived), when, how, and with what
--            external reference/platform/URL/internal note. See
--            docs/application-submission-guide.md "Database design" for the
--            full reasoning on why this is a NEW pair of tables rather than
--            new columns on `applications` — a submission event has a
--            materially different shape and audit lifecycle than the
--            columns already on that row, and (per PART 3 below) needs its
--            own immutable child rows referencing exact document versions,
--            which a same-row column could never express.
--   PART 2 — public.application_submission_documents: one row per document
--            actually included in the submission, referencing the EXACT
--            application_documents ROW ID at the moment of submission (never
--            a document TYPE alone) — this is what "the submission snapshot
--            is immutable even if the student later replaces a document" is
--            built on. document_type is deliberately denormalized onto this
--            child row (justified below, PART 2) so a submission's document
--            pack can be read without a join, even in the deeply
--            hypothetical case the parent application_documents row's own
--            document_type were ever altered (it never is, in practice).
--   PART 3 — staff_record_application_submission(): the ONLY way a
--            submission is ever recorded. One atomic PL/pgSQL function that
--            re-validates authorization, stage eligibility, document state,
--            and checklist completeness against the CURRENT database state
--            (never a value read earlier by the caller), locks the parent
--            application row for the duration (serializing every
--            concurrency case this task's spec calls out — see this
--            function's own comment), and — only on success — creates the
--            submission row, its document-snapshot child rows, and performs
--            the EXISTING M16 ready_to_submit -> submitted stage transition
--            (never a newly invented stage) in the SAME transaction.
--   PART 4 — get_my_application_submission(): the ONLY way a student ever
--            reads their own submission record — a narrow SECURITY DEFINER
--            function whose RETURNS TABLE structurally excludes
--            submitted_by_user_id, internal_note, external_url, and
--            platform_name (none of those are safe/useful for a student —
--            see docs/application-submission-guide.md "Student data-exposure
--            boundary").
--   PART 5 — RLS on both new tables: staff (super_admin/admin/assigned
--            counsellor) SELECT only — matching 0018/0020's exact two-branch
--            role/assignment shape — and NO INSERT/UPDATE/DELETE policy for
--            anyone. Every write happens exclusively inside
--            staff_record_application_submission(), which (like every other
--            SECURITY DEFINER function in this codebase — see
--            student_upload_application_document() in 0018) runs as the
--            table owner and is therefore not itself subject to these
--            SELECT-only policies. There is deliberately no student SELECT
--            policy at all — a student's only path to their own submission
--            is PART 4's narrow RPC, per this task's own "prefer NOT giving
--            students raw table SELECT access" instruction.
--   PART 6 — explicit anon revoke for every new function, per the lesson
--            0019 already taught this codebase: Supabase's default
--            privilege configuration grants EXECUTE on a new function to
--            anon directly, separate from `public` membership. A bare
--            `revoke ... from public` is not enough.
--
-- ONE VS MULTIPLE SUBMISSIONS (explicit design decision — task requires
-- this be documented): exactly ONE immutable application_submissions row per
-- application, enforced by a UNIQUE index on application_id (PART 1). The
-- current M16 lifecycle graph (APPLICATION_STAGE_TRANSITIONS,
-- src/lib/admin/status.ts) has no edge back from 'submitted' to
-- 'ready_to_submit' — 'submitted' can only move forward to 'under_review' or
-- 'withdrawn' — so this product has no resubmission semantics today. Adding
-- a multi-submission model now would be building a workflow the lifecycle
-- itself does not support yet; a real "corrected resubmission" feature would
-- need its own explicit M16 lifecycle change first, at which point this
-- table can be revisited (see docs/application-submission-guide.md
-- "Limitations / deferred work"). The unique index doubles as this
-- migration's core concurrency guarantee: two staff racing to record the
-- same submission can never both succeed (see PART 3's own comment).
--
-- STAGE TRANSITION REUSE: this migration reuses the EXISTING
-- ready_to_submit -> submitted edge (already present in
-- APPLICATION_STAGE_TRANSITIONS and in student_advance_application()'s own
-- 'submit' action, 0017 PART 3) — no new stage is invented. Submission
-- readiness is therefore defined as requiring stage = 'ready_to_submit'
-- specifically (a strict narrowing of M18's own broader
-- READINESS_APPROPRIATE_STAGES, which also allows 'inquiry'/'preparing' for
-- its own, purely informational purpose) — see
-- src/lib/applications/application-submission.ts's own header comment for
-- the full three-layer relationship (M16 stage / M18 readiness / M19
-- submission readiness).
--
-- No document is ever copied to a second storage location by this
-- migration — a submission snapshot captures document METADATA/identity
-- (the exact application_documents row id) only, per this task's own "M19
-- snapshots document metadata/reference identity" instruction. Nothing here
-- touches the application-documents Storage bucket, its RLS policies, or
-- public bucket access in any way.
-- ============================================================================


-- ============================================================================
-- PART 1 — public.application_submissions
-- ============================================================================
--
-- Immutable once written: no UPDATE policy exists anywhere in this file, no
-- trigger sets updated_at, and no code path in this milestone ever issues an
-- UPDATE against this table after its INSERT. This is deliberate — the whole
-- point of "the submission snapshot must survive a later document
-- replacement or stage change" is that this row, once created, never
-- changes again.
--
-- university_id/course_id/course_intake_id are kept as FKs (ON DELETE SET
-- NULL — nothing in this codebase ever hard-deletes a university/course/
-- intake row today, but if that were ever added later, it must never be
-- allowed to destroy this audit row) purely for convenient joins;
-- university_label/course_label/intake_label are the actual immutable
-- record of what was submitted, captured as plain text at submission time,
-- so a later rename of the university/course record can never rewrite this
-- historical row's meaning.
create table if not exists public.application_submissions (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  submitted_at timestamptz not null default now(),
  submitted_by_user_id uuid references auth.users (id) on delete set null,
  submission_method text not null,
  platform_name text,
  external_reference text,
  external_url text,
  internal_note text,
  application_stage_at_submission text not null,
  university_id uuid references public.universities (id) on delete set null,
  university_label text,
  course_id uuid references public.courses (id) on delete set null,
  course_label text,
  course_intake_id uuid references public.course_intakes (id) on delete set null,
  intake_label text,
  created_at timestamptz not null default now(),
  constraint application_submissions_method_check check (
    submission_method in ('university_portal', 'centralized_platform', 'email', 'agent_partner', 'other')
  ),
  constraint application_submissions_platform_name_length_check check (platform_name is null or length(platform_name) <= 200),
  constraint application_submissions_external_reference_length_check check (external_reference is null or length(external_reference) <= 200),
  constraint application_submissions_external_url_length_check check (external_url is null or length(external_url) <= 500),
  constraint application_submissions_external_url_format_check check (external_url is null or external_url ~ '^https?://'),
  constraint application_submissions_internal_note_length_check check (internal_note is null or length(internal_note) <= 2000)
);

-- Enforces "exactly one submission per application" (see this file's own
-- header comment for the explicit one-vs-multiple design decision) AND is
-- this migration's core defense against two staff racing to record the same
-- submission simultaneously — the second INSERT attempting to violate this
-- index fails outright, on top of (not instead of) the row-lock-based
-- serialization staff_record_application_submission() already performs.
create unique index if not exists application_submissions_one_per_application on public.application_submissions (application_id);

create index if not exists application_submissions_submitted_at_idx on public.application_submissions (submitted_at);

comment on table public.application_submissions is
  'Milestone 19 — one IMMUTABLE row per application recording that staff manually performed (or recorded having already performed) an external submission. Never written or modified except by staff_record_application_submission(). Never implies Nextwise itself submitted anything to a university system — this is a record of a manual action, not an automated one.';
comment on column public.application_submissions.submitted_by_user_id is
  'Milestone 19 — always set from auth.uid() by staff_record_application_submission(), never a caller-supplied value. STAFF-ONLY — never returned by get_my_application_submission().';
comment on column public.application_submissions.internal_note is
  'Milestone 19 — STAFF-ONLY free text. Never returned by get_my_application_submission() and never rendered on any student-facing page. Must never contain portal credentials or passwords — this is documented, not database-enforced, matching this codebase''s existing convention for review_note/internal notes elsewhere.';
comment on column public.application_submissions.application_stage_at_submission is
  'Milestone 19 — the applications.stage value immediately before this migration''s own stage transition (always ''ready_to_submit'' in practice, since that is the only stage staff_record_application_submission() accepts) — captured so this historical row remains meaningful even if a future milestone widens which stages are eligible.';


-- ============================================================================
-- PART 2 — public.application_submission_documents
-- ============================================================================
--
-- The immutable link between a submission and the EXACT application_documents
-- ROW used — never a document TYPE alone, and never the CURRENT row for that
-- type at read time (which could by then be a completely different row, if
-- the student has since replaced it). application_document_id references
-- application_documents ON DELETE RESTRICT, not CASCADE and not SET NULL:
-- this table's whole purpose is to make it structurally impossible for any
-- future cleanup/maintenance code to delete a document row this migration
-- has snapshotted without that cleanup failing loudly first. In current
-- practice this is a belt-and-suspenders guarantee, not a live risk — every
-- existing document mutation path (student_upload_application_document's
-- replacement, student_remove_application_document) already only ever sets
-- is_current = false / removed_at, never DELETE (0018 PART 6/7) — but the
-- task explicitly asks that FK delete behavior be inspected carefully and
-- never allow a later cleanup to destroy submission audit history, so this
-- constraint makes that guarantee explicit at the schema level rather than
-- resting solely on "no code path happens to delete rows today".
--
-- document_type is deliberately denormalized from application_documents.
-- Documented per this task's own suggested example ("justify any
-- denormalization, e.g. duplicating document_type"): it lets staff read
-- "what document types were in this submission" with zero joins, and
-- remains correct even in the (never-exercised) hypothetical case a future
-- change ever allowed a document row's own document_type to be edited after
-- creation — this frozen copy would still reflect what was true at
-- submission time.
create table if not exists public.application_submission_documents (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.application_submissions (id) on delete cascade,
  application_document_id uuid not null references public.application_documents (id) on delete restrict,
  document_type text not null,
  created_at timestamptz not null default now(),
  constraint application_submission_documents_unique unique (submission_id, application_document_id)
);

create index if not exists application_submission_documents_submission_idx on public.application_submission_documents (submission_id);
create index if not exists application_submission_documents_document_idx on public.application_submission_documents (application_document_id);

comment on table public.application_submission_documents is
  'Milestone 19 — one row per document actually included in a submission, referencing the exact application_documents row id at that moment. application_document_id is ON DELETE RESTRICT deliberately (see this table''s own header comment) — a later document lifecycle change can retire (is_current = false) the referenced row, but can never destroy it, so this snapshot always remains resolvable. Rows here are only ever inserted by staff_record_application_submission(), in the same transaction as the parent application_submissions row, and are never updated or deleted afterward.';


-- ============================================================================
-- PART 3 — staff_record_application_submission(): the ONLY way a submission
-- is ever recorded.
-- ============================================================================
--
-- One atomic PL/pgSQL function. Every authorization, eligibility, and
-- document/checklist state check below re-reads the CURRENT database state
-- inside this function's own transaction — never a value the caller read
-- earlier and passed in — closing exactly the "SELECT-check -> client ->
-- later INSERT" gap this task's spec explicitly warns against.
--
-- CONCURRENCY: `select ... from public.applications where id = p_application_id
-- for update` locks the parent application row for the remainder of this
-- transaction. Every other mutating path that touches this same application
-- row (student_advance_application, student_upload_application_document,
-- student_remove_application_document, staff_review_application_document
-- indirectly via its own document-row lock, and the admin updateApplication()
-- conditional UPDATE) either takes the same row lock or performs its own
-- conditional UPDATE against the current row state — so two callers racing
-- on the same application always serialize against each other and the loser
-- always re-validates against the winner's already-committed result. This is
-- what makes all four of this task's explicit concurrency cases safe:
--
--   Case 1 (counsellor''s page open, student replaces an accepted document,
--   counsellor presses record): the student''s replacement locks and commits
--   first or second — either way, by the time this function''s own document
--   checks run, the replaced document''s new current row is back at
--   'pending_review' (0018/0020''s own DEFAULT), so the "required document
--   accepted" check below fails and this function raises the generic
--   "no longer ready for submission" error. EXPECTED, per spec.
--
--   Case 2 (counsellor A and admin both press record simultaneously): the
--   second caller''s `for update` blocks until the first transaction commits,
--   then re-reads the row fresh and its own "already submitted" check
--   (against the now-existing application_submissions row) fails — on top
--   of the belt-and-suspenders unique index on application_id (PART 1),
--   which would reject a duplicate INSERT even if the row lock were somehow
--   bypassed. EXPECTED: no duplicate current submission is ever created.
--
--   Case 3 (counsellor becomes unassigned before pressing submit): the
--   authorization check below re-reads `assigned_counsellor_id` from the
--   freshly locked row, not from anything the caller''s stale page loaded
--   earlier — a now-unassigned counsellor fails this check and receives "You
--   no longer have access to submit this application." EXPECTED.
--
--   Case 4 (application stage moves before a stale form submits): the stage
--   check below requires the freshly locked row''s stage to still be
--   'ready_to_submit' — a stage that has since moved on fails this check
--   with the generic "no longer ready for submission" message. EXPECTED.
--
-- AUTHORIZATION: identical two-branch shape to every other staff RPC/RLS
-- policy in this codebase (0018/0020) — super_admin/admin, or an assigned
-- counsellor. Finance/analyst/content_editor/student/anonymous callers all
-- fail this same check (a student caller additionally already fails the
-- earlier is_admin_role()-based checks entirely, since they hold no admin
-- role row at all).
--
-- ERROR MESSAGES: every raise below is safe, honest, and already
-- user-facing text — no raw Postgres/constraint detail is ever attached.
-- Several distinct failure reasons deliberately share the exact same
-- generic "no longer ready for submission" message (stage ineligible,
-- document not accepted/current, needs_correction outstanding, checklist
-- incomplete) — this is the same anti-enumeration posture used throughout
-- this codebase (see staff_review_application_document()'s own comment):
-- a caller can never distinguish exactly which readiness signal failed from
-- the error text alone; the admin UI's own readiness panel (computed from
-- the same underlying signals via a fresh page load) is what tells staff
-- specifically what to fix.
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
  -- see this function's own header comment for why every concurrency case
  -- this task calls out is safe as a direct consequence of this lock.
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

  -- Stage eligibility: reuses the EXISTING ready_to_submit -> submitted edge
  -- (APPLICATION_STAGE_TRANSITIONS, src/lib/admin/status.ts) — the only
  -- stage this function ever transitions FROM. See this migration's own top
  -- comment for why this is a deliberate narrowing of M18's broader
  -- READINESS_APPROPRIATE_STAGES.
  if v_app.stage <> 'ready_to_submit' then
    raise exception 'This application is no longer ready for submission. Refresh and review the latest details.' using errcode = 'P0001';
  end if;

  -- No current document (required or not) may be sitting in
  -- needs_correction — an unresolved student-facing correction blocks
  -- submission outright, matching this table's own review-state semantics
  -- (0020 PART 1/2).
  if exists (
    select 1 from public.application_documents d
    where d.application_id = p_application_id and d.is_current = true and d.review_status = 'needs_correction'
  ) then
    raise exception 'This application is no longer ready for submission. Refresh and review the latest details.' using errcode = 'P0001';
  end if;

  -- Every REQUIRED document type (kept in sync by hand with
  -- REQUIRED_APPLICATION_DOCUMENT_TYPES in
  -- src/lib/applications/application-documents.ts, the same manual-sync
  -- convention this codebase already uses for the document_type/item_key
  -- CHECK constraints in 0018/0020) must have a CURRENT, ACCEPTED document —
  -- covers "missing" and "uploaded but still pending_review" in one check.
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

  -- Every manual M18 checklist item must be complete — kept in sync by hand
  -- with APPLICATION_CHECKLIST_ITEM_KEYS in
  -- src/lib/applications/application-checklist.ts, same manual-sync
  -- convention as the document-type vocabulary above.
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

  -- The full current+accepted document pack is always snapshotted in its
  -- entirety — there is no staff-selectable subset. This is a deliberate
  -- simplification (see docs/application-submission-guide.md "Document-
  -- version immutability strategy"): it removes an entire class of
  -- client-trust issues (a caller omitting an accepted required document, or
  -- passing a document id that belongs to a different application) by never
  -- accepting a document-id list from the caller in the first place. Every
  -- document included here was already verified current+accepted by the
  -- checks above (the required-type check) or is a current+accepted
  -- recommended document included for completeness.
  insert into public.application_submission_documents (submission_id, application_document_id, document_type)
  select v_submission_id, d.id, d.document_type
  from public.application_documents d
  where d.application_id = p_application_id and d.is_current = true and d.review_status = 'accepted';

  -- The SAME existing M16 stage transition
  -- (ready_to_submit -> submitted) — never a newly invented stage. The
  -- WHERE clause re-asserts stage = 'ready_to_submit' one more time (defense
  -- in depth beyond the row lock, matching this codebase's own conditional-
  -- UPDATE convention in applyApplicationUpdate()/staff_review_application_
  -- document()) — if this somehow matches zero rows despite the lock, the
  -- exception below rolls back the entire transaction, including the two
  -- inserts above, so no partial submission state is ever left behind.
  update public.applications
  set stage = 'submitted', submitted_at = now()
  where id = p_application_id and stage = 'ready_to_submit'
  returning stage into v_new_stage;

  if v_new_stage is null then
    raise exception 'This application is no longer ready for submission. Refresh and review the latest details.' using errcode = 'P0001';
  end if;

  insert into public.application_status_history (application_id, from_status, to_status, changed_by, actor_type, student_visible_message)
  values (p_application_id, 'ready_to_submit', 'submitted', auth.uid(), v_actor_type, 'Your application has been submitted.');

  return query select v_row.id, v_row.application_id, v_row.submitted_at, v_row.submission_method, v_row.platform_name, v_row.external_reference, v_row.external_url, v_new_stage;
end;
$$;

comment on function public.staff_record_application_submission(uuid, text, text, text, text, text) is
  'Milestone 19 — the ONLY way a staff member (super_admin/admin/assigned counsellor) records that an application was manually submitted externally. One atomic transaction: locks the parent application row, re-validates authorization/stage/document/checklist state against the CURRENT database, creates the immutable submission row and its document-snapshot child rows, performs the EXISTING ready_to_submit -> submitted stage transition, and writes a status-history entry — or raises one of a small set of safe, generic, anti-enumeration errors and rolls back everything. Never trusts a caller-supplied submitted_by/reviewer/assignment/stage/readiness value. This function never implies Nextwise itself submitted anything to a university system — it only records that staff already did, manually, outside this product.';

revoke all on function public.staff_record_application_submission(uuid, text, text, text, text, text) from public;
revoke execute on function public.staff_record_application_submission(uuid, text, text, text, text, text) from anon;
grant execute on function public.staff_record_application_submission(uuid, text, text, text, text, text) to authenticated;


-- ============================================================================
-- PART 4 — get_my_application_submission(): the ONLY way a student ever
-- reads their own submission record.
-- ============================================================================
--
-- Returns zero rows (never an error) both when no submission exists yet AND
-- when the application id does not belong to the caller — same
-- anti-enumeration posture as get_my_application()/get_my_application_
-- documents() (0017/0018): a student probing another student's application
-- id can never distinguish "not submitted yet" from "not yours" from
-- "doesn't exist" from this function's behavior alone.
--
-- RETURNS TABLE structurally excludes submitted_by_user_id, internal_note,
-- external_url, and platform_name — none of those are safe or useful for a
-- student (see docs/application-submission-guide.md "Student data-exposure
-- boundary" for the full reasoning on each excluded field). This is a
-- narrowing decision made once, here, rather than trusted to every future
-- caller to remember not to select those columns.
create or replace function public.get_my_application_submission(p_application_id uuid)
returns table (
  id uuid,
  application_id uuid,
  submitted_at timestamptz,
  submission_method text,
  external_reference text,
  university_label text,
  course_label text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    s.id, s.application_id, s.submitted_at, s.submission_method, s.external_reference,
    s.university_label, s.course_label, s.created_at
  from public.application_submissions s
  join public.applications a on a.id = s.application_id
  where s.application_id = p_application_id
    and a.student_user_id = auth.uid();
$$;

comment on function public.get_my_application_submission(uuid) is
  'Milestone 19 — the ONLY path by which a student reads their own application_submissions row. Structurally excludes submitted_by_user_id, internal_note, external_url, and platform_name — all staff-only/not-safely-student-facing. Zero rows (never an error) for a not-yet-submitted or not-owned application id.';

revoke all on function public.get_my_application_submission(uuid) from public;
revoke execute on function public.get_my_application_submission(uuid) from anon;
grant execute on function public.get_my_application_submission(uuid) to authenticated;


-- ============================================================================
-- PART 5 — Row Level Security
-- ============================================================================

alter table public.application_submissions enable row level security;

drop policy if exists "Admins/assigned counsellor can read application submissions" on public.application_submissions;
create policy "Admins/assigned counsellor can read application submissions"
  on public.application_submissions for select to authenticated
  using (
    exists (
      select 1 from public.applications a
      where a.id = application_submissions.application_id
        and (
          public.is_admin_role(array['super_admin', 'admin'])
          or (public.is_admin_role(array['counsellor']) and a.assigned_counsellor_id = public.current_counsellor_id())
        )
    )
  );

-- No INSERT/UPDATE/DELETE policy for anyone — every write happens exclusively
-- inside staff_record_application_submission(), which (as the table owner's
-- SECURITY DEFINER function) is not itself subject to this SELECT-only
-- policy, exactly mirroring 0018/0020's own application_documents/
-- application_checklist_items write posture. There is deliberately NO
-- student SELECT policy at all — a student's only path to their own
-- submission is PART 4's narrow RPC.

alter table public.application_submission_documents enable row level security;

drop policy if exists "Admins/assigned counsellor can read submission documents" on public.application_submission_documents;
create policy "Admins/assigned counsellor can read submission documents"
  on public.application_submission_documents for select to authenticated
  using (
    exists (
      select 1 from public.application_submissions s
      join public.applications a on a.id = s.application_id
      where s.id = application_submission_documents.submission_id
        and (
          public.is_admin_role(array['super_admin', 'admin'])
          or (public.is_admin_role(array['counsellor']) and a.assigned_counsellor_id = public.current_counsellor_id())
        )
    )
  );

-- No INSERT/UPDATE/DELETE policy for anyone — same reasoning as
-- application_submissions above. finance/analyst/content_editor get no
-- policy branch on either table above and therefore see zero rows, matching
-- this task's explicit "default to DENY" instruction for those three roles.


-- ============================================================================
-- PART 6 — explicit anon revoke for every new function (the 0019 lesson)
-- ============================================================================
--
-- Both grant/revoke sequences above already include an explicit
-- `revoke execute ... from anon` line before the `grant ... to authenticated`
-- line — this PART exists only as a single, greppable confirmation of that
-- fact for the migration-security regression test, matching 0020's own PART
-- 6 convention.
