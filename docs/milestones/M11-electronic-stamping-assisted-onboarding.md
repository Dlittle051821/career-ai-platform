# Milestone 11 — Electronic Stamping (F-123) + Assisted Onboarding Revision

This milestone ships two independent, LOCKED requirements together — neither replaces the
other:

1. **F-123 Electronic Stamping** — a provider-agnostic stamping gateway, mirroring
   Milestone 10's (F-122) Electronic Signature architecture exactly, so an agreement can be
   stamped, signed, both (in either configurable order), or neither.
2. **Assisted Onboarding Revision** — after registration, a student is never forced through
   a long mandatory profile form. They choose between a free "Discovery Session" with a
   counsellor or building their own profile; either way, the Career/Course/College
   explorers stay freely browsable regardless of profile completeness. This introduces a
   structured Discovery Session Counsellor Workspace, Profile Field Provenance, and
   Recommendation Readiness.

Delivered across 8 commits, in the mandated order, each independently verified
(`tsc --noEmit`, `eslint`, `vitest run`, `next build`) before moving to the next:

| # | Commit | Submilestone |
|---|---|---|
| 1 | `cb7cfc0` | M11-A1 — stamping provider abstraction |
| 2 | `d0dfdd4` | M11-A2 — admin/student stamping workflow + webhook |
| 3 | `1714ff5` | **Correction**: wired up `src/lib/stamping` tests into `vitest.config.mts` (never ran otherwise) + fixed a real bug in `validateRequestStamp()` it surfaced |
| 4 | `5a584c4` | M11-B1 — post-registration choice + Discovery Session booking |
| 5 | `1369d8b` | M11-B2 — structured Discovery Session Counsellor Workspace (A–J) |
| 6 | `72597bd` | M11-C1 — Profile Completeness + Counsellor Verification |
| 7 | `649de5e` | M11-C2 — Recommendation Readiness + Dashboard Integration |

**Read this before trusting any earlier "M11-A complete, tests passing" claim in this
project's history**: `vitest.config.mts`'s `test.include` glob list never had
`src/lib/stamping/**/*.test.ts` added when M11-A1 first wrote those four test files. They
were silently never executed by `npm test` — the "707/707 passing" figure reported at the
time was **incorrect** (it never contained the stamping suite at all). This was caught
during M11-B1's own pre-work verification pass (a full `vitest run` unexpectedly showed 43
test files instead of the expected 47), fixed immediately in commit `1714ff5` **before**
any B/C code was written, and is disclosed here in full rather than quietly folded in. See
§9 "Known limitations and self-identified corrections" for the second thing that fix
surfaced (a real, if minor, bug in the stamping rules).

**Out of scope** (per spec, not touched): F-152 Refund Request Workflow, F-311 Refund
Calculator, Parent Dashboard, WhatsApp Automation, Scholarship Matcher, Advanced
Application Tracker, AI Document Review, Market Intelligence, Fit Score, Student AI
Copilot, Schools Platform.

---

# PART A — Electronic Stamping (F-123)

## A.1 Objective

Let an admin/counsellor request an electronic stamp for an agreement version (already
modeled by Milestone 10's `agreement_versions`/`agreements` tables), configure whether an
agreement needs stamping, signing, both (in either order), or neither, and let a student
view/download the stamped document once complete — without ever claiming this application
satisfies any specific jurisdiction's stamp-duty law, and without ever inventing a
state-specific stamp value.

**Legal/compliance note** (same posture as Milestone 10 §"Legal/compliance note" for
signatures): this milestone does not claim that a stamp captured through the mock provider
— or any future real provider — satisfies a specific jurisdiction's stamp-duty
requirements. `STAMP_SIGN_SEQUENCE` (`STAMP_THEN_SIGN` / `SIGN_THEN_STAMP` / `STAMP_ONLY` /
`SIGN_ONLY`) is configurable per agreement precisely because this application makes no
universal claim about which order (or whether both) is legally required. Stamp
jurisdiction/state/value fields are free text or provider-reported — never validated
against, or guessed from, a hardcoded state-specific rate table.

## A.2 Architecture

```
 Admin UI  ───────▶  src/lib/supabase/admin/stamping.ts ──▶ create_stamp_request() (RPC, SECURITY INVOKER)
 (request/retry/cancel)                                 ──▶ StampProvider.createStampRequest()/retry/cancel
                     │ validated by
                     ▼
                     src/lib/stamping/rules.ts (pure, unit-tested)

 Real/mock provider ──▶ POST /api/webhooks/stamp ──▶ apply_stamp_webhook_event() (RPC, SECURITY DEFINER)
  (webhook delivery)                                     ├─▶ stamp_requests status transition
                                                           ├─▶ stamp_webhook_events (idempotency)
                                                           ├─▶ admin_audit_log (via record_system_audit_log)
                                                           └─▶ agreements.stamp_status (sync trigger)
                                     │ best-effort, never fails the webhook response
                                     ▼
                     uploadStampedDocument() → Storage bucket `stamped-agreements` (private)
                                     │
                                     ▼
 Student UI  ───────▶ src/lib/supabase/agreements/my-agreements.ts (re-checks student_user_id === user.id)
 Admin UI    ───────▶ createStampedDownloadUrl() → short-lived signed URL (RLS-scoped client)
```

Same two layering conventions as every prior milestone's provider integration:

- **Pure vs I/O split**: `src/lib/stamping/` (provider interface, mock provider, env
  config, business rules) is framework-free and fully unit-tested; `src/lib/supabase/
  admin/stamping.ts` is the I/O layer.
- **RLS is the floor, not the only check**: `src/lib/supabase/agreements/
  my-agreements.ts` explicitly re-verifies `student_user_id === user.id` server-side for
  every stamped-document read, on top of RLS.

## A.3 Provider abstraction

`src/lib/stamping/provider.ts` defines `StampProvider` — mirrors `SignatureProvider`
(Milestone 10) exactly in shape: `createStampRequest`, `getStampStatus`,
`cancelStampRequest`, `retryStampRequest`, `verifyWebhook` (local pre-check only, never
authoritative), `getStampedDocument`. `src/lib/stamping/get-provider.ts` resolves
`STAMP_PROVIDER` (default `mock`) to a concrete instance, falling back to mock on any
unrecognized value rather than crashing, and returns a **module-level singleton** (the
mock's in-memory state must survive across separate HTTP requests within one process for
request→webhook flows to work — same known limitation as the signature mock: lost on cold
start, never shared across serverless instances; the database, not the mock's memory, is
always this application's own source of truth).

`MockStampProvider` (`src/lib/stamping/mock-provider.ts`) is a complete in-memory
implementation issuing `mock_stamp_...` request IDs, generating a stamped PDF via
`pdf-lib`, computing real HMAC-SHA256 webhook signatures, and exposing the same
`simulateEvent(providerRequestId, eventType, metadata?)` test harness pattern as the
signature mock, so the full request → webhook → status-sync loop is exercisable end to end
with no real provider.

### Future provider integration

Identical five-step recipe to Milestone 10 §3 ("Future provider integration"): (1) add a
new class implementing `StampProvider`; (2) add a `case` in `get-provider.ts`, selected by
`STAMP_PROVIDER`; (3) populate `STAMP_API_KEY`/`STAMP_API_SECRET`/`STAMP_ENVIRONMENT`; (4)
configure that provider's webhook delivery to sign requests as
`X-Signature: hex(HMAC-SHA256(rawBody, secret))`, or bridge a re-signed payload in
`/api/webhooks/stamp/route.ts`; (5) run the migration's BOOTSTRAP steps (§A.10 below). No
other file (rules, admin UI, student UI, webhook route, analytics, audit log) needs to
change.

## A.4 Database changes — `supabase/migrations/0012_electronic_stamping_and_assisted_onboarding.sql`

**Note on this file's own name**: despite the filename, this migration's actual content
(PARTs 1–7) is stamping only — `onboarding_path`, `discovery_sessions`,
`student_profile_section_provenance`, and `student_recommendation_verifications` all
shipped in the separate `0013_assisted_onboarding_and_recommendation_readiness.sql`
instead, once the plan was split into smaller, independently-committable submilestones.
The file's own header comment still references "PART 8" and "PART 9 below" for those two
tables — a stale forward-reference from before the split. This is a cosmetic inaccuracy in
an already-committed migration's comment text only (it changes nothing about what the SQL
actually does), left uncorrected per this repo's own "never edit an already-shipped
migration" convention (see §9 below — flagged there too, not hidden).

Purely additive to `0001`–`0011` except two non-destructive changes: widening
`product_events.event_name`'s CHECK constraint (once, for the whole of M11 — stamping,
onboarding, and profile/recommendation readiness together, since it's easier to keep one
CHECK-constraint history entry in sync with `PRODUCT_EVENTS` than three), and adding two
new nullable/defaulted columns (`stamp_sign_sequence`, `stamp_status`) to the existing
`public.agreements` table — every other column, constraint, RLS policy, and trigger on it
is untouched.

| Object | Purpose |
|---|---|
| `stamp_requests` | One row per stamp attempt. `status`: `draft → pending → processing → completed` (or `failed`/`cancelled`/`expired` off the non-terminal path). A partial unique index, `stamp_requests_one_active_per_version`, blocks more than one non-terminal (`draft`/`pending`/`processing`) request per agreement version. |
| `agreements.stamp_sign_sequence` / `agreements.stamp_status` | Two new nullable columns on the existing table. `stamp_sign_sequence` is one of `STAMP_THEN_SIGN`/`SIGN_THEN_STAMP`/`STAMP_ONLY`/`SIGN_ONLY`, or `null` (stamping not configured for this agreement at all). |
| `sync_agreement_stamp_status()` | Trigger keeping `agreements.stamp_status` in sync with the latest stamp request's status — same read-model-convenience pattern as Milestone 10's `sync_agreement_signature_status()`. |
| `create_stamp_request()` | `SECURITY INVOKER` RPC — atomically locks the target agreement version and inserts the request row. Deliberately accepts a version whose status is `draft` (locking it atomically in the same statement) — only a `superseded` version is rejected. This is the exact behavior `src/lib/stamping/rules.ts`'s `validateRequestStamp()` was initially out of sync with; see §9. |
| `stamp_webhook_events` | Idempotency ledger — same `unique(provider, event_id)` + raw-body digest pattern as `signature_webhook_events`/`payment_webhook_events`. |
| `stamp_provider_config` | One-row table holding the server-side-only webhook HMAC secret. RLS enabled with zero policies — unreachable via any client role, only via the `SECURITY DEFINER` function below. |
| `apply_stamp_webhook_event(text, text)` | `SECURITY DEFINER`, granted to `anon` only. Re-derives the HMAC from `stamp_provider_config`, checks idempotency, applies the status transition, writes to `admin_audit_log` via `record_system_audit_log()`. Every failure branch returns `{"valid": false, "reason": ...}` — never `RAISE EXCEPTION`, for the same reason as Milestone 10's signature function (a raised exception would roll back the audit-log insert a rejected delivery needs). |
| `set_stamp_document_path(text, text, text)` | `SECURITY DEFINER`, granted to `anon`. Narrow helper the webhook route calls after uploading the stamped PDF, to record its Storage path. |
| Storage RLS on `storage.objects` | Scoped to bucket `stamped-agreements`, resolved the same way as Milestone 10's `signed-agreements` policy (parses the object's first path segment back to `public.agreements` and applies that table's own visibility rules). |
| `product_events.event_name` CHECK | Widened once for the whole milestone (§A.7/§B/§C below). |

Full manual-verification SQL is in the migration's own PART 7; the two required one-time
manual steps are in its BOOTSTRAP section (§A.10 below).

## A.5 Status lifecycle

`stamp_requests.status`: `draft → pending → processing → completed`, with
`failed`/`cancelled`/`expired` reachable from any non-terminal state.
`NON_TERMINAL_STAMP_REQUEST_STATUSES` (`src/types/stamping.ts`) = `draft, pending,
processing` — exactly what the partial unique index treats as "already active" for a
version, and what gates whether Retry/Cancel are offered in the admin UI.
`WEBHOOK_ONLY_STAMP_REQUEST_STATUSES` = `completed, failed, expired` — no admin action in
this application sets any of these directly; only a verified webhook delivery can.

## A.6 API endpoint

**`POST /api/webhooks/stamp`** — mirrors `/api/webhooks/signature` exactly: reads the raw
body via `request.text()` (never `request.json()` first), verifies `X-Signature: <hex
HMAC-SHA256 of the raw body>`, fails closed with 503 if no webhook secret is configured,
runs a fast local pre-check (`provider.verifyWebhook()`) before the authoritative
`apply_stamp_webhook_event()` RPC, returns `200 { duplicate: true }` on a retried delivery
without double-firing analytics, fires the matching `product_events` event on a successful
transition, and best-effort captures the stamped document (download → private Storage
upload → path record) without ever turning that enrichment step's failure into a failed
webhook response. Carries no session by design — every write happens inside `SECURITY
DEFINER` functions that independently verify the HMAC.

Two new GET download routes, mirroring the signature milestone's own precedent exactly:
`GET /admin/agreements/[id]/stamped-document` (admin, `AdminAuthorizationError` → 403) and
`GET /agreements/[id]/stamped-document` (student-facing, re-checks ownership server-side).

## A.7 Analytics events (Electronic Stamping)

Added to the `"agreement"` category in `src/lib/analytics/events.ts`:
`agreement_stamp_requested`, `agreement_stamp_completed`, `agreement_stamp_failed`,
`agreement_stamp_cancelled` — all **implemented**. `agreement_stamp_requested` and
`agreement_stamp_cancelled` fire from the admin action layer
(`src/lib/supabase/admin/stamping.ts`); the other two fire from the webhook route on the
corresponding status transition.

## A.8 Admin & student UI

- `/admin/agreements/[id]` — extended (not redesigned) with a "Stamping" section:
  configure `stamp_sign_sequence` via `AgreementForm`, then Request/Retry/Cancel/View via
  `StampActionForms.tsx` (`RequestStampForm`, `RetryStampRequestForm`,
  `CancelStampRequestForm`) — same `hasPermission(admin.role, "agreements:write")` gate the
  pre-existing agreements admin UI already used; no new permission was added.
- `/admin/agreements/[id]/stamped-document` — admin download route.
- `/(site)/agreements/[id]` — extended with the stamped-document download link alongside
  the existing signed-document one.
- `/agreements/[id]/stamped-document` — student download route.

## A.9 Environment variables (new, `.env.example` only)

All default to unset — the app builds and runs with none configured, falling back to the
mock provider and (outside production) a fixed, clearly-labeled dev-only webhook secret:
`STAMP_PROVIDER` (default `mock`), `STAMP_API_KEY`/`STAMP_API_SECRET` (unused by mock),
`STAMP_WEBHOOK_SECRET` (must also be synced into `stamp_provider_config` — see BOOTSTRAP
below), `STAMP_ENVIRONMENT` (purely descriptive).

## A.10 Manual configuration required (nothing here can be done from this sandbox)

1. **Sync the webhook secret.** Choose a long random string, set it as
   `STAMP_WEBHOOK_SECRET` in your deployment, and run:
   ```sql
   update public.stamp_provider_config set webhook_secret = '<same value>' where id = 1;
   ```
2. **Create the private Storage bucket** — Supabase dashboard → Storage → New bucket:
   name exactly `stamped-agreements`, "Public bucket" unchecked. Cannot be done via SQL.
3. (Optional, later) Configure a real `StampProvider` per §A.3 and point its webhook
   delivery at `https://<your domain>/api/webhooks/stamp`.

## A.11 Testing (Electronic Stamping)

- `src/lib/stamping/config.test.ts`, `mock-provider.test.ts`, `rules.test.ts`,
  `migration-security.test.ts` — same coverage shape as the equivalent signature test
  files. **Only actually wired into `vitest.config.mts` as of commit `1714ff5`** — see the
  disclosure at the top of this document and §9 below.
- Manual verification: same six-step end-to-end mock-flow walkthrough as Milestone 10 §12B
  (request → simulateEvent → webhook POST → status/document verification →
  duplicate-delivery check → tampered-signature rejection → non-owning-student IDOR check),
  substituting `/api/webhooks/stamp` and `stamped-agreements`.

---

# PART B — Assisted Onboarding Revision

## B.1 Objective (LOCKED requirement)

After registration, never force a student through a long mandatory profile form. Show two
choices instead: **"Book a Free Nextwise Discovery Session"** (Recommended) or **"Build My
Profile Myself."** Either way, free exploration of Career/Course/College explorers is
preserved regardless of profile completeness (they were never gated on profile completion
to begin with — confirmed during investigation: `/careers`, `/courses`, `/universities`,
`/career-discovery` are not in `PROTECTED_PATHS`). Reuse or build a minimal counselling
booking system with a `DISCOVERY_SESSION` type, and build a structured Discovery Session
Counsellor Workspace.

**Spec-vs-reality gap found and documented, not silently resolved**: the spec describes
reusing "the existing counselling booking system." No such system exists in this
codebase — `/book-counselling` is an explicit Milestone-1 demo whose own on-screen copy
states preferences are "validated locally but were not transmitted, booked, or stored
anywhere." It was left completely untouched. Instead, PARTs 2–3 of migration `0013` build
the smallest real booking model this milestone actually needs: one session type,
`DISCOVERY_SESSION`, locked by a CHECK constraint — not a general scheduler the spec never
asked for.

**Second spec-vs-reality gap**: the spec asks to keep the free Discovery Session "clearly
distinct from the paid ₹5,000 Personal Strategy step." No such paid product exists
anywhere in this codebase under that name or price — only the free Discovery Session
(this milestone) and the general `/pricing` flow (Milestone 10) exist. This milestone does
**not** fabricate a new paid product page to satisfy that sentence; it keeps the real free
Discovery Session visually and conceptually distinct from `/pricing` (different route,
different copy, different CTA styling — "Recommended" badge on the free option, never
positioned as a substitute for a paid plan) and documents the gap here rather than
inventing a feature. See §C.6 for how the related analytics events were handled.

## B.2 Database changes — `supabase/migrations/0013_assisted_onboarding_and_recommendation_readiness.sql`

Ships the full M11-B/C schema in one migration (mirroring `0012`'s own "ship the whole
milestone's schema once" precedent), even though the code landed across four separately
committed submilestones on top of it.

| PART | Object | Purpose |
|---|---|---|
| 1 | `student_profiles.onboarding_path` / `onboarding_path_chosen_at` | Two new nullable columns (`ADD COLUMN IF NOT EXISTS`) — `discovery_session` or `self_serve`, or `null` (not chosen yet). Existing students are never reset or defaulted to either value. |
| 2 | `discovery_sessions` | `session_type` locked to `'DISCOVERY_SESSION'` only via CHECK (forward-compatible column, single value today). `status`: `requested → scheduled → completed`, or `cancelled`/`no_show`. RLS: a student can INSERT their own (only with `status='requested'` and no counsellor pre-assigned) and SELECT their own — **no UPDATE/DELETE for students at all**, so a booking can never be silently altered client-side. Admin/counsellor get SELECT+UPDATE, counsellors scoped to unassigned-or-own via `current_counsellor_id()`. |
| 3 | `discovery_session_workspace` | 1:1 with `discovery_sessions` via `session_id` PK/FK. One `jsonb` column per Counsellor Workspace section (A–H, `student_basics` through `student_uncertainty`, plus `recommendation_readiness_notes`), each CHECK-constrained to `jsonb_typeof(...) = 'object'`. Plus `counsellor_notes text` (section I) and `missing_information text[]` (section J). **Staff-only RLS — students have zero access**, not even read: this is the counsellor's own working notes, never a document shown back to the student. |
| 4 | `student_profile_section_provenance` | Composite PK `(student_user_id, section_key)`. `provenance` CHECK'd to the 4 allowed values; a second CHECK (`..._verified_consistency`) requires `verified_by_counsellor_id`/`verified_at` both set whenever `provenance='COUNSELLOR_VERIFIED'`. **Absence of a row = `SELF_ENTERED`** — the default, not a placeholder needing a backfill. RLS: student SELECT-own-only (never write); admin/counsellor scoped via `admin_student_meta` (widened by `0014` — see below). |
| 5 | `student_recommendation_verifications` | Composite PK `(student_user_id, recommendation_type)`. `recommendation_type` CHECK'd to `career`/`course`/`college`/`pathway`. Stores **only** the counsellor override — the actual NOT_READY/PRELIMINARY/READY levels are a pure computed function (`src/lib/recommendations/readiness.ts`, M11-C2), never stored. `verified_by_counsellor_id` is **NOT NULL** — a materially different constraint from PART 4's provenance table, see §C.3. |
| 6 | Verification queries | Manual, not auto-run. |

## B.3 Migration `0014_discovery_session_counsellor_scope.sql` — a self-identified RLS gap, fixed additively

Found while building B2: `admin_student_meta` only accepts an INSERT from
`super_admin`/`admin` (a deliberate Milestone-7 boundary) — a counsellor can never become a
student's `admin_student_meta.assigned_counsellor_id` by themselves. That made `0013`
PART 4/5's counsellor-scoped RLS (scoped only via `admin_student_meta`) unreachable for a
counsellor legitimately running a brand-new student's Discovery Session, who was never
"assigned" through the admin-only path.

Rather than loosening `admin_student_meta`'s own INSERT policy (out of this milestone's
mandate to revisit), `0014` widens (via `DROP POLICY IF EXISTS` + `CREATE POLICY`, no
table/column changes) all four RLS policies on `student_profile_section_provenance` and
`student_recommendation_verifications` to **also** accept a counsellor who is
`discovery_sessions.assigned_counsellor_id` for some session belonging to that student —
ORed with (not replacing) the existing `admin_student_meta` basis. Same "never rewrite an
already-shipped migration, always ship an additive correction" convention as every prior
milestone's own corrections.

## B.4 Post-registration flow

`RegisterForm.tsx`'s two redirect targets (immediate-session and
email-confirmation-`next=`) both changed from `/dashboard` to `/welcome`.

`/(site)/welcome` — the choice screen. Redirects straight to `/dashboard` if
`onboarding_path` is already set (a one-time fork, never a recurring gate); fires
`onboarding_choice_viewed` on render (an "impression" event fired directly from the server
component body, same established pattern as `career_recommendations_generated` on
`/recommendations`). Two `Card` choices, "Book a Free Nextwise Discovery Session"
(Recommended badge) and "Build My Profile Myself," each a `<form action={...}>` calling
`chooseDiscoverySessionAction`/`chooseSelfServeAction` — sets `onboarding_path` and fires
`onboarding_discovery_selected`/`onboarding_self_profile_selected`, then redirects
(Discovery choice → `/discovery-session/book`; self-serve choice → `/dashboard`). Both
paths, and the "explore first" skip, remain reachable afterwards from the dashboard's own
Counselling / Student Digital Profile cards — this screen is never a student's only path
to either flow.

`/(site)/discovery-session/book` — the authenticated booking form
(`DiscoverySessionBookingForm.tsx`), calling `bookDiscoverySession()`
(`src/lib/supabase/discovery-sessions/book.ts`), validated by
`validateBookDiscoverySession()` (`src/lib/discovery-sessions/rules.ts`), firing
`discovery_session_booked`. `getMyActiveDiscoverySession()`/`listMyDiscoverySessions()`
back the dashboard's "Discovery Session" card (rewired from static "no sessions booked
yet" copy to real data in this same commit).

`/lib/supabase/middleware.ts`'s `PROTECTED_PATHS` gained `/welcome` and
`/discovery-session`.

## B.5 Admin Discovery Session management + Counsellor Workspace (sections A–J)

`/admin/discovery-sessions` (list, filterable) and `/admin/discovery-sessions/[id]`
(detail — assign counsellor, schedule, mark completed/no-show/cancelled via
`DiscoverySessionActionForm.tsx`, gated by the new `"discovery-sessions:read"`/`"write"`
permission pair granted to `admin` and `counsellor`, RLS-scoped further per §B.2 PART 2).
`DISCOVERY_SESSION_STATUS_TRANSITIONS` (`src/lib/admin/status.ts`):
`requested → scheduled|cancelled`; `scheduled → completed|no_show|cancelled`;
terminal states have no further transitions. `discovery_session_completed` fires on the
transition to `completed`.

`/admin/discovery-sessions/[id]/workspace` — the full structured Counsellor Workspace,
sections A–J exactly as specified: **A** Student Basics, **B** Academics, **C** Interests,
**D** Goals, **E** Budget/Financial, **F** Parent/Sponsor Input, **G** Student
Uncertainty, **H** Notes (folded into `counsellor_notes`), **I**
Recommendation-Readiness Notes, **J** Missing Information (a newline-separated free-text
list). `DiscoverySessionWorkspaceForm.tsx` posts to
`saveDiscoverySessionWorkspace()` (`src/lib/supabase/admin/discovery-session-workspace.ts`),
validated by `validateSaveDiscoverySessionWorkspace()` (rejects only when the session's
status is `cancelled`), which upserts by `session_id` and fires `discovery_session_started`
**only the first time** a workspace row is created for that session (never on later edits
— an idempotency-guarded "started" semantic, not a per-save event).

## B.6 Analytics events (Assisted Onboarding)

All **implemented**, each wired to the real call site named above:
`onboarding_choice_viewed`, `onboarding_discovery_selected`,
`onboarding_self_profile_selected`, `discovery_session_booked`,
`discovery_session_started`, `discovery_session_completed`.

---

# PART C — Profile Completeness, Counsellor Verification, and Recommendation Readiness

## C.1 Objective (LOCKED requirement)

Introduce Profile Field Provenance (`SELF_ENTERED`/`COUNSELLOR_ENTERED`/
`COUNSELLOR_VERIFIED`/`SYSTEM_DERIVED`) and Recommendation Readiness
(`NOT_READY`/`PRELIMINARY`/`READY`/`COUNSELLOR_VERIFIED`) per recommendation type
(career/course/college/pathway) with Recommendation Confidence (`LOW`/`MEDIUM`/`HIGH`),
and reflect both on the Student Dashboard. `/admin/students` stays **deliberately
read-only** for student-reported data (`docs/admin-system-guide.md` §4, reconfirmed by a
dedicated research pass before writing any C1 code) — neither feature ever writes to
`student_profiles` or any `student_*` table; both are purely additive metadata layered on
top.

## C.2 Profile Field Provenance (M11-C1)

Modeled at the **section** level (11 keys, matching `src/lib/profile/completion.ts`'s
existing weighted-completion model exactly — `about_you`, `education`,
`subject_strengths`, `interests`, `skills`, `work_preferences`, `career_priorities`,
`career_goals`, `study_location`, `budget_funding`, `experience`), not per individual
database column across the 11 physical `student_*` tables, which the spec's own
completeness model does not require.

- `src/types/profile-provenance.ts` — the 4 provenance values, section keys/labels,
  `SectionProvenance` shape.
- `src/lib/profile-provenance/rules.ts` (+ tests) — `validateSetSectionProvenance()`:
  only `COUNSELLOR_ENTERED`/`COUNSELLOR_VERIFIED` can ever be chosen by a counsellor
  action (`SELF_ENTERED`/`SYSTEM_DERIVED` are set automatically, never written by this
  path); `COUNSELLOR_VERIFIED` requires the acting admin to have a linked counsellor
  record (`admin.counsellorId`).
- `src/lib/supabase/admin/profile-provenance.ts` —
  `getSectionProvenanceMap(studentUserId)` (permission `profile-verification:read`) and
  `setSectionProvenance(studentUserId, formData)` (permission
  `profile-verification:write`) — upserts by `(student_user_id, section_key)`, audit-logs,
  fires `profile_field_counsellor_updated`/`_verified`.
- `src/lib/supabase/profile-provenance.ts` — student-facing
  `getMySectionProvenanceMap()`, RLS-scoped, never resolves the verifying counsellor's
  name (`counsellors` RLS is admin-only) and never surfaces the internal staff note.
- `src/lib/supabase/student-profile.ts` — refactored to extract
  `fetchStudentProfileSnapshotByUserId(supabase, userId)` out of the pre-existing
  `getStudentProfileSnapshot()`, so the new admin-scoped
  `getStudentProfileSnapshotForAdmin()` (`src/lib/supabase/admin/student-profile.ts`,
  gated by `students:read`) reuses the exact same ~150-line, 10-table mapping instead of a
  second, drifting copy.
- **Admin UI**: a new "Student Digital Profile" card on `/admin/students/[id]` —
  per-section completeness (reusing `calculateCompletion()` unchanged) alongside each
  section's provenance badge, with an inline per-section form to record
  `COUNSELLOR_ENTERED`/`COUNSELLOR_VERIFIED` plus an optional staff-only note. Gated by
  `hasPermission(admin?.role, "profile-verification:read"/"write")`, same pattern as the
  Milestone 10 agreements page's `canWrite` check.
- **Student UI**: a new, read-only `ProvenanceSummaryCard` on `/profile` — renders
  **nothing at all** when no section has ever been touched by a counsellor (the common
  case), never modifies the reused `ReviewStep`/`ProfileView` components.

## C.3 Recommendation Readiness + Confidence (M11-C2)

A **pure, computed-fresh-every-time** value (`src/lib/recommendations/readiness.ts`) — the
same "never trust a stored percent" philosophy `calculateCompletion()` itself already
follows. Only an explicit counsellor override is ever persisted
(`student_recommendation_verifications`), which is why `verified_by_counsellor_id` on that
table is **NOT NULL**: unlike profile provenance (where a plain admin can record
`COUNSELLOR_ENTERED` without being a counsellor themselves), recommendation verification
can only ever be written by an account with a linked `counsellors` row — enforced by the
column constraint itself, not just app logic, and RLS's own `WITH CHECK` clause requires
`verified_by_counsellor_id = current_counsellor_id()` even for `super_admin`/`admin`.

Each of the four types reads a considered, documented subset of the 11 completion
sections — `career` mirrors the pre-existing `hasMinimumProfileDataForRecommendations()`
signal categories (the only type with a real matching engine, `src/lib/recommendations/
engine.ts`); `course`/`college`/`pathway` have **no matching engine yet** in this
codebase (`RECOMMENDATION_TYPE_HAS_ENGINE`) — their readiness is explicitly documented as
forward-looking infrastructure a counsellor can assess and verify today, per `0013` PART
5's own table comment. Thresholds: ≥80% weighted-relevant-completion → `READY`/`HIGH`
confidence; ≥40% → `PRELIMINARY`/`MEDIUM`; below → `NOT_READY`/`LOW`. A counsellor
override always wins as `COUNSELLOR_VERIFIED`/`HIGH`, regardless of the computed level.

- `src/lib/recommendations/readiness-rules.ts` (+ tests) —
  `validateSetRecommendationVerification()` (always requires a linked counsellor id, per
  the NOT NULL column above) and `validateClearRecommendationVerification()` (does
  **not** require one — undoing a mistaken verification is a corrective action any
  authorized admin should be able to take).
- `src/lib/supabase/admin/recommendation-readiness.ts` —
  `getRecommendationReadinessForAdmin()` (`recommendation-readiness:read`),
  `setRecommendationVerification()`/`clearRecommendationVerification()`
  (`recommendation-readiness:write`) — both fire `recommendation_readiness_changed`.
- `src/lib/supabase/recommendation-readiness.ts` — student-facing
  `getMyRecommendationReadiness()`, RLS-scoped, no counsellor-name resolution (same
  reasoning as §C.2).
- **Admin UI**: a new "Recommendation readiness" card on `/admin/students/[id]` — one row
  per type, level/confidence/relevant-completion-%/missing-sections, a "Verify" action
  (only offered when the acting admin has a linked counsellor id) and a two-click
  `ConfirmSubmitButton`-guarded "Clear verification."
- **Dashboard integration**: the existing "Career recommendations" card on `/dashboard`
  and the intro of `/recommendations` now show a live `ReadinessBadge` for the `career`
  type instead of just a static "Real" badge. The pre-existing
  `hasMinimumProfileDataForRecommendations()` boolean gate on `/recommendations` is
  **untouched** — this is additive display, not a replacement of that working gate.

## C.4 Permissions added

Two new pairs in `src/lib/admin/permissions.ts`, each independently checked against the
RLS policies they sit in front of (never assumed to match):

| Permission | `super_admin` | `admin` | `counsellor` | `analyst` |
|---|---|---|---|---|
| `discovery-sessions:read`/`write` | ✅ | ✅ | ✅ | ❌ (RLS read policy — `0013` PART 2 — was never extended to `analyst`; granting the app permission without it would just show an always-empty list) |
| `profile-verification:read`/`write` | ✅ | ✅ | ✅ | read-only |
| `recommendation-readiness:read`/`write` | ✅ | ✅ | ✅ | read-only (this table's RLS read policy — `0013` PART 5 — *does* include `analyst`, unlike discovery-sessions above) |

## C.5 Audit log

`AUDIT_ENTITY_TYPES` (`src/lib/supabase/admin/audit.ts`) gained `discovery_session`,
`student_profile_section_provenance`, `student_recommendation_verification` — every write
in PART C above records to the existing `admin_audit_log` via the existing
`recordAuditLog()` path; no second audit table.

## C.6 Analytics events — full status, including the honest "stays reserved" cases

| Event | Status | Real call site / reason it stays reserved |
|---|---|---|
| `profile_field_counsellor_updated` | implemented | `setSectionProvenance()` (COUNSELLOR_ENTERED) |
| `profile_field_counsellor_verified` | implemented | `setSectionProvenance()` (COUNSELLOR_VERIFIED) |
| `recommendation_readiness_changed` | implemented | `setRecommendationVerification()` / `clearRecommendationVerification()` — the one genuine "change" this pure-computed model can detect deterministically |
| `profile_completeness_changed` | reserved | `profile_completion_percent`/`status` is computed fresh every time, never diffed against a previous stored value — no natural point to fire a "changed" event without adding state solely to support it |
| `recommendations_unlocked` | reserved | Would fire the first time computed readiness crosses into `READY`, but readiness has no stored "last known level" by design (`0013` PART 5) — detecting that one-time crossing would require exactly the persistence that design choice was meant to avoid |
| `personal_strategy_cta_viewed` | reserved | No real "Personal Strategy" paid product exists anywhere in this codebase (see §B.1's second spec-vs-reality gap) — nothing to instrument |
| `personal_strategy_selected` | reserved | Same gap as above |

---

# Cross-cutting

## 9. Known limitations and self-identified corrections (complete list)

- **`vitest.config.mts` did not run `src/lib/stamping/**/*.test.ts` from M11-A1 through the
  start of M11-B1** — see the disclosure at the top of this document. Fixed in `1714ff5`.
- **The fix above surfaced a real (minor) bug**: `src/lib/stamping/rules.ts`'s
  `validateRequestStamp()` originally rejected an agreement version whose status was
  `'draft'`, but `create_stamp_request()` (§A.4) is explicitly designed to accept a draft
  version and atomically lock it in the same statement — mirroring how a version is locked
  the moment it's sent for signature, not before. Fixed to only reject `'superseded'`
  versions, matching the RPC's actual behavior. Also fixed a regex mismatch in the
  discovery-sessions `migration-security.test.ts` written this same session (a trailing
  `))` vs `);` difference against the real SQL text).
- **Migration `0012`'s filename and header comment reference PART 8/PART 9 (discovery
  sessions/provenance) that do not exist in that file** — they shipped in `0013` instead
  once the plan was split. Cosmetic only (comment text, not executable SQL); not corrected
  in the already-shipped file per this repo's migration-immutability convention. See §A.4.
- **`0013`'s counsellor-scoping via `admin_student_meta` alone was insufficient** for a
  counsellor running a brand-new student's Discovery Session (that table only accepts
  `super_admin`/`admin` INSERTs) — fixed additively by `0014` rather than editing `0013`.
  See §B.3.
- **No real e-stamping OR e-signature provider is connected** — only the in-memory mocks
  ship for both. Wiring a real stamping provider is described in §A.3 but out of this
  milestone's scope, same posture as Milestone 10's own signature provider.
- **The mock stamp provider's in-memory state is lost on process restart** and is not
  shared across serverless instances — same known limitation as the Milestone 10 mock,
  acceptable for a mock; the database is always this application's real source of truth.
- **No real "Personal Strategy" (₹5,000) paid product exists** — see §B.1 and §C.6.
  `personal_strategy_cta_viewed`/`personal_strategy_selected` stay reserved rather than
  instrumenting a fabricated feature.
- **course/college/pathway Recommendation Readiness has no matching engine behind it** —
  by design (§C.3); it is forward-looking infrastructure a counsellor can already assess
  today, not a claim that those recommendation types themselves exist yet.
- **`README.md`'s own numbered "Milestone N" list already collided with this work before
  this session began** — it separately uses "Milestone 11" to mean an earlier, unrelated
  pricing-inclusions/brand-token delivery (see `MANIFEST.md`, which predates this
  milestone), and its "What's not implemented yet" section still said "there is no signing
  provider" even after Milestone 10's real (mock-backed) signature system had already
  shipped — a pre-existing documentation gap, not something introduced by this milestone.
  README.md has been corrected as part of this milestone's documentation pass (see the
  final report) without renumbering its existing "Milestone N" list, to avoid a broader
  , out-of-mandate renumbering.
- **No email/SMS notification for a booked Discovery Session** — this codebase has no real
  notification system in any milestone (`LoggingNotifier` from Milestone 10 logs instead
  of sending); a booked Discovery Session is visible in-app (dashboard, admin) only.
- **Recommendation Readiness thresholds (80%/40%) and each type's relevant-section list
  are a considered judgment call**, not a value specified anywhere in the spec text (the
  spec names the four levels/three confidence bands but not the exact cutoffs or which
  profile sections matter per type) — documented inline in `readiness.ts`'s own comments
  and open to recalibration.

## 10. Testing summary

Automated (Vitest), all pure/framework-free, no live DB:

- `src/lib/stamping/*.test.ts` (4 files) — §A.11.
- `src/lib/discovery-sessions/*.test.ts` (3 files, including two migration-security
  regression guards for `0013` and `0014`).
- `src/lib/profile-provenance/rules.test.ts`.
- `src/lib/recommendations/readiness.test.ts` + `readiness-rules.test.ts`.

`vitest.config.mts` registers `src/lib/stamping/**/*.test.ts`,
`src/lib/discovery-sessions/**/*.test.ts`, `src/lib/profile-provenance/**/*.test.ts` as new
include globs (`src/lib/recommendations/**/*.test.ts` already covered the readiness files —
no new glob needed there).

Full verification run after every one of the 7 commits above: `npx tsc --noEmit` (clean),
`npm run lint` (clean), `npx vitest run` (852 tests / 53 files passing as of the final
commit — see the final report for the exact figure and how it grew commit-by-commit),
`npm run build` (81 routes).

## 11. Files (complete, by commit)

**`cb7cfc0` — M11-A1, stamping provider foundation:**
New: `supabase/migrations/0012_electronic_stamping_and_assisted_onboarding.sql`,
`src/types/stamping.ts`, `src/lib/stamping/{provider,config,get-provider,mock-provider,rules}.ts`
+ their 4 `.test.ts` files, `src/lib/storage/stamped-documents.ts`.
Modified: `src/types/database.ts`, `.env.example`.

**`d0dfdd4` — M11-A2, admin/student stamping workflow + webhook:**
New: `src/app/api/webhooks/stamp/route.ts`, `src/lib/supabase/admin/stamping.ts`,
`src/app/admin/agreements/[id]/stamped-document/route.ts`,
`src/app/(site)/agreements/[id]/stamped-document/route.ts`,
`src/components/admin/agreements/StampActionForms.tsx`.
Modified: `src/app/(site)/agreements/[id]/page.tsx`, `src/app/admin/agreements/[id]/page.tsx`,
`src/app/admin/agreements/actions.ts`, `src/components/admin/agreements/AgreementForm.tsx`,
`src/lib/admin/status.ts`, `src/lib/analytics/events.ts`, `src/lib/supabase/admin/agreements.ts`,
`src/lib/supabase/admin/audit.ts`, `src/lib/supabase/admin/students.ts`,
`src/lib/supabase/agreements/my-agreements.ts`, `src/types/admin.ts`.

**`1714ff5` — correction:** Modified: `src/lib/stamping/rules.ts`, `vitest.config.mts`.

**`5a584c4` — M11-B1, assisted onboarding + Discovery Session booking:**
New: `supabase/migrations/0013_assisted_onboarding_and_recommendation_readiness.sql`,
`src/types/discovery-session.ts`, `src/lib/discovery-sessions/{rules.ts,rules.test.ts,migration-security.test.ts}`,
`src/lib/supabase/discovery-sessions/book.ts`, `src/lib/supabase/admin/discovery-sessions.ts`,
`src/app/(site)/welcome/{page.tsx,actions.ts}`, `src/app/(site)/discovery-session/book/{page.tsx,actions.ts}`,
`src/components/sections/discovery-session/DiscoverySessionBookingForm.tsx`,
`src/app/admin/discovery-sessions/{page.tsx,actions.ts,[id]/page.tsx}`,
`src/components/admin/discovery-sessions/DiscoverySessionActionForm.tsx`.
Modified: `src/app/(site)/dashboard/page.tsx`, `src/components/sections/auth/RegisterForm.tsx`,
`src/components/admin/AdminShell.tsx`, `src/lib/admin/permissions.ts`, `src/lib/admin/status.ts`,
`src/lib/analytics/events.ts`, `src/lib/supabase/admin/audit.ts`, `src/lib/supabase/middleware.ts`,
`src/lib/supabase/student-profile.ts`, `src/types/database.ts`.

**`1369d8b` — M11-B2, Counsellor Workspace (A–J):**
New: `supabase/migrations/0014_discovery_session_counsellor_scope.sql`,
`src/lib/discovery-sessions/migration-0014-security.test.ts`,
`src/lib/supabase/admin/discovery-session-workspace.ts`,
`src/app/admin/discovery-sessions/[id]/workspace/{page.tsx,actions.ts}`,
`src/components/admin/discovery-sessions/DiscoverySessionWorkspaceForm.tsx`.
Modified: `src/app/admin/discovery-sessions/[id]/page.tsx`, `src/lib/analytics/events.ts`,
`src/lib/discovery-sessions/rules.ts` + `rules.test.ts`.

**`72597bd` — M11-C1, profile verification:**
New: `src/types/profile-provenance.ts`, `src/lib/profile-provenance/{rules.ts,rules.test.ts}`,
`src/lib/supabase/admin/{profile-provenance.ts,student-profile.ts}`,
`src/lib/supabase/profile-provenance.ts`,
`src/components/admin/students/ProfileProvenanceCard.tsx`,
`src/components/sections/profile/ProvenanceSummaryCard.tsx`.
Modified: `src/app/(site)/profile/page.tsx`, `src/app/admin/students/[id]/page.tsx`,
`src/app/admin/students/actions.ts`, `src/components/admin/StatusBadge.tsx`,
`src/lib/admin/permissions.ts`, `src/lib/analytics/events.ts`,
`src/lib/supabase/student-profile.ts`, `vitest.config.mts`.

**`649de5e` — M11-C2, recommendation readiness:**
New: `src/types/recommendation-readiness.ts`,
`src/lib/recommendations/{readiness.ts,readiness.test.ts,readiness-rules.ts,readiness-rules.test.ts}`,
`src/lib/supabase/admin/recommendation-readiness.ts`, `src/lib/supabase/recommendation-readiness.ts`,
`src/components/admin/students/RecommendationReadinessCard.tsx`,
`src/components/sections/recommendations/ReadinessBadge.tsx`.
Modified: `src/app/(site)/dashboard/page.tsx`, `src/app/(site)/recommendations/page.tsx`,
`src/app/admin/students/[id]/page.tsx`, `src/app/admin/students/actions.ts`,
`src/components/admin/StatusBadge.tsx`, `src/lib/admin/permissions.ts`,
`src/lib/analytics/events.ts`, `src/lib/recommendations/fixtures.test-helpers.ts`.

See the final completion report (delivered in-conversation, not a repo file) for the
25-point verification checklist and Definition of Done.
