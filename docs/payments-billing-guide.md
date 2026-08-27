# Milestone 8 — Payments, Invoicing and Receipts Guide

This document explains the Milestone 8 payments/billing system: what it actually does, how the pieces fit
together, how to configure and test it against Razorpay, and what its real limitations are. It complements —
never replaces — the code comments in `supabase/migrations/0005_payments_billing.sql`, which remain the most
detailed and authoritative explanation of the database layer.

Nothing in this document should be read as a claim that real payment processing, email delivery, GST compliance,
or webhook delivery is happening in *your* deployment unless you have configured the pieces described below and
verified them yourself against your own Razorpay test-mode dashboard. The code makes no such claim on its own —
every gateway-dependent action fails closed with an honest "not configured" message until you do.

## Table of contents

1. What this system is (and is not)
2. Architecture overview
3. Relationship to the Milestone 7 `payments` table
4. Why verification happens twice (Node pre-check + Postgres authoritative check)
5. Data model
6. The full payment lifecycle, end to end
7. Idempotency: orders and webhooks
8. Payment links (`/pay/[token]`)
9. Invoices, line items, and money math
10. GST / tax honesty
11. Offline (manually recorded) payments vs. gateway-verified payments
12. Refunds
13. Reconciliation
14. PDFs (invoices and receipts)
15. Authorization model (three layers)
16. Environment variables and one-time database bootstrap
17. Local/dev setup and Razorpay test-mode walkthrough
18. Webhook local testing (Razorpay CLI / a tunnel)
19. Automated tests
20. Production checklist
21. Known limitations
22. Troubleshooting
23. Rollback
24. Security correction: function execution privileges

---

## 1. What this system is (and is not)

This is a real integration with Razorpay's order/checkout/webhook/refund APIs, gated entirely by whichever
Razorpay keys you configure. In Razorpay **test mode** (the mode your dashboard test keys operate in), it
performs genuine test-mode checkout flows, genuine webhook deliveries from Razorpay's servers, and genuine
signature verification — nothing here is simulated or mocked at runtime. In **live mode** (live keys), the exact
same code path moves real money, because Razorpay itself does not distinguish code paths by mode — only by which
keys you gave it.

What it is **not**: a claim that any specific deployment has working email delivery, a completed GST
registration, or a production Razorpay account already wired up. Those are all things *you* configure — the
system tells you plainly when a piece is missing rather than pretending it works.

## 2. Architecture overview

```
Browser (student)                 Next.js server (this app)              Postgres (Supabase)
─────────────────                 ────────────────────────              ───────────────────
/payments/[invoiceId]  ────────▶  Server Action:                 ────▶  payment_attempts (order row)
  "Pay" button                    createCheckoutSessionAction()          (idempotent insert)
                                   → gateway.createOrder()
                                     (Razorpay REST, server-only)
                                          │
                                          ▼
                                   Razorpay Checkout.js opens
Razorpay Checkout.js (loaded  ◀── in the browser (order_id +
via next/script) — student        key_id only; key_secret never
enters card/UPI/etc details        leaves the server)
DIRECTLY WITH RAZORPAY,
never with this app
        │
        │ on success, browser receives
        │ razorpay_payment_id / order_id / signature
        ▼
verifyCheckoutAction()   ───────▶  gateway.verifyCheckoutSignature() ──▶  verify_checkout_payment() SQL fn
(Server Action)                    (Node pre-check, fast fail)           re-derives HMAC independently,
                                                                          marks transaction "authorized"
                                                                          (never "captured" — see §4)

Razorpay's servers  ────────────▶  POST /api/webhooks/razorpay  ──────▶  apply_webhook_event() SQL fn
(asynchronous, out of band          verifies signature over the           re-derives HMAC independently,
 from anything the browser           RAW body (Node pre-check)            idempotent on (provider, event_id),
 does)                                                                    marks transaction "captured"/
                                                                           "failed", recomputes invoice status
```

The browser never talks to Razorpay's servers on our behalf for anything privileged — Checkout.js is Razorpay's
own hosted UI, loaded from `https://checkout.razorpay.com/v1/checkout.js`, and the student's payment details go
directly to Razorpay, never through this application's servers. The only things the browser sends back to this
app are the three values Razorpay's Checkout.js success callback provides (`razorpay_payment_id`,
`razorpay_order_id`, `razorpay_signature`), and those three values are independently re-verified in Postgres
before anything is written — see §4.

## 3. Relationship to the Milestone 7 `payments` table

Milestone 7's `public.payments` table (from `0004_admin_system.sql`) is untouched by this migration. It remains
exactly what it always was: an admin's manual, honest record that a payment happened or is expected, with no
gateway integration behind it. Milestone 8 does not repurpose, rename, or reinterpret any of its rows or columns.

Milestone 8 introduces an entirely separate, parallel model — `invoices` → `payment_attempts` →
`payment_transactions` → `refunds` — for anything that goes through the Razorpay gateway from this point
forward. The two systems are not merged and do not reference each other. If you want a single combined view of
"all money in and out," you would need to build that as a reporting query across both — it does not exist today.
The legacy `/admin/payments` module (M7) and the new `/admin/invoices` + `/admin/refunds` modules (M8) are
separate admin nav items, separate tables, separate permissions.

This decision was deliberate rather than an oversight: silently reinterpreting old manually-recorded `paid` rows
as gateway-verified would misrepresent history that was never cryptographically confirmed.

## 4. Why verification happens twice

Every signature check in this system happens in two places:

1. **Node-side pre-check** (`RazorpayGateway.verifyCheckoutSignature` / `verifyWebhookSignature` in
   `src/lib/payments/providers/razorpay.ts`) — a fast local HMAC computation used only to fail fast on an
   obviously invalid request before doing a database round trip. It is never trusted as the actual authorization
   for a database write.
2. **Postgres `SECURITY DEFINER` functions** (`verify_checkout_payment()`, `apply_webhook_event()` in
   `supabase/migrations/0005_payments_billing.sql`) — the authoritative check. Both independently re-derive
   Razorpay's HMAC signature using the secret stored in the zero-RLS-policy `payment_gateway_config` table, not
   whatever the caller (browser, or Razorpay's webhook request) claims. A forged or mismatched signature is
   rejected at this layer regardless of what happened at the Node layer.

This matters because two of the three payment-related writes in this system come from callers that do not carry
an admin-authorized Supabase session in the normal sense: a student's own browser (reporting checkout
completion) and Razorpay's webhook servers (carrying no Supabase session at all). RLS alone — "does this session
belong to a role allowed to write here" — cannot be the boundary for either, because a session proves who is
asking, not whether what they are asking to be recorded is true. The two `SECURITY DEFINER` functions solve this
by re-deriving the truth cryptographically instead: nobody without the real Razorpay secret can produce a valid
signature, so a valid signature is itself the authorization.

A third function, `recompute_invoice_status()`, is deliberately **not** in this list even though it participates
in the same call chains — it is `SECURITY INVOKER` (runs with the calling role's own privileges, fully subject to
normal RLS), not `SECURITY DEFINER`. An earlier release of this migration had it as `SECURITY DEFINER` with no
explicit execution grant, which was a real privilege-escalation bug: any authenticated caller — including a
student with no relationship to the target invoice — could invoke it and have its internal `SELECT`/`UPDATE`
against `invoices` run with the function owner's elevated privileges, bypassing invoice RLS entirely. This has
been corrected — see §24 for the full before/after and how to verify it.

**A verified checkout signature only ever marks a transaction `authorized`, never `captured`.** A successful
Checkout.js callback proves the payment genuinely belongs to the order that was created — it does not prove
Razorpay has finished capturing the funds. Only a verified webhook event (`payment.captured`), or an admin's
manual reconciliation against Razorpay's `fetchPayment` API, ever moves a transaction to `captured`, and only a
`captured` (or better) transaction total ever moves an invoice's status to `paid`. The browser returning to a
"success" URL never by itself marks anything paid.

## 5. Data model

All tables live in `supabase/migrations/0005_payments_billing.sql` (one additive migration; `0001`–`0004` are
untouched). Summary (see the migration file's own comments for full detail on every column and constraint):

| Table | Purpose |
|---|---|
| `payment_gateway_config` | Singleton row holding a server-side-only copy of `RAZORPAY_KEY_SECRET`/`RAZORPAY_WEBHOOK_SECRET`, used only inside the two `SECURITY DEFINER` functions. RLS enabled, **zero policies** — unreachable via the normal API/dashboard client. |
| `billing_settings` | Singleton row of legal entity name, address, support contact, GST registration flag, GSTIN, default tax rate, invoice footer note. Gates whether any tax field is ever shown (§10). |
| `invoice_number_sequences` | One row per invoice-number prefix (currently one per calendar year), written only through `next_invoice_number()` (§9). |
| `invoices` | The bill itself: status, currency, subtotal/discount/tax/total in minor units, dates, notes, a frozen `billing_snapshot` (§9), void reason. Never hard-deleted. |
| `invoice_line_items` | Line items belonging to an invoice; totals are server-computed and re-verified on every write. |
| `payment_attempts` | One row per Razorpay order created against an invoice. At most one non-terminal attempt per invoice (`payment_attempts_one_active_per_invoice`). |
| `payment_transactions` | One row per Razorpay payment id observed against an attempt, or one manually-recorded offline row (`is_manual = true`). |
| `refunds` | A refund requested against a captured transaction. At most one in-flight refund per transaction. |
| `payment_webhook_events` | Append-only ledger of every verified webhook delivery, keyed on `(provider, event_id)` where `event_id` is a SHA-256 fingerprint of the verified raw body. |
| `payment_request_tokens` | Opaque "copy payment link" tokens; only the SHA-256 hash of the token is stored (§8). |

Status enums (also mirrored non-authoritatively in TypeScript for UI purposes — `src/lib/admin/status.ts`'s
`INVOICE_STATUS_TRANSITIONS`/`PAYMENT_ATTEMPT_STATUS_TRANSITIONS`, and `src/lib/payments/invoice-status.ts`'s
`deriveInvoiceStatus()`):

- **Invoice status**: `draft`, `issued`, `partially_paid`, `paid`, `overdue`, `void`, `refunded`,
  `partially_refunded`. The one and only place this transitions for payment-driven reasons is
  `recompute_invoice_status()` in SQL — never set directly by application code except `draft`→`issued` (on
  issue) and any status→`void` (an explicit admin action).
- **Payment attempt status**: `created`, `pending`, `authorized`, `captured`, `failed`, `cancelled`, `refunded`,
  `partially_refunded`.
- **Payment transaction status**: `created`, `authorized`, `captured`, `failed`, `refunded`,
  `partially_refunded`.
- **Refund status**: `requested`, `processing`, `processed`, `failed`.
- **Webhook processing status**: `received`, `processed`, `ignored`, `failed`.

## 6. The full payment lifecycle, end to end

1. An admin (super_admin/admin/finance) creates a **draft** invoice at `/admin/invoices/new`, adds line items.
   Nothing is visible to the student yet.
2. The admin **issues** the invoice. This is the only moment `next_invoice_number()` is called (atomic, §9), a
   `billing_snapshot` is frozen (§9), `issued_by`/`issued_at` are set, and status becomes `issued`.
3. The admin generates a **payment link** (`createPaymentLink` → `payment_request_tokens`) and copies it to send
   to the student however they choose — there is no automated email/SMS send (§16, §21).
4. The student opens the invoice at `/payments/[invoiceId]` (from the dashboard, or via `/pay/[token]` if they
   used the copied link) and clicks **Pay**. `PayButton.tsx` calls `createCheckoutSessionAction()`, which either
   reuses an existing non-terminal `payment_attempts` row for this invoice or creates a new Razorpay order
   (`gateway.createOrder()`) and a corresponding row.
5. Razorpay Checkout.js opens in the browser with the order id and the (non-secret) `key_id`. The student pays
   directly with Razorpay.
6. On success, Checkout.js's callback hands the browser `razorpay_payment_id`/`razorpay_order_id`/
   `razorpay_signature`. `verifyCheckoutAction()` sends these to `verify_checkout_payment()`, which independently
   verifies the signature and marks the transaction `authorized` (never `captured` — §4).
7. Asynchronously (usually within seconds, but not guaranteed), Razorpay's servers POST a webhook to
   `/api/webhooks/razorpay`. The route handler verifies the signature over the **raw** request body, then calls
   `apply_webhook_event()`, which independently re-verifies the signature, records the event idempotently, and —
   for `payment.captured` — marks the transaction `captured` and calls `recompute_invoice_status()`, which is
   what actually moves the invoice to `paid` (or `partially_paid` if it doesn't cover the full total).
8. If the webhook never arrives (misconfigured endpoint, dropped delivery, local dev without a tunnel), an admin
   can trigger **reconciliation** from `/admin/invoices/[id]` — `reconcilePaymentAttempt()` calls Razorpay's real
   `fetchPayment()` API and applies the same "only move forward" status logic the webhook handler uses. This is
   the documented fallback, not a substitute for configuring the webhook in production.

## 7. Idempotency: orders and webhooks

**Order creation** (no duplicate Razorpay orders from a double-click or two open tabs): before creating an
order, the app looks for an existing non-terminal `payment_attempts` row for the invoice. If two requests race
anyway, the partial unique index `payment_attempts_one_active_per_invoice` (`where status in ('created',
'pending', 'authorized')`) rejects the second insert at the database level; the app catches that and re-reads the
now-existing row instead of creating a second live order.

**Webhook processing** (no duplicate captures/refunds/audit entries from a redelivered webhook): `event_id` is a
deterministic SHA-256 hex fingerprint of the verified raw webhook body, computed inline in
`apply_webhook_event()` via `digest(p_raw_body, 'sha256')` — not a header Razorpay is guaranteed to send on every
plan, and not a separate TypeScript helper. `payment_webhook_events_provider_event_unique` (`unique (provider,
event_id)`) is the actual duplicate guard: the function first attempts an `insert ... on conflict do nothing` on
this table, and if that insert affects zero rows, the delivery is a byte-identical duplicate and the function
returns `{duplicate: true}` immediately without touching any other table.

**Out-of-order events** (e.g. a late `payment.authorized` arriving after `payment.captured` already landed) are
handled by "only move forward" logic in the `on conflict` update for `payment_transactions`: a `captured` row is
never downgraded back to `authorized`, and a `failed` row is never resurrected by a later authorized/captured
event for the same payment id.

## 8. Payment links (`/pay/[token]`)

A payment link token is a cryptographically random value; only its SHA-256 hash is ever stored
(`payment_request_tokens.token_hash`), and the raw token exists only in the URL handed to the admin — it is never
written to the database or to the audit log. Visiting `/pay/[token]` is a **lookup convenience only**: it
resolves the token to an `invoice_id` and redirects into the normal `/payments/[invoiceId]` flow, which still
requires the visitor to be signed in as that invoice's own student. Possessing the token never bypasses RLS
ownership checks — a token does not authenticate anyone, it only saves them from having to find the invoice in
their dashboard.

## 9. Invoices, line items, and money math

All money is stored and computed as **integer minor currency units** (paise for INR) — `src/lib/payments/
invoice-math.ts` computes line totals (`quantity × unit_amount − discount + tax`, each step rounded to an
integer) and invoice subtotal/discount/tax/total from line items, and every write re-verifies these
server-side rather than trusting client-submitted totals. `src/lib/admin/money.ts`'s `parseMoneyInput`/
`formatMoney` convert between the major-unit decimal strings shown in forms/UI and the minor-unit integers stored
in the database — this is the same convention every money field elsewhere in the app already uses.

**Invoice numbering** is atomic under concurrency: `next_invoice_number()` (SQL, `SECURITY DEFINER`) uses an
`insert ... on conflict (prefix) do update ... returning` statement against `invoice_number_sequences`, which
takes a row lock for the statement's duration — two concurrent issue requests for the same year's prefix
serialize on that lock and each receives a distinct, gap-free number (`INV-2026-00001`, `INV-2026-00002`, ...).
This deliberately avoids `select max(...) + 1` in application code, which races under concurrent requests.

**Billing snapshots**: `buildBillingSnapshot()` (`src/lib/payments/snapshot.ts`) freezes the student's name/email
and the business's legal name/address/GST details into `invoices.billing_snapshot` (jsonb) at the moment an
invoice is **issued**. A later edit to the student's profile or to `billing_settings` never silently rewrites an
already-issued invoice or receipt — the snapshot is what PDFs render from, not live lookups.

Invoices are never hard-deleted. An unwanted draft or an invoice that should no longer be collectible is
**voided** (`status = 'void'`, `void_reason` set) — the record and its full history remain.

## 10. GST / tax honesty

`src/lib/payments/tax.ts`'s `isGstConfigured()` is the single gate every tax-rendering codepath checks:
`billing_settings.gst_registered = true` **and** a non-blank `gstin` — both, deliberately conservative (the
database also enforces this half at the constraint level: `billing_settings_gstin_requires_flag` forbids a
`gstin` value unless `gst_registered = true`). Until an authorized admin fills in genuine GST registration
details at `/admin/billing-settings`, `applicableTaxRateBps()` always returns `null` (no invented tax rate is
ever applied) and `invoiceDocumentLabel()` always returns `"Invoice"`, never `"Tax Invoice"`. Nothing in this
codebase fabricates a GSTIN, tax rate, legal entity name, or registration information — if you have not genuinely
registered for GST and configured it here, your invoices are plain invoices, and the PDFs say so.

## 11. Offline (manually recorded) payments vs. gateway-verified payments

An admin can record that a payment was received outside Razorpay entirely (bank transfer, cash, a payment taken
before this system existed) via `recordOfflinePayment()`. This creates a synthetic `payment_attempts` row
(`provider: "offline"`, `status: "captured"`) and a `payment_transactions` row with `is_manual: true` and
`provider_payment_id: null` — the database constraint `payment_transactions_manual_requires_no_provider_id`
makes it structurally impossible for a manual row to also carry a gateway payment id, so the two can never be
confused at the schema level. `recompute_invoice_status()` is called afterward exactly as it would be for a real
gateway capture, so the invoice's status correctly reflects the payment either way.

Every UI that displays a transaction (admin invoice detail, student invoice detail, receipts) must render offline
and gateway-verified rows visibly differently, and does — offline rows are labeled as manually recorded, never
presented as "verified by Razorpay." A manually recorded payment can never be refunded through the Razorpay
refund flow (§12 explicitly rejects `is_manual` transactions) — reversing one is an offline/manual process
outside this system, same as recording it was.

## 12. Refunds

Only super_admin/admin/finance can initiate a refund, from `/admin/refunds` or an invoice's detail page.
`loadEligibleTransaction()` in `src/lib/supabase/admin/refunds.ts` rejects the attempt up front if the target
transaction is `is_manual` (offline — see §11) or not in a refundable status (`captured`/`partially_refunded`),
with a clear error message rather than silently doing nothing. A real, eligible refund calls
`gateway.createRefund()` (Razorpay's refund API) and inserts a `refunds` row (`status: "requested"`); the actual
`processed`/`failed` outcome is recorded later via a `refund.processed`/`refund.failed` webhook (or
reconciliation), following the same "verified evidence, not an assumption" principle as payments. At most one
in-flight refund per transaction is allowed at a time (`refunds_one_open_per_transaction`), which keeps webhook
matching for refund events unambiguous. Refund amounts are entered as a major-unit decimal (matching every other
money field in the admin UI) and parsed via `parseMoneyInput()` against the transaction's currency — never as raw
minor units.

## 13. Reconciliation

`reconcilePaymentAttempt()` (`src/lib/supabase/admin/payment-attempts.ts`) is a manual "refresh from gateway"
action available on an invoice's detail page. It calls Razorpay's real `fetchPayment()` API for the attempt's
known payment id and applies the exact same forward-only status transition logic (`nextTransactionStatus()`) the
webhook handler uses — it never trusts anything an admin might type, only what Razorpay's API itself reports.
This exists specifically for the case where a webhook was missed, delayed, or never configured (e.g. during local
development without a public URL) — it is a genuinely useful fallback, not a placeholder.

## 14. PDFs (invoices and receipts)

`src/lib/payments/pdf.ts` generates both invoice and receipt PDFs server-side with `pdf-lib` (no native
dependencies, no headless-browser rendering). All user-supplied text (line item descriptions, notes, student
name) is passed through `sanitizeForPdf()` before being drawn. PDFs render from the invoice's frozen
`billing_snapshot` (§9), never from a live profile/settings lookup, so a document downloaded today always matches
what was true when the invoice was issued. Download routes:

- Admin: `GET /admin/invoices/[id]/pdf`, `GET /admin/invoices/[id]/receipts/[transactionId]`
- Student: `GET /payments/[invoiceId]/pdf`, `GET /payments/[invoiceId]/receipts/[transactionId]`

Every route re-derives ownership (student routes check the invoice's `student_user_id` against the caller's own
session; there is no way to download another student's PDF by guessing an id) and re-checks admin permissions
independently of the page that links to it — a route handler is not authorized merely because a page renders a
link to it.

## 15. Authorization model (three layers)

Matching the existing Milestone 7 pattern, every M8 surface is enforced at three independent layers — "hiding a
button is not authorization":

1. **Middleware / layout**: `src/lib/supabase/middleware.ts`'s `PROTECTED_PATHS` includes `/payments` and `/pay`
   (added alongside the existing `/dashboard`, `/roadmap`, `/profile`, `/recommendations`, `/admin`) — an
   unauthenticated visitor is redirected before any page code runs. The admin layout continues to gate every
   `/admin/*` route on the caller's admin role exactly as it did before M8.
2. **Server actions / data-access**: every mutating function in `src/lib/supabase/admin/invoices.ts`,
   `refunds.ts`, and `payment-attempts.ts` calls `requireAdminPermission("invoices:write")` (or the matching
   `:read`/`refunds:write`/etc. permission) before doing anything — the same `requireAdminPermission()` helper
   Milestone 7's admin modules already use. New permission strings added to `src/lib/admin/permissions.ts`:
   `invoices:read`, `invoices:write`, `refunds:read`, `refunds:write`, `payment-events:read`,
   `billing-settings:read`, `billing-settings:write`.
3. **Postgres RLS**: every M8 table has RLS enabled with explicit policies (see §5's table list and the migration
   file itself) — even a caller who somehow bypassed the first two layers cannot read or write rows RLS does not
   grant. `payment_gateway_config` goes further and has RLS enabled with **zero** policies for any role,
   reachable only from inside the privileged `SECURITY DEFINER` functions.

There is a fourth, function-level layer specific to the four RPC-callable functions this migration defines
(`next_invoice_number`, `recompute_invoice_status`, `verify_checkout_payment`, `apply_webhook_event`): each has
PostgreSQL's default PUBLIC execution grant explicitly revoked and is re-granted only to the one Postgres role
that actually needs it (`authenticated` for the first three, `anon` only for `apply_webhook_event`, since the
webhook route carries no session). See §24 for the full detail — this closes a real gap where, previously,
`recompute_invoice_status` had no explicit grant at all and (combined with an earlier `SECURITY DEFINER` mode)
was callable by any authenticated user, not just an admin.

Role matrix for M8 (matching the existing M7 roles):

| Role | Invoices | Refunds | Payment events | Billing settings |
|---|---|---|---|---|
| `super_admin` | read/write | read/write | read | read/write |
| `admin` | read/write | read/write | read | read/write |
| `finance` | read/write | read/write | read | read/write |
| `counsellor` | read only (own assigned students) | — | — | — |
| `analyst` | read only | read only | — | — |
| `content_editor` | — | — | — | — |
| student | own invoices/attempts/transactions/refunds only, always read-only | — | — | — |

A student can read their own invoice but has no update/delete policy on it at all — they cannot change a total,
mark it paid, alter a gateway identifier, or read another student's records, regardless of what the client-side
code does or doesn't render.

## 16. Environment variables and one-time database bootstrap

Add to `.env.local` (see the fully-commented block already in `.env.example`):

```
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

(`.env.example` ships `NEXT_PUBLIC_APP_URL` pre-filled with the standard local dev URL above, since that value is
correct for local development as-is — change it to your real deployment URL for anything beyond `localhost`. The
three Razorpay variables are intentionally left blank — see §5/§16 on why fabricating a placeholder value for a
secret is never appropriate.)

`RAZORPAY_KEY_ID` is the only one of these ever sent to the browser (Checkout.js needs it to open the payment
modal — it is not a secret). `RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET` must never be prefixed
`NEXT_PUBLIC_` and are read only in server-only modules (`src/lib/payments/env.ts`, guarded by the `server-only`
package as defense in depth). With none of these set, the app still builds and runs — payment actions show a
"Payment gateway is not configured" state instead of crashing any unrelated page.

**These env vars alone are not sufficient.** Checkout and webhook verification read the Razorpay key
secret/webhook secret from the `payment_gateway_config` **database table**, not from `process.env`, at
verification time (§4) — this is a one-time manual step, same pattern as the first `super_admin` bootstrap in
`0004_admin_system.sql`. After running `0005_payments_billing.sql`, run the single `UPDATE` statement in that
file's own `BOOTSTRAP` section (near the bottom) with the exact same values you set for `RAZORPAY_KEY_SECRET`/
`RAZORPAY_WEBHOOK_SECRET`. Until you do this, every checkout verification and every webhook delivery fails closed
with "Payment gateway is not configured" — by design, not a bug.

## 17. Local/dev setup and Razorpay test-mode walkthrough

1. Sign up for a Razorpay account and switch the dashboard to **Test Mode** (top-left toggle). Never use live
   keys in development.
2. **Settings → API Keys → Generate Test Key** gives you a Key ID and Key Secret. Put these in `.env.local` as
   `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET`.
3. Run `supabase/migrations/0005_payments_billing.sql` against your Supabase project (SQL Editor — see the file's
   own top-of-file instructions), then run the `BOOTSTRAP` `UPDATE` statement at the bottom with the same test
   key secret (leave the webhook secret blank for now if you haven't created a webhook yet, or fill it in once
   you have — see §18).
4. As a super_admin/admin/finance user, go to `/admin/billing-settings` and fill in at least a legal entity name
   (GST fields are optional — leave `gst_registered` off unless you genuinely have a GSTIN to test with, per
   §10).
5. Create a test student account, then as an admin go to `/admin/invoices/new`, pick that student, add a line
   item, save as draft, then **Issue**.
6. Generate a payment link from the invoice detail page and copy it, or simply sign in as the student and visit
   `/payments`.
7. Click **Pay**. Razorpay's test-mode Checkout modal opens. Use one of Razorpay's published test card numbers
   (find the current list in Razorpay's dashboard under Test Mode documentation, or in their official docs —
   these change over time, so this guide intentionally does not hardcode one) to complete a test payment.
8. Confirm the invoice moves to `paid` (or `partially_paid`) — this requires either a working webhook (§18) or a
   manual **Reconcile** click on the invoice detail page if you have not set up a webhook yet.

## 18. Webhook local testing (Razorpay CLI / a tunnel)

Razorpay's servers cannot reach `localhost` directly. To test webhooks locally, expose your dev server with a
tunnel (e.g. `ngrok http 3000`) or use Razorpay's own CLI/webhook-testing tooling if you have access to it, then:

1. In the Razorpay dashboard, go to **Settings → Webhooks → Add New Webhook**.
2. Set the URL to `https://<your-tunnel-domain>/api/webhooks/razorpay`.
3. Select at minimum: `payment.authorized`, `payment.captured`, `payment.failed`, `refund.processed`,
   `refund.failed`.
4. Razorpay shows you a webhook secret at creation time — put it in `.env.local` as `RAZORPAY_WEBHOOK_SECRET`,
   **and** update the same value into `payment_gateway_config.razorpay_webhook_secret` via the `BOOTSTRAP`
   statement (§16) — both places need it.
5. Trigger a test payment (§17) and watch `/admin/payment-events` for the incoming delivery, its processing
   status, and (for anything not cleanly matched) its diagnostic message.

If you cannot set up a tunnel, use the manual **Reconcile** action on an invoice instead (§13) — it is the
documented fallback specifically for this situation, not a lesser feature.

## 19. Automated tests

`npm test` runs Vitest over pure, framework-free business logic (no live network calls, no real Razorpay
credentials — see `vitest.config.mts`'s own docblock). Coverage under `src/lib/payments/`: invoice line/total
math (`invoice-math.test.ts`), invoice status derivation (`invoice-status.test.ts`), GST gating
(`tax.test.ts`), payment-link token handling (`tokens.test.ts`), billing snapshot freezing (`snapshot.test.ts`),
and `RazorpayGateway`'s local HMAC pre-checks against hand-computed signature vectors — valid, wrong-secret,
cross-order replay, tampered, and empty signatures for checkout; valid, wrong-secret, wrong-body,
unconfigured-secret, and duplicate-delivery-consistency for webhooks (`providers/razorpay.test.ts`). Existing
`src/lib/admin/permissions.test.ts` and `status.test.ts` were extended with M8 permission strings and status
transitions. `migration-security.test.ts` is a static regression guard over the migration SQL text itself (see
§24) — it reads `supabase/migrations/0005_payments_billing.sql` and asserts the security-mode and grant/revoke
invariants the §24 correction relies on, so a future edit that silently reverts or weakens them fails `npm test`
even without a live database.

The privileged Postgres functions (`next_invoice_number`, `recompute_invoice_status`, `verify_checkout_payment`,
`apply_webhook_event`) cannot be unit-tested via Vitest beyond that static check — their actual runtime behavior
only runs inside Postgres. Their correctness is verified by the manual Razorpay test-mode walkthrough in §17–18
and by the `has_function_privilege()` queries in the migration file's own PART 11 (also reproduced in §24), not
by an automated suite. If your project later adds a Postgres-level test harness (e.g. `pgTAP`), that would be the
natural place to add direct coverage of these functions.

## 20. Production checklist

- Switch Razorpay dashboard to **Live Mode**, generate live API keys, and set `RAZORPAY_KEY_ID`/
  `RAZORPAY_KEY_SECRET` in your production environment's secret store — never commit them, never put them in
  `.env.local` in the repo.
- Re-run the `BOOTSTRAP` `UPDATE` against your production database with the live key secret.
- Create a **live-mode** webhook pointing at your real production domain, and bootstrap the live webhook secret
  the same way.
- Set `NEXT_PUBLIC_APP_URL` to your real production URL so generated payment links are absolute.
- Fill in genuine `billing_settings` (legal entity name, address, and — only if actually GST-registered —
  GSTIN and tax rate). Do not enable `gst_registered` without a real, valid GSTIN.
- Decide and document your own email/SMS delivery approach for payment links if you want automated delivery —
  this system deliberately does not fabricate one (§21).
- Confirm `/admin/payment-events` is reachable by someone who will actually monitor it for `failed`/`ignored`
  events, since a missed webhook silently relies on manual reconciliation until someone notices.

## 21. Known limitations

- **No automated email/SMS/WhatsApp delivery.** Payment links and PDF invoices/receipts are generated and
  downloadable, but sending them is "copy this link/file and send it yourself." If no email provider is
  configured, the UI says **"Email delivery not configured"** rather than claiming a message was sent.
- **GST/tax invoices are only as compliant as what you configure.** This system will never fabricate a GSTIN,
  tax rate, or registration detail — but it also does not validate that a GSTIN you enter is real, active, or
  correctly formatted beyond basic non-blank checks. Confirm your own tax compliance with a professional; this
  is not tax advice.
- **Razorpay only, one mode at a time.** There is no multi-gateway routing and no way to run test and live mode
  simultaneously — the mode is whatever your configured keys are issued for.
- **Refunds require the original transaction to be a real, captured, non-manual gateway payment.** Reversing a
  manually recorded (offline) payment is outside this system entirely.
- **No built-in monitoring/alerting for missed webhooks.** `/admin/payment-events` shows history, but nothing
  proactively pages anyone if a webhook silently stops arriving — reconciliation is manual.
- **No combined ledger across the M7 `payments` table and M8's invoice model** — see §3.
- **No partial-invoice payment plans / installments** — an invoice is paid in full or in a series of ad hoc
  captured amounts that sum toward its total; there is no scheduled installment feature.

## 22. Troubleshooting

- **"Payment gateway is not configured"** everywhere: `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET` are missing from
  your server environment, or the `payment_gateway_config` bootstrap `UPDATE` (§16) was never run — both are
  required.
- **Checkout succeeds in the browser but the invoice never shows as paid**: this is expected if the webhook
  isn't configured/reachable yet (a verified checkout only reaches `authorized`, never `captured`/`paid` — §4).
  Use the **Reconcile** action, or set up a webhook (§18).
- **Webhook delivery shows up in `/admin/payment-events` as `ignored`**: check the `diagnostic_message` column —
  most commonly this means the event type isn't one this system processes (anything other than
  `payment.authorized`/`payment.captured`/`payment.failed`/`refund.processed`/`refund.failed` is recorded for
  audit completeness but intentionally not acted on), or no matching `payment_attempts`/`payment_transactions`
  row was found for the payment/order id in the payload.
- **A refund attempt is rejected**: check whether the target transaction is `is_manual` (offline payments cannot
  be refunded through this flow — §11) or not in a `captured`/`partially_refunded` status.
- **`npm test` doesn't pick up new files under `src/lib/payments/`**: confirm the directory is listed in
  `vitest.config.mts`'s `test.include` array.

## 23. Rollback

Because `0005_payments_billing.sql` only adds new tables/functions/policies and never alters `0001`–`0004`,
rolling back Milestone 8 does not require touching any pre-existing table. To fully remove it: drop the tables
listed in §5 (in an order that respects their foreign keys — `refunds`, `payment_webhook_events`,
`payment_request_tokens`, `payment_transactions`, `payment_attempts`, `invoice_line_items`, `invoices`,
`invoice_number_sequences`, `billing_settings`, `payment_gateway_config`), drop all four functions
(`next_invoice_number`, `recompute_invoice_status`, `verify_checkout_payment`, `apply_webhook_event` — their
explicit `revoke`/`grant` statements from §24 are dropped automatically along with them), and remove the M8 nav
items/routes/permission strings from the application code. A simpler, non-destructive rollback is to leave the
schema in place (it has no effect on any M1–M7 feature) and just unset `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET` —
every payment action reverts to the "not configured" state and no new payment data can be created, while existing
invoices remain readable.

## 24. Security correction: function execution privileges

An earlier release of `supabase/migrations/0005_payments_billing.sql` had a privilege-escalation bug in
`recompute_invoice_status()`. This section documents it, the fix, and how to verify the fix yourself — apply this
correction by re-running the (idempotent) migration file; no other migration is affected.

**The bug.** `recompute_invoice_status(uuid)` was defined `SECURITY DEFINER` with no explicit `GRANT`/`REVOKE`
statements anywhere in the file. PostgreSQL grants `EXECUTE` on a newly created function to `PUBLIC` by default —
in a Supabase project, that means both `anon` and `authenticated` could call it unless explicitly revoked. Because
the function was `SECURITY DEFINER`, its body (a `SELECT` and an `UPDATE` against `public.invoices`) ran with the
function **owner's** privileges rather than the caller's — bypassing the `invoices` table's RLS policies
entirely. In practice this meant any authenticated user, including a student with no relationship whatsoever to
the target invoice, could call `recompute_invoice_status('<any invoice id>'::uuid)` directly via
`supabase.rpc(...)` and have Postgres read and recompute that invoice's status regardless of ownership — an RLS
bypass, even though the recomputation logic itself only ever derives a status from already-verified
`payment_transactions`/`refunds` rows rather than accepting arbitrary input.

**The fix**, both applied in this migration file:

1. `recompute_invoice_status(uuid)` is now `SECURITY INVOKER` (see the PART 6.5 comment block in the migration
   for the full before/after). It executes with the *calling* role's own privileges, so its internal
   `SELECT`/`UPDATE` are fully subject to the normal `invoices`/`payment_transactions`/`payment_attempts`/
   `refunds` RLS policies described in §5 and §15 — a direct call from a non-admin, non-owning caller now finds
   the target row invisible (raises `Invoice not found.`) or, for a caller's own invoice, fails the `UPDATE`
   (there is still no student `UPDATE` policy on `invoices`), which now raises a clear exception instead of
   silently returning a null-filled row.
2. `next_invoice_number()`, `recompute_invoice_status(uuid)`, `verify_checkout_payment(uuid,text,text,text)`, and
   `apply_webhook_event(text,text)` all have `PUBLIC`'s default `EXECUTE` grant explicitly revoked, then
   re-granted only to the one Postgres role each function's real call site actually runs as: `authenticated` for
   the first three (every real caller is an authenticated student or admin server action — see PART 10 in the
   migration for the exact call sites cited), and `anon` — not `authenticated` — for `apply_webhook_event`, since
   `src/app/api/webhooks/razorpay/route.ts` deliberately carries no Supabase session and therefore executes as
   `anon`. No function in this migration is left executable by `PUBLIC`/unrestricted.

**Why the checkout/webhook flows still work.** `apply_webhook_event()` (still `SECURITY DEFINER`) calls
`recompute_invoice_status()` internally after processing a `payment.captured` or `refund.processed` event. A
`SECURITY INVOKER` function called from inside a `SECURITY DEFINER` function executes under the *outer*
function's already-elevated role for that call — and a function's owner always retains implicit `EXECUTE` on
functions it owns, regardless of the `REVOKE ... FROM PUBLIC` above — so this nested call is unaffected. Direct
admin RPC calls (`recordOfflinePayment` and `reconcilePaymentAttempt` in `src/lib/supabase/admin/`) also continue
to work, because those actions run only after `requireAdminPermission("invoices:write")` succeeds, and the
`super_admin`/`admin`/`finance` roles that permission requires are exactly the roles the existing `invoices`
`UPDATE` RLS policy already allows.

**Verifying it.** The migration file's own PART 11 ("Security verification queries") has copy-pasteable
`has_function_privilege()` queries to run in the Supabase SQL Editor after applying this migration — confirming
`authenticated` can call the first three functions but not `apply_webhook_event`, `anon` can call only
`apply_webhook_event`, and `PUBLIC` itself can call none of the four; plus a `pg_proc.prosecdef` query to confirm
each function's security mode matches what's documented, and an end-to-end check (call
`recompute_invoice_status()` as a non-admin test user against another student's invoice and confirm it raises
rather than returning data). `src/lib/payments/migration-security.test.ts` is a static, DB-free regression test
that reads the migration file's text and asserts these same invariants (security mode, and every expected
`revoke`/`grant` statement) so a future accidental revert of this fix fails `npm test` immediately, without
needing a live database to catch it.
