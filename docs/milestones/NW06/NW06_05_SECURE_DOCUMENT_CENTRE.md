# NW06.5 — Secure Document Centre

**Status:** Complete — confirmation only, no code change needed.

## 1. What the brief asked

A secure, private document store for application materials, with staff review and an auditable upload/replace/remove lifecycle.

## 2. What already existed (Milestones 17–18)

`supabase/migrations/0018_application_documents_foundation.sql` built the `application_documents` table (zero direct student RLS — every student read/write is through `get_my_application_documents()`/`student_upload_application_document()`/`student_remove_application_document()`), a private Storage bucket (`application-documents`, 25MB cap, 4 allowed MIME types, three Storage RLS policies keyed off `is_current`), and the "0019 lesson" (`revoke execute ... from anon` needed as an explicit, separate statement from `revoke ... from public` — a Supabase default-privilege quirk this migration's own follow-up, `0019_application_document_rpc_permissions.sql`, fixed and which every subsequent migration in this codebase, including NW06's, now applies as a standing convention).

`supabase/migrations/0020_application_processing_workspace.sql` (Milestone 18) added staff review (`review_status`/`correction_message` columns, `staff_review_application_document()`), giving a counsellor/admin a real accept/needs-correction/reject workflow per document.

## 3. What NW06 added on top — deliberately a reference, never a second store

NW06.6's new `application_tasks.evidence_document_id` column is an **optional pointer** into this existing table (`references public.application_documents (id) on delete set null`) — a task may reference one of the student's own current documents as supporting evidence (e.g. a payment receipt for an `external_payment` task), but NW06 adds zero new upload path, zero new Storage bucket, and zero new review mechanism. `student_complete_application_task()` (NW06_application_tasks.sql PART 6) re-verifies, at write time, that any supplied evidence document belongs to the *same* application and is still the *current* version (`d.application_id = v_app_id and d.is_current = true`) — a defense-in-depth check on top of, never a replacement for, 0018's own Storage RLS, which remains the entire security boundary for the document itself.

## 4. Verification performed this stage

Re-confirmed, by direct reading of `supabase/migrations-proposed/NW06_application_tasks.sql`, that no `insert`/`update`/`delete` statement anywhere in it touches `application_documents` or the `application-documents` Storage bucket — the only interaction is the read-only `exists (...)` ownership check above.

## 5. Conclusion

No regression, no code change required to the document centre itself for this stage. It remains exactly as Milestone 17/18 left it; NW06 only references it, through a column whose own `on delete set null` guarantees a task can never block a document lifecycle event.
