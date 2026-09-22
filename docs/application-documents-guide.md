# Application Documents Foundation Guide (Milestone 17, v3)

## 1. What this milestone is

A secure document-management **foundation** for student applications: a
fixed, controlled 9-value document taxonomy; a required-vs-recommended
checklist; secure per-application upload/view/replace/remove of files
through Supabase Storage; a new `application_documents` table with **zero
direct student RLS access**; minimal, read-only admin/counsellor
visibility inside the existing application-detail page; and a pure,
reusable completeness calculation.

Deliberately **not** built: any counsellor document-review/approval
workflow (Milestone 18), any stage-mutation side effect from a document
action, and any visa/SOP/LOR/OCR functionality.

This is a **v3 hardening pass** on top of a v2 rewrite. A v1 draft of this
milestone was produced but deliberately never installed — pre-install
review found five concrete security/storage-integrity gaps, all fixed in
v2 (§4 below). v2 was itself reviewed again before install and found
"substantially correct", but that second review surfaced two further,
narrower gaps — a Storage DELETE-policy integrity hole and an
over-broad staff read scope — both fixed in this v3 pass (§4a below).
Migration number `0018` is reused across all three drafts: it has never
been applied to any database, so patching it in place (rather than adding
`0019`) is safe.

## 2. Domain model

Nine document types, in a fixed, controlled vocabulary
(`src/lib/applications/application-documents.ts`):

`academic_transcript`, `degree_certificate`, `resume_cv`,
`identity_document`, `english_test_score`, `standardized_test_score`,
`financial_document`, `portfolio`, `other_supporting_document`.

Three are **required** (`academic_transcript`, `identity_document`,
`resume_cv`); the rest are recommended. This is a fixed, global TypeScript
constant, not a per-course requirements table — a future milestone could
promote it without changing `getApplicationDocumentCompleteness()`'s
public shape.

`public.application_documents` (new table, `0018_application_documents_
foundation.sql`): one row per uploaded document version. No
`student_user_id` column — ownership is always derived by joining to
`applications.student_user_id`, the same pattern `application_status_
history` already uses. `is_current` is the sole authorization-relevant
flag: at most one `true` row per `(application_id, document_type)`,
enforced by a partial unique index. `removed_at` is a non-load-bearing
audit distinction only (null = retired by replacement, non-null = explicit
removal) — no policy or function anywhere branches on it for
authorization.

Files themselves live in a new private Storage bucket,
`application-documents` — this table never holds binary data, only
pointers (`storage_path`) into it.

## 3. Storage

**Bucket provisioning.** Unlike the two pre-existing buckets in this
codebase (`signed-agreements`, `stamped-agreements`, both of which require
manual dashboard creation per their own migrations' BOOTSTRAP notes), this
milestone provisions `application-documents` **directly from the
migration** via an idempotent `insert into storage.buckets (...) on
conflict (id) do update ...`. This works because a Supabase migration runs
as a privileged role that owns the schema and bypasses `storage.buckets`'
own RLS — the same reason every `create table`/`create policy` statement
in this codebase already works. The prior draft of this migration (and,
unaudited, the two earlier milestones before it) claimed this was
impossible; it is not. See `0018`'s own PART 4 comment for the full
correction. Values: private (`public = false`), 25MB max, MIME types
`application/pdf`, `image/jpeg`, `image/png`, `image/webp`.

**Path convention:** `<application_id>/<random_uuid>/<sanitized_filename>`
— built by `buildApplicationDocumentStoragePath()` in
`src/lib/supabase/education/application-documents.ts`. The random middle
segment is an independently-generated correlation id, never the eventual
metadata row's own id.

**Three `storage.objects` RLS policies**, all scoped to `bucket_id =
'application-documents'`:

- **INSERT** — owning student only (regex-guarded UUID cast of the path's
  first segment, joined to `applications.student_user_id = auth.uid()`).
- **SELECT** — owning student, admin, or the assigned counsellor (narrowed
  from admin/finance/analyst in v2 — see §4a, Issue 2) — **and** the
  object's `name` must match an `application_documents` row with
  `is_current = true`. This last clause was the central security fix of
  v2 (see §4, Issue 3).
- **DELETE** — owning student only. Not extended to admin. As of v3, also
  requires that the object's `name` NOT match a CURRENT
  `application_documents` row — see §4a, Issue 1.

No UPDATE policy exists for anyone — a "replace" is always
upload-new-object + retire-old-metadata-row + best-effort-delete-old-
object, never an in-place mutation.

## 4. The five security fixes (v1 → v2)

A pre-install review of the v1 draft found five concrete gaps. Each is
fixed in this version, not deferred:

1. **Ghost metadata.** v1's upload RPC only validated `storage_path`'s
   shape, never confirmed the object actually existed. Fixed:
   `student_upload_application_document()` now requires an exact match
   against `storage.objects` (`bucket_id = 'application-documents' and
   name = p_storage_path`) before any metadata becomes current.
2. **Replacement cleanup.** v1's retire-old-row UPDATE never returned the
   retired row's own `storage_path`, and the TypeScript caller never
   attempted to clean up the old object at all. Fixed: the RPC now returns
   `previous_storage_path`; `uploadApplicationDocument()` uses that exact
   value (never a client-guessed path) to best-effort-delete the old
   object, **only after** the new metadata has already committed. A
   cleanup failure is logged and never invalidates the new document.
3. **Retired file access.** v1's Storage SELECT policy checked only
   bucket + ownership — a replaced/removed object stayed readable via the
   Storage API indefinitely. Fixed: the SELECT policy now also requires an
   `application_documents` row with matching `storage_path` **and
   `is_current = true`**. This is the fix that makes #2 and #4 safe by
   construction, independent of whether their own best-effort cleanup ever
   succeeds.
4. **Remove cleanup failure.** Already-correct ordering in v1 (metadata
   retirement is unconditional and atomic; Storage delete is attempted
   after and its failure is logged, never rolled back) — but that
   correctness depended entirely on fix #3 existing. Now provably safe: a
   failed cleanup leaves the object physically present but unreadable by
   anyone.
5. **Raw error leakage.** v1's `uploadApplicationDocument()`/
   `removeApplicationDocument()` returned `rpcError.message`/
   `storageError.message` directly whenever truthy — despite the file's
   own header comment claiming otherwise. Fixed:
   `sanitizeApplicationDocumentError()` maps a small, explicit allow-list
   of this milestone's own RPC-authored, already-safe error strings back
   to themselves (exact match only, never a substring check); every other
   error — any raw Postgres/PostgREST/Storage error — maps to one generic
   fallback message. This is a deliberately stricter policy than some
   pre-existing Milestone 16 code uses (see `advanceMyApplication()` in
   `applications.ts`, which relays `error.message` as-is because every
   message its own RPC raises is already safe) — this milestone's task
   required the stricter, explicit-allow-list version.

## 4a. The two v3 hardening fixes

A post-v2 review found v2's five fixes above "substantially correct" but
surfaced two further, narrower gaps. Both are fixed in this migration
(still `0018`, patched in place — never applied anywhere, so no `0019` is
needed), not deferred:

### Issue 1 — block direct deletion of current documents

**The gap.** v2's Storage DELETE policy checked only `bucket_id` +
regex-guarded ownership (the same join every other policy in this file
uses). That let the owning student delete **any** object under an
application they own via the raw Storage API — including the object
backing a **CURRENT** `application_documents` row (`is_current = true`) —
entirely bypassing `student_remove_application_document()`. The
consequence was a genuine database/storage integrity break, not merely a
stale-UI inconsistency: `get_my_application_documents()` and the admin/
counsellor SELECT policy would both keep reporting that document as
present and current indefinitely, while the underlying file no longer
existed.

**The fix.** The DELETE policy's own `using` clause now ALSO requires:

```sql
not exists (
  select 1 from public.application_documents d
  where d.storage_path = storage.objects.name
    and d.is_current = true
)
```

ANDed (never ORed) with the existing bucket + ownership checks. This does
not trust any client-supplied document id or path — the check is keyed
entirely off `storage.objects.name`, the object's own name as Storage
itself supplies it to the policy — exactly the same value the SELECT
policy already matches against `storage_path`.

**Why the three legitimate cleanup paths still work.** Every real deletion
call site in `src/lib/supabase/education/application-documents.ts` already
retires the metadata row (flips `is_current` to `false`) **before** ever
attempting the Storage delete, never the reverse:

- **(A) Orphan cleanup** — the Storage upload succeeded but
  `student_upload_application_document()` then failed (validation error,
  ownership mismatch, etc.), so no `application_documents` row was ever
  created referencing that path at all. `NOT EXISTS` is vacuously true;
  cleanup is permitted.
- **(B) Replacement cleanup** — `student_upload_application_document()`
  (PART 6) flips the OLD row's `is_current` to `false` and returns its
  `storage_path` as `previous_storage_path` as part of the SAME
  transaction that inserts the new current row. Only after that
  transaction has already committed does `uploadApplicationDocument()`
  attempt to delete the old object. By then, no current row references
  that path; cleanup is permitted.
- **(C) Explicit-remove cleanup** — `student_remove_application_document()`
  (PART 7) flips the row's `is_current` to `false` (and sets `removed_at`)
  in one atomic UPDATE before `removeApplicationDocument()` attempts the
  Storage delete. Same reasoning; cleanup is permitted.

A CURRENT document's object can never be deleted directly through Storage
under any of the three cases above, or otherwise — the policy makes this a
database-enforced invariant, not merely an application-code convention.

### Issue 2 — least-privilege document access

**The gap.** v2 gave `finance` and `analyst` read access to application-
document metadata AND files, by reusing the same broad
`is_admin_role(array['super_admin', 'admin', 'finance', 'analyst'])` check
already used elsewhere in this codebase for general `applications:read`-
scoped visibility. `application_documents` can hold identity documents,
academic transcripts, financial documents, and test-score certificates —
genuinely sensitive operational records. "Finance/analyst can already read
`applications` broadly" is not, by itself, a reason to inherit that
breadth here.

**The decision.** Re-audited against the real permission model
(`src/lib/admin/permissions.ts`, `ROLE_PERMISSIONS`): nothing in this
project's existing spec establishes a concrete product requirement for
finance or analyst to see this table. Access is narrowed to `super_admin`,
`admin`, and the assigned counsellor only, at all three layers:

1. **Table-level RLS** (`application_documents` SELECT policy, PART 2) —
   role check narrowed from `['super_admin', 'admin', 'finance', 'analyst']`
   to `['super_admin', 'admin']` (the counsellor branch is a separate,
   unaffected OR-condition already scoped to the assigned counsellor).
2. **Storage-level RLS** (`storage.objects` SELECT policy, PART 5) — the
   identical narrowing, so the table-level and Storage-level authorization
   models never diverge (a caller authorized to see a document's metadata
   row but not its file, or vice versa, would itself be a bug).
3. **TypeScript orchestration**
   (`src/lib/supabase/admin/application-documents.ts`) — both functions
   now gate on a new `application-documents:read` permission instead of
   the broader `applications:read` v2 used.

**Why a new permission, not an existing one.** The task considered three
options: (a) keep reusing `applications:read` — rejected, it is exactly
the over-broad scope being narrowed away from; (b) reuse an existing
narrower permission — none fits: nothing in `ROLE_PERMISSIONS` already
scopes to "super_admin/admin/counsellor, explicitly not finance/analyst"
for a sensitive per-application data surface (the closest analogues,
`profile-verification:read` and `recommendation-readiness:read`, both
extend to `analyst` too, which this task explicitly does not want here);
(c) add one new, narrow, read-only permission — chosen, because it follows
this codebase's own established convention of giving each milestone that
introduces a new sensitive, per-student-data surface its own narrow
permission pair rather than widening an existing one (see
`profile-verification:*`, `recommendation-readiness:*`,
`discovery-sessions:*` for precedent). This is one new permission string
added to an existing framework, not a new RBAC architecture.

**Final decision:** `application-documents:read` — read-only, no `:write`
counterpart (admin/counsellor visibility in this milestone is read-only,
full stop; every document mutation is student-only). Granted to
`super_admin` (via the blanket `ADMIN_PERMISSIONS` assignment), `admin`,
and `counsellor`. **Deliberately withheld from `finance` and `analyst`.**

**Keeping the surrounding page working.** The application-detail page
itself (`src/app/admin/applications/[id]/page.tsx`) is still gated by the
broader, pre-existing `applications:read` (unchanged by this milestone) —
so a finance/analyst caller can still reach the page. That page now checks
`hasPermission(admin?.role, "application-documents:read")` itself before
ever calling `listApplicationDocumentsForAdmin()`, and simply omits the
whole Documents card for a caller who lacks it — the exact same pattern
this codebase already uses for `profile-verification:read`/
`recommendation-readiness:read` on
`src/app/admin/students/[id]/page.tsx`. A finance/analyst caller therefore
sees the rest of the page normally; the Documents card is not there at
all, never a permission-denied error.

## 5. Authorization model

Every student read/write goes through one of three narrow SECURITY
DEFINER RPCs in `0018_application_documents_foundation.sql` — there is
**no student RLS policy of any kind** on `application_documents`:

- `get_my_application_documents(p_application_id)` — read, current
  documents only.
- `student_upload_application_document(...)` — upload/replace.
- `student_remove_application_document(p_document_id)` — remove.

Each: derives identity exclusively from `auth.uid()`; is `revoke all ...
from public; grant execute ... to authenticated;`; returns a narrow,
explicit column list; embeds its own ownership check inside its own WHERE
clause (a row lock, an UPDATE's WHERE, or a join) — never trusts a
preceding SELECT or RLS alone. `student_upload_application_document()`
locks the parent `applications` row before retiring/inserting, which
serializes every concurrent upload for the same application and is what
makes the retire-then-insert sequence race-free even under concurrent
replacement of the same document type.

Admin/counsellor access is gated by a dedicated `application-documents:read`
permission (`requireAdminPermission("application-documents:read")`),
granted only to `super_admin`/`admin`/`counsellor` — **not** `finance` or
`analyst` (see §4a, Issue 2, for the full least-privilege decision and why
v2's broader reuse of `applications:read` was narrowed away from in v3).
`application_documents` DOES have one admin/counsellor RLS SELECT policy,
narrowed the same way (mirroring `applications`' own admin-read policy
shape, minus finance/analyst); the "current documents only" display rule is
enforced at the application layer
(`listApplicationDocumentsForAdmin()` filters `is_current`), not by that
RLS policy, since a retired row's metadata is not itself sensitive the way
file bytes are.

## 6. Application integration

No document action in this milestone ever mutates `applications.stage`, and
no code path here calls `student_advance_application()`/
`updateApplication()`. `getApplicationDocumentCompleteness()` is a pure,
read-only function used only to render a "N of 3 required documents
uploaded" summary line — it does not claim an application is ready for
submission on its own. Every Milestone 16 ownership check, transition rule,
and concurrency protection is untouched by this migration.

## 7. Testing

No live Postgres connection exists in this project's Vitest setup — RLS/
RPC correctness is verified by (a) a static-SQL-text regression test
(`src/lib/applications/application-documents-migration-security.test.ts`)
asserting the exact policy/function bodies contain the right ownership
joins, grants, and role scopes; and (b) a manual QA plan to run against a
real staging Supabase project (see the completion report). This is the
same verification split every prior SECURITY DEFINER milestone in this
codebase has used.

v3 extends that same test file with explicit coverage of both hardening
fixes: for Issue 1, that the DELETE policy remains bucket-scoped, still
verifies ownership, still checks the exact `storage_path`, adds the new
`is_current`-checking `NOT EXISTS` clause ANDed (never ORed) with the
existing checks, and — conceptually, by asserting the retire-before-cleanup
ordering in the upload/remove RPC bodies — that all three legitimate
cleanup states (orphan, replacement, explicit-remove) remain permitted;
for Issue 2, that both the table-level and Storage-level SELECT policies
no longer mention `finance`/`analyst` and still agree with each other.
`src/lib/admin/permissions.test.ts` gained two tests asserting
`application-documents:read` is scoped to `super_admin`/`admin`/
`counsellor` only and has no `:write` counterpart.

## 8. Known limitations

- The required/recommended tiering is a fixed, global constant, not a
  per-course requirements table.
- Admin/counsellor visibility is read-only, gated by the dedicated
  `application-documents:read` permission — see §5 and §4a.
- No version-history UI for retired documents, even though retired rows
  are retained for audit purposes. Only `is_current = true` rows are ever
  returned to a student or admin.
- No document-review/approval status exists at all.
- Deferred to Milestone 18+: the full counsellor document-processing/
  review workspace, structured shortlisting, SOP/LOR generation, any visa
  workflow, university API integrations, OCR/document extraction, and AI
  document analysis.
