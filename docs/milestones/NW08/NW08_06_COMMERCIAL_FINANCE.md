# NW08.6 — Commercial Operations & Finance

## 1. The hard constraint, restated verbatim

**Nextwise Verified costs INR 1,999 inclusive of applicable GST. An unresolved checkout calculation / incorrect-charge risk was identified in earlier milestones. This milestone does NOT assume it has been fixed, does NOT enable unsafe purchases, and does NOT modify any payment calculation.** Nothing in NW08.6 reads, computes, or displays a price/tax total — it only counts already-recorded `invoices`/`payments`/`refunds` rows by their existing `status` column. No checkout file was opened or changed.

## 2. What was built

**`src/lib/supabase/admin/commercial-finance.ts`** (new) — `getCommercialFinanceOverview(role)`, composing four independently permission-gated sections over the four existing, mature commercial modules: pricing (active plan/offer counts), payments (6-status distribution), invoices (8-status distribution), refunds (8-status distribution, the real `refunds.status` lifecycle — not `Payment.refundStatus`, see §3). Every section is `null` (not an empty array) when the caller's role lacks that domain's own `:read` permission — distinguishing "no access" from "access, but zero rows" — and each section's query is additionally re-verified by `requireAdminPermission()` against the current session's own role before running, never trusting the `role` parameter alone as the gate. No new table, no mutation, no write path.

**New page:** `/admin/finance` ("Commercial Operations & Finance") — four side-by-side panels (Pricing, Payments, Invoices, Refunds), each independently omitted when the viewer lacks that section's permission, with the GST/checkout-risk notice restated directly on the page. Added to the sidebar as "Finance Overview" (gated `payments:read`, alongside the existing Payments/Invoices/Refunds/Payment Events/Billing Settings items in the same group).

## 3. The distinction this page is built around

Per `NW08_01_ADMIN_AUDIT.md` §6, this codebase has two separate refund-status concepts: `Payment.refundStatus` (a coarse 4-value field — `none`/`requested`/`partial`/`full` — living on a payment record) and the standalone `refunds` table's own 8-value lifecycle (`requested → under_review → approved → processing → processed | failed`, plus `rejected`/`cancelled`), the latter governed by `REFUND_STATUS_TRANSITIONS` and the race-safe `claim_refund_for_processing()`/`finalize_refund()` RPCs. This page's Refunds panel reads the latter — the real lifecycle — and its subtitle ("a 'requested' or 'under review' case is not money that has left the business") states the distinction the brief's §16 rules require: a refund **request** is never shown as a completed refund, and a `pending` payment is never counted in the Payments panel as paid (the panel shows every status including `pending`/`failed`, each labeled, never pre-filtered to look more favorable).

## 4. Verification

`npx tsc --noEmit` — clean. `npx eslint` on every new/changed file — clean. `npx vitest run` — 139/2318, unchanged (no new pure-logic function; `getCommercialFinanceOverview()` is a thin, multi-section Supabase-calling composition, same category as `getAdminDashboardSummary()`/`getAnalyticsSummary()`, left to structural review per this codebase's existing convention — see `NW08_01_ADMIN_AUDIT.md` §9). `npm run build` — succeeds; `/admin/finance` registered as a new dynamic route.

## 5. What NW08.6 did not do

No change to any payment, invoice, refund, or pricing mutation path. No change to checkout. No second ledger or duplicated revenue figure (revenue trend remains solely on the Command Centre, sourced from `getAdminDashboardSummary()`). No mockup number used — the SGD currency shown in the mockup does not appear anywhere; every amount/count on this page is a live INR (or whatever currency is actually recorded) query result.
