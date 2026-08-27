# Milestone 8 — Security Correction Patch — Install Guide

This is a **small corrective patch** on top of the Milestone 8 (Payments, Invoicing and Receipts) delivery — it is
not a full Milestone 8 reinstall. It contains only the files touched by this correction. Apply it on top of an
existing Milestone 8 install (i.e. after `careerpath-ai-m8-complete.zip` has already been extracted and its
migration applied).

## 1. What this patch fixes

A confirmed privilege-escalation issue in `public.recompute_invoice_status(uuid)` inside
`supabase/migrations/0005_payments_billing.sql`, plus two smaller `.env.example` correctness issues. Full
before/after detail is in `docs/payments-billing-guide.md` §24 ("Security correction: function execution
privileges") and in the extensive comment block directly above the function in the migration file itself — this
section is a summary only.

**The bug.** `recompute_invoice_status(uuid)` was `SECURITY DEFINER` with no explicit execution grants. PostgreSQL
grants `EXECUTE` to `PUBLIC` by default on a new function, so any authenticated user — including a student with
no relationship to the target invoice — could call it directly via `supabase.rpc("recompute_invoice_status", {
p_invoice_id: "<any invoice id>" })`. Because the function was `SECURITY DEFINER`, its internal `SELECT`/`UPDATE`
against `public.invoices` ran with the function owner's privileges, bypassing `invoices`' row-level security
entirely — an RLS bypass reachable by any signed-in user, not just admins.

**The fix.**

1. `recompute_invoice_status(uuid)` is now `SECURITY INVOKER` — it runs with the *calling* role's own privileges,
   so its internal reads/writes are fully subject to normal RLS. A non-owning caller now gets a clear exception
   instead of silently reading or "updating" a row they have no access to.
2. All four functions this migration defines (`next_invoice_number`, `recompute_invoice_status`,
   `verify_checkout_payment`, `apply_webhook_event`) now have `PUBLIC`'s default `EXECUTE` grant explicitly
   revoked, then re-granted only to the one role each function's real caller actually runs as:
   `authenticated` for the first three, and `anon` (not `authenticated`) for `apply_webhook_event`, since the
   Razorpay webhook route (`src/app/api/webhooks/razorpay/route.ts`) carries no Supabase session.
3. A new "PART 11 — Security verification queries" section was added to the migration file with copy-pasteable
   `has_function_privilege()` and `pg_proc.prosecdef` queries so you can confirm the grants and security modes
   landed correctly after applying this patch.
4. `.env.example` had two bugs unrelated to the above, also fixed here: duplicated
   `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` lines (one pair blank, one pair containing
   the placeholder text `your_actual_project_url`/`your_actual_publishable_key`) are now a single clean pair; and
   `NEXT_PUBLIC_APP_URL` now defaults to `http://localhost:3000` (a correct value for local development as-is)
   instead of being left blank. `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET`/`RAZORPAY_WEBHOOK_SECRET` remain
   intentionally blank placeholders — never fabricate a value for a secret.

**Why the rest of the system is unaffected.** The other three functions were already `SECURITY DEFINER` with an
internal authorization or cryptographic check of their own (an admin/ownership check for
`verify_checkout_payment`, an independent HMAC signature re-derivation for `verify_checkout_payment` and
`apply_webhook_event`, an admin-role check for `next_invoice_number`) — see the "PART 9.5 — SECURITY DEFINER
audit summary" comment block newly added to the migration file, which records this review explicitly. Nothing
about the checkout flow, the webhook flow, or invoice numbering changes behavior for a legitimate caller; the
checkout/webhook flows' internal calls to `recompute_invoice_status()` continue to work because a
`SECURITY INVOKER` function called from inside a `SECURITY DEFINER` function inherits the outer function's
already-elevated role for that call (and a function's owner always retains implicit `EXECUTE` on functions it
owns). Direct admin RPC calls to `recompute_invoice_status()` (from `recordOfflinePayment` and
`reconcilePaymentAttempt` in `src/lib/supabase/admin/`) also continue to work because those actions already
require `super_admin`/`admin`/`finance` via `requireAdminPermission("invoices:write")`, and those are exactly the
roles the existing `invoices` `UPDATE` RLS policy already allows.

## 2. Files in this patch

```
supabase/migrations/0005_payments_billing.sql   (modified — the fix itself)
.env.example                                    (modified — duplicate lines removed, APP_URL defaulted)
docs/payments-billing-guide.md                  (modified — new §24, updated §4/§15/§16/§19/§23)
src/lib/payments/migration-security.test.ts     (new — static regression guard, see §5 below)
```

No other Milestone 8 file changed. Nothing from Milestones 1–7 is touched by this patch.

## 3. How to apply

1. Extract this ZIP's contents into your project root, overwriting the four files listed above (paths inside
   this ZIP are already relative to your project root — same convention as the original M8 delivery).
2. **Re-run the migration.** `0005_payments_billing.sql` is idempotent (every statement uses
   `if not exists`/`or replace`/`drop policy if exists` before `create policy`, and the `revoke`/`grant`
   statements in the new PART 10 are safe to re-run any number of times) — open the Supabase SQL Editor, paste
   the **entire, now-corrected** file contents, and run it again. You do not need to drop or recreate anything;
   this re-applies cleanly over your existing Milestone 8 schema and simply changes the function definition and
   its privileges.
3. No `.env.local` change is required for the fix itself — only edit `.env.local` if you want to adopt the
   `.env.example` cleanup (e.g. copying the new `NEXT_PUBLIC_APP_URL=http://localhost:3000` default). Never copy
   real secrets into a committed file.
4. Run `npm install` only if you don't already have `src/lib/payments/migration-security.test.ts` picked up —
   no new dependency was added by this patch, so this step is optional unless your `node_modules` is stale for
   another reason.

**Do not skip step 2.** The application code (`src/lib/supabase/admin/invoices.ts`,
`src/lib/supabase/admin/payment-attempts.ts`, etc.) was not changed by this patch and did not need to be — the
vulnerability was entirely in the database function's security mode and grants, so the fix is entirely in the
migration file and only takes effect once you re-run it against your database.

## 4. Verifying the fix

After re-running the migration, run the queries in the migration file's own "PART 11 — Security verification
queries" section (also reproduced in `docs/payments-billing-guide.md` §24) in the Supabase SQL Editor:

- `has_function_privilege('authenticated', 'public.recompute_invoice_status(uuid)', 'execute')` → expect `true`
- `has_function_privilege('anon', 'public.recompute_invoice_status(uuid)', 'execute')` → expect `false`
- `has_function_privilege('public', 'public.recompute_invoice_status(uuid)', 'execute')` → expect `false`
- `has_function_privilege('authenticated', 'public.apply_webhook_event(text,text)', 'execute')` → expect `false`
- `has_function_privilege('anon', 'public.apply_webhook_event(text,text)', 'execute')` → expect `true`
- `select proname, prosecdef from pg_proc where pronamespace = 'public'::regnamespace and proname =
  'recompute_invoice_status';` → expect `prosecdef = false` (i.e. `SECURITY INVOKER`)
- End-to-end: as a signed-in non-admin test user, call
  `select public.recompute_invoice_status('<some other student''s invoice id>'::uuid);` and confirm it raises
  `Invoice not found.` rather than returning that invoice's data.

## 5. Regression tests

`src/lib/payments/migration-security.test.ts` is new — it statically reads
`supabase/migrations/0005_payments_billing.sql` and asserts: `recompute_invoice_status` is `security invoker`
(not `security definer`); the other three functions remain `security definer` with a pinned `search_path`; all
four functions have `revoke execute ... from public`; the correct `grant execute ... to authenticated` /
`to anon` statements are present for the correct functions; and the PART 11 verification-query section exists.
This cannot exercise real Postgres RLS/grants (Vitest has no database connection in this project — see
`vitest.config.mts`'s docblock), but it will fail `npm test` immediately if this fix is ever accidentally
reverted or weakened in a future edit to the migration file, without needing a live database to catch it.

Verification run in this environment before packaging this patch (see §6):

```
npm run typecheck   — clean
npm run lint         — clean
npm test              — 211 tests / 19 files passing (203 pre-existing + 8 new in migration-security.test.ts)
npm run validate:careers — 100 careers, 0 errors/warnings
npm run build         — 56 routes generated, no duplicates
```

None of these checks were weakened, skipped, or had assertions removed to make them pass.

## 6. Known limitations of this patch

- This patch changes database function security only. It does not add a live Postgres test harness (e.g.
  pgTAP) — the `has_function_privilege()` queries in §4 must be run manually against your own Supabase project;
  they were not executed in this sandbox (no live Supabase project is reachable here).
- If you have already granted broader access to `recompute_invoice_status` manually outside this migration
  (e.g. an ad hoc `GRANT` run directly in your project's SQL Editor), re-running this migration's `REVOKE`
  followed by its `GRANT` will reset it to the intended state — but a `GRANT` issued by a *different* role than
  the one that owns these functions, after this migration runs, could still re-broaden access. Treat the
  verification queries in §4 as the source of truth for your actual deployed state, not this document.

## 7. Rollback

Reverting this patch is **not recommended** — it would reintroduce the privilege-escalation bug described in §1.
If you must revert for some other reason, restore your previous copy of `supabase/migrations/0005_payments_billing.sql`
(before this patch) and re-run it; note that doing so removes the `revoke`/`grant` statements and PART 11 entirely
and returns `recompute_invoice_status` to `SECURITY DEFINER` with no explicit grants — i.e. back to the
vulnerable state. There is no partial/safe rollback of just this function change while keeping the rest of
Milestone 8 intact; the corrected file is a drop-in replacement, not an additive change, for that one function.
