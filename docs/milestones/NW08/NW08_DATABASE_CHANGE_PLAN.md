# NW08 — Database Change Plan

**Status: NO CHANGE.** NW08 adds zero migrations, proposed or applied. Every new query this milestone introduces reads an existing table/column through the existing Supabase client, gated by the existing RLS policies and the existing `AdminPermission` matrix — nothing here required a schema change.

## 1. Why no migration was needed

`NW08_01_ADMIN_AUDIT.md` concluded the brief's 6 mockup areas are reachable by composing already-existing data (dashboard counts, analytics aggregates, counsellor workload, applications/leads/students CRUD, payments/invoices/refunds/pricing CRUD, `student_outcomes`) plus a small number of new, purely additive aggregate functions — all of them simple `count: "exact", head: true` queries or narrow column selects against tables that already exist: `payments`, `refunds`, `invoices`, `pricing_plans`, `pricing_offers`, `student_outcomes`, `leads`, `admin_student_meta`, `applications`. None of them needed a new column, a new table, or a changed RLS policy.

## 2. The one thing considered and deliberately NOT built

A narrower "Student Relations" CRM-only staff role (suggested by the brief's NW08.3 section) would have required a new `ROLE_PERMISSIONS` entry and, if it needed any RLS-visible distinction beyond the application-layer permission check, a migration. `NW08_01_ADMIN_AUDIT.md` §8 documents this as a considered-and-deferred proposal — not built, no migration drafted for it — because the brief's own phrasing was conditional ("if required") and nothing in the existing codebase evidenced a real operational need for it yet.

## 3. What NW08 explicitly did not do

No `DROP`. No destructive `ALTER`. No RLS policy change. No new `SECURITY DEFINER` function. No data backfill. No change to `supabase/migrations/` or `supabase/migrations-proposed/`. The one still-proposed, still-unapplied migration from NW07 (`supabase/migrations-proposed/NW07_counsellor_studio_foundation.sql`) is untouched and remains exactly as NW07 left it — this milestone does not assume it has been applied anywhere, and nothing NW08 built depends on it (the one place a dependency might have existed — a per-counsellor "recommendation review" workload count — was deliberately not built this milestone; see `NW08_01_ADMIN_AUDIT.md` §4).
