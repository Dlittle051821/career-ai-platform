# CC-18: GST integrity and QA preflight preparation (NW-F01)

Date: 2026-11-07 (Europe/Berlin). Prepared by Claude. Local implementation only.

Nothing remote was done:
- No SQL was run against QA or production (the preflight was rehearsed only on a disposable local PostgreSQL).
- No Supabase, Vercel or Razorpay change.
- No commit, push, merge or deploy.
- Real payments and real-student AI stay off.

## A. Recovery and source state

| Check | Result |
|---|---|
| Worktree | `C:\ClaudeBuilds\CC15-INSTALL-TARGET`, branch `cc15-security-install`, HEAD `4f69c33be218e59433713ebe1fef22c857d25a67`, index unchanged (1,464 entries, nothing staged) |
| Cumulative files | All 39 CC-15/CC-16 files on Windows equal the verified tree (line-ending-normalized) before CC-18 started |
| Rollback chain | CC-15 installer backup (in the extracted CC-15 package folder) and `C:\ClaudeBuilds\Milestones\CC17-QA-READINESS\CC16-ROLLBACK-KIT.zip` both left untouched. CC-18 adds its own kit (section D) |
| Environment | No shell on Windows. Development and every test below ran on Linux, on a copy verified identical to Windows. Files were synchronized through the file bridge with hashes checked before and after |

## B. Exact GST root cause

1. **Live `purchase_pricing_plan()` (0007/0008).** It treated GST as configured only when `gst_registered` AND a non-blank GSTIN were present. `gst_registered = true` with a missing GSTIN (or a missing rate) was therefore silently treated as **zero tax**. When fully configured, it added tax **on top** of every plan, so ₹1,999 became ₹2,358.82.
2. **NW01 proposal (before CC-18).** It fixed tax-inclusive arithmetic but kept the same silent-zero-tax rule. It also allowed Verified to be `unconfigured` or `tax_exclusive` while registered, and allowed offers on Verified.
3. **CC-15 `05` and the app guard.** They checked the amount, but neither read the authoritative `billing_settings` (admin-only under RLS). So a Verified invoice with tax 0 and total 199,900 passed even when the business was GST-registered with incomplete configuration.
4. **Timing.** The app created the Razorpay order **before** any database-side pricing check. The `05` policy only ran at the attempt insert, after the order existed.

## C. Corrected logic

**Locked rule:** Nextwise Verified = **199,900 paise INR, GST included**.

**Database (authoritative, `05` CC-18 version):**
- `nw_billing_tax_config_problem()` (definer; nobody may execute it directly):
  - No `billing_settings` row → `billing_settings_missing`.
  - Not registered → OK; a GSTIN without registration → `gstin_without_registration`.
  - Registered → GSTIN must match `^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$` (`gstin_invalid`), and the rate must be 1–2,800 bps (`gst_rate_invalid`).
  - Never inferred, never zero.
- `nw_invoice_charge_problem(invoice, amount, currency, student)` (definer, VOLATILE, locks the invoice `FOR SHARE` against concurrent edits) checks:
  - own invoice;
  - payable status;
  - currency;
  - valid tax configuration;
  - amount = total − captured, and > 0;
  - line totals and line tax = invoice totals.
- For **Verified** (identified by `invoices.pricing_plan_id` slug, or the purchase's plan slug or frozen name), it also requires:
  - INR;
  - subtotal = total = charge = 199,900;
  - discount 0;
  - nothing captured yet;
  - tax = `round(199900·r/(10000+r))` (18% → **30,493**, net **169,407**; 5% → 9,519), or 0 when unregistered;
  - every taxed line at rate r;
  - the purchase snapshot consistent.
- **Student attempt RLS policy:** unchanged shape. It still requires `created_by = auth.uid()`, a `created` Razorpay attempt with an order ID and the unique `(provider, provider_order_id)`, and now delegates to the check above.
- **`check_invoice_charge(invoice, amount, currency)`:** new; granted to `authenticated` only. It returns null or a reason code, and only for the caller's own invoice (any other invoice → `invoice_not_found`).

**Database (`NW01` CC-18 version, `purchase_pricing_plan`):**
- One transaction; requires CC-18 `05`; search_path pinned.
- Fails closed on an invalid or missing tax configuration (shared check).
- Verified:
  - no offers or coupons;
  - published version must be 199,900 INR;
  - never `tax_exclusive`;
  - must be `tax_inclusive` while registered;
  - total asserted = 199,900.
- An existing unpaid Verified invoice is reused only if it still passes the charge check; otherwise the purchase stops with "needs review by support".
- Purchase, invoice, line and snapshot are written in the same transaction, as before.
- Other plans keep their behaviour: tax-exclusive adds GST; inclusive backs it out.

**Application (`checkout.ts`):**
- After the CC-15 TypeScript guard, the server calls `check_invoice_charge` with the student's own session **before creating or reusing any Razorpay order**.
- Any error, a missing RPC, or a non-null reason blocks checkout with "You have not been charged".
- Webhook amount and currency reconciliation (`06`) is unchanged.

**Security review of the changes:**
- **Definer functions:** all pin search_path; helpers are not executable by `anon`, `authenticated` or `service_role`.
- **Inputs and identity:** the amount comes from the server's due computation; tax comes only from `billing_settings` (no caller input); there is no cross-student access (ownership is checked inside the definer).
- **Rounding:** PostgreSQL `round` (half away from zero) matches the JS `Math.round` used by the guard for positive values. Both give 30,493.
- **Errors and rollback:** error messages are student-safe reason codes, never raw database errors; all three migrations are single transactions.
- **Admin and finance flows:** admin-issued invoices with their own line rates stay payable (tested); admin attempt creation is unchanged.

## D. Files changed in CC-18

| File | Change |
|---|---|
| `supabase/migrations-proposed/nw-f01-s3/05_payment_attempt_integrity.sql` | GST and Verified validation helpers, `check_invoice_charge`, CC-18 header and postconditions |
| `supabase/migrations-proposed/NW01_fix_purchase_pricing_plan_tax_handling.sql` | Fail-closed configuration, Verified locks, transaction, preconditions and postconditions (tracked file) |
| `src/lib/supabase/payments/checkout.ts` | Database pre-order check before gateway order or reuse |
| `src/types/database.ts` | `check_invoice_charge` RPC type |
| `scripts/security/nw-f01-s3.offline.test.mjs` | Loads NW01; G1–G12 matrix and compatibility/grant tests; CC-15 fixture now has line items |
| `scripts/security/nw-f01-s4.migration-rehearsal.test.mjs` | NW01 rehearsal (dependency guard, forced failure, rerun) |
| `src/lib/payments/checkout-charge-wiring.test.ts` | Database-check wiring tests |
| `docs/stabilization/nw-f01-s3/CC-18-REVIEW.md` | New (this document) |
| `docs/stabilization/nw-f01-s3/qa/CC18-QA-PREFLIGHT.sql` | New: read-only preflight |
| `docs/stabilization/nw-f01-s3/qa/Run-QaPreflight.ps1` | New: guarded preflight runner |

There are no dependency changes. Exact hashes are in `CC18-MANIFEST.json` (milestone folder). The rollback kit `CC18-ROLLBACK-KIT.zip` restores the exact pre-CC-18 bytes.

## E. G1–G12 acceptance results (offline PGlite: database level; Vitest: application level)

| ID | Scenario | Result |
|---|---|---|
| G1 | Not registered | **PASS**: invoice 199,900, tax 0; check OK; attempt and capture at 199,900; paid |
| G2 | Registered, 18%, `tax_inclusive` | **PASS**: total 199,900, tax 30,493, net 169,407; line rate 1,800; purchase snapshot consistent; paid at 199,900 |
| G2b | Registered, 5% | **PASS**: tax 9,519 inside 199,900 |
| G3 | Old tax-on-top invoice (235,882) | **PASS**: check `verified_price_mismatch`; attempt refused; purchase refuses reuse ("needs review"); not paid |
| G4 | Registered with GSTIN missing or malformed, rate missing, 0 or >28% | **PASS**: no invoice created (`gstin_invalid` / `gst_rate_invalid`) |
| G4b | Billing settings missing; config breaks after issue | **PASS**: purchase refused; existing invoice becomes unpayable; no attempt |
| G5 | Verified `tax_exclusive`, or not inclusive while registered | **PASS**: purchase refused |
| G6 | Offer, coupon, wrong price or currency on Verified | **PASS**: purchase refused |
| G7 | Wrong attempt amount, wrong currency, reused order ID | **PASS**: refused (RLS / unique index) |
| G8 | Captured ₹10 | **PASS**: event `failed`; no transaction; not paid |
| G9 | Captured in USD | **PASS**: same as G8 |
| G10 | Duplicate capture delivery | **PASS**: one transaction; stays paid |
| G11 | Stale open order or DB check failure | **PASS** (Vitest): order not reused; no gateway call |
| G12 | Partial charge, inconsistent breakdown, wrong tax share | **PASS**: refused (`amount_not_due`, `invoice_breakdown_inconsistent`, `verified_tax_mismatch`) |
| — | Other plans and admin invoices | **PASS**: tax-exclusive Essential adds GST; admin 5% invoice payable |
| — | Plan identification failure | **PASS** (Vitest guard: `missing_configuration`). The database falls back to slug or frozen-name detection |
| — | Grants | **PASS**: helpers not executable by `anon`, `authenticated` or `service_role`; `check_invoice_charge` not by `anon`; another student's invoice → `invoice_not_found` |
| — | App: DB check reasons (GSTIN, rate, settings, tax mismatch, RPC missing) with total exactly 199,900 | **PASS**: blocked, no order, no attempt |

"No entitlement" follows from "not paid": entitlements require `invoices.status = 'paid'` (see `src/lib/products/entitlements.ts`).

## F. Tests and build (Linux only; Windows script provided)

| Check | Result |
|---|---|
| Vitest full | 158 files, **2,736 passed** |
| TypeScript `--incremental false` | exit 0 |
| ESLint | 0 errors (18 existing warnings) |
| SQL artifact drift | OK |
| Offline SQL security suite (PGlite) | **79/79** |
| Migration rehearsal (PostgreSQL 16.15) | **12/12**, including NW01: refuses without 05, forced-failure rollback, idempotent rerun |
| Concurrency | 10/10 in each of 5 runs; 0 deadlocks |
| QA preflight SQL, rehearsed on a local pre-migration database | Ran clean; expected results confirmed |
| `next build` | exit 0; 97/97 pages (placeholder public variables only) |
| `git diff --check` | clean |

**Windows:** run `Verify-CC18.ps1` (milestone folder). It checks branch, HEAD and every file hash, then runs the same commands with `npm.cmd`. It never installs, reapplies or overwrites anything.

## G. QA preflight (prepared; NOT authorized to run)

Files:
- `docs/stabilization/nw-f01-s3/qa/CC18-QA-PREFLIGHT.sql`: one `READ ONLY` transaction, rolled back.
- `docs/stabilization/nw-f01-s3/qa/Run-QaPreflight.ps1`. It:
  - requires `psql`;
  - refuses unless host/user contain `ynwzijulzksmrcwdhudv`, and refuses anything containing `bwlkxunujngksibfzzfv`;
  - requires port 5432 (a single session);
  - asks you to type the project ref;
  - reads the password without echo and clears it afterwards;
  - never uses the linked Supabase CLI.

| # | Check | Expected |
|---|---|---|
| 1 | QA identity | Runner host/user guard + typed ref; SQL shows `postgres`/`postgres`, `read_only = on` |
| 2 | Backup | **Dashboard, not SQL**: Database → Backups (or PITR). Record the backup ID and time; confirm the restore option is available before Approval 2 |
| 3 | Schema/RPC compatibility | All `present_*` = t (NW07, NW09, v1 RPCs, billing, `invoices.pricing_plan_id`, webhooks, refunds, purchase, signature/stamp); all `absent_*` = t (no NW09.2 consents, no CC-18 charge check, no 05 index yet) |
| 4 | `auth.uid()` | Definition reads `request.jwt.claim.sub` first; `bound_uid` = the test UUID. **If not, F1 is BLOCKED** (the wrapper would fail closed) |
| 5 | Reserved AI runs | `reserved_runs = 0` (otherwise quiesce) |
| 6–8 | Duplicate payment-order / signature / stamp IDs | All 0. **Counts only**; no identifiers are printed |
| 9 | Definer ownership and extensions | `non_postgres_definers = 0`; pgcrypto and pg_trgm present (note schema, e.g. `extensions`) |
| 10 | Private buckets | `signed-agreements` and `stamped-agreements` with `public = f`, or 0 rows (create privately later) |
| 11 | Billing tax configuration | Booleans only (GSTIN never printed). Assessment must not read "INCOMPLETE"; if it does, fix it in the admin UI before checkout tests |
| 12 | Verified catalogue | Active; latest published version 199,900 INR; `tax_inclusive` if GST registered |
| 13 | Unpaid Verified invoices ≠ 199,900 | 0 (otherwise finance reviews or voids them) |

**Sensitive output:** none of the queries return student data, payment or provider IDs, or the GSTIN. The full `auth.uid()` definition and extension schemas are platform metadata.

## H. Migration order and recovery (QA only; for separate approval)

Order:
1. Backup and preflight.
2. `NW09_2_ATOMIC_01-03.sql`.
3. `05` (CC-18).
4. `06`.
5. `NW01` (CC-18).
6. Verified catalogue tax configuration.
7. Private buckets.
8. QA integration tests with fictional users.
9. Isolated staging deployment.

**Sequence changes:**
- **`NW01` must follow `05`**: it calls the 05 helpers and refuses otherwise.
- `06` requires `05`.
- Step 6 (publishing a `tax_inclusive` Verified version) is needed before Verified purchases if GST is registered, and is harmless if not.
- Buckets must exist before the signature/stamp integration tests.

| Step | Role | Preconditions | Objects affected | Transaction | Postconditions | On failure | Recovery | Repeatable |
|---|---|---|---|---|---|---|---|---|
| NW09.2 artifact | `postgres` (session pooler) | Preflight green; approval setting set | AI/consent tables, RPCs, grants, capture guard, review RPC, definer search paths | One | Built-in DO checks | Auto rollback | Forward fix; `04` pause; backup restore last | Yes (rehearsed) |
| 05 | `postgres` | No duplicate order IDs; `billing_settings` and `invoices.pricing_plan_id` present | Unique index, 5 functions, student attempt policy | One | Index, policy and grants verified | Auto rollback | Re-create the 0005 policy; drop the new functions/index | Yes |
| 06 | `postgres` | 05 applied | `apply_webhook_event` | One | Reconciliation marker; anon execute kept | Auto rollback | Re-create the 0016 function | Yes |
| NW01 | `postgres` | 05 (CC-18) applied; pricing approval | `purchase_pricing_plan` | One | GST marker; authenticated execute | Auto rollback | Re-create the 0008 function | Yes |
| Verified version | Admin UI (finance/admin) | NW01 applied | New published `tax_inclusive` version 199,900 INR | App | P12 shows `tax_inclusive` | — | Publish the previous terms as a new version | Yes |
| Buckets | Dashboard | — | 2 private buckets | — | P10 rows `public = f` | — | Delete empty buckets | Yes |

Data preservation: none of these steps delete or rewrite existing rows. All rehearsals compared data fingerprints before and after.

## I. Remaining blockers

| Priority | Item |
|---|---|
| **P0** | Human independent security sign-off (cumulative, now including CC-18 GST logic) |
| **P0** | Approval and execution of QA preflight steps 1–5, then migrations (H), then QA tests G1–G12 in Razorpay test mode |
| **P0** | Business confirmation of QA billing configuration (GST registration status, GSTIN, rate) and Verified `tax_inclusive` |
| **P0** | Staging isolation (CC-16/CC-17 checklist) before any push |
| **P0** | Windows run of `Verify-CC18.ps1` |
| P1 | Private buckets; service-role residuals; privacy and retention; paid-model ceilings; finance runbook for `failed` capture events and "needs review" Verified invoices |
| P2 | Server-created payment attempts (N4); service-path audit marker; OpenAI response verification; F5, F9, F10 |

**BLOCKED pending QA evidence:** the `auth.uid()` binding (F1) and the Supabase grant posture can only be confirmed by preflight step 4 and the QA tests.

## J. Git

- Branch `cc15-security-install`; HEAD `4f69c33` (unchanged); nothing staged; no conflicts.
- Working tree: 16 modified tracked files (CC-15's 15, plus `NW01_fix_purchase_pricing_plan_tax_handling.sql`) and 27 untracked (24 earlier, plus CC-18 review, preflight SQL and runner).
- `supabase/.temp/cli-latest` untouched.

## K. Approvals required before any remote operation

1. Run the QA preflight (steps 1–5, read-only) with `Run-QaPreflight.ps1`.
2. Take the QA backup (dashboard).
3. Apply the NW09.2 artifact, 05, 06 to QA.
4. Apply NW01 to QA and publish a Verified `tax_inclusive` version; confirm the QA billing configuration.
5. Create the private buckets in QA.
6. Run QA integration and G1–G12 tests in Razorpay test mode with fictional users.
7. Read and change Vercel settings for staging isolation; any push or deploy.
8. Human security sign-off before any production step.

## L. Smallest next action (CC-19)

Run `Verify-CC18.ps1` on Windows, then approve **preflight steps 1–5 only**. Bring back the generated `qa-preflight-<timestamp>.txt`. CC-19 interprets it and prepares the exact Approval-3 session for the NW09.2 artifact, 05 and 06.
