# CC24-05 — Payment safety report

**Approved price:** Nextwise Verified = **₹1,999 total payable, inclusive of applicable GST** (199,900 paise INR).

**State at `a1017b9` and after CC-24:**
- **paid checkout OFF;**
- no Razorpay order can be created;
- no purchase, invoice or entitlement is created from the pricing journey.

CC-24 did not change the pricing model, prices, GST logic, or any CC-18 payment file.

## 1. The GST concern (unchanged; needs remote work)

The live database function `purchase_pricing_plan()` (migrations 0007/0008) has two defects:
- When GST is fully configured it adds tax **on top** of the price, so ₹1,999 becomes ₹2,358.82.
- When GST is registered but the GSTIN or rate is missing, it silently charges **zero** tax.

CC-18 prepared the correction, which has **not** been applied to QA or production:
- **NW01 (CC-18 version):** tax-inclusive arithmetic; Verified locked to 199,900 INR, `tax_inclusive`, no offers; fails closed on bad tax configuration.
- **nw-f01-s3 `05`:** `check_invoice_charge()` and the attempt-integrity policy.
- **nw-f01-s3 `06`:** webhook capture reconciliation.

Until those are approved, applied and tested (CC-19/CC-20), **taking payments online could charge an incorrect amount.** Payments must therefore stay off. This is release blocker D14.

## 2. Defence layers that keep payments off (verified in CC-24)

| # | Layer | Where | Verified by |
|---|---|---|---|
| 1 | **Launch gate.** All three must hold: `NEXTWISE_PAID_CHECKOUT` is exactly `enabled`; `NEXTWISE_PAID_CHECKOUT_PREREQUISITES` is exactly `CC19-CC20-APPROVED` (an operator statement that the GST migrations are applied); Razorpay keys are present. Razorpay keys alone never enable it, so the gate does **not** rely on empty credentials. | `src/lib/payments/launch-mode.ts` | Unit tests: `cc22b-payments-off` and `cc24-payment-safety` (6 off-cases: credentials only, wrong casing, `true`, empty or lower-case prerequisite, missing secret) |
| 2 | **Purchase gate.** The pricing purchase library refuses before `purchase_pricing_plan()` is called. | `src/lib/supabase/pricing/checkout.ts` | G3: 4 direct action calls refused; 0 rows written. Tree-wide test: the only caller of `purchase_pricing_plan` is gated |
| 3 | **Order gate.** "Pay" refuses before `createOrReuseCheckoutSession()`. | `src/app/(site)/payments/actions.ts` | G4. Tree-wide test: the only caller is gated, and the gate comes first |
| 4 | **Verify gate (new in CC-24, D06).** The browser "verify payment" action refuses before any DB call. | same file | `cc24-payment-safety` (refused with no DB call even with keys set; reaches the DB check only when deliberately enabled) |
| 5 | **App charge guard (CC-18).** Verified must be exactly 199,900 INR with consistent lines and tax. | `src/lib/payments/checkout-charge-guard.ts` | CC-18 suite (unchanged, passing) |
| 6 | **DB charge check (CC-18, proposed).** `check_invoice_charge()` runs before any order. A missing RPC blocks checkout. | `checkout.ts` + `05` | CC-18 suite; a missing RPC fails closed |
| 7 | **HMAC verification.** `verify_checkout_payment` and `apply_webhook_event` re-derive Razorpay's HMAC in the DB. | migrations 0005/0016 | G5: a forged verification is rejected |
| 8 | **Webhook route.** Fails closed: 503 when unconfigured, 400 for a bad signature. | `src/app/api/webhooks/razorpay/route.ts` | Code review |
| 9 | **UI.** No checkout links; existing invoices are shown honestly without a pay control; the free Discovery Session stays bookable. | pricing and payments pages | G1, G2, G6, G8 |

## 3. Browser evidence (local stack, payments off)

| ID | Check | Result |
|---|---|---|
| G1 | ₹1,999 shown as tax-inclusive, 0 checkout links (1440 / 390 / 320 px) | PASS |
| G2 | Direct `/pricing/checkout/nextwise-verified` offers no way to pay | PASS |
| G3 | `confirmPricingPurchaseAction` called directly: Verified, free Explore, invalid id, injection string all refused; invoices, purchases, attempts and transactions unchanged | PASS |
| G4 | `createCheckoutSessionAction` called directly for an open invoice: refused; no attempt | PASS |
| G5 | Forged payment verification is rejected; invoice still unpaid | PASS |
| G6 | Existing invoice listed honestly; not altered or deleted | PASS |
| G7 | Gateway log: 0 purchase or payment writes reached the DB | PASS |
| G8 | Free Discovery Session still bookable from pricing | PASS |

The final per-run results are in CC24-04.

## 4. Display vs charge

- **Display.** The pricing page shows ₹1,999 "inclusive of GST" from the published plan version. It labels tax-inclusive only when the version's `tax_status` is `tax_inclusive`. The repository seeds leave `tax_status = unconfigured`, so QA and production need a published `tax_inclusive` Verified version (CC-18 step 6; finance/admin UI, not SQL).
- **Charge.** Nothing can be charged while the gate is closed. Once opened, layers 5–7 refuse any Verified charge other than exactly 199,900 paise.

## 5. Required follow-up before any real payment (separate approvals)

1. Human security sign-off: cumulative CC-14 to CC-24.
2. QA preflight (CC-18 `Run-QaPreflight.ps1`, read-only), then a QA backup.
3. Apply NW09.2 atomic, `05`, `06`, then NW01 (CC-18 versions) to QA.
4. Business confirmation of the GST configuration: registration, GSTIN, rate. Publish Verified as `tax_inclusive` 199,900 INR.
5. QA G1–G12 in Razorpay **test mode** with fictional users.
6. Only then set `NEXTWISE_PAID_CHECKOUT_PREREQUISITES=CC19-CC20-APPROVED` and `NEXTWISE_PAID_CHECKOUT=enabled` on a staging environment, with test keys.
7. Production: separate decision.

**Paid AI:** unchanged and off. It requires `AI_OPENAI_APPROVED=true` (and `AI_REAL_STUDENT_DATA_APPROVED` for real data). Nothing sets these, and no student-facing AI exists.
