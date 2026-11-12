# CC26-03: Payment safety and billing

**Payments are OFF and stay off.** No live or test Razorpay payment, refund or webhook operation was performed. No payment switch, key or environment variable was changed.

## 1. Price

The customer price of Nextwise Verified is **₹1,999, inclusive of applicable GST** (199,900 paise).

| Check | Result |
|---|---|
| Pricing page at desktop, iPhone 13 and 320 px (suite G1) | ₹1,999 shown, "Tax is included in this price", 0 checkout links, free Discovery Session CTA present |
| Admin finance note | "Nextwise Verified is INR 1,999 inclusive of applicable GST" |
| App charge guard (`checkout-charge-guard.ts`) | Verified may be charged exactly 199,900 paise or nothing (Vitest) |

## 2. Defect fixed: direct API creation of unpaid invoices (S8)

**Before CC-26:**
- The pause lived only in the Next.js server action (`isPaidCheckoutEnabled()`).
- Any signed-in student could call the RPC `purchase_pricing_plan` directly and receive a real issued invoice, which consumed the next number of the gap-free GST invoice series.
- The same call wrote a purchase snapshot and counted a redemption against any limited offer.
- Students could also insert `payment_attempts` rows with any amount and order id (the CC-15 forgery precondition).
- No money could move: no gateway order is ever created while checkout is off.

**Fix:** `supabase/migrations-proposed/cc26/0026_cc26_database_checkout_gate.sql`.

- **The switch.** `payment_launch_controls` is a single row, closed by default. No client role has any privilege on it and there is no RLS policy, so neither students nor admins can open it through the API. Only the database owner can, with an approved SQL statement (the ACTIVATION section of the file).
- **Two BEFORE INSERT triggers.** While the switch is closed they refuse:
  - a self-checkout invoice (one with `pricing_plan_id`) created by a signed-in user who is not super_admin, admin or finance;
  - any `payment_attempts` insert by such a user.
- **What the refusal undoes.** It raises SQLSTATE 42501 with "Online checkout is not open yet. You have not been charged.", which rolls back the RPC's whole transaction: the invoice number, the purchase snapshot and the offer redemption.
- **Why triggers.** A change inside `purchase_pricing_plan` would have been silently removed by the pending NW01 `create or replace`. The triggers survive it (tested with NW01 applied in both orders).
- **What still works.** Admin and finance invoices, server-side service-role work, webhooks and refunds are unchanged.

**App mapping** (`src/lib/supabase/pricing/checkout.ts`): if the app's flag were ever switched on while the database gate is still closed, the student sees the honest "checkout paused" message instead of "please try again" (`cc26-database-checkout-gate.test.ts`, 6 tests).

## 3. Results

| Suite | Result |
|---|---|
| CC-26 SQL suite, payment checks P00–P10 (disposable DB, both states) | All pass. P01/P02: the student's direct RPC is refused, also with a limited-offer coupon. P03: a direct attempt insert is refused. P06: the ledger is unchanged (no invoice, purchase, invoice number or redemption). P04/P05/P09: neither students nor admins can read or open the switch. P07: anonymous refused. P08: admins still issue invoices. P10: with the gate opened by the owner, checkout charges exactly ₹1,999. |
| Mutation tests | Dropping either trigger is caught (MU2 → P01, MU3 → P03) |
| Browser/API suite P (local stack, real PostgREST JWTs) | See CC26-06: P1 anonymous refused; **P2** (strengthened) the direct RPC is refused with 42501 and no invoice, purchase or invoice number; **P2b** (new) a direct attempt insert is refused; P3 forged verification and P4 forged webhook rejected; P5 secrets unreadable; P6 no payment rows; P7 all paid switches off |
| Suite G (UI) | G2–G8: no confirm or pay control; direct server-action calls refused; forged verification rejected; existing invoices shown honestly; free session still bookable |
| NW-F01 payment SQL (CC-18 protected tests, unchanged) | Offline PGlite **79/79** (NW01 G1–G12 GST matrix, attempt integrity, capture reconciliation), migration rehearsal **12/12**, concurrency **10/10** |

## 4. Tax boundary (why payments must stay off)

Measured by the CC-26 suite's P11, with GST registration switched on inside a rolled-back transaction:

| Database | Total for the ₹1,999 tax-inclusive plan |
|---|---|
| 0001–0022 (no NW01), as on QA today | **₹2,358.82** (235,882 paise): 18% added **on top**. This is the known CC-19/CC-20 defect. |
| With NW01 applied | **₹1,999.00** (199,900): tax backed out of the inclusive price, correctly |

The CC-18 app guard would refuse the ₹2,358.82 charge, and the CC-26 database gate refuses to create the invoice at all. Even so, GST registration must not be switched on before NW01.

## 5. Entitlements and authorization

- Paid features are granted only for invoices whose live status is exactly `paid` (`src/lib/products/entitlements.ts`), and that status is maintained only by `recompute_invoice_status()` from real transactions. Unpaid invoices never grant anything.
- Students can read only their own invoices, attempts and purchases (RLS); anonymous callers cannot purchase (P1, P07).
- Webhook and verification signatures are checked in the database (P3, P4, G5).

## 6. Before payments may be switched on (not authorized now)

1. Apply NW-F01 05 and 06, then NW01, on QA. Set Verified to `tax_inclusive`. Pass the CC-18 QA checks.
2. Run Razorpay **test-mode** journeys on the QA Preview: exact ₹1,999 charge, wrong-amount capture refused, refund path. Use test keys only.
3. Get written business and legal approval for taking payments; confirm the GST registration details.
4. Open the database gate (0026 ACTIVATION) and set `NEXTWISE_PAID_CHECKOUT` with its prerequisites flag. Both are needed: either one alone keeps checkout closed.
