# NW03.6 — Automated Tests, Security & Release Review

**Milestone:** NW03 "Two-Product Architecture"
**Stage:** 6 of 6 (final)
**Depends on:** NW03.1–NW03.5

## 1. Full validation gate (final re-run)

| Check | Baseline (NW03.1) | Final (post NW03.2–NW03.6) |
|---|---|---|
| `npx tsc --noEmit` | 0 errors | 0 errors |
| `npm run lint` | 0 errors, 18 warnings | 0 errors, 18 warnings (identical set) |
| `npx vitest run` | 127 files / 2091 tests | 129 files / 2115 tests — all passed, zero skipped, zero failed |
| `npm run build` | 79 routes | 84 routes (the 5 new: `/career`, `/abroad`, `/studio`, `/studio/career`, `/studio/abroad`) |

No regression anywhere in the baseline. The two new test files (`src/lib/products/entitlements.test.ts`, 10 tests; `src/lib/auth/nw03-studio-reference-audit.test.ts`, 14 tests) account for the full +24 test delta (2115 − 2091).

## 2. Validation matrix, by group

### 2.1 Routing

- `/career`, `/abroad` build as static (`○`) public pages — confirmed in the build output.
- `/studio`, `/studio/career`, `/studio/abroad` build as dynamic (`ƒ`) pages — correctly reflecting that they are auth-gated, not static.
- Exactly one `page.tsx` resolves to each new path — asserted by `nw03-studio-reference-audit.test.ts`'s "exactly one page resolves to each of /studio, /studio/career, /studio/abroad" case, mirroring the same collision-guard pattern used for `/dashboard`/`/profile`/`/recommendations`.
- No existing route's path, file, or behavior changed.

### 2.2 Auth

- `/studio` (and, via the existing prefix-match, `/studio/career` + `/studio/abroad`) added to `middleware.ts`'s `PROTECTED_PATHS` — asserted by test.
- `RegisterForm.tsx`'s post-signup redirect now honors a safe `next` instead of a hardcoded `/welcome`, closing the AC-04 gap identified in NW03.1 — asserted by three dedicated test cases (push-call uses `safeNext`, the old hardcoded push is gone, `emailRedirectTo` carries `safeNext` too).
- `src/app/auth/callback/route.ts` already applied `getSafeRedirectPath` before this milestone — confirmed unchanged and still doing so.
- No new redirect logic was hand-rolled anywhere; every new redirect path (`RegisterForm.tsx`, `/studio/career`) reuses an existing, already-reviewed mechanism (`getSafeRedirectPath`, Next's own `redirect()`).

### 2.3 Entitlements

- `classifyPurchaseEntitlements` unit-tested directly: empty input, career-only, abroad-only, both-at-once (no cross-contamination), null `planId` (never guessed), unknown `planId` (never guessed), and a full exhaustiveness check over all 5 `PricingCategory` values.
- Confirmed informational-only usage: `nw03-studio-reference-audit.test.ts` asserts the Studio hub's workspace links are unconditional `<Link>` elements, not wrapped in an entitlement check.
- `getMyProductEntitlements()` (the I/O wrapper) is re-derived from `pricing_purchases` on every call — no caching layer was added that could go stale or be forged.

### 2.4 Supabase / RLS security

- No new table, column, policy, or migration was added by NW03 — there is nothing new for RLS to cover.
- `getMyProductEntitlements()`'s one new query (`pricing_plans` by id list) relies on that table's pre-existing "Anyone can read..." RLS policy — the same policy `listPublicPricingPlans()` already depends on; no `service_role` key, no RLS bypass, no admin-permission check was added or needed.
- `listMyPurchases()` (unchanged) remains scoped to `auth.uid() = student_user_id` — a student can only ever see their own purchases feeding into their own entitlement result.
- No IDOR surface was introduced: every new page (`/studio`, `/studio/career`, `/studio/abroad`) reads only "whoever is currently logged in"'s own data (`getCurrentProfile()`, `getMyProductEntitlements()`), with no id taken from a URL param or query string.

### 2.5 Existing-functionality preservation

Covered in full in `NW03_05_INTEGRATION.md` — NW01's trust/system-integrity invariants and NW02's 7-destination allowlist both re-verified intact, with the full pre-existing test suite as evidence.

### 2.6 Accessibility

- All new pages reuse existing, already-accessible primitives (`PageHero`, `Section`, `SectionHeading`, `Card`, `Badge`, `LinkButton`, `ComingSoon`, `DemoNotice`) rather than hand-rolled markup.
- Every new decorative icon carries `aria-hidden="true"`, matching the sitewide convention observed in every file read this milestone.
- Heading hierarchy on every new page starts at `<h1>` (via `PageHero`, or a page-level `<h1>` on `/studio`/`/studio/abroad`) and uses `<h2>` for subsections — no skipped levels.
- Nav changes (`PRODUCT_NAV` in `Header.tsx`/`MobileNav.tsx`) reuse the existing `aria-current`/focus/underline treatment applied to every other nav link, not a new pattern.

### 2.7 Build & type safety

- `npx tsc --noEmit`: 0 errors throughout every stage (checked after NW03.2, NW03.3, NW03.4, and this final stage).
- `npm run build`: succeeded at every stage; warning count never increased beyond the pre-existing 18.

### 2.8 Payment safety

- Zero files under `src/lib/payments/`, `src/app/(site)/payments/`, `src/app/(site)/pay/`, `src/app/(site)/pricing/checkout/`, `src/app/api/webhooks/razorpay/`, or any admin payment/refund module were opened for editing at any point in NW03.2–NW03.6.
- The known ₹1,999-GST-inclusive bug was not touched, investigated, or referenced in any new code — entitlements only *read* `pricing_purchases` rows that the existing, unmodified payment path already wrote.

## 3. Issue classification (P0–P3)

| ID | Severity | Description | Status |
|---|---|---|---|
| P0 | — | None found. | — |
| P1 | — | None found. | — |
| P2 | Resolved | `RegisterForm.tsx`'s post-signup redirect was hardcoded to `/welcome`, which would have forced an Abroad-originated signup through Career onboarding with no way to reach `/studio/abroad` directly — a real AC-04 violation if left unfixed. | Fixed in NW03.3; verified by automated test in NW03.6. |
| P3 | Resolved (documentation only) | `/roadmap`'s product ownership was unresolved (`LEGACY-REQUIRES-REVIEW`) after NW03.1. | Opened and reclassified CAREER in NW03.5; no code change required. |
| P3 | Accepted, out of scope | `/welcome`'s own content remains Career-shaped; a Career-signup-with-no-`next` visitor still sees it exactly as before. | Intentional — bypassing it for Abroad (rather than rewriting it) was the minimal, lowest-regression-risk fix; rewriting `/welcome` itself is not in NW03's stage list. |

No P0 or P1 issues were found at any point in this milestone.

## 4. Final status

All 18 acceptance criteria referenced throughout NW03.1–NW03.5 are addressed by the implementation delivered in NW03.2–NW03.4 and verified in NW03.5–NW03.6:

- One brand, one account/auth, two independent product journeys (`/career`→`/studio/career`, `/abroad`→`/studio/abroad`) — delivered.
- Abroad never requires a Career assessment; Career never requires a consultancy purchase — delivered and verified (AC-04 fix + informational-only entitlements).
- Entitlements are product-specific and server-enforced, never client-state-only — delivered (`src/lib/products/entitlements.ts`).
- Existing Supabase auth/RLS/user IDs/sessions preserved — verified unchanged (zero new tables/migrations/policies).
- The 6-country Abroad destination allowlist preserved without silent expansion — verified unchanged (`LAUNCH_COUNTRY_CODES` still exactly 7; `EUROPE_COUNTRIES` reused, not re-typed).
- The known payment bug was not touched — verified (zero payment files opened).
- NW06–NW10 functionality was not built — confirmed; every file added or edited in this milestone is listed in `NW03_02_ROUTES.md`, `NW03_03_STUDENT_JOURNEYS.md`, and `NW03_04_AUTH_ENTITLEMENTS.md`, and none of it extends beyond the two-product routing/journey/entitlement scope NW03 itself defines.

NW03 is complete and ready for packaging (see `NW03_COMPLETION_REPORT.md`).
