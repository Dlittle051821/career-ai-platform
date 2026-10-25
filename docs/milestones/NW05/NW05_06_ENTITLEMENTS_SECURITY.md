# NW05.6 — Product Entitlements Security Fix (P0)

Status: **COMPLETE** — the P0 gap NW05.1's audit found is fixed in code and covered by adversarial tests.

## 1. The defect (confirmed by NW05.1's audit, fixed here)

`public.purchase_pricing_plan()` (the checkout-confirmation RPC) creates a `pricing_purchases` row and an `invoices` row (`status = 'issued'`, unpaid) **before** the student completes payment via Razorpay — the browser is then redirected to `/payments/[invoiceId]` for the actual payment step (`src/app/(site)/pricing/checkout/actions.ts`). Before this fix, `getMyProductEntitlements()` granted `hasCareerEntitlement`/`hasAbroadEntitlement` from the mere **existence** of a `pricing_purchases` row — with zero reference to that invoice's actual payment state. Consequences, all now fixed:

- A student who started checkout but never paid (or whose payment failed) was granted the same entitlement as a student who actually paid.
- A later refund (`invoices.status` transitioning to `'refunded'`/`'partially_refunded'` via the existing, already-correct `recompute_invoice_status()`) never revoked the entitlement — the purchase row was never touched.

This is exactly ENTITLEMENT RULES 3 and 4 in the NW05 brief: "A purchase is NOT an active entitlement merely because a purchase row exists" and "Pending, failed, refunded or cancelled purchases must not grant paid access."

## 2. The fix

`src/lib/products/entitlements.ts`:

- `classifyPurchaseEntitlements()` gained a third parameter, `paidInvoiceIds: ReadonlySet<string>`. A purchase now counts toward an entitlement only when **both** its plan resolves to a known category (unchanged rule) **and** its `invoiceId` is in `paidInvoiceIds`.
- `getMyProductEntitlements()` now also queries `invoices` (`id, status`) for every invoice id linked to the student's own purchases, and builds `paidInvoiceIds` from only the rows whose `status === 'paid'`. Every other status (`draft`/`issued`/`partially_paid`/`overdue`/`void`/`refunded`/`partially_refunded`) and a missing invoice link both exclude the purchase.
- **Fail-closed**: if the `pricing_plans` lookup or the `invoices` lookup errors, the function returns the all-false/empty shape — never the old "fall back to granting it anyway" behavior.

No schema change was needed. `recompute_invoice_status()` (`0005_payments_billing.sql`) already existed and was already the correct, authoritative source of invoice status — this fix is purely a read-side join that had been missing.

## 3. Why this is safe to ship without a migration

- Zero new tables/columns/RLS policies — `invoices` is read through its existing "Students can read their own invoices" RLS policy, and `invoiceIds` is derived only from the student's own already-RLS-scoped purchases (never from client input), so there is no cross-user leakage risk even independent of RLS.
- `ProductEntitlements`'s public shape is unchanged — every caller (`/studio`'s "Active plan" badges) needed no change.
- This is strictly MORE restrictive than before — no path that previously denied an entitlement can now grant one; some paths that previously granted one (unpaid/refunded purchases) now correctly deny it.

## 4. Payment safety — unchanged, per the brief's explicit instruction

This fix does not touch, enable, or alter any payment-provider integration, the Razorpay checkout flow, or the ₹1,999 GST-inclusive price calculation. The brief's own instruction — "DO NOT enable payments... DO NOT alter the payment calculation as part of NW05... keep unsafe checkout blocked pending explicit approval and a separately validated payment fix" — is honored exactly: checkout remains exactly as it was found. This stage only fixed what happens AFTER a purchase row exists, never anything about creating or processing one.

## 5. Tests

`src/lib/products/entitlements.test.ts` (rewritten for the 3-arg signature, +8 new cases) — pure classifier tests, including the brief's SECURITY CASES applicable at this layer: no linked invoice, a pending ("issued") invoice, a refunded invoice, a mix of one paid and one pending purchase, and an unresolvable category even with a paid invoice.

`src/lib/products/entitlements-io.test.ts` (new, 9 tests) — a narrow, explicitly-justified exception to the "`src/lib/supabase/` is untested here" convention (same reasoning as every other such exception in `vitest.config.mts`), extended to this specific I/O wrapper because it is the security-critical function this fix targets. Mocks `createClient`/`listMyPurchases` and verifies:

- No purchases, or no purchase linked to any invoice → empty, and Supabase is never even queried.
- A genuinely paid purchase → the real entitlement is granted.
- A refunded / partially-paid / still-issued invoice → no entitlement, despite the purchase row and a resolvable category existing.
- A `pricing_plans` lookup error, or an `invoices` lookup error → empty (fail-closed) either way.
- The function never throws, even on an unexpected Supabase rejection.

Both files are already covered by the existing `"src/lib/products/**/*.test.ts"` vitest include glob — no config change was needed.

## 6. Security cases from the brief — coverage

| Case | Covered by |
|---|---|
| Anonymous | `listMyPurchases()`'s own existing `getCurrentUser()` null-check (unchanged, pre-existing) |
| Free registered (no purchases) | `entitlements-io.test.ts` |
| Paid verified | `entitlements.test.ts` + `entitlements-io.test.ts` |
| Pending purchase | Both test files |
| Failed purchase | Same as pending — a failed Razorpay attempt never reaches `'paid'` |
| Refunded purchase | Both test files |
| Revoked/cancelled purchase | Same mechanism as refunded — any non-`'paid'` status |
| Forged client entitlement flag | Structurally impossible — entitlement is always server-recomputed from `invoices.status`; nothing client-supplied is ever read |
| Invalid ownership / another student's resource id | `invoiceIds` is derived only from the caller's own RLS-scoped purchases; `invoices` RLS itself is a second, independent barrier |
| Missing entitlement config | `entitlements.test.ts`'s "unresolvable category" cases |
| DB query error | `entitlements-io.test.ts`'s two fail-closed cases |

## 7. Validation

| Check | Result |
|---|---|
| `npx tsc --noEmit` | Clean — 0 errors |
| `npx vitest run` | 133 files / 2173 tests — all passing |
| `npm run lint` | 0 errors, 18 pre-existing warnings (unchanged) |
| `npm run build` | Succeeds |
