-- ============================================================================
-- Milestone 17 (v2) — Application Documents Foundation
-- Security & Storage Integrity Hardening
-- ============================================================================
--
-- BASELINE: this migration is written against the REAL current repository
-- state, branch release/m10, verified by reading 0001-0017 directly (no
-- migration between v1's assumed baseline and this one was skipped) before
-- writing a line of SQL here — see M17_COMPLETION_REPORT.md §1 for the full
-- audit trail. 0001-0017 are untouched by this file. This is a v2 rewrite of
-- a prior sandbox draft that was deliberately NEVER installed because
-- pre-install review found five concrete security/storage-integrity gaps
-- (ghost metadata, missing replacement cleanup, retired-object read access,
-- unlogged remove-cleanup failure, raw error leakage) — every one of those
-- gaps is fixed IN THIS FILE, not patched later; see each PART's own comment
-- for exactly where and how.
--
-- THE CORE DESIGN, UNCHANGED FROM THE DRAFT: `public.application_documents`
-- gets ZERO direct student RLS access, from the very first version below —
-- the same lesson Milestone 16's v1->v2->v3 history already had to learn
-- for `applications` itself (0017 PART 7's own audit finding). Every student
-- read and write goes through one of three narrow SECURITY DEFINER RPCs,
-- each of which:
--   - is `security definer`, `set search_path = public`, and (for reads)
--     `stable`;
--   - derives identity exclusively from auth.uid() — never a caller-supplied
--     student/owner id;
--   - is `revoke all ... from public; grant execute ... to authenticated;`
--     — never `anon`;
--   - returns a narrow, explicit `returns table (...)` column list — never
--     `returns public.application_documents` or `select *`;
--   - embeds its own ownership check inside its own WHERE clause (a lock, an
--     UPDATE's WHERE, or a join) — never trusts a preceding SELECT or RLS
--     alone.
--
-- Nothing here touches payments, invoices, refunds, pricing, or any
-- Razorpay-related table/function/policy. Nothing here builds the M18
-- counsellor document-review workspace. Nothing here mutates
-- `applications.stage` — document completeness is one input to application
-- readiness, never an automatic trigger for it (spec's own instruction).
--
-- ----------------------------------------------------------------------------
-- M17-v3 — FINAL APPLICATION DOCUMENT INTEGRITY HARDENING
-- ----------------------------------------------------------------------------
-- This is a v3 patch of the v2 migration above (migration number 0018 is
-- REUSED, not bumped to 0019 — this migration has never been applied to any
-- database, so patching it in place is safe and there is no prior 0018 state
-- anywhere to migrate away from). v2's five original security fixes (ghost
-- metadata, replacement cleanup, retired-object read access, unlogged
-- remove-cleanup failure, raw error leakage) are all still present, unchanged
-- — this patch is additive/narrowing only. Two further issues found in a
-- post-v2 review are fixed here, each documented in full at its own PART:
--
--   ISSUE 1 (PART 5, Storage DELETE policy) — a v2 gap allowed the owning
--   student to delete ANY object under their own application via the raw
--   Storage API, including the object backing a CURRENT application_documents
--   row — bypassing student_remove_application_document() entirely and
--   leaving `is_current = true` metadata pointing at a Storage object that no
--   longer exists (a database/storage integrity break, not merely a UX
--   inconsistency). Fixed by adding a `not exists (... is_current = true)`
--   condition to that policy's own `using` clause — see PART 5's own comment
--   at the DELETE policy for the full reasoning. A current document's
--   physical object can no longer be deleted directly through Storage, full
--   stop; only orphaned/already-retired objects remain deletable, which is
--   exactly the set of objects the two legitimate cleanup call sites
--   (uploadApplicationDocument()'s replacement cleanup, removeApplication
--   Document()'s removal cleanup — both in src/lib/supabase/education/
--   application-documents.ts) ever target, and both already retire the
--   metadata row FIRST, before attempting Storage cleanup — never the
--   reverse order.
--
--   ISSUE 2 (PART 2 and PART 5, least-privilege document access) — v2 gave
--   `finance` and `analyst` read access to application-document metadata AND
--   files, by reusing the broad `is_admin_role(array['super_admin', 'admin',
--   'finance', 'analyst'])` check already used elsewhere in this codebase for
--   general `applications:read`-scoped visibility. Re-audited against the
--   real permission model in src/lib/admin/permissions.ts: nothing in this
--   project's existing spec establishes a concrete need for finance or
--   analyst to see identity documents, transcripts, financial documents, or
--   test-score certificates — `applications:read` being broad elsewhere is
--   not itself a reason to inherit that breadth here. Fixed by narrowing both
--   the table-level SELECT policy (PART 2) and the Storage SELECT policy
--   (PART 5) to `super_admin`, `admin`, and the assigned counsellor only —
--   `finance` and `analyst` are removed from both. The TypeScript admin
--   orchestration layer (src/lib/supabase/admin/application-documents.ts) is
--   updated to match, gated by a new narrow `application-documents:read`
--   permission (src/lib/admin/permissions.ts) granted only to
--   super_admin/admin/counsellor — reusing this codebase's own established
--   per-milestone-narrow-permission-pair convention (see
--   "profile-verification:read"/"recommendation-readiness:read" for
--   precedent) rather than reusing the broader `applications:read`, and
--   rather than inventing a new RBAC architecture. See
--   docs/application-documents-guide.md's "Least-privilege document access
--   (M17-v3)" section for the full decision and reasoning.
-- ============================================================================


-- ============================================================================
-- PART 1 — public.application_documents
-- ============================================================================
--
-- Deliberately NO `student_user_id` column — ownership is always derived by
-- joining to `applications.student_user_id`, the exact pattern
-- `application_status_history` already uses (0004_admin_system.sql,
-- extended 0017 PART 4) — this avoids a second, independently-drift-able
-- copy of the owning student's id.
--
-- `is_current` distinguishes the live document of a (application_id,
-- document_type) pair from a replaced/removed one. `removed_at` is a
-- NON-LOAD-BEARING audit distinction only: null means "retired by
-- replacement" (a newer document of the same type took over), non-null
-- means "explicitly removed by the student with nothing replacing it". NO
-- RLS policy and NO RPC below ever branches on `removed_at` for
-- authorization — the single, sole authorization gate for whether a
-- document (metadata row OR the underlying Storage object) is currently
-- visible is `is_current = true`, checked directly. This is deliberate
-- defense against exactly the kind of subtle gap PART 5 below closes: a
-- flag that exists for one purpose (audit trail) must never quietly become
-- part of a different purpose (access control) by accident.
create table if not exists public.application_documents (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  document_type text not null,
  original_filename text not null,
  storage_path text not null,
  mime_type text not null,
  file_size_bytes bigint not null,
  display_label text,
  is_current boolean not null default true,
  removed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint application_documents_document_type_check check (
    document_type in (
      'academic_transcript',
      'degree_certificate',
      'resume_cv',
      'identity_document',
      'english_test_score',
      'standardized_test_score',
      'financial_document',
      'portfolio',
      'other_supporting_document'
    )
  ),
  constraint application_documents_filename_length_check check (
    length(original_filename) >= 1 and length(original_filename) <= 255
  ),
  constraint application_documents_display_label_length_check check (
    display_label is null or length(display_label) <= 200
  ),
  constraint application_documents_file_size_check check (
    file_size_bytes > 0 and file_size_bytes <= 26214400
  ),
  constraint application_documents_storage_path_unique unique (storage_path)
);

comment on table public.application_documents is
  'Milestone 17 (v2) — per-application uploaded document metadata. Files themselves live in the private ''application-documents'' Storage bucket (PART 4 below); this table never holds binary data, only pointers to it. Zero direct student RLS access (PART 2 below) — every student read/write goes through get_my_application_documents()/student_upload_application_document()/student_remove_application_document() (PART 3/6/7). `is_current` is the sole authorization-relevant flag: exactly one row may be `is_current = true` per (application_id, document_type) — enforced by the partial unique index below even under a concurrent-upload race, because every write path that flips it first locks the parent applications row (see PART 6/7). `removed_at` is a non-load-bearing audit distinction only (null = retired by replacement, non-null = explicit removal) — no policy or function anywhere branches on it for authorization; `is_current` alone gates visibility.';

comment on column public.application_documents.storage_path is
  'Milestone 17 (v2) — pointer into storage.objects.name in the ''application-documents'' bucket, convention <application_id>/<random_uuid>/<sanitized_filename> (built by buildApplicationDocumentStoragePath() in src/lib/supabase/education/application-documents.ts). The random middle segment is an independently-generated correlation id, deliberately NOT this row''s own eventual id — a client never gets to pick a future primary key via the path it uploads to. UNIQUE so two metadata rows can never point at the same physical object.';

comment on column public.application_documents.removed_at is
  'Milestone 17 (v2) — audit trail only: null when this row was superseded by a newer current document of the same type (a "replace"), non-null when a student explicitly removed it with nothing replacing it. NEVER used for authorization by any RLS policy or RPC in this migration — `is_current = true` is the one and only authorization-relevant flag. This column exists purely so a future admin audit view could distinguish the two cases; no such view is built in this milestone.';

create index if not exists application_documents_application_idx on public.application_documents (application_id);

-- At most one current document per (application_id, document_type), even
-- under a concurrent-upload race — see student_upload_application_document()
-- (PART 6) for why the parent-row lock it takes makes this index's guarantee
-- unreachable in practice, and why the index still exists anyway as the
-- database-authoritative backstop, not merely a convenience.
drop index if exists public.application_documents_one_current_per_type;
create unique index application_documents_one_current_per_type
  on public.application_documents (application_id, document_type)
  where is_current = true;

comment on index public.application_documents_one_current_per_type is
  'Milestone 17 (v2) — at most one is_current=true row per (application_id, document_type). student_upload_application_document() (PART 6) always locks the parent applications row before retiring the old current row and inserting the new one, which serializes every concurrent upload attempt for the SAME application — this index is the database-authoritative backstop for that guarantee, not the only thing providing it.';

drop trigger if exists set_application_documents_updated_at on public.application_documents;
create trigger set_application_documents_updated_at
  before update on public.application_documents
  for each row execute function public.set_updated_at();


-- ============================================================================
-- PART 2 — RLS on application_documents: admin/counsellor read-only. NO
-- student policy of any kind.
-- ============================================================================
--
-- Mirrors `applications`' own existing admin-read policy shape exactly
-- (0004_admin_system.sql). There is no INSERT/UPDATE/DELETE policy for
-- anyone via direct table access — every mutation goes through PART 6/7's
-- SECURITY DEFINER RPCs, which run as the function owner and are therefore
-- unaffected by RLS being otherwise fully closed here.
--
-- Task requirement ("M17 has no version-history UI, so normal viewing
-- should expose current documents only"): this policy deliberately does NOT
-- filter on is_current — it is a table-level ROW policy, and RLS restricts
-- rows a role may read at all, not which of those rows the calling
-- application code chooses to display. The "current documents only" rule is
-- enforced at the application layer (listApplicationDocumentsForAdmin() in
-- src/lib/supabase/admin/application-documents.ts filters `.eq("is_current",
-- true)`), which is the correct place for a UI-display concern — RLS still
-- correctly restricts WHICH APPLICATION''S documents (any of its rows,
-- current or retired) an admin/counsellor may read at all, which is the
-- actual security boundary this table needs. A retired row''s METADATA
-- (filename, size, type) is not sensitive the way the underlying file bytes
-- are — PART 5 below is what actually makes a retired Storage object
-- unreadable, regardless of what this table''s RLS exposes.
--
-- SECURITY FIX — Issue 2 (M17-v3, least-privilege document access): v2''s
-- role check here was `is_admin_role(array['super_admin', 'admin', 'finance',
-- 'analyst'])` — reused from the broad `applications:read` visibility set
-- used elsewhere in this codebase. Re-audited against the real permission
-- model (src/lib/admin/permissions.ts): application_documents can hold
-- identity documents, academic transcripts, financial documents, and test
-- certificates — genuinely sensitive operational records, not the kind of
-- thing "finance/analyst can already read applications broadly" by itself
-- justifies exposing. No existing product requirement establishes a concrete
-- need for finance or analyst to see this table at all. Narrowed below to
-- `super_admin`/`admin` plus the assigned counsellor only — `finance` and
-- `analyst` are removed. The TypeScript orchestration layer
-- (src/lib/supabase/admin/application-documents.ts) is updated to match,
-- gated by a new `application-documents:read` permission
-- (src/lib/admin/permissions.ts) granted only to super_admin/admin/
-- counsellor — see docs/application-documents-guide.md for the full
-- decision and reasoning.
alter table public.application_documents enable row level security;

drop policy if exists "Admins/finance/assigned counsellor can read application documents" on public.application_documents;
drop policy if exists "Admins/assigned counsellor can read application documents" on public.application_documents;
create policy "Admins/assigned counsellor can read application documents"
  on public.application_documents for select to authenticated
  using (
    exists (
      select 1 from public.applications a
      where a.id = application_documents.application_id
        and (
          public.is_admin_role(array['super_admin', 'admin'])
          or (public.is_admin_role(array['counsellor']) and a.assigned_counsellor_id = public.current_counsellor_id())
        )
    )
  );


-- ============================================================================
-- PART 3 — get_my_application_documents(): the ONLY way a student reads
-- their own application's documents directly.
-- ============================================================================
--
-- Same reasoning as get_my_application() (0017 PART 8): a bare RLS policy
-- can restrict which ROWS a student may read, but this table has NO student
-- RLS policy at all (PART 2 above), so this SECURITY DEFINER function is the
-- entire read path. Returns only is_current = true rows — a student never
-- sees a retired/replaced document through this function, consistent with
-- "no version-history UI" (task requirement). Returns zero rows (never an
-- error) for an application id that does not exist or is not the caller's —
-- the same anti-enumeration posture as every other RPC in this codebase
-- since Milestone 16.
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
  updated_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select d.id, d.document_type, d.original_filename, d.storage_path, d.mime_type, d.file_size_bytes, d.display_label, d.created_at, d.updated_at
  from public.application_documents d
  join public.applications a on a.id = d.application_id
  where d.application_id = p_application_id
    and a.student_user_id = auth.uid()
    and d.is_current = true
  order by d.document_type, d.created_at desc;
$$;

comment on function public.get_my_application_documents(uuid) is
  'Milestone 17 (v2) — the ONLY path by which a student reads their own application_documents rows. Verifies applications.student_user_id = auth.uid() itself (this table has no student RLS policy at all — PART 2 — so this function IS the entire student read boundary). Returns only is_current = true rows. Returns zero rows, never an error, for an application id that does not exist or is not the caller''s.';

revoke all on function public.get_my_application_documents(uuid) from public;
grant execute on function public.get_my_application_documents(uuid) to authenticated;


-- ============================================================================
-- PART 4 — Storage bucket provisioning (idempotent, from THIS migration)
-- ============================================================================
--
-- AUDIT FINDING / CORRECTION (explicitly re-audited per this milestone's own
-- instruction, rather than blindly repeating the prior draft's claim): the
-- prior sandbox draft of this migration asserted, verbatim, "SQL cannot
-- create a bucket" and required manual dashboard creation — copying the same
-- claim already made (unaudited) for the ''signed-agreements'' (M10) and
-- ''stamped-agreements'' (M11-A) buckets. That claim is INCORRECT.
-- `storage.buckets` is an ordinary Postgres table that Supabase''s own
-- `storage` extension creates (columns include id, name, public,
-- file_size_limit, allowed_mime_types, created_at, updated_at); it does have
-- RLS enabled, but that RLS applies to requests made through PostgREST/the
-- Storage API using the `anon`/`authenticated` roles — it does NOT apply to
-- a migration executed by the privileged role `supabase db push` (and the
-- Supabase SQL editor) run migrations as, which owns the schema and bypasses
-- RLS entirely, exactly like every `create table`/`create policy`/`alter
-- table` statement elsewhere in this very file already relies on. An
-- idempotent `insert ... on conflict (id) do update` against storage.buckets
-- from a migration is a standard, widely-documented Supabase pattern for
-- exactly this reason. This migration therefore provisions its own bucket
-- here instead of requiring a manual dashboard step. (This correction is
-- scoped to `application-documents` only — 0011/0012''s own BOOTSTRAP notes
-- for their two pre-existing buckets are untouched, since 0001-0017 are
-- never edited by this migration; if those two buckets also don''t already
-- exist in a given environment, they still need the manual step those
-- migrations describe. This file does not re-provision them.)
--
-- Values match this milestone's spec exactly: private (public = false), max
-- file size 25MB (26214400 bytes — matching PART 1's own
-- application_documents_file_size_check, so the bucket-level limit and the
-- table-level constraint always agree), and the four allowed MIME types.
-- `on conflict (id) do update` (not `do nothing`) so re-running this
-- migration after a manual limit change elsewhere always converges back to
-- these exact values — safe because this bucket is wholly owned by this
-- milestone, not something an operator is expected to hand-tune afterward.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'application-documents',
  'application-documents',
  false,
  26214400,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;


-- ============================================================================
-- PART 5 — Storage RLS for the private 'application-documents' bucket.
-- ============================================================================
--
-- Path convention (enforced by buildApplicationDocumentStoragePath() in
-- src/lib/supabase/education/application-documents.ts, the only code path
-- that ever builds an upload path): every object's `name` is
-- `<application_id>/<random_uuid>/<sanitized_filename>`. Every policy below
-- re-derives ownership from that path by joining back to `applications` —
-- never from the Storage-native "owner" concept. Same regex-guard-before-cast pattern as
-- the two pre-existing buckets (0011 PART 8, 0012 PART 4): a malformed
-- object name must short-circuit an RLS `using`/`with check` clause to "no
-- match" rather than raise and abort the whole query.
--
-- SECURITY FIX — Issue 3 (retired file access), the central fix of this
-- migration: the prior draft's SELECT policy checked ONLY bucket_id + the
-- ownership join to `applications` — it never confirmed the object's `name`
-- corresponds to a CURRENT `application_documents` row. That let a
-- replaced/removed object stay readable via the Storage API indefinitely,
-- by the owning student AND by admin/counsellor, even after it disappeared
-- from every UI. Fixed below: the SELECT policy now ALSO requires an exists
-- join to `application_documents` where `storage_path = storage.objects.name
-- and is_current = true`. This single change is what makes Issue 4 (remove
-- cleanup failure) and the "old object stays orphaned after a replacement
-- cleanup failure" half of Issue 2 both safe by construction: even if the
-- physical object is never actually deleted (Storage delete failed, or was
-- never attempted), it becomes unreadable the moment its metadata row's
-- is_current flips to false, which happens atomically inside the same
-- transaction as the metadata write, before any Storage cleanup is even
-- attempted (PART 6/7).
--
-- No public/anon read policy exists here at all — a private bucket with no
-- SELECT policy for `anon` means a raw object URL is never fetchable without
-- a short-lived signed URL generated server-side (see
-- src/lib/supabase/education/application-documents.ts
-- getApplicationDocumentDownloadUrl()), which itself still requires the
-- generating request to satisfy the SELECT policy below.

drop policy if exists "Owning student can upload application documents" on storage.objects;
create policy "Owning student can upload application documents"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'application-documents'
    and split_part(storage.objects.name, '/', 1) ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    and exists (
      select 1 from public.applications a
      where a.id = (split_part(storage.objects.name, '/', 1))::uuid
        and a.student_user_id = auth.uid()
    )
  );

-- SECURITY FIX — Issue 2 (M17-v3, least-privilege document access): same
-- narrowing as PART 2's table-level policy above, for the same reasoning —
-- `finance` and `analyst` are removed from the role check below. This keeps
-- the table-level and Storage-level authorization models in agreement, which
-- this task explicitly requires (they must never diverge — a caller
-- authorized to see a document's METADATA row but not its Storage object, or
-- vice versa, would be a bug either way).
drop policy if exists "Owning student or authorized staff can read current application documents" on storage.objects;
create policy "Owning student or authorized staff can read current application documents"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'application-documents'
    and split_part(storage.objects.name, '/', 1) ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    and exists (
      select 1
      from public.applications a
      join public.application_documents d
        on d.application_id = a.id
       and d.storage_path = storage.objects.name
       and d.is_current = true
      where a.id = (split_part(storage.objects.name, '/', 1))::uuid
        and (
          a.student_user_id = auth.uid()
          or public.is_admin_role(array['super_admin', 'admin'])
          or (public.is_admin_role(array['counsellor']) and a.assigned_counsellor_id = public.current_counsellor_id())
        )
    )
  );

-- SECURITY FIX — Issue 1 (M17-v3, block direct deletion of current
-- documents): v2's DELETE policy checked only bucket_id + the regex-guarded
-- ownership join to `applications` — it let the owning student delete ANY
-- object under an application they own via the raw Storage API, including
-- the object backing a CURRENT application_documents row (is_current =
-- true). That bypassed student_remove_application_document() entirely (no
-- metadata retirement ever happened) and could leave a row with
-- `is_current = true` pointing at a Storage object that no longer exists —
-- a database/storage integrity break, not merely a stale-UI inconsistency,
-- since PART 3's get_my_application_documents() and PART 2's admin/
-- counsellor SELECT policy would both keep reporting that document as
-- present and current indefinitely.
--
-- Fixed below by adding a `not exists (... is_current = true)` condition:
-- deletion through the raw Storage API is now allowed ONLY for an object
-- that is NOT the storage_path of any current application_documents row.
-- This still permits every legitimate cleanup call site in
-- src/lib/supabase/education/application-documents.ts, because both of them
-- already retire the metadata row (flip is_current to false) FIRST, inside
-- the same RPC transaction, before ever attempting the Storage delete that
-- follows — never the reverse order:
--   (A) a failed metadata RPC during upload — the object was written to
--       Storage but student_upload_application_document() never ran (or
--       raised), so no application_documents row references it at all —
--       the `not exists` check is vacuously true and cleanup is permitted;
--   (B) a replacement — student_upload_application_document() (PART 6) has
--       already flipped the OLD row's is_current to false and returned its
--       storage_path as previous_storage_path before uploadApplicationDocument()
--       ever attempts to delete that old object — by the time the delete
--       runs, no current row references that path, so cleanup is permitted;
--   (C) an explicit remove — student_remove_application_document() (PART 7)
--       has already flipped the row's is_current to false (and set
--       removed_at) before removeApplicationDocument() attempts the Storage
--       delete — same reasoning, cleanup is permitted.
-- A CURRENT document's object — one whose application_documents row still
-- has is_current = true — can never be deleted directly through Storage by
-- this policy, under any of the three cases above or otherwise. This does
-- not trust any client-supplied document id or path: the check is keyed
-- entirely off `storage.objects.name` (the object's own name, which Storage
-- itself supplies to the policy), matched against `application_documents.
-- storage_path`, exactly the same way PART 5's SELECT policy above already
-- does.
drop policy if exists "Owning student can delete application documents" on storage.objects;
create policy "Owning student can delete application documents"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'application-documents'
    and split_part(storage.objects.name, '/', 1) ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    and exists (
      select 1 from public.applications a
      where a.id = (split_part(storage.objects.name, '/', 1))::uuid
        and a.student_user_id = auth.uid()
    )
    and not exists (
      select 1 from public.application_documents d
      where d.storage_path = storage.objects.name
        and d.is_current = true
    )
  );

-- Deliberately no UPDATE policy for anyone — a "replace" is always
-- upload-new-object + retire-old-metadata-row + best-effort-delete-old-
-- object, never an in-place object mutation, matching both pre-existing
-- buckets' own posture (0011 PART 8, 0012 PART 4). Deliberately no admin/
-- counsellor DELETE policy either ("keep admin changes minimal" — task
-- requirement; admin visibility in this milestone is read-only, full stop).


-- ============================================================================
-- PART 6 — student_upload_application_document(): the ONLY way a student
-- attaches a document to their OWN application.
-- ============================================================================
--
-- SECURITY FIX — Issue 1 (ghost metadata): the prior draft only
-- regex-validated p_storage_path's SHAPE; it never confirmed the object
-- actually exists in storage.objects. A student could therefore call this
-- RPC with a well-formed but entirely fictitious path and have this table
-- happily record metadata for a file that was never uploaded (or was
-- uploaded to a different bucket/path, or was already deleted). Fixed below
-- — PART "Verify the object genuinely exists" — by requiring an exact match
-- against storage.objects (bucket_id = 'application-documents' and name =
-- p_storage_path) before any metadata write happens. This runs SECURITY
-- DEFINER, so it can read storage.objects regardless of the calling role's
-- own grants on that table — the same reason every other cross-schema check
-- in this codebase (e.g. this function's own ownership join to
-- `applications`) is safe to do from inside a SECURITY DEFINER function.
--
-- SECURITY FIX — Issue 2 (replacement cleanup): the prior draft's
-- retire-old-current-row UPDATE never captured the retired row's own
-- storage_path, so the calling TypeScript had no way to know which Storage
-- object had just become orphaned, and never attempted to delete it. Fixed
-- below by capturing the retired row's storage_path with `returning
-- storage_path into v_previous_storage_path` and returning it as part of
-- this function's own result — the calling TypeScript
-- (uploadApplicationDocument() in src/lib/supabase/education/application-
-- documents.ts) uses THIS returned value, never a client-guessed path, to
-- attempt cleanup, and only AFTER this entire transaction (which already
-- committed the new current document) has succeeded. A cleanup failure on
-- that old object can never invalidate the new current document (the
-- metadata write already committed independently) and, thanks to PART 5's
-- fix, the old object is unreadable via Storage regardless of whether that
-- cleanup ever succeeds.
--
-- Locks the parent applications row (`select ... for update`) scoped to
-- student_user_id = auth.uid() BEFORE retiring/inserting — the same
-- discipline student_advance_application() (0017 PART 3.1) uses. This
-- serializes every concurrent upload attempt against the SAME application
-- (including two concurrent replacements of the SAME document_type), which
-- is what makes the retire-then-insert sequence below race-free: a second
-- concurrent call for the same application always waits for the first to
-- commit or roll back before it can even read the "current" row of that
-- type, so it is structurally impossible for two inserts to ever violate
-- application_documents_one_current_per_type (PART 1).
create or replace function public.student_upload_application_document(
  p_application_id uuid,
  p_document_type text,
  p_original_filename text,
  p_storage_path text,
  p_mime_type text,
  p_file_size_bytes bigint,
  p_display_label text default null
)
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
  previous_storage_path text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_app public.applications;
  v_previous_storage_path text;
  v_row public.application_documents;
  v_expected_prefix text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated.' using errcode = '28000';
  end if;

  if p_document_type not in (
    'academic_transcript', 'degree_certificate', 'resume_cv', 'identity_document',
    'english_test_score', 'standardized_test_score', 'financial_document',
    'portfolio', 'other_supporting_document'
  ) then
    raise exception 'This document type is not recognized.' using errcode = '22023';
  end if;

  if p_mime_type not in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp') then
    raise exception 'This file type is not supported. Please upload a PDF, JPEG, PNG, or WEBP file.' using errcode = '22023';
  end if;

  if p_file_size_bytes is null or p_file_size_bytes <= 0 or p_file_size_bytes > 26214400 then
    raise exception 'This file is too large. The maximum size is 25MB.' using errcode = '22023';
  end if;

  if p_original_filename is null or length(p_original_filename) < 1 or length(p_original_filename) > 255 then
    raise exception 'This file name is not valid.' using errcode = '22023';
  end if;

  if p_display_label is not null and length(p_display_label) > 200 then
    raise exception 'This label is too long (200 characters max).' using errcode = '22001';
  end if;

  -- Defense in depth beyond the Storage INSERT policy (PART 5): re-validate
  -- that the path's own application-id segment matches p_application_id.
  -- The Storage policy already enforces this at upload time, but this
  -- function must never assume a caller-supplied path actually corresponds
  -- to the application_id it is also independently asserting — the two
  -- parameters come from the same client call and nothing stops a caller
  -- from supplying a mismatched pair.
  v_expected_prefix := p_application_id::text || '/';
  if p_storage_path is null or left(p_storage_path, length(v_expected_prefix)) <> v_expected_prefix then
    raise exception 'This document could not be saved. Please try uploading again.' using errcode = 'P0001';
  end if;

  -- Lock the parent application row FIRST — see this function's own header
  -- comment for why this single lock is what makes the entire
  -- retire-then-insert sequence below race-free.
  select * into v_app from public.applications where id = p_application_id and student_user_id = auth.uid() for update;

  if v_app.id is null then
    raise exception 'This document could not be saved — the application may not be yours. Please refresh and try again.' using errcode = 'P0001';
  end if;

  -- SECURITY FIX — Issue 1 (ghost metadata): confirm the Storage object
  -- genuinely exists before any metadata becomes current. Runs AFTER the
  -- ownership lock above so a caller can never use this check to probe for
  -- the existence of an object under an application that is not theirs.
  if not exists (
    select 1 from storage.objects so
    where so.bucket_id = 'application-documents'
      and so.name = p_storage_path
  ) then
    raise exception 'This document could not be saved. Please try uploading again.' using errcode = 'P0001';
  end if;

  -- SECURITY FIX — Issue 2 (replacement cleanup): capture the retired row's
  -- own storage_path so the caller can attempt to clean up the now-orphaned
  -- Storage object — but only AFTER this transaction commits, and never
  -- before. removed_at is deliberately left null here (this is a
  -- replacement, not an explicit removal — see PART 1's own comment on that
  -- column).
  update public.application_documents
  set is_current = false
  where application_id = p_application_id
    and document_type = p_document_type
    and is_current = true
  returning storage_path into v_previous_storage_path;

  insert into public.application_documents (
    application_id, document_type, original_filename, storage_path, mime_type, file_size_bytes, display_label, is_current
  ) values (
    p_application_id, p_document_type, p_original_filename, p_storage_path, p_mime_type, p_file_size_bytes, p_display_label, true
  )
  returning * into v_row;

  return query select
    v_row.id, v_row.document_type, v_row.original_filename, v_row.storage_path, v_row.mime_type,
    v_row.file_size_bytes, v_row.display_label, v_row.created_at, v_row.updated_at, v_previous_storage_path;
end;
$$;

comment on function public.student_upload_application_document(uuid, text, text, text, text, bigint, text) is
  'Milestone 17 (v2) — the ONLY path by which a student attaches a document to their OWN application. (v2 security fixes) Verifies the Storage object named p_storage_path genuinely exists in the application-documents bucket before metadata becomes current (closes the "ghost metadata" gap — a caller could previously record metadata for a file that was never actually uploaded). Locks the parent applications row before retiring any existing current document of the same type and inserting the new one — this single lock is what makes the whole retire-then-insert sequence race-free even under concurrent replacement of the same document_type. Returns the newly retired row''s own storage_path (previous_storage_path, null on a first upload) so the caller may attempt best-effort Storage cleanup of the now-orphaned old object AFTER this transaction has already committed — a cleanup failure on that old object can never invalidate the new current document, and (PART 5''s Storage SELECT policy) the old object is unreadable via Storage regardless of whether that cleanup ever succeeds.';

revoke all on function public.student_upload_application_document(uuid, text, text, text, text, bigint, text) from public;
grant execute on function public.student_upload_application_document(uuid, text, text, text, text, bigint, text) to authenticated;


-- ============================================================================
-- PART 7 — student_remove_application_document(): the ONLY way a student
-- removes a document from their OWN application.
-- ============================================================================
--
-- A single atomic UPDATE whose own WHERE clause (is_current = true AND an
-- ownership-join EXISTS) is the entire check — never a preceding SELECT.
-- One generic anti-enumeration error covers every distinct failure reason
-- (document does not exist / already removed / belongs to a different
-- student). Returns the retired row's own storage_path so the calling
-- TypeScript uses THAT value, never a client-supplied path, for the
-- best-effort Storage cleanup that follows.
--
-- SECURITY NOTE — Issue 4 (remove cleanup failure): this function's own
-- behavior was already correct in the prior draft (metadata retirement is
-- unconditional and happens in this one atomic statement; a subsequent
-- Storage delete failure in the calling TypeScript is logged and does not
-- roll back or fail the metadata change) — what made that correctness
-- UNSAFE in the prior draft was Issue 3 (the Storage SELECT policy not
-- checking is_current). With PART 5's fix in place, a failed cleanup here
-- leaves the physical object present but unreadable via Storage by anyone,
-- which is the actual safety property this task requires. The calling
-- TypeScript still logs any cleanup failure explicitly (never silently
-- swallowed) for operational visibility, per the task's own requirement.
create or replace function public.student_remove_application_document(p_document_id uuid)
returns table (
  id uuid,
  storage_path text
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

  update public.application_documents d
  set is_current = false, removed_at = now()
  where d.id = p_document_id
    and d.is_current = true
    and exists (
      select 1 from public.applications a
      where a.id = d.application_id
        and a.student_user_id = auth.uid()
    )
  returning * into v_row;

  if v_row.id is null then
    raise exception 'This document could not be removed — it may not be yours, or it may have already been removed. Please refresh and try again.' using errcode = 'P0001';
  end if;

  return query select v_row.id, v_row.storage_path;
end;
$$;

comment on function public.student_remove_application_document(uuid) is
  'Milestone 17 (v2) — the ONLY path by which a student removes a document from their OWN application. A single atomic UPDATE (is_current = true AND an ownership-join EXISTS, both in the same WHERE clause — never a preceding SELECT) is the entire authorization check. removed_at is set to now() (an explicit removal, per PART 1''s own comment on that column, which is never itself an authorization signal). Returns the retired row''s own storage_path so the caller''s best-effort Storage cleanup always targets exactly the object this function just proved was the caller''s own, never a client-supplied path. One generic anti-enumeration error covers every distinct failure reason.';

revoke all on function public.student_remove_application_document(uuid) from public;
grant execute on function public.student_remove_application_document(uuid) to authenticated;
