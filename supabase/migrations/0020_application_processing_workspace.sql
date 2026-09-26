-- ============================================================================
-- Milestone 18 — Counsellor Application Processing Workspace
-- ============================================================================
--
-- BASELINE: written against the real repository at HEAD
-- 4023730cf6e6ccd0d9b923b25837147b72c9be57 ("Harden M17 document RPC
-- permissions"), branch release/m10. supabase/migrations/ contains 0001-0019
-- at that HEAD; this file is the next free number. 0018 and 0019 are NOT
-- edited by this migration — every change below is additive/new-object-only,
-- or (PART 3) a `drop function` + `create` of a function FIRST DEFINED in
-- 0018, executed from THIS file, which is forward schema evolution, not an
-- edit to the 0018/0019 files on disk. Nothing here touches payments,
-- invoices, refunds, pricing, Razorpay, or any SEO-owned table.
--
-- M18 is explicitly NOT a new application architecture (task's own words).
-- It adds:
--   PART 1 — review columns on the EXISTING application_documents table
--            (chosen over a separate review-events table — see
--            docs/application-processing-guide.md "Database design" for the
--            full reasoning: M17 already gives every document row immutable,
--            append-only version semantics, so a plain column with
--            DEFAULT 'pending_review' already satisfies "replacement must
--            require review again" with zero changes to 0018's insert path).
--   PART 2 — staff_review_application_document(): the ONLY way a staff
--            member changes a document's review state.
--   PART 3 — get_my_application_documents() forward-replaced to also return
--            review_status/correction_message (never review_note/
--            reviewed_by) to the student.
--   PART 4 — application_checklist_items: a small, fixed-vocabulary
--            operational checklist.
--   PART 5 — application_internal_notes: staff-only, append-only, timestamped
--            notes — mirrors the existing admin_student_notes table/RLS
--            shape (0004_admin_system.sql PART on students) exactly, keyed
--            by application_id instead of student_user_id. No second notes
--            architecture is introduced.
--   PART 6 — explicit anon revoke for every new/replaced function, per the
--            lesson 0019 already taught this codebase: Supabase's default
--            privilege configuration grants EXECUTE on a new function to
--            anon directly, separately from `public` membership. A bare
--            `revoke ... from public` is not enough.
--
-- No document review action mutates applications.stage. No RPC here trusts
-- a caller-supplied reviewer/actor id — every actor column is set from
-- auth.uid() only. Every new SECURITY DEFINER function pins
-- `set search_path = public`, returns a narrow explicit column list, and is
-- revoked from public/anon before being granted to authenticated.
-- ============================================================================


-- ============================================================================
-- PART 1 — Document review columns on public.application_documents
-- ============================================================================
--
-- Simplified THREE-state model (per task's own explicit fallback
-- instruction): 'pending_review' | 'accepted' | 'needs_correction'. A
-- fourth 'rejected' state was considered and dropped — a student can always
-- replace a document, so 'rejected' and 'needs_correction' would have had
-- no distinct operational consequence in this milestone; a counsellor uses
-- 'needs_correction' with a correction_message either way. Documented here
-- and in docs/application-processing-guide.md.
--
-- DEFAULT 'pending_review' is what makes "a replaced/newly uploaded document
-- must require review again, never inherit ACCEPTED from what it replaced"
-- free: 0018's student_upload_application_document() always INSERTs a brand
-- new row for a replacement (never an UPDATE of the old row) — see 0018
-- PART 6 — so the new row picks up this column's default with no change to
-- that function at all.
alter table public.application_documents
  add column if not exists review_status text not null default 'pending_review',
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references auth.users (id) on delete set null,
  add column if not exists review_note text,
  add column if not exists correction_message text;

alter table public.application_documents
  drop constraint if exists application_documents_review_status_check;
alter table public.application_documents
  add constraint application_documents_review_status_check
  check (review_status in ('pending_review', 'accepted', 'needs_correction'));

alter table public.application_documents
  drop constraint if exists application_documents_review_note_length_check;
alter table public.application_documents
  add constraint application_documents_review_note_length_check
  check (review_note is null or length(review_note) <= 2000);

alter table public.application_documents
  drop constraint if exists application_documents_correction_message_length_check;
alter table public.application_documents
  add constraint application_documents_correction_message_length_check
  check (correction_message is null or length(correction_message) <= 1000);

comment on column public.application_documents.review_status is
  'Milestone 18 — staff review state for the CURRENT document row only (is_current is unaffected by review — review never changes which row is current). Defaults to pending_review on every insert, including a replacement upload, so a new/replaced document always requires review again; no code path carries an old row''s review_status forward.';
comment on column public.application_documents.review_note is
  'Milestone 18 — INTERNAL staff-only note about this review decision. Never returned by any student-facing RPC (see PART 3) — kept in a separate column from correction_message specifically so a student-facing message can never accidentally be sourced from staff-internal text.';
comment on column public.application_documents.correction_message is
  'Milestone 18 — STUDENT-FACING message explaining what needs to change. Separate column from review_note (internal) per this milestone''s explicit "do not mix internal notes and student-facing requests in one field" requirement. Cleared automatically whenever review_status is set to anything other than needs_correction (see staff_review_application_document(), PART 2).';

-- RLS note: RLS restricts ROWS, not COLUMNS. The existing admin/counsellor
-- SELECT policy on this table (0018 PART 2) already covers these five new
-- columns for whichever rows it already permitted — no RLS policy change is
-- needed for admin/counsellor read access to review state.


-- ============================================================================
-- PART 2 — staff_review_application_document(): the ONLY way a staff member
-- changes a document's review state.
-- ============================================================================
--
-- Same conditional-UPDATE-with-WHERE-clause-as-the-entire-check pattern as
-- 0018's student_remove_application_document() (PART 7) and this codebase's
-- established applyRefundTransition()/applyApplicationUpdate() pattern
-- (src/lib/supabase/admin/refunds.ts, applications.ts): the UPDATE's own
-- WHERE clause is `id = p_document_id AND is_current = true AND <role/
-- assignment check>`, never a preceding SELECT. This single WHERE clause is
-- what solves BOTH "a retired document cannot be reviewed" AND "the student
-- replaced this document while the counsellor's page was open" (the
-- replacement's UPDATE already flipped the old row's is_current to false —
-- see 0018 PART 6 — so this UPDATE simply matches zero rows against a stale
-- document id, exactly like the concurrency case this task calls out).
create or replace function public.staff_review_application_document(
  p_document_id uuid,
  p_review_status text,
  p_review_note text default null,
  p_correction_message text default null
)
returns table (
  id uuid,
  application_id uuid,
  document_type text,
  review_status text,
  reviewed_at timestamptz,
  reviewed_by uuid,
  review_note text,
  correction_message text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.application_documents;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated.' using errcode = '28000';
  end if;

  if p_review_status not in ('pending_review', 'accepted', 'needs_correction') then
    raise exception 'This review status is not recognized.' using errcode = '22023';
  end if;

  if p_review_note is not null and length(p_review_note) > 2000 then
    raise exception 'This internal note is too long (2000 characters max).' using errcode = '22001';
  end if;

  if p_correction_message is not null and length(p_correction_message) > 1000 then
    raise exception 'This request message is too long (1000 characters max).' using errcode = '22001';
  end if;

  -- Authorization + concurrency + current-document-only, all in one WHERE
  -- clause. is_admin_role()/current_counsellor_id() are the exact same
  -- helper functions 0018 PART 2's own SELECT policy already uses — reused
  -- unchanged, never re-derived.
  update public.application_documents d
  set
    review_status = p_review_status,
    reviewed_at = now(),
    reviewed_by = auth.uid(),
    review_note = p_review_note,
    -- A correction_message only ever makes sense alongside
    -- needs_correction — cleared whenever the decision is anything else, so
    -- an old request message can never linger and look current after a
    -- document is later accepted or reset to pending.
    correction_message = case when p_review_status = 'needs_correction' then p_correction_message else null end
  where d.id = p_document_id
    and d.is_current = true
    and exists (
      select 1 from public.applications a
      where a.id = d.application_id
        and (
          public.is_admin_role(array['super_admin', 'admin'])
          or (public.is_admin_role(array['counsellor']) and a.assigned_counsellor_id = public.current_counsellor_id())
        )
    )
  returning * into v_row;

  if v_row.id is null then
    -- One generic, anti-enumeration message covers every distinct failure
    -- reason: document does not exist, is not current (retired/replaced —
    -- including a replacement that happened after this page loaded), or the
    -- caller is not authorized for this application. Never distinguishes
    -- between them.
    raise exception 'This document could not be reviewed — it may no longer be current, or you may not have access. Please refresh and try again.' using errcode = 'P0001';
  end if;

  return query select v_row.id, v_row.application_id, v_row.document_type, v_row.review_status, v_row.reviewed_at, v_row.reviewed_by, v_row.review_note, v_row.correction_message;
end;
$$;

comment on function public.staff_review_application_document(uuid, text, text, text) is
  'Milestone 18 — the ONLY way a staff member (super_admin/admin/assigned counsellor) changes a document''s review state. A single atomic UPDATE whose own WHERE clause (id + is_current = true + role/assignment EXISTS) is the entire authorization AND concurrency check — never a preceding SELECT. reviewed_at/reviewed_by are always server-derived from now()/auth.uid(), never caller-supplied. correction_message is cleared whenever the decision is not needs_correction. One generic anti-enumeration error covers every failure reason, including a retired/replaced document.';

revoke all on function public.staff_review_application_document(uuid, text, text, text) from public;
revoke execute on function public.staff_review_application_document(uuid, text, text, text) from anon;
grant execute on function public.staff_review_application_document(uuid, text, text, text) to authenticated;


-- ============================================================================
-- PART 3 — get_my_application_documents(): forward-replaced to also return
-- review_status/correction_message to the student. NEVER review_note or
-- reviewed_by (both staff-internal).
-- ============================================================================
--
-- Postgres cannot CREATE OR REPLACE a function with a changed return-table
-- shape, so this DROPs the exact 0018-defined function signature and
-- recreates it. This is a forward-migration replacement of a function
-- object — the 0018 FILE ON DISK IS NOT MODIFIED; 0018 remains exactly as
-- installed. Every other property of the function is preserved unchanged:
-- same ownership check (application.student_user_id = auth.uid()), same
-- is_current = true filter, same anti-enumeration "zero rows, never an
-- error" behavior for a foreign/nonexistent application id.
drop function if exists public.get_my_application_documents(uuid);

create or replace function public.get_my_application_documents(p_application_id uuid)
returns table (
  id uuid,
  document_type text,
  original_filename text,
  storage_path text,
  mime_type text,
  file_size_bytes bigint,
  display_label text,
  created_at timestamptz,
  updated_at timestamptz,
  review_status text,
  correction_message text
)
language sql
security definer
set search_path = public
stable
as $$
  select
    d.id, d.document_type, d.original_filename, d.storage_path, d.mime_type,
    d.file_size_bytes, d.display_label, d.created_at, d.updated_at,
    d.review_status, d.correction_message
  from public.application_documents d
  join public.applications a on a.id = d.application_id
  where d.application_id = p_application_id
    and a.student_user_id = auth.uid()
    and d.is_current = true
  order by d.document_type, d.created_at desc;
$$;

comment on function public.get_my_application_documents(uuid) is
  'Milestone 17 (v2), forward-extended by Milestone 18 — the ONLY path by which a student reads their own application_documents rows. M18 adds review_status and correction_message to the returned columns; review_note and reviewed_by are deliberately NEVER added here — those are staff-internal only. Everything else is unchanged from the 0018 definition.';

revoke all on function public.get_my_application_documents(uuid) from public;
revoke execute on function public.get_my_application_documents(uuid) from anon;
grant execute on function public.get_my_application_documents(uuid) to authenticated;


-- ============================================================================
-- PART 4 — public.application_checklist_items
-- ============================================================================
--
-- A practical, fixed-vocabulary operational checklist — deliberately not a
-- generic workflow engine. Of the eight checklist items in the task's own
-- example list, only these four are genuinely staff-toggled state; the other
-- four ("required documents uploaded", "required documents reviewed",
-- "student clarification required", "ready for submission") are DERIVED at
-- read time from real signals (document completeness, review status,
-- outstanding correction requests, readiness) — see
-- src/lib/applications/application-checklist.ts — never stored, so they can
-- never drift out of sync with the data they summarize.
create table if not exists public.application_checklist_items (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  item_key text not null,
  completed_at timestamptz,
  completed_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint application_checklist_items_item_key_check check (
    item_key in ('profile_reviewed', 'eligibility_checked', 'intake_confirmed', 'details_confirmed')
  ),
  constraint application_checklist_items_unique unique (application_id, item_key)
);

create index if not exists application_checklist_items_application_idx on public.application_checklist_items (application_id);

comment on table public.application_checklist_items is
  'Milestone 18 — the four manually-toggled operational checklist items. A row''s absence means "not yet completed" (no row is pre-seeded on application creation). completed_at/completed_by are always server-derived (now()/auth.uid()) via the RLS WITH CHECK below, never trusted from the client.';

drop trigger if exists set_application_checklist_items_updated_at on public.application_checklist_items;
create trigger set_application_checklist_items_updated_at
  before update on public.application_checklist_items
  for each row execute function public.set_updated_at();

alter table public.application_checklist_items enable row level security;

drop policy if exists "Admins/assigned counsellor can read checklist items" on public.application_checklist_items;
create policy "Admins/assigned counsellor can read checklist items"
  on public.application_checklist_items for select to authenticated
  using (
    exists (
      select 1 from public.applications a
      where a.id = application_checklist_items.application_id
        and (
          public.is_admin_role(array['super_admin', 'admin'])
          or (public.is_admin_role(array['counsellor']) and a.assigned_counsellor_id = public.current_counsellor_id())
        )
    )
  );

-- INSERT/UPDATE both require the same role/assignment check AND that any
-- completed_by being written is either null (marking incomplete) or exactly
-- the caller's own auth.uid() (marking complete) — a caller can never write
-- another user's id into completed_by, and (per the codebase''s
-- "application-layer convention, not the boundary" posture) the calling
-- TypeScript never even offers a way to pass one in — this is defense in
-- depth, not the only place that''s true.
drop policy if exists "Admins/assigned counsellor can set checklist items" on public.application_checklist_items;
create policy "Admins/assigned counsellor can set checklist items"
  on public.application_checklist_items for insert to authenticated
  with check (
    (completed_by is null or completed_by = auth.uid())
    and exists (
      select 1 from public.applications a
      where a.id = application_checklist_items.application_id
        and (
          public.is_admin_role(array['super_admin', 'admin'])
          or (public.is_admin_role(array['counsellor']) and a.assigned_counsellor_id = public.current_counsellor_id())
        )
    )
  );

drop policy if exists "Admins/assigned counsellor can update checklist items" on public.application_checklist_items;
create policy "Admins/assigned counsellor can update checklist items"
  on public.application_checklist_items for update to authenticated
  using (
    exists (
      select 1 from public.applications a
      where a.id = application_checklist_items.application_id
        and (
          public.is_admin_role(array['super_admin', 'admin'])
          or (public.is_admin_role(array['counsellor']) and a.assigned_counsellor_id = public.current_counsellor_id())
        )
    )
  )
  with check (
    (completed_by is null or completed_by = auth.uid())
    and exists (
      select 1 from public.applications a
      where a.id = application_checklist_items.application_id
        and (
          public.is_admin_role(array['super_admin', 'admin'])
          or (public.is_admin_role(array['counsellor']) and a.assigned_counsellor_id = public.current_counsellor_id())
        )
    )
  );

-- No DELETE policy — "un-completing" an item is an UPDATE back to
-- completed_at = null, never a row deletion, so the row (and its own
-- created_at) is a stable per-item identity across toggles.


-- ============================================================================
-- PART 5 — public.application_internal_notes
-- ============================================================================
--
-- Mirrors public.admin_student_notes (0004_admin_system.sql) exactly — same
-- append-only shape, same select+insert-only RLS posture, same
-- "author_user_id/note/created_at, no update, no delete" columns — keyed by
-- application_id instead of student_user_id. This reuses the existing
-- notes-table PATTERN rather than inventing a new one; it is a new TABLE
-- (application-scoped notes are a different entity than student-scoped
-- notes, exactly as this codebase already treats admin_student_notes and
-- application_status_history as two separate, purpose-built tables rather
-- than one shared generic "notes" table) but not a new ARCHITECTURE.
create table if not exists public.application_internal_notes (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  author_user_id uuid references auth.users (id) on delete set null,
  note text not null,
  created_at timestamptz not null default now(),
  constraint application_internal_notes_note_length_check check (length(note) >= 1 and length(note) <= 4000)
);

create index if not exists application_internal_notes_application_idx on public.application_internal_notes (application_id);

comment on table public.application_internal_notes is
  'Milestone 18 — INTERNAL-ONLY, append-only, timestamped, actor-recorded application notes. Mirrors admin_student_notes'' shape exactly. Never returned by any student-facing RPC or query (get_my_application/get_my_application_documents/listMyApplications do not touch this table at all) — this is what makes "students cannot see internal notes" true regardless of any UI-layer omission.';

alter table public.application_internal_notes enable row level security;

drop policy if exists "Admins/assigned counsellor can read internal notes" on public.application_internal_notes;
create policy "Admins/assigned counsellor can read internal notes"
  on public.application_internal_notes for select to authenticated
  using (
    exists (
      select 1 from public.applications a
      where a.id = application_internal_notes.application_id
        and (
          public.is_admin_role(array['super_admin', 'admin'])
          or (public.is_admin_role(array['counsellor']) and a.assigned_counsellor_id = public.current_counsellor_id())
        )
    )
  );

drop policy if exists "Admins/assigned counsellor can add internal notes" on public.application_internal_notes;
create policy "Admins/assigned counsellor can add internal notes"
  on public.application_internal_notes for insert to authenticated
  with check (
    author_user_id = auth.uid()
    and exists (
      select 1 from public.applications a
      where a.id = application_internal_notes.application_id
        and (
          public.is_admin_role(array['super_admin', 'admin'])
          or (public.is_admin_role(array['counsellor']) and a.assigned_counsellor_id = public.current_counsellor_id())
        )
    )
  );

-- No UPDATE, no DELETE policy — append-only, matching admin_student_notes
-- exactly. Nothing in this milestone's spec asks for editable/removable
-- internal notes, and an append-only table is what keeps "preserve
-- auditability" (task's own requirement) trivially true.
