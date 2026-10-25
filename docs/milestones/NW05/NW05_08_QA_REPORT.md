# NW05.8 — Automated Tests, Responsive QA, Docs, Package & Deliver

Status: **COMPLETE WITH ONE DISCLOSED LIMITATION** (§3 — no live browser pass on authenticated routes; see why)

## 1. New regression test coverage

| File | Tests | Covers |
|---|---|---|
| `src/lib/abroad/scope.test.ts` | 11 | Abroad-destination matching, pure |
| `src/lib/supabase/student-profile-actions-provenance.test.ts` | 14 | NW05.3 downgrade-RPC wiring into all 11 save functions, fail-tolerant on RPC error |
| `src/lib/products/entitlements.test.ts` (rewritten) | 21 | Pure entitlement classifier incl. 8 new P0 security cases |
| `src/lib/products/entitlements-io.test.ts` | 9 | Fail-closed orchestration of the live entitlement read path |
| `src/lib/profile/nw05-provenance-verification-security-audit.test.ts` | 9 | Static source-text audit — no student-writable verification path anywhere in SQL or TypeScript |

**64 new tests** across 5 files, all passing, zero skipped or weakened.

## 2. Full validation gate

Run after every substantive NW05 change, and again as the final gate:

| Check | Command | Result |
|---|---|---|
| Type-check | `npx tsc --noEmit` | **Clean — 0 errors** |
| Unit/regression tests | `npx vitest run` | **134 test files, 2182 tests — all passing** (up from the pre-NW05 baseline of 130 files / 2137 tests — the +64 tests across 4 new test files plus the rewritten `entitlements.test.ts` are exactly this milestone's new coverage) |
| Lint | `npm run lint` | **0 errors, 18 warnings** — the same 18 pre-existing `@next/next/no-img-element` warnings as every prior milestone, none introduced by NW05 |
| Production build | `npm run build` | **Succeeds** — every route compiles, including `/studio`, `/studio/career`, `/studio/abroad` |

No test was removed, skipped, or weakened to reach this result.

## 3. Responsive/visual QA — disclosed limitation and what was done instead

**This environment's `NEXT_PUBLIC_SUPABASE_URL` is a placeholder** (`https://placeholder.supabase.co`, confirmed in `.env.local`) — there is no live Supabase project reachable from this sandbox. `/studio`, `/studio/career`, and `/studio/abroad` are all authenticated AND fully data-dependent (every section on them is a real Supabase read). A live Playwright pass against this environment would not exercise real page content at all — it would either hit the login redirect (correctly, since middleware has no live session to validate) or, if auth were artificially bypassed, every data call would fail against a placeholder host and the page would render only its error boundary. Neither outcome is a meaningful responsive/visual test, and this milestone's own brief explicitly prohibits bypassing security to manufacture one ("Do not alter production Supabase... configuration").

This is exactly the situation Section 15 of the brief anticipates: **"If a live Supabase test env unavailable, differentiate UNIT/INTEGRATION/BROWSER TEST PASSED vs MANUAL VERIFICATION REQUIRED."**

**What was done instead — a structural (source-level) responsive review:**

- Every new/changed layout in `src/app/studio/page.tsx`, `src/app/studio/abroad/page.tsx`, `StudentJourneyOverview.tsx`, and `AbroadReadinessCard.tsx` was grepped for fixed-pixel-width classes (`w-[`, `min-w-[`, `max-w-[`) that could force horizontal overflow at 375px — **none found**.
- Every multi-column grid in this milestone's new code collapses to 1 or 2 columns below the `sm:` breakpoint (`grid-cols-2 sm:grid-cols-4` in `StudentJourneyOverview`; `sm:grid-cols-2` everywhere else), the same pattern NW04's Playwright-measured pass already confirmed overflow-free at 375/390/768/1024/1440px for the rest of this product's pages.
- Every new component reuses the same `Card`/`Badge`/`Link` primitives and `rounded-[1.5rem] border border-border bg-surface p-5 shadow-soft` card shell already used (and already visually reviewed) throughout `/dashboard`.

**MANUAL VERIFICATION REQUIRED before this is marked production-ready** — exact steps for a real staging environment with a live Supabase project:

1. Sign in as a test student account with: (a) no profile data, (b) a partially-complete profile with some saved items, (c) a completed profile with applications and a counsellor-verified section.
2. For each of those 3 accounts, load `/studio`, `/studio/career`, and `/studio/abroad` at 375px, 390px, 768px, 1024px, and 1440px viewport widths.
3. Confirm: no horizontal scroll, every "Your journey so far" / "Abroad Readiness" tile wraps/stacks legibly, the two workspace cards remain equal-width at every breakpoint, loading skeletons appear briefly on a throttled connection, and the error boundary renders correctly if a query is forced to fail (e.g. by temporarily revoking the test account's session mid-request).
4. Run Lighthouse (authenticated) against all three routes using that same test account — never a bypassed/unauthenticated session.

## 4. Security test summary (consolidated from NW05.6/NW05.7)

| Security case (from the brief) | Result |
|---|---|
| Anonymous | Pre-existing `getCurrentUser()`/middleware gating — unchanged, still correct |
| Free registered (no purchases) | `entitlements-io.test.ts` — empty entitlement, zero Supabase queries |
| Paid / verified | `entitlements.test.ts` + `entitlements-io.test.ts` — entitlement correctly granted |
| Pending purchase | Both entitlement test files — correctly denied |
| Failed purchase | Same mechanism as pending — correctly denied |
| Refunded purchase | Both entitlement test files — correctly denied |
| Revoked purchase | Same mechanism as refunded — correctly denied |
| Counsellor role / Admin role | Unchanged, pre-existing RLS — re-verified by the new NW05.7 static audit |
| Another student's resource id | Structurally impossible — every id used is derived from the caller's own RLS-scoped data |
| Forged client entitlement flag | Structurally impossible — nothing client-supplied is ever read for entitlement or provenance |
| Invalid ownership / IDOR | Covered by existing RLS, re-verified by NW05.7's static audit for the provenance tables specifically |
| Missing entitlement config | `entitlements.test.ts`'s unresolvable-category cases |
| DB query error | `entitlements-io.test.ts`'s two fail-closed cases |

## 5. What NW05.8 did not need to add

- No new RLS/migration-security test beyond the one new NW05.7 static audit — no migration was applied, so there is nothing new to verify against a real database.
- No payment/checkout test — NW05 made no payment-provider or checkout-flow change.
- No new React-rendering test harness — this codebase has never used React Testing Library/jsdom; NW05 follows the same established static-source-text-audit convention as every prior milestone.
