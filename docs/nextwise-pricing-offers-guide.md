# Milestone 10 — NextWise Pricing & Offers Guide

This document explains the Milestone 10 pricing/offers system: the nine official NextWise plan prices, how the
database and admin UI keep price history immutable, how the checkout flow reuses Milestone 8's payments system
unchanged, and every deliberate "never invent this" boundary. It complements — never replaces — the code comments
in `supabase/migrations/0007_nextwise_pricing_offers.sql`, which remain the most detailed and authoritative
explanation of the database layer.

Nothing in this document should be read as a claim that a specific deployment already has real, admin-approved
plan benefits, an active discount, or a configured tax rate. Those are all things an admin enters at
`/admin/pricing` — until they do, the public pricing page shows honest, neutral placeholder copy instead of a
fabricated one.

## Table of contents

1. The nine official plans
2. What's shown vs. what's never invented
3. Database design
4. Pricing versions: immutability and the publishing workflow
5. Payment type: one-time only (no subscriptions, no instalments)
6. Offers
7. Checkout flow, end to end
8. Security model (RLS, roles, `purchase_pricing_plan()`)
9. Taxes
10. Student dashboard
11. Analytics
12. Testing and manual verification
13. Migration, seed, and rollback
14. Known limitations and unresolved decisions
15. Milestone 11 — Inclusions, presentation settings, and the NextWise visual identity

---

## 1. The nine official plans

Every price below is the real, final NextWise price — integer minor units (paise), one-time payment, no
subscription, INR only, no active discount by default. These are seeded by
`supabase/seed/0004_pricing_offers_seed.sql` and are the only prices this system will ever show unless an admin
changes them at `/admin/pricing`.

| Category | Plan | Price | Minor units | Slug |
| --- | --- | --- | --- | --- |
| School Counselling | School Counselling | ₹5,000 | 500000 | `school-counselling` |
| Class 11 Counselling | Class 11 Counselling | ₹10,000 | 1000000 | `class-11-counselling` |
| Class 12 Counselling | Class 12 Counselling | ₹15,000 | 1500000 | `class-12-counselling` |
| Bachelor Abroad | Bachelor Abroad — Tier 1 | ₹25,000 | 2500000 | `bachelor-abroad-tier-1` |
| Bachelor Abroad | Bachelor Abroad — Tier 2 | ₹60,000 | 6000000 | `bachelor-abroad-tier-2` |
| Bachelor Abroad | Bachelor Abroad — Tier 3 | ₹1,30,000 | 13000000 | `bachelor-abroad-tier-3` |
| Master Abroad | Master Abroad — Tier 1 | ₹27,000 | 2700000 | `master-abroad-tier-1` |
| Master Abroad | Master Abroad — Tier 2 | ₹65,000 | 6500000 | `master-abroad-tier-2` |
| Master Abroad | Master Abroad — Tier 3 | ₹1,40,000 | 14000000 | `master-abroad-tier-3` |

The Bachelor/Master Abroad **tier names are temporary** — "Tier 1/2/3" is a placeholder until NextWise decides on
permanent names. The slug (used forever by every purchase record) never changes; the *public title* is edited at
`/admin/pricing/[id]/versions/new` by publishing a new price version whenever the name is finalized. Slugs are
otherwise stable and load-bearing: `/pricing/checkout/[slug]`, analytics, and historical purchase snapshots all key
off them.

`src/lib/pricing/offers.test.ts` pins these nine amounts (as a fixture that mirrors the seed file byte-for-byte) so
a future edit to either file that drifts from the other fails the test suite.

## 2. What's shown vs. what's never invented

This system was built against one hard rule: **nothing about a plan's scope, discount, tax, or legal terms is ever
fabricated by application code.** Concretely:

- **Included services / benefits** — a plan version's `included_services` starts as an empty array. Until an
  admin adds real entries, the public pricing page and checkout summary show
  `"Contact NextWise for the detailed service scope."` (`NEUTRAL_SCOPE_FALLBACK`,
  `src/lib/pricing/plan-versions.ts`) instead of a guessed feature list. There is no default benefit list anywhere
  in the codebase.
- **Exclusions** — a default disclaimer ("University, visa, test, translation, courier, government, and other
  third-party fees are not included unless stated otherwise") is shown when a plan hasn't listed its own
  exclusions. An admin can override this per plan with specific text.
- **Discounts / coupon codes** — no offer exists until an admin creates one, and every new offer is created
  `is_active = false`, `status = 'draft'`. There is no seed data for offers at all (`supabase/seed/0004_...` seeds
  zero rows into `pricing_offers`).
- **Tax rates** — a plan version's `tax_status` only ever says whether tax is *configured* to be additive,
  inclusive, or not configured; it never states or computes a rate on its own. See §9.
- **Guarantees** — no plan copy anywhere claims a guaranteed admission, visa outcome, or scholarship. The public
  pricing page's own disclosure card states this explicitly.
- **Instalments / refund percentages / session counts** — none of these exist as structured data anywhere in this
  migration; if a plan's description happens to mention them, that text is 100% admin-authored, never computed or
  defaulted by this system.

## 3. Database design

Five new tables (migration `0007_nextwise_pricing_offers.sql`), all under Row Level Security:

- **`pricing_plans`** — catalog identity: `slug` (stable, unique), `category` (one of the five sections),
  `internal_name`, `display_order`, `is_recommended`, `is_active`, and `current_version_id` (which version is
  currently live). No price lives here — see §4. Never hard-deleted; a plan that should stop being offered is
  deactivated (`is_active = false`) instead, so historical purchases and invoices that reference it stay intact.
- **`pricing_plan_versions`** — one row per priced revision: title, description, `currency`,
  `amount_minor_units`, `payment_type` (always `'one_time'`), `included_services`/`exclusions` (jsonb arrays of
  `{label, description}`), `tax_status`, `status` (draft/published/archived), and an optional
  `effective_from`/`effective_until` window. **Immutable once it leaves draft** — see §4.
- **`pricing_offers`** — one row per discount: `discount_type` (`fixed` or `percentage`), the corresponding
  amount/percentage, an optional `coupon_code`, a mandatory `starts_at`/`ends_at` window, `is_active`, `status`,
  and redemption limits (`max_redemptions`, `per_user_limit`, `redemption_count`). See §6.
- **`pricing_purchases`** — an immutable snapshot written once, at the moment of purchase, by
  `purchase_pricing_plan()` (§8) — never by any other code path. Captures the plan name, approved benefits,
  original amount, discount, tax, and final amount **as they were at that instant**, so a later price change can
  never alter what a past purchase says it cost.
- **`pricing_analytics_events`** — a narrow funnel log (`plan_view` / `plan_selected` / `checkout_started` only).
  See §11 for why this deliberately carries no money.

Every table's RLS policy set follows the same shape: public/anonymous reads are restricted to active + published +
currently-effective rows; `super_admin`/`admin`/`finance` can write; `analyst` can read everything but not write;
`counsellor` and `content_editor` get **no** pricing access at all (spec: "counsellors must not modify pricing",
"content managers must not modify financial values unless explicitly authorized" — this migration does not
explicitly authorize it).

## 4. Pricing versions: immutability and the publishing workflow

A plan's price never changes in place — publishing a new price always means creating a **new**
`pricing_plan_versions` row. This is enforced two ways:

1. **A `BEFORE UPDATE` trigger** (`prevent_pricing_version_mutation()`) on `pricing_plan_versions`: while a version
   is `draft`, every field is freely editable. The instant its status leaves `draft`, only the
   `published → archived` transition is allowed — any other column changing on that row raises an error. RLS alone
   cannot express "this row is only sometimes read-only," which is why this needed a trigger, not just a policy.
2. **Publishing a version** (`publishPricingPlanVersion()`, `src/lib/supabase/admin/pricing.ts`) archives any
   *other* currently-published version of the same plan first, so at most one version is ever live, then points
   `pricing_plans.current_version_id` at the new one.

An invoice created for a purchase stores which version it was created against (via `pricing_purchases`, §3) —
changing a plan's price afterward can never retroactively change what a past invoice says. "Publish future
pricing" means exactly that: `effective_from` can be set in the future, so a version is published now (visible to
admins, price-locked) but not purchasable by students until that moment arrives — enforced by
`isVersionCurrentlyEffective()` (`src/lib/pricing/plan-versions.ts`) both in the UI and, independently, in
`pricing_plan_versions`'s own public RLS policy and inside `purchase_pricing_plan()`.

Archiving a published version retires it early with no replacement — the plan simply has no purchasable version
until a new one is published.

## 5. Payment type: one-time only (no subscriptions, no instalments)

Every plan is a single, one-time payment. `pricing_plan_versions.payment_type` is constrained by a `CHECK`
constraint to the literal value `'one_time'`, and `billing_interval` is constrained to `null` only — there is no
code path in this migration that can create a recurring charge or an instalment schedule. This was a deliberate
scope boundary from the original spec, not an oversight: the schema keeps `payment_type` as a string (rather than a
boolean) specifically so a future, **separately reviewed** subscription/instalment feature could extend it later
without a breaking schema change — but nothing here implements one today. No UI copy anywhere describes a price as
monthly or yearly (`paymentTypeLabel()` in `src/lib/pricing/plan-versions.ts` always renders "One-time payment").

## 6. Offers

An offer is a plan-scoped discount: `fixed` (a flat minor-units amount) or `percentage` (basis points, e.g. 1000 =
10.00%). Validation happens in two layers that are kept deliberately in lockstep — `src/lib/pricing/offers.ts` (the
pure TypeScript copy used by the admin form and the checkout preview) and matching `CHECK` constraints plus
re-validation inside `purchase_pricing_plan()` (the authoritative copy):

- A percentage must be greater than 0 and at most 100 (bps 1–10000).
- A fixed discount must be a positive amount, in the **same currency as the plan**, and can never exceed the
  plan's current price.
- `ends_at` must be after `starts_at`.
- `max_redemptions` and `per_user_limit`, if set, must be positive integers.
- A coupon code, if present, must match `^[A-Z0-9_-]{3,32}$` — nothing generates a coupon code automatically; every
  code is admin-typed.
- **No offer is active by default.** `createPricingOffer()` always inserts `is_active = false, status = 'draft'`.
  An admin must explicitly publish (`draft → published`) and then separately activate it (`setPricingOfferActive`)
  before it can ever apply to a checkout — two distinct, deliberate steps, both requiring the two-click
  `ConfirmSubmitButton` confirmation in the admin UI (`PricingOfferWorkflowCard.tsx`) since either one can start
  applying a real discount to student checkouts.
- An offer only ever applies when **all** of active, published, and inside its `[starts_at, ends_at]` window are
  true (`isOfferCurrentlyRedeemable()`) — an expired, inactive, draft, or future offer can never discount a price,
  on the public page, at checkout preview, or inside `purchase_pricing_plan()`.
- An offer that has used up every redemption slot (`redemption_count >= max_redemptions`) is treated as exhausted
  (`isOfferExhausted()`) and skipped, even if every other condition holds.
- The computed discount is always clamped to at most the plan's amount (`computeOfferDiscount()`), so the final
  price can never go negative — verified for both a normal and a deliberately-oversized fixed discount in
  `src/lib/pricing/offers.test.ts`.

## 7. Checkout flow, end to end

```
Browser (student)                     Next.js server                          Postgres (Supabase)
─────────────────                     ───────────────                         ───────────────────
/pricing                    ────────▶  listPublicPricingPlans()        ────▶  RLS-filtered read of
  (public, no login)                   (src/lib/supabase/pricing/             pricing_plans/versions/offers
                                        public-plans.ts)

Click a plan's CTA          ────────▶  middleware redirects to /login   (only if not already signed in;
                                        ?next=/pricing/checkout/[slug]    PROTECTED_PATHS in
                                                                          src/lib/supabase/middleware.ts)

/pricing/checkout/[slug]    ────────▶  getPublicPricingPlanBySlug()     ────▶  same RLS-filtered read,
  (order-summary/confirm)              computePriceBreakdown()                one plan
                                        (preview only — never authoritative)

"Confirm and continue      ────────▶  confirmPricingPurchaseAction()   ────▶  purchase_pricing_plan(planId,
  to payment"                         → purchasePricingPlan()                 offerId, couponCode)
                                                                                (SECURITY DEFINER, §8)
                                                                          ──▶  re-validates plan/offer/amount/
                                                                                currency/effective dates,
                                                                                writes invoices +
                                                                                invoice_line_items +
                                                                                pricing_purchases

                             ────────▶  redirect(/payments/[invoiceId])
/payments/[invoiceId]       ────────▶  EXISTING Milestone 8 flow: createOrReuseCheckoutSession()
  (unchanged M8 page)                  → PayButton (Razorpay Checkout.js) → verifyCheckoutPayment()
                                        → public.verify_checkout_payment() (independent signature re-check)
```

The critical property: **once `purchase_pricing_plan()` returns an `invoice_id`, this is an ordinary invoice.**
Nothing about the rest of the flow — Razorpay order creation, the Checkout.js modal, webhook signature
verification, receipt generation — knows or cares that the invoice came from a plan purchase rather than an
admin-created one. There is exactly one checkout code path in this application and exactly one payments ledger;
a plan purchase is simply what feeds an invoice into it, not a second system next to it.

Server-authoritative pricing is structural, not just a convention: the browser only ever sends a `planId` (and
optionally an `offerId`/`couponCode` **hint**) to `purchase_pricing_plan()`. The function independently re-resolves
the plan's current published version, re-validates whichever offer it resolves, and computes the amount actually
charged entirely from live database rows — nothing about the amount, discount, or tax is ever accepted as input
from the client. `src/lib/pricing/offers.ts`'s `computePriceBreakdown()` — used for the order-summary preview on
`/pricing/checkout/[slug]` — is a **preview only**; it is never what decides the amount that reaches Razorpay.

## 8. Security model (RLS, roles, `purchase_pricing_plan()`)

`purchase_pricing_plan(p_plan_id, p_offer_id, p_coupon_code) RETURNS jsonb` is the one and only way a student's own
browser session can turn a plan selection into a real, priced, numbered invoice. It is `SECURITY DEFINER` (runs
with elevated privilege, deliberately — a student's own role cannot `INSERT` into `invoices` directly), which means
every step inside it matters for safety:

1. `auth.uid()` is checked and used as the student — the function can never be called to create an invoice for
   someone else.
2. `search_path` is explicitly pinned to `public` (a standard `SECURITY DEFINER` hardening step — an unpinned
   search path is a privilege-escalation vector via a malicious same-named function/table in another schema).
3. Execute privilege is revoked from `PUBLIC` and `anon`, and granted only to `authenticated` — a signed-out
   visitor cannot call it at all (the checkout confirm page is also behind middleware auth, §7, as defense in
   depth).
4. Every write inside the function (`invoices`, `invoice_line_items`, `pricing_purchases`, and the offer's
   `redemption_count`) is scoped to data the function itself just validated — never a blind pass-through of
   caller-supplied values.
5. Duplicate-checkout prevention: before creating a new invoice, the function looks for an existing **unpaid**
   invoice already tagged to the same student and plan (via the new `invoices.pricing_plan_id` column) and reuses
   it instead of creating a second one — the same "return the existing unpaid resource instead of creating a new
   one" idempotency pattern already established by the `payment_attempts_one_active_per_invoice` partial unique
   index in Milestone 8, applied one level up.
6. Invoice numbering reuses the exact same atomic, gap-free sequence-table pattern as the admin-only
   `next_invoice_number()` (`insert ... on conflict (prefix) do update ... returning`), duplicated inline here
   rather than loosening that function's own `current_admin_role() is not null` guard — one shared numbering
   sequence, two entry points, neither weakened.
7. An offer's redemption-count increment is guarded so that if two simultaneous checkouts would both push it past
   `max_redemptions`, the transaction that loses the race is rolled back with a clear error rather than silently
   over-redeeming the offer.

Least-privilege beyond this one function: `pricing_purchases` has **no** `INSERT`/`UPDATE`/`DELETE` policy for any
role, including admins — the only way a row is ever written is through `purchase_pricing_plan()`. Reads are scoped
per role: a student sees only their own purchases; `admin`/`finance`/`analyst` see all; `counsellor` sees purchases
for students in their own scope, matching the pattern already used elsewhere in this admin system.

## 9. Taxes

No GST/tax rate is supplied by this migration, and none is ever invented. A plan version's `tax_status` field is
**descriptive only** — it records whether that plan's stated price is meant to be tax-exclusive (tax added at
checkout) or tax-inclusive (tax already folded in), for accountant/legal review, once real GST configuration
exists. The actual rate always comes from the existing Milestone 8 billing settings
(`getBillingSettingsForDocument()`), exactly as it already does for every other invoice in this system — this
migration adds no second tax configuration surface.

`purchase_pricing_plan()` always computes any configured tax as an **addition on top of** `amount_minor_units`,
matching how every other invoice in this system already computes tax (`src/lib/payments/invoice-math.ts`). A true
tax-inclusive back-calculation (deriving a pre-tax base from a tax-inclusive sticker price) is deliberately not
implemented — it would require a policy decision (rounding rules, which is authoritative) this project has not been
asked to make. Until GST is genuinely configured, no invoice shows a tax line at all, and the public pricing page
shows no tax wording (`taxStatus === "unconfigured"` renders nothing) — see
`src/components/sections/pricing/PublicPricingPlanCard.tsx`.

## 10. Student dashboard

`/dashboard`'s "My plans" card (`listMyPurchases()`, `src/lib/supabase/pricing/my-purchases.ts`) shows every plan a
signed-in student has purchased: plan name, purchase date, amount paid, any discount applied, and a link to the
underlying invoice at `/payments/[invoiceId]` (which itself links to the PDF and any receipt). Gated purely by
`pricing_purchases`'s own `auth.uid() = student_user_id` RLS policy — a student can only ever see their own
purchases, never another student's.

## 11. Analytics

Two deliberately separate sources, never merged into one event log:

- **Funnel signals** (`pricing_analytics_events`) — `plan_view`, `plan_selected`, `checkout_started` only. No
  amount, no discount detail, no payment data of any kind. Anyone (including a signed-out visitor) can write these;
  `student_user_id`/`occurred_at` are always stamped server-side by a trigger, so this table can never be used to
  forge either. `recordPricingAnalyticsEvent()` is fire-and-forget-safe — any failure is logged and swallowed, so
  an analytics hiccup can never block a student from viewing pricing or completing checkout.
- **Revenue, successful-purchase, and failed-payment figures** (`getPricingAnalyticsSummary()`,
  `src/lib/supabase/admin/pricing-analytics.ts`, shown at `/admin/pricing/analytics`) are computed **live** from
  `pricing_purchases` joined against the real `invoices` table's status — never from a second, independently
  tracked "did this purchase succeed" event. A second event log for money would risk drifting from what actually
  happened in Razorpay; deriving it live from the one authoritative ledger structurally cannot drift.

`/pricing` records one `plan_view` per currently-effective plan shown; `/pricing/checkout/[slug]` records
`plan_selected` on load and `confirmPricingPurchaseAction()` records `checkout_started` before calling
`purchase_pricing_plan()`.

## 12. Testing and manual verification

**Automated (Vitest, `src/lib/pricing/**/*.test.ts`):**

- `plan-versions.test.ts` — effective-window logic (draft/archived never effective; future `effective_from` not
  yet effective; past `effective_until` no longer effective), the neutral-fallback gate, and the one-time payment
  label.
- `offers.test.ts` — offer shape validation (percentage bounds, fixed-amount positivity, currency match, date
  ordering, redemption-limit positivity, coupon-code format), against-plan validation (fixed discount can't exceed
  plan price, currency must match), redeemability (inactive/draft/future/expired all rejected), exhaustion,
  discount computation (including clamping), full price-breakdown math (discount before tax, tax on the
  post-discount base, final price never negative even under a deliberately-oversized discount), and a fixture
  regression pinning all nine official plan prices in integer minor units against the actual seed file.
- `src/lib/admin/money.test.ts` — `formatMoneyForPdf`'s locale (`en-IN`) produces the exact expected Indian digit
  grouping for the two lakh-scale plan prices (₹1,30,000 and ₹1,40,000), stays ASCII-only for every official plan
  amount, and is unchanged for every amount under one lakh (the locale switch's own regression guard).
- `src/lib/payments/pdf.test.ts` — a full invoice PDF generates successfully at the largest official plan price
  (₹1,40,000) without the historical "WinAnsi cannot encode ₹" crash.

**Not unit-testable, and why:** `purchase_pricing_plan()`, every RLS policy, and the `pricing_plan_versions`
immutability trigger are Postgres-side guarantees that cannot run inside Vitest (no live Postgres connection in
this project's test suite — see `vitest.config.mts`'s own docblock for the same convention already established for
Milestone 8's `verify_checkout_payment()`/`apply_webhook_event()`). These are verified manually instead:

1. As a `super_admin`, publish a version for one plan, then attempt to edit that published version directly via
   SQL (`update pricing_plan_versions set amount_minor_units = ... where id = '...'`) — confirm it's rejected by
   the immutability trigger.
2. As a signed-out visitor, confirm `/pricing` loads and shows real prices, and that `/pricing/checkout/[slug]`
   redirects to `/login?next=...`.
3. As a student, complete a full checkout in Razorpay test mode; confirm the invoice, PDF, and dashboard "My
   plans" entry all show the correct amount, and that a second click on the same plan's CTA reuses the same
   unpaid invoice rather than creating a duplicate.
4. Create a percentage offer, publish it, but leave it inactive — confirm the public page and checkout preview
   still show the original price. Activate it — confirm the discounted price now appears, and that the discount
   at checkout matches what `purchase_pricing_plan()` actually charged (check the resulting invoice/purchase row).
5. Set an offer's `max_redemptions` to 1, redeem it once, then attempt a second purchase using the same offer —
   confirm it's rejected.
6. As a `counsellor` or `content_editor` role, confirm `/admin/pricing` is inaccessible (no `pricing:read`
   permission).
7. Confirm `select has_function_privilege('anon', 'purchase_pricing_plan(uuid,uuid,text)', 'execute')` returns
   `false`, and the same query for `authenticated` returns `true`.

## 13. Migration, seed, and rollback

**Install:** run `supabase/migrations/0007_nextwise_pricing_offers.sql` in the Supabase SQL Editor (requires
`0004_admin_system.sql` and `0005_payments_billing.sql` first — see the README's
[Pricing & Offers setup](../README.md#pricing--offers-setup)), then run `supabase/seed/0004_pricing_offers_seed.sql`
to load the nine official plans. The seed is idempotent: `pricing_plans` uses `ON CONFLICT (slug) DO NOTHING`, and
`pricing_plan_versions` uses a `WHERE NOT EXISTS` guard keyed to the plan — running the seed again after an admin
has already customized a plan's price never overwrites their change or creates a duplicate version. No
`pricing_offers` rows are ever created by the seed.

**Rollback:** dropping the five new tables (`pricing_analytics_events`, `pricing_purchases`, `pricing_offers`,
`pricing_plan_versions`, `pricing_plans`, in that order for FK dependencies) and the two additive
`invoices.pricing_plan_id`/`pricing_offer_id` columns removes Milestone 10 entirely; every other milestone
(including Milestone 8's invoices/payments) is untouched, since this migration only ever *adds* to
`invoices` — it never alters an existing column. There is no data migration to reverse for prior invoices, since a
pre-Milestone-10 invoice simply has `pricing_plan_id = null`.

## 14. Known limitations and unresolved decisions

- **Temporary tier names.** "Bachelor/Master Abroad — Tier 1/2/3" are explicitly placeholder names (per the
  original spec) until NextWise finalizes real names. Renaming is a normal admin action (publish a new version
  with the new `public_title`) and does not require a code or migration change.
- **No approved benefit copy yet.** Every plan's `included_services` starts empty; the public page shows the
  neutral fallback (§2) until an admin enters real, approved copy. This is intentional, not a bug — see §2 for why
  nothing here is guessed.
- **No tax rate configured by default.** See §9 — this is deliberate, not a gap to be filled by this migration.
- **No subscriptions or instalments.** See §5 — the schema leaves room for a future, separately reviewed feature,
  but nothing recurring is implemented today.
- **Tax-inclusive back-calculation is not implemented.** `tax_status` can record that a price is meant to be
  tax-inclusive, but no code currently derives a pre-tax base from it — see §9.
- **No coupon-code redemption UI on the public checkout page yet.** An offer can require a coupon code
  (`pricing_offers.coupon_code`), and `purchase_pricing_plan()` accepts one as a hint, but
  `/pricing/checkout/[slug]` currently only offers whichever offer is already active and published for that plan —
  there is no "enter a coupon code" input on that page yet. This does not affect security (the server still
  independently validates whatever offer/coupon combination it's given); it's a UI gap for a future iteration.

> **Update (Milestone 11 — see §15 below):** two of the bullets above are now resolved and are left in place only
> as a historical record of Milestone 10's initial launch state. "Temporary tier names" is resolved —
> `supabase/seed/0005_pricing_inclusions_seed.sql` publishes a version 2 for every Bachelor/Master Abroad plan
> under its official Essential/Plus/Premium name. "No approved benefit copy yet" is resolved for the structured
> inclusions list specifically (`pricing_plan_inclusions`, §15.1) — the free-text `included_services` jsonb column
> itself is untouched and still starts empty for a brand-new plan version, exactly as designed in §2.

---

## 15. Milestone 11 — Inclusions, presentation settings, and the NextWise visual identity

This section documents the second pricing milestone, layered entirely on top of Milestone 10 above without
changing any of its tables, RLS policies, or the `purchase_pricing_plan()` function's signature/return shape.
Migration: `supabase/migrations/0008_pricing_inclusions_and_presentation.sql`. Seed:
`supabase/seed/0005_pricing_inclusions_seed.sql`.

### 15.1 Why a child table, not more jsonb

Milestone 10's `included_services` jsonb array could technically hold structured objects, but the spec's admin
capabilities for this milestone — "add, edit, remove and reorder inclusions" as first-class actions with stable
identifiers, and "mark selected inclusions as highlights" — are naturally row-level operations. A jsonb array
would force every single edit into a read-whole-array/rewrite-whole-array admin code path, with no stable id to
link a reorder control or an edit page to. `pricing_plan_inclusions` is a real child table instead, one row per
included-service line, keyed to `plan_version_id`, with `display_order`/`title`/`explanation`/`category`/
`numeric_allowance`/`unit`/`is_highlight`/`is_active` — exactly the fields the spec lists. `included_services`
itself is untouched and still exists; the public pricing page and admin UI were updated (application code, not
the database) to read the structured list going forward, with `included_services` kept as a legacy free-text
fallback field in the admin form.

### 15.2 Presentation settings vs. inclusions

Ten new nullable columns were added directly to `pricing_plan_versions` (not a child table) for the specific
facts the public page needs to show *prominently*, distinct from the scrollable inclusions list: `session_count`,
`session_duration_note`, `audience_label`, `university_shortlist_limit`, `application_support_limit`,
`sop_review_rounds`, `scholarship_support_note`, `mock_interview_count`, `counsellor_tier`,
`support_duration_note`. These are single scalar facts per version (there is exactly one session count per plan,
never a list of them), so a column is the right shape — a child table would be over-engineering for a
one-to-one fact. All ten were added to `prevent_pricing_version_mutation()`'s frozen-column list: a published
version's session count is exactly as immutable as its price.

A `null` presentation field means "not yet configured by an admin, or genuinely not applicable to this tier" —
never a fabricated number. The comparison table (§15.4) renders a null cell as an em dash via
`formatComparisonCell()` (`src/lib/pricing/plan-versions.ts`). For example, Bachelor Abroad Essential's
`mock_interview_count` is `null` (the spec's copy for that tier never mentions mock interviews at all), while
Bachelor Abroad Plus's is also `null` even though its copy mentions "portfolio or interview preparation where
applicable" — that phrase gives no fixed count, so no number was invented for it; only tiers whose copy states an
actual number (e.g. "up to 3 mock interviews") have this field populated.

### 15.3 Immutability, once more, one layer down

`pricing_plan_inclusions` rows are immutable once their parent `pricing_plan_versions.status` leaves `'draft'` —
enforced twice, matching Milestone 10's own belt-and-suspenders style: the RLS INSERT/UPDATE/DELETE policies
require the parent to still be `'draft'` (this is what actually blocks attaching a new inclusion to an
already-published plan), and a `BEFORE UPDATE` trigger (`prevent_pricing_inclusion_mutation()`) independently
re-checks the same condition for the UPDATE case. A new inclusion for a published plan always means: create a new
draft version (already-existing Milestone 10 admin action), copy inclusions forward into it (a new admin action,
§15.5), edit/add/remove/reorder there, then publish — never an edit to the published version's own inclusions.

### 15.4 The purchase snapshot, extended

`pricing_purchases` gained three additive columns, populated by the `create or replace function
purchase_pricing_plan(...)` in `0008_pricing_inclusions_and_presentation.sql` (identical signature and return
shape to Milestone 10's — `src/lib/supabase/pricing/checkout.ts` needed zero changes):

- `session_count_at_purchase` — copied from the live version's `session_count`.
- `inclusions_at_purchase` — a jsonb array of `{title, explanation, category, numericAllowance, unit,
  isHighlight}`, built inside the function from the live version's *active* `pricing_plan_inclusions` rows,
  ordered by `display_order`, via a `jsonb_agg(... order by i.display_order) filter (where i.is_active)` query —
  never trusted from the browser, exactly like every other figure this function computes.
- `presentation_limits_at_purchase` — a jsonb object of the nine comparison/presentation fields (everything from
  §15.2 except `session_count`, which has its own column).

Nothing here is ever recomputed after insert — same immutable, append-only discipline as
`plan_name_at_purchase`/`included_services_at_purchase` already had.

### 15.5 Admin UI additions

`/admin/pricing/[id]/versions/[versionId]` (only while the version is `draft`) now also renders:

- A "Presentation & comparison-table settings" fieldset on the existing version form (session count, audience,
  and all nine comparison fields) — `src/components/admin/pricing/PricingPlanVersionForm.tsx`.
- An inclusions manager (`PricingInclusionsManager`) listing the version's inclusions with up/down reorder
  buttons, an Edit link, and a two-click-confirm Delete button, plus an "Add inclusion" link to a small
  create form. New routes: `/admin/pricing/[id]/versions/[versionId]/inclusions/new` and
  `/admin/pricing/[id]/versions/[versionId]/inclusions/[inclusionId]`. New data-access functions in
  `src/lib/supabase/admin/pricing.ts`: `listPricingInclusions`, `getPricingInclusionById`,
  `createPricingInclusion`, `updatePricingInclusion`, `deletePricingInclusion`, `reorderPricingInclusions` — every
  one permission-gated on `pricing:write` (same as every other pricing mutation) and independently blocked by
  RLS/the trigger once the parent version is no longer a draft.
- The published/archived read-only version view now also displays every presentation field and the structured
  inclusions list (previously it only showed the legacy `included_services` list).

### 15.6 Public `/pricing` page redesign

Same route (`src/app/(site)/pricing/page.tsx`), reorganized (not rebuilt) into three accessible tabs — School
Guidance (the three school/class categories grouped in the UI layer only; `pricing_plans.category` in the
database is unchanged), Bachelor Abroad, Master Abroad — via a new WAI-ARIA tabs component
(`src/components/sections/pricing/PricingTabs.tsx`: roving tabindex, Left/Right/Home/End key support, one
`tabpanel` at a time). Each plan card (`PublicPricingPlanCard.tsx`) now shows the session count, audience label,
and key limits in a small stats block near the top, a concise initial list of inclusions (highlights first, up to
five), and — when there are more — an accessible "View all services" disclosure
(`ViewAllServicesDialog.tsx`, built on the native `<dialog>` element for a real top-layer modal with built-in
focus trapping and Escape-to-close, plus an explicit focus-return to the triggering button). The Bachelor/Master
Abroad tabs also render `PricingComparisonTable.tsx` — a real `<table>` with `<caption>` and `<th scope>` (never
a div-grid) covering the eight fields the spec lists (sessions, university-shortlist limit, application-support
limit, SOP review rounds, scholarship support, mock interviews, dedicated/senior counsellor, support duration).
The page also gained `loading.tsx` (a skeleton, Next.js App Router route-level loading state) and `error.tsx` (a
plain-English error state with a retry button — never a raw error message), and a "Terms that apply to every
package" section reproducing the spec's six mandatory terms bullets verbatim in substance.

### 15.7 The NextWise visual identity

`src/app/globals.css` gained a fully-commented `--brand-*` token block (REAL values sampled from
`public/brand/nextwise-icon.png`/documented in `src/config/site.ts`: `--brand-primary`,
`--brand-primary-strong`, `--brand-ink`; every other family — violet, signal/lime, coral, paper, muted, border,
success/warning/info and their pale variants — is explicitly labeled PROVISIONAL, since no approved hex for any
of those families existed anywhere in this repository before this milestone). Every existing `--color-*` token is
now defined as `var(--brand-*)`, so the whole site re-themes through this one file — **except** `--color-accent`,
deliberately left on its own original hex: `Button`'s `secondary` variant renders `bg-accent text-white`, and
pointing `--color-accent` at the vivid lime would drop contrast to roughly 1.5:1 (a real accessibility
regression). New pricing-specific UI that wants the lime "signal" treatment reaches `--brand-signal`/
`--brand-signal-strong` directly via an arbitrary-value class (e.g. `text-[var(--brand-signal-strong)]`), never
through `--color-accent`. `:focus-visible`'s outline is repointed at `--brand-focus` (an alias of
`--brand-primary`, 4.99:1 against `--brand-paper`, passing the WCAG 2.1 3:1 non-text/UI-component minimum).
`src/lib/payments/pdf.ts` picked up a light brand touch — `hexToPdfRgb()` converts three of the same hex values
into pdf-lib's 0-1 `rgb()` scale for a thin accent rule under the document header, a pale-primary tint on the
line-items table header, and the status label's color (paid → success green, overdue/void → coral, everything
else → ink) — the status is always also spelled out as text (e.g. "PAID"), so color is never the only way the
information is conveyed, and the document remains fully legible printed in plain black-and-white.
`sanitizeForPdf()` and `loadLogoBytes()`/`drawLogo()`'s asset handling are untouched.

### 15.8 Testing (Milestone 11 additions)

**Automated (Vitest):**

- `src/lib/pricing/plan-versions.test.ts` — extended with `sortInclusionsByDisplayOrder`,
  `activeInclusions`/`visibleInclusionsInOrder`, `highlightedInclusions`, `buildComparisonRow`, and
  `formatComparisonCell` (null → em dash, never a fabricated value).
- `src/lib/pricing/official-catalog.test.ts` — a fixture regression covering all nine official plan prices in
  integer minor units, their major-unit (rupee) display strings via `formatMoney`, their exact session
  allowances, category groupings, the audience label (School Counselling only), and the counsellor-tier/
  mock-interview-count facts for every Bachelor/Master Abroad tier.
- `src/config/brand-tokens.test.ts` — asserts every official `--brand-*` token name is declared in
  `globals.css`, that every non-REAL token is labeled PROVISIONAL, that `:focus-visible` is repointed at
  `--brand-focus`, and that `--color-accent` is never aliased to a `--brand-*` token.
- `src/config/site.test.ts`'s existing rebrand guard was extended to also cover the newly-touched pricing
  surfaces (`PublicPricingPlanCard.tsx`, `PricingComparisonTable.tsx`, `ViewAllServicesDialog.tsx`,
  `PricingPreview.tsx`, the checkout page).

**Not unit-testable, and why (same reasoning as §12):** the new `pricing_plan_inclusions` RLS policies, its
immutability trigger, and the extended `prevent_pricing_version_mutation()`/`purchase_pricing_plan()` are
Postgres-side guarantees with no live Postgres connection in this project's test suite. Verified manually
instead — see PART 7 of `0008_pricing_inclusions_and_presentation.sql` for the exact SQL to run:

1. As a `super_admin`, attempt to `UPDATE` an inclusion whose parent version is `published` — confirm it's
   rejected by the immutability trigger.
2. As an `anon` client, confirm `select count(*) from pricing_plan_inclusions` joined to a `draft` version
   returns zero rows.
3. As a `super_admin`, attempt to `UPDATE` a published version's `session_count` — confirm it's rejected by the
   extended `prevent_pricing_version_mutation()`.
4. After running `0005_pricing_inclusions_seed.sql`, run the verification query at the bottom of that file and
   confirm all nine plans show the official Essential/Plus/Premium names (where applicable), the correct
   `session_count`, and a non-zero `inclusion_count`.
5. Complete a real checkout in Razorpay test mode for a Bachelor/Master Abroad plan; confirm the resulting
   `pricing_purchases` row's `inclusions_at_purchase` and `presentation_limits_at_purchase` match what the plan
   showed on `/pricing` at the moment of purchase.
