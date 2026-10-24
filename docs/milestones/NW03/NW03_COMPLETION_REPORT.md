# NW03 — Two-Product Architecture: Completion Report

**Milestone:** NW03
**Status:** COMPLETE — all 6 stages delivered, zero open P0/P1 issues
**Branch:** `release/m10`
**Companion documents:** `NW03_01_AUDIT.md` · `NW03_02_ROUTES.md` · `NW03_03_STUDENT_JOURNEYS.md` · `NW03_04_AUTH_ENTITLEMENTS.md` · `NW03_05_INTEGRATION.md` · `NW03_06_QA_REPORT.md` · `NW03_ARCHITECTURE.md`

> **A note on the acceptance-criteria numbering below.** This report tracks the 18 distinct, concrete requirements this milestone's brief stated across its architectural mandate and constraints. The numbering (AC-01–AC-18) is this report's own organization of those requirements for traceability across the six stage documents above — it is not claimed to reproduce the brief's own internal numbering verbatim. Every requirement listed is one this session's record of the brief actually states; none is invented for this report.

## 1. Acceptance criteria — evidence table

| AC | Requirement | Evidence |
|---|---|---|
| AC-01 | One brand, one Supabase Auth account/session system shared by both products. | `NW03_01_AUDIT.md` §5 confirms one `profiles`/`student_profiles` row per user, both pre-existing; no second account system was introduced. `NW03_05_INTEGRATION.md` §2 confirms this held unchanged. |
| AC-02 | Career Intelligence has its own public entry point. | `/career` (`src/app/(site)/career/page.tsx`), built in NW03.2, static route confirmed in the build output (`NW03_02_ROUTES.md` §3). |
| AC-03 | Abroad has its own public entry point. | `/abroad` (`src/app/(site)/abroad/page.tsx`), built in NW03.2, static route confirmed in the build output. |
| AC-04 | Abroad must never require a Career assessment, at any point including signup. | Gap found in `NW03_01_AUDIT.md` §5 (`RegisterForm.tsx` hardcoded `/welcome`); fixed in NW03.3; verified end-to-end and by automated test (`nw03-studio-reference-audit.test.ts`, AC-04 describe block) in NW03.6. |
| AC-05 | Career must never require a consultancy/Abroad purchase. | `/career-discovery`, `/careers`, `/courses` all remain free and purchase-independent — unchanged by NW03 (`NW03_01_AUDIT.md` §2); `src/lib/products/entitlements.ts` is never used to gate access (verified by test, `NW03_06_QA_REPORT.md` §2.3). |
| AC-06 | Each product has its own authenticated student workspace. | `/studio/career` (→ `/dashboard`) and `/studio/abroad`, built in NW03.3. |
| AC-07 | The two workspaces are reachable from one shared hub. | `/studio` (`src/app/studio/page.tsx`), built in NW03.3, linked from `DashboardShell`'s nav. |
| AC-08 | Entitlements must be product-specific. | `ProductEntitlements` separates `hasCareerEntitlement`/`hasAbroadEntitlement` and their purchase lists; unit-tested for zero cross-contamination (`entitlements.test.ts`, "a student with both..." case), `NW03_04_AUTH_ENTITLEMENTS.md` §2. |
| AC-09 | Entitlements must be server-enforced, never client-state-only. | `getMyProductEntitlements()` re-derives from `pricing_purchases` on every call; no cookie/localStorage caching exists. `NW03_04_AUTH_ENTITLEMENTS.md` §2.1. |
| AC-10 | Entitlements must never leak across products. | Pure classifier excludes any purchase whose plan category can't be resolved, rather than guessing; unit-tested (`entitlements.test.ts`, null/unknown `planId` cases). |
| AC-11 | Existing Supabase auth/sessions must be preserved unchanged. | `NW03_05_INTEGRATION.md` §2; zero changes to `src/lib/supabase/server.ts`, `src/lib/supabase/client.ts`, or any Supabase Auth call site. |
| AC-12 | Existing RLS policies must be preserved, with no new bypass. | `NW03_06_QA_REPORT.md` §2.4 — zero new tables/policies; the one new read (`pricing_plans` by id) relies on a pre-existing "Anyone can read" policy already used elsewhere. |
| AC-13 | Existing user IDs/profile schema must be preserved. | No migration was written or needed anywhere in NW03 (`NW03_01_AUDIT.md` §4, `NW03_04_AUTH_ENTITLEMENTS.md` §1). |
| AC-14 | The 6-country Abroad destination allowlist (+ India = 7 launch destinations) must be preserved exactly, no silent expansion. | `LAUNCH_COUNTRY_CODES` re-read and confirmed still exactly `["IN","DE","IE","NL","FR","SE","DK"]` in `NW03_05_INTEGRATION.md` §3 and asserted by automated test in `NW03_06_QA_REPORT.md` §2.1; `/abroad` imports `EUROPE_COUNTRIES` directly rather than re-typing it. |
| AC-15 | NW01 "Trust & System Integrity" invariants must be preserved. | Full checklist and empirical test-suite confirmation in `NW03_05_INTEGRATION.md` §2. |
| AC-16 | NW02 education-discovery features must be preserved and reused, not duplicated. | Full checklist in `NW03_05_INTEGRATION.md` §3; `/career`/`/abroad` link to existing `/courses`/`/study-europe` rather than forking them. |
| AC-17 | The known ₹1,999 GST-inclusive payment bug must not be touched. | Zero payment/checkout/webhook files opened for editing at any NW03 stage — confirmed in `NW03_06_QA_REPORT.md` §2.8. |
| AC-18 | No NW06–NW10 functionality may be built; work must include automated tests, a security review, and a clean build/type-check/lint gate before completion. | Scope held to routing + one pure module throughout (`NW03_ARCHITECTURE.md` §6–§8); 24 new automated tests added (`entitlements.test.ts` + `nw03-studio-reference-audit.test.ts`); security review in `NW03_06_QA_REPORT.md` §2.4; final gate in §1 of that same document: 0 tsc errors, 0 lint errors/18 pre-existing warnings, 2115/2115 tests passing, successful build. |

All 18 criteria: **met**.

## 2. Issue classification (P0–P3), final

| Severity | Count | Detail |
|---|---|---|
| P0 (blocking) | 0 | None found at any stage. |
| P1 (serious) | 0 | None found at any stage. |
| P2 (real defect, fixed) | 1 | `RegisterForm.tsx`'s hardcoded `/welcome` redirect (AC-04 gap) — found in NW03.1, fixed in NW03.3, verified in NW03.6. |
| P3 (minor / accepted) | 2 | `/roadmap`'s product ownership was unresolved — resolved by classification only (NW03.5), no code change needed. `/welcome`'s own content stays Career-shaped for a no-`next` signup — accepted as out of scope for this milestone (bypass, not rewrite, was the minimal fix). |

## 3. Final validation summary

```
npx tsc --noEmit        0 errors
npm run lint             0 errors, 18 pre-existing warnings (unchanged set)
npx vitest run           129 test files, 2115 tests — all passed
npm run build            84 routes — succeeded
```

## 4. What this milestone did not do (by design)

- No database migration.
- No change to payment/checkout/webhook/refund code.
- No change to the admin shell, `admin_roles`, or any admin-only route.
- No change to `/welcome`'s own content.
- No NW06–NW10 feature work.
- No commit, push, or deploy — per this engagement's standing constraint, all work exists only in the staged working copy pending the user's own review and installation into the real repository (see §5).

## 5. Delivery

Packaged and delivered per the same convention established for NW01/NW02: a zip of every new/changed file plus this `docs/milestones/NW03/` folder, sent via `SendUserFile`, with an offer to also write it to the user's `C:\ClaudeBuilds\NW03\...` folder via the device bridge if a desktop is connected. See the session's final delivery message for the exact file list and instructions.
