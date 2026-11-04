-- ============================================================================
-- NW06 — Student Action Required: application_tasks
-- ============================================================================
--
-- STATUS: PROPOSED. NOT applied to any database by this milestone. Lives in
-- supabase/migrations-proposed/ (not supabase/migrations/) per this
-- repository's own established convention — see NW05's identical treatment
-- of NW05_student_mark_section_self_entered.sql for precedent. A
-- founder/admin must review this file and copy it into
-- supabase/migrations/ with the next sequential number (0023) before it
-- takes effect, through the normal migration process.
--
-- WHY THIS EXISTS (see docs/milestones/NW06/NW06_01_EXISTING_SYSTEM_AUDIT.md
-- §2.6/§2.7 for the full audit): Milestones 16-19 already built a complete,
-- production-quality application lifecycle, secure document store, and
-- counsellor/admin processing workspace. What they did NOT build is any
-- persisted, structured "here is a concrete thing you (the student) need to
-- do, with a due date and a completion/verification lifecycle" concept — the
-- closest existing signals (a document's review_status/correction_message,
-- applications.next_action free text) are each useful for one narrow
-- purpose but none of them is a task. This migration adds exactly that, as
-- ONE new table with a fixed task-type vocabulary that includes, as one
-- type among several, the brief's "external university/visa/government
-- payment" case — never a second, parallel payments feature, and never
-- anything that could be mistaken for Nextwise collecting money on a
-- third party's behalf (see PART 4's own comment).
--
-- CONVENTION FOLLOWED: this migration adopts the HEAVIER of this codebase's
-- two existing "staff-writable sub-resource of an application" patterns —
-- the one application_documents/application_submissions use (zero direct
-- RLS INSERT/UPDATE for anyone; every mutation is a narrow SECURITY DEFINER
-- RPC; RLS itself only ever grants SELECT) — rather than the lighter one
-- application_checklist_items uses (plain RLS INSERT/UPDATE with a WITH
-- CHECK constraining the actor column). The task record here is a genuine
-- multi-state machine (open -> in_progress -> student_completed ->
-- verified_complete, plus cancelled, with different allowed next-states
-- depending on the current one) — exactly the shape
-- staff_review_application_document() and staff_record_application_
-- submission() already use an RPC for, not the trivial boolean toggle
-- application_checklist_items is. Every RPC below: derives identity
-- exclusively from auth.uid(); is `security definer`, `set search_path =
-- public`, and (for reads) `stable`; is revoked from public/anon and
-- granted to authenticated only; returns a narrow, explicit `returns table
-- (...)` that structurally excludes staff-only columns from every
-- student-facing function; and embeds its own ownership/authorization check
-- inside its own lock/WHERE clause, never trusting a preceding read alone.
--
-- Nothing here touches payments, invoices, pricing, checkout, or Razorpay.
-- Nothing here mutates applications.stage. Nothing here is a second
-- document-storage mechanism — a task may optionally reference an existing
-- application_documents row as evidence (ON DELETE SET NULL; the document
-- itself continues to be governed entirely by 0018/0020's own, unchanged,
-- RLS/Storage policies), it never stores a file of its own.
-- ============================================================================


-- ============================================================================
-- PART 1 — public.application_tasks
-- ============================================================================

create table if not exists public.application_tasks (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  task_type text not null,
  status text not null default 'open',
  title text not null,
  description text,
  due_date date,
  -- Optional hint linking this task to one of the existing 9
  -- application_documents taxonomy values (src/lib/applications/
  -- application-documents.ts APPLICATION_DOCUMENT_TYPES) — e.g. a
  -- 'document_upload' task for 'financial_document'. Manually kept in sync
  -- with that list, same established convention as application_documents_
  -- document_type_check / application_checklist_items_item_key_check.
  related_document_type text,
  -- Populated only for task_type = 'external_payment' — PART 4's own
  -- comment covers why these columns can never be mistaken for a Nextwise
  -- payment flow. The CHECK constraint below enforces they are NULL for
  -- every other task type, not merely left unset by convention.
  external_payment_amount_minor_units bigint,
  external_payment_currency text,
  external_payment_payee text,
  external_payment_instructions text,
  external_payment_reference text,
  -- STUDENT-FACING. Set only via student_complete_application_task() (PART
  -- 6). Never authoritative on its own — see that function's own comment.
  student_note text,
  student_completed_at timestamptz,
  -- Optional link to one of the student's OWN current application_documents
  -- rows, offered as supporting evidence (e.g. a payment receipt) for this
  -- task. ON DELETE SET NULL: a task must never be able to block a document
  -- lifecycle event (replacement retires the old row via is_current, never
  -- deletes it — so in today's code this FK is never actually exercised by
  -- a delete — but SET NULL is still the honest, safe choice if that were
  -- ever to change).
  evidence_document_id uuid references public.application_documents (id) on delete set null,
  -- STAFF-ONLY. Never returned by get_my_application_tasks()/get_my_open_
  -- application_tasks() (PART 7/8) — structurally absent from both
  -- functions' RETURNS TABLE, not merely omitted by convention.
  verified_at timestamptz,
  verified_by uuid references auth.users (id) on delete set null,
  staff_note text,
  cancelled_at timestamptz,
  cancelled_by uuid references auth.users (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint application_tasks_task_type_check check (
    task_type in (
      'document_upload',
      'document_replacement',
      'application_review',
      'application_correction',
      'external_payment',
      'information_request',
      'other_approved_action'
    )
  ),
  constraint application_tasks_status_check check (
    status in ('open', 'in_progress', 'student_completed', 'verified_complete', 'cancelled')
  ),
  constraint application_tasks_related_document_type_check check (
    related_document_type is null or related_document_type in (
      'academic_transcript', 'degree_certificate', 'resume_cv', 'identity_document',
      'english_test_score', 'standardized_test_score', 'financial_document',
      'portfolio', 'other_supporting_document'
    )
  ),
  constraint application_tasks_title_length_check check (length(title) >= 1 and length(title) <= 200),
  constraint application_tasks_description_length_check check (description is null or length(description) <= 2000),
  constraint application_tasks_student_note_length_check check (student_note is null or length(student_note) <= 1000),
  constraint application_tasks_staff_note_length_check check (staff_note is null or length(staff_note) <= 2000),
  constraint application_tasks_payment_payee_length_check check (external_payment_payee is null or length(external_payment_payee) <= 200),
  constraint application_tasks_payment_instructions_length_check check (external_payment_instructions is null or length(external_payment_instructions) <= 2000),
  constraint application_tasks_payment_reference_length_check check (external_payment_reference is null or length(external_payment_reference) <= 200),
  constraint application_tasks_payment_currency_length_check check (external_payment_currency is null or length(external_payment_currency) = 3),
  constraint application_tasks_payment_amount_positive_check check (external_payment_amount_minor_units is null or external_payment_amount_minor_units > 0),
  -- Defense in depth beyond staff_create_application_task()'s own
  -- validation (PART 5): a task that is not 'external_payment' can never
  -- carry ANY of the five payment-only columns, enforced at the schema
  -- level, not merely by the RPC choosing to null them out.
  constraint application_tasks_payment_fields_scoped_check check (
    task_type = 'external_payment'
    or (
      external_payment_amount_minor_units is null
      and external_payment_currency is null
      and external_payment_payee is null
      and external_payment_instructions is null
      and external_payment_reference is null
    )
  )
);

create index if not exists application_tasks_application_idx on public.application_tasks (application_id);
create index if not exists application_tasks_status_idx on public.application_tasks (status);
create index if not exists application_tasks_due_date_idx on public.application_tasks (due_date);

comment on table public.application_tasks is
  'NW06 (proposed) — a concrete, student-facing action item on one application, with a fixed type vocabulary, a due date, and a staff-verified completion lifecycle (open -> in_progress -> student_completed -> verified_complete, or cancelled at any non-terminal point). task_type = ''external_payment'' is the brief''s third-party-fee case — see this column set''s own comment and PART 4 for why it can never be mistaken for a Nextwise-collected payment. Zero direct student RLS access (PART 3) — every student read/write is through get_my_application_tasks()/get_my_open_application_tasks()/student_complete_application_task() (PART 6/7/8). Zero direct staff INSERT/UPDATE either — staff_create_application_task()/staff_update_application_task_status() (PART 5) are the only write paths, matching this table''s own state-machine complexity to the SAME RPC-only pattern application_documents/application_submissions already use, not application_checklist_items'' simpler plain-RLS-toggle pattern.';

comment on column public.application_tasks.staff_note is
  'NW06 (proposed) — INTERNAL staff-only note. Never returned by any student-facing function — kept in a separate column from student_note (student-authored) specifically so the two can never be conflated, mirroring application_documents.review_note vs correction_message (0020) exactly.';

comment on column public.application_tasks.student_note is
  'NW06 (proposed) — STUDENT-authored free text, written only via student_complete_application_task(). For an external_payment task this is where a student may add their own payment reference/context when acknowledging they paid — this acknowledgement is NEVER itself proof of payment; see PART 4''s own comment. Staff must independently verify (staff_update_application_task_status -> verified_complete) before a payment task is ever treated as resolved.';

drop trigger if exists set_application_tasks_updated_at on public.application_tasks;
create trigger set_application_tasks_updated_at
  before update on public.application_tasks
  for each row execute function public.set_updated_at();


-- ============================================================================
-- PART 2 — the external-payment safety invariant, stated explicitly
-- ============================================================================
--
-- NEXTWISE DOES NOT COLLECT: university application fees, tuition fees, visa
-- fees, government fees, or any other third-party education charge. This
-- table never gives Nextwise a way to do so: there is no payment-method
-- field, no bank/UPI/card field, no Razorpay order reference, and no column
-- that could hold a Nextwise-owned payment destination. The five
-- external_payment_* columns above are exclusively STAFF-ENTERED,
-- VERIFIED-ELSEWHERE informational text/numbers describing a charge the
-- student pays DIRECTLY to the university/provider/government, by whatever
-- channel that third party actually uses — this table only displays that
-- information and records a student's own self-reported acknowledgement
-- (student_completed_at/student_note) plus an independent staff verification
-- (verified_at/verified_by), never a transaction of any kind. No trigger,
-- function, or policy in this migration (or anywhere else in this codebase)
-- ever reads these columns to initiate, process, or confirm a payment.


-- ============================================================================
-- PART 3 — Row Level Security: staff SELECT only. No student policy of any
-- kind, and no staff INSERT/UPDATE/DELETE policy either — every mutation is
-- RPC-only (PART 5/6).
-- ============================================================================

alter table public.application_tasks enable row level security;

drop policy if exists "Admins/assigned counsellor can read application tasks" on public.application_tasks;
create policy "Admins/assigned counsellor can read application tasks"
  on public.application_tasks for select to authenticated
  using (
    exists (
      select 1 from public.applications a
      where a.id = application_tasks.application_id
        and (
          public.is_admin_role(array['super_admin', 'admin'])
          or (public.is_admin_role(array['counsellor']) and a.assigned_counsellor_id = public.current_counsellor_id())
        )
    )
  );


-- ============================================================================
-- PART 4 — staff_create_application_task(): the ONLY way a task is created.
-- ============================================================================

create or replace function public.staff_create_application_task(
  p_application_id uuid,
  p_task_type text,
  p_title text,
  p_description text default null,
  p_due_date date default null,
  p_related_document_type text default null,
  p_external_payment_amount_minor_units bigint default null,
  p_external_payment_currency text default null,
  p_external_payment_payee text default null,
  p_external_payment_instructions text default null,
  p_external_payment_reference text default null
)
returns table (
  id uuid,
  task_type text,
  status text,
  title text,
  due_date date,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_app public.applications;
  v_is_external boolean;
  v_row public.application_tasks;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated.' using errcode = '28000';
  end if;

  if p_task_type not in (
    'document_upload', 'document_replacement', 'application_review', 'application_correction',
    'external_payment', 'information_request', 'other_approved_action'
  ) then
    raise exception 'This task type is not recognized.' using errcode = '22023';
  end if;

  if p_title is null or length(btrim(p_title)) < 1 or length(p_title) > 200 then
    raise exception 'A task title is required (200 characters max).' using errcode = '22023';
  end if;

  if p_description is not null and length(p_description) > 2000 then
    raise exception 'This description is too long (2000 characters max).' using errcode = '22001';
  end if;

  if p_related_document_type is not null and p_related_document_type not in (
    'academic_transcript', 'degree_certificate', 'resume_cv', 'identity_document',
    'english_test_score', 'standardized_test_score', 'financial_document',
    'portfolio', 'other_supporting_document'
  ) then
    raise exception 'This document type is not recognized.' using errcode = '22023';
  end if;

  v_is_external := p_task_type = 'external_payment';
  if v_is_external then
    if p_external_payment_payee is null or length(btrim(p_external_payment_payee)) < 1 or length(p_external_payment_payee) > 200 then
      raise exception 'A payee is required for an external payment task (200 characters max).' using errcode = '22023';
    end if;
    if p_external_payment_instructions is null or length(btrim(p_external_payment_instructions)) < 1 or length(p_external_payment_instructions) > 2000 then
      raise exception 'Payment instructions are required for an external payment task (2000 characters max).' using errcode = '22023';
    end if;
    if p_external_payment_amount_minor_units is not null and p_external_payment_amount_minor_units <= 0 then
      raise exception 'The payment amount must be greater than zero.' using errcode = '22023';
    end if;
    if p_external_payment_currency is not null and length(p_external_payment_currency) <> 3 then
      raise exception 'The currency code must be exactly 3 letters (e.g. INR, EUR, USD).' using errcode = '22023';
    end if;
    if p_external_payment_reference is not null and length(p_external_payment_reference) > 200 then
      raise exception 'The reference is too long (200 characters max).' using errcode = '22001';
    end if;
  end if;

  select a.id, a.assigned_counsellor_id into v_app from public.applications a where a.id = p_application_id;
  if v_app.id is null then
    raise exception 'This application could not be found.' using errcode = 'P0001';
  end if;

  if not (
    public.is_admin_role(array['super_admin', 'admin'])
    or (public.is_admin_role(array['counsellor']) and v_app.assigned_counsellor_id = public.current_counsellor_id())
  ) then
    raise exception 'You do not have access to create a task on this application.' using errcode = 'P0001';
  end if;

  insert into public.application_tasks (
    application_id, task_type, status, title, description, due_date, related_document_type,
    external_payment_amount_minor_units, external_payment_currency, external_payment_payee,
    external_payment_instructions, external_payment_reference, created_by
  ) values (
    p_application_id, p_task_type, 'open', btrim(p_title), p_description, p_due_date, p_related_document_type,
    case when v_is_external then p_external_payment_amount_minor_units else null end,
    case when v_is_external then upper(p_external_payment_currency) else null end,
    case when v_is_external then btrim(p_external_payment_payee) else null end,
    case when v_is_external then btrim(p_external_payment_instructions) else null end,
    case when v_is_external then p_external_payment_reference else null end,
    auth.uid()
  )
  returning * into v_row;

  return query select v_row.id, v_row.task_type, v_row.status, v_row.title, v_row.due_date, v_row.created_at;
end;
$$;

comment on function public.staff_create_application_task(uuid, text, text, text, date, text, bigint, text, text, text, text) is
  'NW06 (proposed) — the ONLY way a staff member (super_admin/admin/assigned counsellor) creates a task on an application. created_by/status(''open'') are always server-derived, never caller-supplied. The five external_payment_* parameters are validated as required, and persisted, ONLY when p_task_type = ''external_payment'' — silently nulled out for every other type, matching application_documents.staff_review_application_document()''s own correction_message-clearing discipline.';

revoke all on function public.staff_create_application_task(uuid, text, text, text, date, text, bigint, text, text, text, text) from public;
revoke execute on function public.staff_create_application_task(uuid, text, text, text, date, text, bigint, text, text, text, text) from anon;
grant execute on function public.staff_create_application_task(uuid, text, text, text, date, text, bigint, text, text, text, text) to authenticated;


-- ============================================================================
-- PART 5 — staff_update_application_task_status(): the ONLY way a task's
-- status changes on the staff side (verification, cancellation, reopening).
-- ============================================================================
--
-- Same lock-then-validate-then-conditional-update shape as
-- staff_record_application_submission() (0021 PART 3): the row is locked
-- FIRST, authorization and the transition's validity are both checked
-- against that freshly-locked state (never a value the caller read
-- earlier), and the final UPDATE's own WHERE clause re-asserts the exact
-- status just validated as defense in depth beyond the lock. One generic,
-- anti-enumeration error covers "task does not exist", "you are not
-- authorized for this application", and "this transition is not allowed
-- from the task's current status" — a caller can never distinguish which of
-- the three from the error text alone, matching this codebase's established
-- posture (see staff_review_application_document()'s own comment).
create or replace function public.staff_update_application_task_status(
  p_task_id uuid,
  p_status text,
  p_staff_note text default null
)
returns table (
  id uuid,
  application_id uuid,
  task_type text,
  status text,
  verified_at timestamptz,
  cancelled_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current record;
  v_is_admin boolean;
  v_allowed boolean;
  v_row public.application_tasks;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated.' using errcode = '28000';
  end if;

  if p_status not in ('open', 'in_progress', 'student_completed', 'verified_complete', 'cancelled') then
    raise exception 'This task status is not recognized.' using errcode = '22023';
  end if;

  if p_staff_note is not null and length(p_staff_note) > 2000 then
    raise exception 'This internal note is too long (2000 characters max).' using errcode = '22001';
  end if;

  select t.id, t.status, a.assigned_counsellor_id into v_current
  from public.application_tasks t
  join public.applications a on a.id = t.application_id
  where t.id = p_task_id
  for update of t;

  if v_current.id is null then
    raise exception 'This task could not be updated — it may not exist, you may not have access, or its status may have already changed.' using errcode = 'P0001';
  end if;

  v_is_admin := public.is_admin_role(array['super_admin', 'admin']);
  if not (
    v_is_admin
    or (public.is_admin_role(array['counsellor']) and v_current.assigned_counsellor_id = public.current_counsellor_id())
  ) then
    raise exception 'This task could not be updated — it may not exist, you may not have access, or its status may have already changed.' using errcode = 'P0001';
  end if;

  -- Fixed, explicit transition table — never a raw "any status to any
  -- status" allowance. verified_complete and cancelled are both terminal:
  -- nothing may transition OUT of either through this function.
  v_allowed := case v_current.status
    when 'open' then p_status in ('in_progress', 'cancelled')
    when 'in_progress' then p_status in ('open', 'cancelled')
    when 'student_completed' then p_status in ('verified_complete', 'open', 'in_progress', 'cancelled')
    else false
  end;

  if not v_allowed then
    raise exception 'This task could not be updated — it may not exist, you may not have access, or its status may have already changed.' using errcode = 'P0001';
  end if;

  update public.application_tasks
  set
    status = p_status,
    staff_note = coalesce(p_staff_note, staff_note),
    verified_at = case when p_status = 'verified_complete' then now() else verified_at end,
    verified_by = case when p_status = 'verified_complete' then auth.uid() else verified_by end,
    cancelled_at = case when p_status = 'cancelled' then now() else cancelled_at end,
    cancelled_by = case when p_status = 'cancelled' then auth.uid() else cancelled_by end
  where id = p_task_id and status = v_current.status
  returning * into v_row;

  if v_row.id is null then
    raise exception 'This task could not be updated — it may not exist, you may not have access, or its status may have already changed.' using errcode = 'P0001';
  end if;

  return query select v_row.id, v_row.application_id, v_row.task_type, v_row.status, v_row.verified_at, v_row.cancelled_at, v_row.updated_at;
end;
$$;

comment on function public.staff_update_application_task_status(uuid, text, text) is
  'NW06 (proposed) — the ONLY way a staff member (super_admin/admin/assigned counsellor) changes a task''s status. Fixed transition table: open/in_progress interchange freely or cancel; student_completed may be verified, reopened (open/in_progress), or cancelled; verified_complete and cancelled are both terminal. verified_at/verified_by/cancelled_at/cancelled_by are always server-derived from now()/auth.uid(), never caller-supplied. One generic anti-enumeration error covers every distinct failure reason.';

revoke all on function public.staff_update_application_task_status(uuid, text, text) from public;
revoke execute on function public.staff_update_application_task_status(uuid, text, text) from anon;
grant execute on function public.staff_update_application_task_status(uuid, text, text) to authenticated;


-- ============================================================================
-- PART 6 — student_complete_application_task(): the ONLY way a student
-- marks their own task complete (including acknowledging an external
-- payment was made — a self-report only, never itself authoritative; see
-- PART 2).
-- ============================================================================

create or replace function public.student_complete_application_task(
  p_task_id uuid,
  p_student_note text default null,
  p_evidence_document_id uuid default null
)
returns table (
  id uuid,
  status text,
  student_completed_at timestamptz,
  evidence_document_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_app_id uuid;
  v_row public.application_tasks;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated.' using errcode = '28000';
  end if;

  if p_student_note is not null and length(p_student_note) > 1000 then
    raise exception 'Your note is too long (1000 characters max).' using errcode = '22001';
  end if;

  select t.application_id into v_app_id
  from public.application_tasks t
  join public.applications a on a.id = t.application_id
  where t.id = p_task_id and a.student_user_id = auth.uid()
  for update of t;

  if v_app_id is null then
    raise exception 'This task could not be updated — it may not be yours, or it may no longer be open.' using errcode = 'P0001';
  end if;

  -- Defense in depth: an evidence document, if supplied, must be one of
  -- THIS SAME application's own CURRENT documents — never another
  -- application's, and never a retired/replaced one. student_upload_
  -- application_document()/application_documents' own Storage policy
  -- (0018 PART 5) remain the entire security boundary for the document
  -- itself; this only confirms the id genuinely belongs here before linking
  -- it.
  if p_evidence_document_id is not null then
    if not exists (
      select 1 from public.application_documents d
      where d.id = p_evidence_document_id and d.application_id = v_app_id and d.is_current = true
    ) then
      raise exception 'The selected document could not be attached. Please choose one of your current uploaded documents.' using errcode = 'P0001';
    end if;
  end if;

  update public.application_tasks
  set
    status = 'student_completed',
    student_completed_at = now(),
    student_note = coalesce(p_student_note, student_note),
    evidence_document_id = coalesce(p_evidence_document_id, evidence_document_id)
  where id = p_task_id
    and application_id = v_app_id
    and status in ('open', 'in_progress', 'student_completed')
  returning * into v_row;

  if v_row.id is null then
    raise exception 'This task could not be updated — it may not be yours, or it may no longer be open.' using errcode = 'P0001';
  end if;

  return query select v_row.id, v_row.status, v_row.student_completed_at, v_row.evidence_document_id;
end;
$$;

comment on function public.student_complete_application_task(uuid, text, uuid) is
  'NW06 (proposed) — the ONLY way a student marks their OWN task complete, including acknowledging (self-report ONLY — never authoritative; see this migration''s PART 2) that an external_payment task''s payment was made directly to the third party named on it. Never touches verified_at/verified_by/staff_note. An optional evidence_document_id must already be one of the SAME application''s own current documents. Callable again while status is already student_completed, so a student may amend their note/evidence before staff verify it.';

revoke all on function public.student_complete_application_task(uuid, text, uuid) from public;
revoke execute on function public.student_complete_application_task(uuid, text, uuid) from anon;
grant execute on function public.student_complete_application_task(uuid, text, uuid) to authenticated;


-- ============================================================================
-- PART 7 — get_my_application_tasks(): the ONLY way a student reads their
-- own tasks for one application.
-- ============================================================================

create or replace function public.get_my_application_tasks(p_application_id uuid)
returns table (
  id uuid,
  task_type text,
  status text,
  title text,
  description text,
  due_date date,
  related_document_type text,
  external_payment_amount_minor_units bigint,
  external_payment_currency text,
  external_payment_payee text,
  external_payment_instructions text,
  external_payment_reference text,
  student_note text,
  student_completed_at timestamptz,
  evidence_document_id uuid,
  verified_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    t.id, t.task_type, t.status, t.title, t.description, t.due_date,
    t.related_document_type,
    t.external_payment_amount_minor_units, t.external_payment_currency,
    t.external_payment_payee, t.external_payment_instructions, t.external_payment_reference,
    t.student_note, t.student_completed_at, t.evidence_document_id,
    t.verified_at, t.created_at, t.updated_at
  from public.application_tasks t
  join public.applications a on a.id = t.application_id
  where t.application_id = p_application_id
    and a.student_user_id = auth.uid()
  order by
    case t.status when 'open' then 0 when 'in_progress' then 0 when 'student_completed' then 1 when 'verified_complete' then 2 when 'cancelled' then 3 else 4 end,
    t.due_date asc nulls last,
    t.created_at desc;
$$;

comment on function public.get_my_application_tasks(uuid) is
  'NW06 (proposed) — the ONLY path by which a student reads their own application_tasks rows for one application. Verifies application.student_user_id = auth.uid() itself (this table has no student RLS policy at all — PART 3 — so this function IS the entire student read boundary for a single application). RETURNS TABLE structurally excludes staff_note/created_by/verified_by/cancelled_at/cancelled_by. Zero rows, never an error, for an application id that does not exist or is not the caller''s.';

revoke all on function public.get_my_application_tasks(uuid) from public;
revoke execute on function public.get_my_application_tasks(uuid) from anon;
grant execute on function public.get_my_application_tasks(uuid) to authenticated;


-- ============================================================================
-- PART 8 — get_my_open_application_tasks(): a cross-application summary for
-- the student's own "action required" dashboard panel (NW06.2) — never a
-- second source of truth, purely a narrower read across every one of the
-- caller's own applications at once so the dashboard does not need one
-- round trip per application.
-- ============================================================================

create or replace function public.get_my_open_application_tasks()
returns table (
  id uuid,
  application_id uuid,
  task_type text,
  status text,
  title text,
  due_date date,
  external_payment_amount_minor_units bigint,
  external_payment_currency text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    t.id, t.application_id, t.task_type, t.status, t.title, t.due_date,
    t.external_payment_amount_minor_units, t.external_payment_currency, t.created_at
  from public.application_tasks t
  join public.applications a on a.id = t.application_id
  where a.student_user_id = auth.uid()
    and t.status in ('open', 'in_progress', 'student_completed')
  order by t.due_date asc nulls last, t.created_at desc;
$$;

comment on function public.get_my_open_application_tasks() is
  'NW06 (proposed) — the ONLY path by which a student reads a cross-application summary of their own NOT-YET-CLOSED tasks (open/in_progress/student_completed — never verified_complete or cancelled). Identity comes entirely from auth.uid(), never a caller-supplied id. Intentionally narrower than get_my_application_tasks() (no description/student_note/evidence_document_id) — this is a dashboard-summary shape, not the full per-application task detail; a caller wanting full detail still calls get_my_application_tasks() for that one application.';

revoke all on function public.get_my_open_application_tasks() from public;
revoke execute on function public.get_my_open_application_tasks() from anon;
grant execute on function public.get_my_open_application_tasks() to authenticated;


-- ============================================================================
-- PART 9 — explicit anon revoke confirmation (the 0019 lesson)
-- ============================================================================
--
-- Every grant/revoke sequence above already includes an explicit `revoke
-- execute ... from anon` line before the `grant ... to authenticated` line
-- — this PART exists only as a single, greppable confirmation of that fact
-- for the migration-security regression test, matching 0020/0021's own
-- final PART convention.
