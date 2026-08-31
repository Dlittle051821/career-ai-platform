# Milestone 10 — Electronic Signature Integration (F-122)

## 1. Objective

Let a counsellor/admin send an agreement (already modeled by the flat `agreements` table
from an earlier milestone) out for electronic signature, and let a student view/download
the signed document once complete — without this application ever claiming to *be* an
e-signature provider, and without this application ever claiming jurisdiction-specific
legal validity for the signatures it collects. This milestone ships:

- A provider-agnostic `SignatureProvider` gateway abstraction plus a fully-functional,
  in-memory **mock** implementation (no real provider is connected).
- Two new tables — `agreement_versions` (immutable-once-locked content snapshots) and
  `signature_requests` (one active request per version, full status lifecycle) — plus a
  webhook idempotency ledger (`signature_webhook_events`) and a server-side-only webhook
  secret table (`signature_provider_config`).
- A webhook route (`/api/webhooks/signature`) that verifies every delivery twice (a fast
  local HMAC pre-check, then an authoritative re-check inside a `SECURITY DEFINER`
  Postgres function) and is fully idempotent.
- Admin UI additions to the existing `/admin/agreements` pages (versions, send/resend/
  cancel, signed-document download) — the existing list/create flow is untouched.
- A new student-facing "My Agreements" surface (`/agreements`, linked from `/dashboard`)
  with explicit, server-side ownership checks — not just RLS.
- A `LoggingNotifier` notification stand-in — this codebase has no real email/SMS system
  in any milestone, so this deliberately logs instead of sending, exactly like Milestone
  9 documented "no assessment feature" as an honest gap rather than building a fake one.
- Analytics events wired into the existing Milestone 9 `product_events` registry, and
  audit-log entries wired into the existing `admin_audit_log` / `record_admin_audit_log()`
  path — no second audit table, no new analytics table.

**Legal/compliance note** (documented here and nowhere claimed otherwise in the code or
UI): this milestone does not claim that signatures collected via the mock provider — or
any future real provider — are legally binding in any specific jurisdiction. Provider
choice and any jurisdiction-specific compliance behavior (e.g. IT Act 2000 conformance in
India, eIDAS in the EU, ESIGN/UETA in the US) is a business/legal decision left entirely
to whichever real provider is eventually configured; this application only records
provider-reported status changes.

**Out of scope** (unchanged from the spec, not touched by this milestone): F-123
e-stamping, refund automation, parent dashboard, WhatsApp automation, new payment
features, advanced admissions, market intelligence, AI copilots.

## 2. Architecture

```
                     ┌─────────────────────────────┐
 Admin UI  ───────▶  │ src/lib/supabase/admin/      │──▶ create_signature_request() (RPC, SECURITY INVOKER)
 (send/resend/cancel)│   signatures.ts               │──▶ SignatureProvider.createSignatureRequest()/resend/cancel
                     └─────────────────────────────┘
                                   │ validated by
                                   ▼
                     src/lib/signatures/rules.ts (pure, unit-tested)

 Real/mock provider  ──▶ POST /api/webhooks/signature ──▶ apply_signature_webhook_event() (RPC, SECURITY DEFINER)
  (webhook delivery)                                          │
                                                                ├─▶ signature_requests status transition
                                                                ├─▶ signature_webhook_events (idempotency)
                                                                ├─▶ admin_audit_log (via record_system_audit_log)
                                                                └─▶ agreements.signature_status (sync trigger)
                                          │ best-effort, never fails the webhook response
                                          ▼
                          uploadSignedDocument() → Storage bucket `signed-agreements` (private)
                                          │
                                          ▼
 Student UI  ───────▶ src/lib/supabase/agreements/my-agreements.ts (re-checks student_user_id === user.id)
 Admin UI    ───────▶ createSignedDownloadUrl() → short-lived signed URL (RLS-scoped client)
```

Two clean layering conventions carried over from every prior milestone:

- **Pure vs I/O split**: `src/lib/signatures/` (provider interface, mock provider, env
  config, business rules) is framework-free and fully unit-tested; `src/lib/supabase/
  admin/signatures.ts` and `src/lib/supabase/agreements/my-agreements.ts` are the I/O
  layer wrapping it, same as `src/lib/pricing/` vs `src/lib/supabase/pricing/`.
- **RLS is the floor, not the only check**: every student-facing read explicitly
  re-verifies `student_user_id === user.id` server-side (matching
  `src/lib/supabase/payments/student-invoices.ts`'s precedent) — RLS is real, but this
  codebase never relies on it alone for ownership-sensitive reads.

## 3. Provider abstraction

`src/lib/signatures/provider.ts` defines `SignatureProvider` — mirrors
`src/lib/payments/gateway.ts`'s `PaymentGateway` pattern exactly:

```ts
export interface SignatureProvider {
  readonly providerName: string;
  createSignatureRequest(params: CreateSignatureRequestParams): Promise<SignatureRequestResult>;
  getSignatureStatus(providerRequestId: string): Promise<GetSignatureStatusResult>;
  cancelSignatureRequest(providerRequestId: string): Promise<void>;
  resendSignatureRequest(providerRequestId: string): Promise<void>;
  verifyWebhook(params: VerifyWebhookParams): boolean; // local pre-check only, never authoritative
  getSignedDocument(providerRequestId: string): Promise<SignedDocument>;
}
```

Every field is either an identifier this application already owns, or this
application's own `ProviderSignatureStatus` union — never a raw provider enum leaking
through. `src/lib/signatures/get-provider.ts` resolves `SIGNATURE_PROVIDER` (default
`"mock"`) to a concrete instance; unrecognized values fall back to mock rather than
crashing.

**`MockSignatureProvider`** (`src/lib/signatures/mock-provider.ts`) is a complete,
in-memory implementation: it issues real `mock_req_...` request IDs, tracks per-request
state, generates a realistic signed PDF via `pdf-lib` (already a dependency), computes
real HMAC-SHA256 webhook signatures, and exposes a **test harness** —
`simulateEvent(providerRequestId, eventType, metadata?)` — that produces a webhook
envelope whose signature the provider's own `verifyWebhook()` accepts, so the entire
send → webhook → status-sync loop can be exercised end-to-end without any real provider.

`get-provider.ts` returns a **module-level singleton** mock instance (not one per call):
send/resend/cancel happen across separate HTTP requests, so the mock's in-memory map
must survive between calls within one process for those flows to work. **Known
limitation**: this in-memory state is lost on a cold start/restart and is never shared
across multiple serverless instances — acceptable for a mock, and the actual source of
truth for this application's own UI/authorization is always the database
(`signature_requests`), never the mock's memory.

### Future provider integration

To connect a real provider (DocuSign, Dropbox Sign, Adobe Sign, Zoho Sign, etc.):

1. Add a new class in `src/lib/signatures/` implementing `SignatureProvider`
   (`provider.ts`) — translate that provider's API calls/webhook payload into this
   interface's shape; never leak its raw status enum past `getSignatureStatus`/
   `createSignatureRequest`'s return types.
2. Add a `case` for it in `getSignatureProvider()` (`get-provider.ts`), selected by
   `SIGNATURE_PROVIDER`.
3. Populate `SIGNATURE_API_KEY`/`SIGNATURE_API_SECRET`/`SIGNATURE_ENVIRONMENT` for that
   provider's credentials.
4. Configure that provider's webhook delivery to sign requests the same way this
   application verifies them (`X-Signature: hex(HMAC-SHA256(rawBody, secret))`), or add a
   small bridge in `/api/webhooks/signature/route.ts` that re-signs a verified
   provider-native payload into that envelope before calling
   `apply_signature_webhook_event()`.
5. Run the BOOTSTRAP steps in `0011_electronic_signature.sql` (webhook secret DB sync,
   Storage bucket creation) — unchanged regardless of which provider is behind them.

No other file (rules, admin UI, student UI, webhook route, analytics, audit log) needs to
change.

## 4. Database changes — `supabase/migrations/0011_electronic_signature.sql`

Purely additive; **`0001`–`0010` are untouched** (confirmed: no `alter table
public.agreements` anywhere in this file — `agreements.signature_status` is only ever
updated by a new trigger, never a column redefinition; every other pre-existing table is
untouched).

| Object | Purpose |
|---|---|
| `agreement_versions` | Immutable-once-locked content snapshot per agreement. `status`: `draft → locked → superseded`. A `BEFORE UPDATE` trigger (`prevent_agreement_version_mutation`, copied from `pricing_plan_versions`' established pattern) freezes every column once locked/superseded except the one allowed `locked → superseded` transition. |
| `signature_requests` | One row per send-for-signature attempt. `status`: `draft → pending → sent → viewed → signed` (or `declined`/`cancelled`/`expired`/`failed` off the non-terminal path). A **partial unique index**, `signature_requests_one_active_per_version`, blocks more than one non-terminal (`draft`/`pending`/`sent`/`viewed`) request per version — the anti-duplicate guard. |
| `create_signature_request()` | `SECURITY INVOKER` RPC — atomically locks the target version (`FOR UPDATE`) and inserts the request row, so "lock version + create request" can never race into two active requests for one version. |
| `sync_agreement_signature_status()` | Trigger keeping `agreements.signature_status` (a pre-existing column) in sync with the latest request's status — read-model convenience, single source of truth stays `signature_requests`. |
| `signature_webhook_events` | Idempotency ledger — `unique(provider, event_id)`, `digest(raw_body,'sha256')` fingerprint — same pattern as `payment_webhook_events`/`apply_webhook_event()`. |
| `signature_provider_config` | One-row table holding the server-side-only webhook HMAC secret. RLS **enabled with zero policies** — unreachable via any client role, only via the `SECURITY DEFINER` function below. Mirrors `payment_gateway_config`. |
| `apply_signature_webhook_event(text, text)` | `SECURITY DEFINER`, granted to `anon` only. The single authoritative webhook entry point: re-derives the HMAC from `signature_provider_config`, checks idempotency, applies the status transition, writes to `admin_audit_log` via `record_system_audit_log()`. **Every failure branch returns `{"valid": false, "reason": ...}` — it never `RAISE EXCEPTION`s** on a verification failure, because a raised exception would roll back the same transaction's audit-log insert, silently erasing the very audit trail a rejected delivery needs. |
| `set_signature_document_path(text, text, text)` | `SECURITY DEFINER`, granted to `anon`. Narrow helper the webhook route calls after successfully uploading the signed PDF, to record its Storage path against the right `signature_requests` row. |
| `record_system_audit_log(...)` | `SECURITY DEFINER`, granted to **no** client role — reachable only from inside the two functions above, for the one case (`actor_role = 'system'`, a webhook with no admin session) `record_admin_audit_log()` cannot cover. Writes into the **same existing `admin_audit_log` table** — no second audit table was created. |
| Storage RLS on `storage.objects` | Scoped to bucket `signed-agreements`, resolved by parsing the object's first path segment (`agreementId`) back to `public.agreements` and applying that table's own visibility rules (admin/finance/assigned counsellor/owning student). A regex guard prevents a malformed object name from throwing mid-policy-evaluation. |
| `product_events.event_name` CHECK | Widened (not replaced) to add the five new Milestone 10 event names — see §7. |

Full manual-verification SQL (query the two grant checks, trigger-blocks-mutation,
unique-index-blocks-duplicate, anon-sees-zero-rows, invalid-signature-rejected-and-
audited) is in the migration's own **PART 10**; the two required one-time manual steps
(webhook-secret sync, private bucket creation) are in its **BOOTSTRAP** section at the
end of the file — reproduced in §11/§12 below.

## 5. Status lifecycle

`agreement_versions.status`: `draft` → `locked` (the moment it's sent for signature —
locking makes editing structurally impossible, enforced by the trigger, not just app
logic) → `superseded` (when a newer version is created/sent).

`signature_requests.status`: `draft` → `pending` → `sent` → `viewed` → `signed`, with
`declined` / `cancelled` / `expired` / `failed` reachable from any non-terminal state.
`NON_TERMINAL_SIGNATURE_REQUEST_STATUSES` (`src/types/signatures.ts`) = `draft, pending,
sent, viewed`; these are exactly the statuses the partial unique index treats as "already
active" for a version, and the resend action becomes available only for `sent`/`viewed`.

Editing an agreement after a request already exists never mutates that request or its
locked version — the admin creates a **new** draft version and sends it separately; the
old request/version pair is left alone (there is deliberately no "rule function" for
this in `src/lib/signatures/rules.ts` — the database's immutability trigger already makes
the unsafe path structurally impossible, see that file's own trailing comment).

## 6. API endpoint

**`POST /api/webhooks/signature`** — mirrors `src/app/api/webhooks/razorpay/route.ts`'s
exact structure:

- Reads the raw body via `request.text()` (never `request.json()` first — re-serializing
  would break signature verification).
- Header: `X-Signature: <hex HMAC-SHA256 of the raw body>`.
- Fails closed with 503 if no webhook secret is configured at all.
- Fast local pre-check via `provider.verifyWebhook()`, then the **authoritative**
  `apply_signature_webhook_event()` RPC — the local check is never trusted alone.
- Returns 200 (with `duplicate: true`) for an already-processed delivery — never
  double-fires analytics on a retried delivery.
- On successful `viewed`/`signed`/`declined` transitions, fires the matching
  `product_events` analytics event.
- Best-effort signed-document capture (download from provider → upload to private
  Storage → record path) — failures here are logged but never turn a successfully
  processed webhook into a failed HTTP response.
- Carries **no session** (anonymous Supabase client) by design — every write happens
  inside `SECURITY DEFINER` functions that independently verify the HMAC before trusting
  anything in the body. The client-reported status is never trusted directly.

No other new HTTP routes were added except two GET download routes that mirror an
existing precedent exactly:
- `GET /admin/agreements/[id]/signed-document` — mirrors `invoices/[id]/pdf/route.ts`
  (catches `AdminAuthorizationError` → 403, uses the existing admin-permission system).
- `GET /agreements/[id]/signed-document` — student-facing equivalent, re-checks
  ownership server-side before generating the signed URL.

## 7. Analytics events

Added to the existing `src/lib/analytics/events.ts` registry (a new `"agreement"`
category, no changes to any existing event):

`agreement_signature_requested`, `agreement_signature_viewed`,
`agreement_signature_completed`, `agreement_signature_declined`,
`agreement_signature_cancelled`.

`agreement_signature_requested` and `agreement_signature_cancelled` fire from the admin
action layer (`src/lib/supabase/admin/signatures.ts`); the other three fire from the
webhook route on the corresponding status transition, only once per delivery (idempotency
guard prevents double-counting on retries).

## 8. Permissions & audit log

No new permission system — every admin write goes through the **existing**
`hasPermission(admin.role, "agreements:write")` check (same permission the pre-existing
agreements admin UI already required) and the **existing** admin-auth/session flow
(`getCurrentAdmin()`). No new ad hoc auth check was added anywhere.

Every admin-initiated signature action (create version, send/resend/cancel) writes to
`admin_audit_log` via the **existing** `record_admin_audit_log()` path — same table, same
helper, same convention as every prior milestone. The one exception is the webhook route,
which has no admin session; for that single case a new `record_system_audit_log()`
`SECURITY DEFINER` function (granted to **no** client role, callable only from inside
`apply_signature_webhook_event()`) writes into the same `admin_audit_log` table with
`actor_role = 'system'`.

## 9. Security measures (summary)

- **No secrets committed** — `.env.example` only ever contains blank placeholders.
- **No confidential document is ever publicly accessible** — the `signed-agreements`
  bucket must be created private; all reads go through `createSignedUrl()` with a 5-minute
  TTL, generated fresh server-side on every view/download, never cached client-side, and
  gated by `storage.objects` RLS.
- **Webhook signature verification is mandatory and two-layered** — a local pre-check
  plus an authoritative, independently-re-derived-HMAC database check; a delivery is
  rejected (400/503) if either fails, and the rejection itself is still audit-logged.
- **No IDOR** — every student-facing read (`src/lib/supabase/agreements/
  my-agreements.ts`) explicitly re-checks `student_user_id === user.id` server-side, on
  top of RLS, never trusting RLS alone.
- **Client-reported status is never trusted** — the only place `signature_requests.status`
  is ever written is inside the two `SECURITY DEFINER` functions, driven by a verified
  webhook body, never by anything the browser sends directly.
- **No existing RLS policy, admin permission, or auth flow was weakened** — every new RLS
  policy is additive (new tables only); every admin check reuses the existing role/
  permission system unchanged.
- **The one service-role-key use is narrow and fully documented** — `src/lib/supabase/
  service-role.ts`, used only by the webhook route's Storage upload (which has no session
  to write through); every other read/write in this entire application, across every
  milestone, still goes through the caller's own RLS-scoped session.
- **Input validation on every new server action/route** — `src/lib/signatures/rules.ts`'s
  pure, discriminated-result validators run before every admin write; the webhook route
  validates body/header presence before any DB call.

## 10. Environment variables (new, `.env.example` only)

All five default to unset — the app builds and runs with none of them configured,
falling back to the mock provider and (outside production) a fixed, clearly-labeled
development-only webhook secret:

- `SIGNATURE_PROVIDER` — selects the `SignatureProvider` implementation; defaults to
  `mock`.
- `SIGNATURE_API_KEY` / `SIGNATURE_API_SECRET` — a real provider's credentials; unused by
  the mock. Never prefixed `NEXT_PUBLIC_`.
- `SIGNATURE_WEBHOOK_SECRET` — the HMAC secret both the route and
  `apply_signature_webhook_event()` verify against. In production this alone is **not**
  sufficient — see BOOTSTRAP step 1 below; it must also be written into
  `signature_provider_config`. Never prefixed `NEXT_PUBLIC_`.
- `SIGNATURE_ENVIRONMENT` — purely descriptive (`sandbox`/`production`), passed through
  to a future real provider adapter.
- `SUPABASE_SERVICE_ROLE_KEY`'s existing doc comment was extended (not added new) to
  cover its one additional use site.

## 11. Manual configuration required (nothing here can be done from this sandbox)

1. **Sync the webhook secret into the database.** Choose a long random string, set it as
   `SIGNATURE_WEBHOOK_SECRET` in your deployment, and run:
   ```sql
   update public.signature_provider_config set webhook_secret = '<same value>' where id = 1;
   ```
   If skipped in a non-production environment, a fixed dev-only fallback secret is used
   automatically so the mock provider's loop still works locally; production always fails
   closed (503) if genuinely unconfigured.
2. **Create the private Storage bucket** in the Supabase dashboard → Storage → New
   bucket: name exactly `signed-agreements`, **"Public bucket" unchecked**. This cannot be
   done via SQL/migration — Storage buckets are created through the Storage API/dashboard
   only. The migration's `storage.objects` RLS policies take effect automatically once the
   bucket exists; a public bucket would bypass them entirely, so this checkbox is
   security-critical.
3. **Set `SUPABASE_SERVICE_ROLE_KEY`** if you want the webhook route's automatic
   signed-document capture step to work; if left unset, signature status transitions
   still work correctly — only that one enrichment step is skipped (logged, not fatal).
4. (Optional, later) Configure a real `SignatureProvider` per §3 "Future provider
   integration" and point that provider's webhook delivery at
   `https://<your domain>/api/webhooks/signature`.

## 12. Testing

### Automated (Vitest)

New test files, all pure/framework-free (no live DB — same convention as every prior
milestone's `src/lib/<domain>/*.test.ts`):

- `src/lib/signatures/config.test.ts` — env parsing, dev-only fallback secret,
  production fail-closed behavior.
- `src/lib/signatures/mock-provider.test.ts` — full provider lifecycle (create/status/
  cancel/resend/getSignedDocument), webhook signature verify (accept/tamper/wrong-secret/
  unconfigured), and the `simulateEvent()` test harness.
- `src/lib/signatures/rules.test.ts` — every precondition and edge case for send/resend/
  cancel.
- `src/lib/signatures/migration-security.test.ts` — SQL-text regression guard for
  `0011_electronic_signature.sql`'s security-relevant invariants (grants, `SECURITY
  DEFINER`/`INVOKER` placement, the no-raise-on-verification-failure design, the
  immutability trigger, the partial unique index, the admin-only write policies, the
  zero-policy `signature_provider_config` table) — mirrors
  `src/lib/payments/migration-security.test.ts`'s established pattern for the same reason:
  this project has no live-DB integration harness in Vitest.
- `src/lib/notifications/notifier.test.ts` — `LoggingNotifier` never throws (including
  when `console.warn` itself throws), redaction of sensitive-looking data keys.

`vitest.config.mts` registers three new include globs
(`src/lib/signatures/**/*.test.ts`, `src/lib/storage/**/*.test.ts`,
`src/lib/notifications/**/*.test.ts`).

### Manual verification appendix

**A. Database (after applying the migration and BOOTSTRAP step 1):**
Run the five verification-query groups in `0011_electronic_signature.sql` PART 10 — grant
checks, immutability-trigger-blocks-mutation, partial-unique-index-blocks-duplicate,
anon-sees-zero-rows on all four new tables, and invalid-signature-rejected-and-audited.

**B. End-to-end mock flow (no real provider needed):**
1. As an admin with `agreements:write`, open an existing agreement, create a draft
   version, and "Send for signature" with a signer name/email.
2. Confirm the version flips to `locked` and the request to `sent`; confirm resend/cancel
   buttons appear.
3. In a Node/psql session, use `MockSignatureProvider.simulateEvent(providerRequestId,
   "viewed")` (or `"signed"`) to build a signed envelope, then `POST` it to
   `/api/webhooks/signature` with the resulting `X-Signature` header — confirm the request
   status updates, `agreements.signature_status` follows, and (for `"signed"`) the signed
   document becomes downloadable from both the admin page and, for the owning student,
   `/agreements/[id]`.
4. Re-POST the identical body/signature — confirm a `200 { duplicate: true }` response and
   no second audit-log/analytics entry.
5. POST with a tampered body or wrong signature — confirm 400, and confirm a
   `SIGNATURE_WEBHOOK_FAILED` row appears in `admin_audit_log` with `actor_role = 'system'`.
6. As a student who does **not** own the agreement, confirm `/agreements/[id]` and its
   `signed-document` route both refuse access even with a guessed/valid-looking UUID
   (IDOR check).

## 13. Known limitations (explicit and complete)

- **No real e-signature provider is connected.** Only the in-memory mock ships. Wiring a
  real one is described in §3 "Future provider integration" but was not done as part of
  this milestone (out of scope — this milestone's job was the abstraction + a working
  mock, not a specific vendor integration).
- **No real notification system exists anywhere in this codebase**, in any milestone —
  `LoggingNotifier` logs (with sensitive-looking keys redacted) instead of sending an
  actual email/SMS. This mirrors Milestone 9's own documented gap ("no assessment
  feature") rather than building a fake email sender.
- **The mock provider's in-memory state is lost on process restart** and is not shared
  across multiple serverless instances — acceptable for local dev/testing, not something
  a real provider would ever exhibit (a real provider's state lives on its own servers).
- **Manual Storage bucket creation is required** — see §11 step 2; cannot be scripted from
  this sandbox or a SQL migration.
- **No git repository exists in this sandbox** (`/home/claude/careerpath-ai` is not a git
  repo), so there is no commit/checkpoint for this milestone's changes beyond the files on
  disk.
- **The automatic signed-document capture step is best-effort** — if
  `SUPABASE_SERVICE_ROLE_KEY` is unset, the webhook still correctly updates
  `signature_requests`/`agreements` status; only the "cache a copy in Storage" enrichment
  is skipped (logged, not fatal), so no signed document will be viewable until that key is
  configured and a fresh signed event is delivered.

## 14. Files (see final completion report for the full categorized list)

New: `supabase/migrations/0011_electronic_signature.sql`, `src/types/signatures.ts`,
`src/lib/signatures/*`, `src/lib/notifications/*`, `src/lib/storage/signed-documents.ts`,
`src/lib/supabase/service-role.ts`, `src/lib/supabase/admin/signatures.ts`,
`src/lib/supabase/agreements/my-agreements.ts`,
`src/app/api/webhooks/signature/route.ts`,
`src/components/admin/agreements/SignatureActionForms.tsx`,
`src/app/admin/agreements/[id]/signed-document/route.ts`,
`src/app/(site)/agreements/[id]/page.tsx`,
`src/app/(site)/agreements/[id]/signed-document/route.ts`,
`docs/milestones/M10-electronic-signature.md` (this file).

Modified: `src/types/database.ts`, `src/lib/analytics/events.ts`,
`src/app/admin/agreements/actions.ts`, `src/app/admin/agreements/[id]/page.tsx`,
`src/app/(site)/dashboard/page.tsx`, `src/lib/supabase/middleware.ts`,
`src/components/admin/StatusBadge.tsx`, `.env.example`, `vitest.config.mts`.
