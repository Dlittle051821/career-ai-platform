# CC-15: Security remediation and installation package (NW-F01)

Date: 2026-11-07 (Europe/Berlin). Prepared by Claude. Local preparation only.

No shared database, production deployment or live payment system was accessed or modified. That covers QA `ynwzijulzksmrcwdhudv` and production `bwlkxunujngksibfzzfv`. Nothing was committed, pushed, merged or installed into `C:\carrier.ai`.

## 1. Scope

The scope was agreed on 2026-11-07:
- Fix the remaining safe findings from the CC-14 independent review: **F3**, **F4** and **F7**. **F2**, **F6** and **F8** were already fixed in CC-14.
- Leave **F1** for a design decision.
- Deliver everything as one cumulative installation package targeting `C:\carrier.ai` at commit `4f69c33be218e59433713ebe1fef22c857d25a67`.

## 2. Fixes made in CC-15

| ID | Finding | Fix | Where |
|---|---|---|---|
| F3 (Medium) | Admins could overwrite the "immutable" signed/stamped document paths and provider request IDs by direct table UPDATE. Duplicate provider IDs were possible. | Trigger `nextwise_security.guard_document_capture` on INSERT and UPDATE of `signature_requests` and `stamp_requests`, applied to every writer including admins and service_role:<br>• a path can be captured only after creation;<br>• it must be canonical (`<agreement>/<request>/<file>`);<br>• the object must exist in the private bucket;<br>• it is write-once;<br>• `provider_request_id` may go null → value once and never change.<br>Partial unique indexes on `(provider, provider_request_id)`, with a duplicate precheck that fails closed. | `01_internal_rpcs.sql` |
| F4 (Medium) | An approval did not name the version the reviewer saw, so content could be swapped before approval. | `staff_review_recommendation_draft` now requires `p_expected_version_id` and rejects any mismatch with the current version. A new `approved_version_id` column records the approved version. Release requires that version still to be current. Drafts already approved before the migration are bound to their current version. The app passes the version rendered on the review page. | `03_…sql`; `recommendation-drafts.ts`; review page and action; `database.ts` |
| F7 (Low) | Legacy SECURITY DEFINER functions had `search_path=public` without `pg_temp`, so temporary objects could shadow them. | Every definer function in `public`/`nextwise_security` not already pinned gets `search_path = pg_catalog, public, extensions, pg_temp`. `extensions` covers Supabase's pgcrypto location. A postcondition fails the migration if any function is missed. Bodies, owners and grants are unchanged (checked by the rehearsal). | End of `03_…sql` |
| P1 (**Critical**, found by the CC-15 re-review, pre-existing since migration 0005) | A student could insert a `payment_attempts` row with any amount and any Razorpay order id, attach a cheap invoice's ₹10 order to the ₹1,999 Verified invoice, and have 199,900 recorded as captured. | New standalone `05_payment_attempt_integrity.sql`:<br>• unique `(provider, provider_order_id)`;<br>• the student INSERT policy now requires `created_by = auth.uid()` and `payment_attempt_insert_allowed(...)`: a fresh `created` Razorpay attempt with an order id, on an own invoice in a payable status, in the invoice currency, for **exactly** the amount still due;<br>• Verified invoices only at exactly 199,900 INR.<br>Admin/finance policies unchanged. The app's existing insert is compatible, so no app change is needed. | `05_…sql` (separate approval from NW09.2) |
| D1–D4 (High/Medium, CC-15 re-review) | The F3 guard protected only the path and provider ID. A bound request could be re-pointed to another version, signer or provider; an admin could attach a document to a request that never completed; ids could be renamed; service_role could delete and re-create a captured row. | The guard now fires on INSERT, UPDATE and DELETE and is SECURITY INVOKER, so it sees the real writer:<br>• `id` is immutable;<br>• once bound: provider, agreement, version and signer are immutable;<br>• once captured: path and status are immutable, and direct DELETE is blocked;<br>• new captures are allowed only for postgres/service_role and only after `signed`/`completed`;<br>• TRUNCATE revoked from service_role;<br>• admin upload policies on the two result buckets dropped. | `01_…sql` |
| N2/N3 (Medium/Low, CC-15 re-test) | Stamp terms and signature evidence could be edited after binding or capture. | Stamp value, currency, state, jurisdiction and document type are frozen once bound. A captured record is fully read-only to everyone except postgres (definer webhook functions) and service_role. | `01_…sql` |
| P2 (Medium, CC-15 re-review) | The app guard allowed partial Verified charges and passed purchases whose plan could not be identified. | Verified requires a single charge of exactly 199,900. A plan purchase with an unidentifiable plan fails closed. | `checkout-charge-guard.ts` |
| S1 (Low, CC-15 re-review) | `extensions` came after `public` in the pinned path. | Pinned path is now `pg_catalog, extensions, public, pg_temp`. | `03_…sql` |
| Packaging | — | All SQL files are labelled **PROPOSED - DO NOT APPLY**. `NW09_2_ATOMIC_01-03.sql` was regenerated (drift-checked). | `nw-f01-s3/*.sql` |

**Kept from CC-14:**
- F2: NaN cost rejection.
- F6: TRUNCATE/TRIGGER/REFERENCES revoked.
- F8: transient errors re-raised.
- The fail-closed checkout guard: Nextwise Verified must be exactly ₹1,999 including GST.
- The atomic AI finalization and lock protocol, from Codex S4 and CC-13.

## 3. Independent re-review of the CC-15 fixes

A separate AI reviewer agent, which did not write the fixes, attacked CC-15 twice on its own disposable PostgreSQL 16 cluster. It loaded pgcrypto into an `extensions` schema, as on Supabase, and wrote exploit scripts that are included in the package evidence.

**First pass.** Confirmed F4 and F7. Found:
- **P1 (Critical, pre-existing payment flaw):** a student can insert a payment attempt for the wrong amount, or reuse another invoice's Razorpay order.
- **D1–D4:** further gaps in the capture guard.
- **P2:** guard gaps for partial Verified charges and unidentifiable plans.
- **S1:** `extensions` was listed after `public` in the pinned path.

All of these were fixed (section 2).

**Second pass (re-test).** P1, D1 (signatures), D2, D3, D4 (direct DELETE/TRUNCATE), S1 and P2 all **held**. Legitimate flows were confirmed working:
- admin request creation, then the signature webhook, then service-role capture;
- stamp capture;
- the app's student payment-attempt insert.

It reported four remaining items:
- **N2 (stamp terms editable after binding):** fixed afterwards; stamp value, currency, state, jurisdiction and document type are now frozen once bound.
- **N3 (evidence timestamps and metadata editable after capture):** fixed afterwards; a captured record is fully read-only outside the trusted server roles.
- **N1** and **N4:** listed as remaining in section 4.

The N2/N3 fixes were verified by new offline regressions and a fresh rehearsal run, not by a third reviewer pass.

**These reviews are by an AI agent and do not replace the required human independent security sign-off.**

## 4. Remaining security findings

| Priority | Item |
|---|---|
| **P0** | **F1 (High):** an assigned counsellor can call `staff_finalize_ai_generation_run` directly with fabricated "AI" content and a fake provider response ID. Remedy: make finalization callable only by a trusted server identity (service_role, with the server passing the authenticated requester) or HMAC-sign the payload. This changes the AI trust boundary and needs your decision. It blocks production AI enablement; QA validation with fictional data may proceed. |
| **P0** | A human independent security reviewer signs off. The CC-14 and CC-15 reviews were done by a separate AI reviewer agent, which does not satisfy this gate. |
| **P0** | Authorized Supabase QA preflight and validation (plan in `CC-14-REVIEW.md` §6). Rehearsals so far were on disposable local PostgreSQL 16 only. |
| **P0** | Approve and apply the NW01 inclusive-GST pricing fix in QA, set Verified's `tax_status` to `tax_inclusive`, and run the checkout cases in test mode. Until then the guard blocks checkout rather than overcharging if GST is switched on. |
| P1 | **N1:** service_role (the server's secret key) can still replace a captured document by deleting and recreating the whole agreement, and can delete stored objects. service_role is treated as fully trusted; protect the key, and consider an append-only capture ledger or Supabase storage object protection. |
| P1 | **Webhook amount reconciliation:** the Razorpay capture webhook trusts the attempt's amount. 05 makes a wrong attempt amount impossible for students, but the webhook should still compare against the gateway amount (re-review: latent, not exploitable without a leaked order id). |
| P2 | **N4:** a student can create a `created` attempt with a made-up order id for their own invoice. This blocks their own checkout until staff cancel it; there is no financial impact. Remedy: server-created attempts. |
| P1 | Private `signed-agreements` and `stamped-agreements` buckets (not created). Privacy and retention approval. Trusted paid-model ceilings and a reconciliation workflow. |
| P2 | F5 (system-looking audit actions via `record_admin_audit_log`), F9 (consent recheck before the provider call), F10 backlog, and global serialization of draft edits on the AI advisory lock. |

## 5. Test results (local; scratch copy of the reviewed tree)

| Check | Result |
|---|---|
| Vitest full suite | 158 files, 2,725 tests passed |
| TypeScript (`tsc --noEmit --incremental false`) | Exit 0 |
| ESLint | 0 errors (18 existing `no-img-element` warnings) |
| Offline SQL (PGlite 0.5.15) | 57/57, including new F3/D1–D4, F4, F7 and P1 regressions (05 loaded) |
| Real multi-session concurrency (PostgreSQL 16.15) | 10/10 tests in each of 10 consecutive runs; 0 deadlocks |
| Migration rehearsal (PostgreSQL 16.15) | 10/10, including 05: atomic under forced failure, idempotent rerun. Forced failures at three points leave catalog and data byte-identical. Successful application preserves data, and changes outside the replaced set are only the pinned search_path and the named ACLs. Rerun is idempotent |
| Artifact drift check | OK |
| Package installer tests | `INSTALLER-TEST-TRANSCRIPT.txt`, delivered next to the ZIP |

## 6. Package

The package is `NEXTWISE-CC15-SECURITY-STABILIZATION-INSTALL.zip`. It is a cumulative patch against `4f69c33`: Codex S3/S4 + CC-13 + CC-14 + CC-15. Installation, verification and rollback steps are in `README-INSTALL.md` inside the package.
