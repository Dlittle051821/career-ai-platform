# NW05 Architecture — Student Studio & Secure Product Entitlements

## 1. Summary

NW05 is split across two very different kinds of work: real-data UI enrichment of the authenticated Studio surfaces (NW05.2/NW05.4/NW05.5), and a P0 security fix plus its supporting safeguard (NW05.6/NW05.3/NW05.7). Nothing in either half required a new table; the one proposed schema addition (a single narrow RPC) is deliberately unapplied. Every new UI surface composes already-existing, already-reviewed data-access functions rather than introducing a second way to read the same data.

## 2. New files

```
src/components/dashboard/StudentJourneyOverview.tsx    — /studio's cross-product "Your journey so far" tile grid
src/app/studio/loading.tsx                              — /studio route-level loading skeleton
src/app/studio/error.tsx                                — /studio route-level error boundary
src/app/studio/abroad/loading.tsx                       — /studio/abroad route-level loading skeleton
src/app/studio/abroad/error.tsx                         — /studio/abroad route-level error boundary
src/components/abroad/AbroadReadinessCard.tsx           — /studio/abroad's "Abroad Readiness" snapshot
src/lib/abroad/scope.ts                                 — pure Abroad-destination-name matcher, derived from EUROPE_COUNTRIES
src/lib/abroad/scope.test.ts                            — 11 tests
src/lib/supabase/student-profile-actions-provenance.test.ts   — 14 tests (NW05.3 downgrade-RPC wiring)
src/lib/products/entitlements-io.test.ts                — 9 tests (NW05.6 fail-closed orchestration)
src/lib/profile/nw05-provenance-verification-security-audit.test.ts  — 9 tests (NW05.7 security regression guard)
supabase/migrations-proposed/NW05_student_mark_section_self_entered.sql  — PROPOSED, NOT applied
docs/milestones/NW05/*.md                               — this milestone's full documentation set
README_NW05_INSTALL.md                                  — install guide (repo root, same convention as NW04)
```

## 3. Modified files

```
src/app/studio/page.tsx                   — enriched with real Journey Overview / Next Best Action / Saved / Discovery sections (NW05.2)
src/app/studio/abroad/page.tsx            — real Abroad-scoped saved items, readiness, and applications replace the NW03 stub (NW05.5)
src/components/dashboard/DiscoverySessionCard.tsx  — additive `activeSessionLabel` prop (default unchanged) so /studio/abroad can reuse it honestly
src/lib/supabase/student-profile-actions.ts  — all 11 save functions now call downgradeSectionProvenanceIfNeeded() (NW05.3)
src/types/database.ts                     — one new Functions entry for the proposed RPC, clearly commented as unapplied
src/lib/products/entitlements.ts           — the P0 fix: classifyPurchaseEntitlements()/getMyProductEntitlements() now require a 'paid' invoice (NW05.6)
src/lib/products/entitlements.test.ts      — updated for the new 3-arg signature, +8 security cases
vitest.config.mts                          — 3 new, documented include entries for the narrow src/lib/supabase/ exception and the two new pure-logic directories
```

`src/app/studio/career/page.tsx` was inspected (NW05.4) and deliberately left unchanged.

## 4. Data flow

No NW05 component introduces a new way to read student data. Every new read in `/studio` and `/studio/abroad` is one of:

- A function already used by `/dashboard` (`getStudentProfileSnapshot`, `calculateCompletion`, `listSavedItems`, `getUniversitiesByIds`/`getCoursesByIds`, `listMyApplications`, `getMyActiveDiscoverySession`, `getMyRecommendationReadiness`, `getNextBestAction`), reused verbatim.
- A new, pure, zero-I/O classification layered on top of one of those (`src/lib/abroad/scope.ts`'s Abroad-destination matching; `StudentJourneyOverview`'s tile derivation) — no new Supabase query anywhere in NW05.2 or NW05.5.
- NW05.6's one genuinely new query: `invoices` by id, joined in application code against the student's own `pricing_purchases`.

## 5. Dependency graph (new/changed only)

```
src/app/studio/page.tsx
 ├─ StudentJourneyOverview.tsx ──uses──> types/student-profile.ts, types/recommendation-readiness.ts
 ├─ NextBestActionCard.tsx (pre-existing, reused)
 ├─ SavedShortlistCard.tsx (pre-existing, reused)
 └─ DiscoverySessionCard.tsx (modified — additive prop)

src/app/studio/abroad/page.tsx
 ├─ AbroadReadinessCard.tsx ──uses──> data/profile-options.ts (BUDGET_BAND_OPTIONS)
 ├─ scope.ts (isAbroadDestinationName / getAbroadDestinationPreferences) ──uses──> data/europe-explorer.ts, data/profile-options.ts
 ├─ SavedShortlistCard.tsx, ApplicationsCard.tsx (pre-existing, reused, Abroad-filtered via scope.ts)
 └─ DiscoverySessionCard.tsx (modified — additive prop, generic label)

src/lib/supabase/student-profile-actions.ts
 └─ downgradeSectionProvenanceIfNeeded() ──calls (best-effort)──> public.student_mark_section_self_entered() [PROPOSED]

src/lib/products/entitlements.ts
 └─ getMyProductEntitlements() ──now also reads──> invoices (id, status)
```

## 6. Architectural decisions and why

1. **`/studio`'s new sections are NOT a reuse of `computeJourneyProgress()`/`JourneyTracker`.** That module is Career-specific by design (career recommendations, career applications); showing it on a page whose entire purpose is product independence would misrepresent an Abroad-only student. See `StudentJourneyOverview.tsx`'s own docblock.
2. **`/studio/career` stays a redirect to `/dashboard`.** Rebuilding it would create exactly the "second, drifting copy" risk NW03.3's own docblock warns against — see `NW05_04_CAREER_WORKSPACE.md`.
3. **Abroad-scoping is pure application code, not a new SQL view.** `isAbroadDestinationName()`/`getAbroadDestinationPreferences()` are typed against the single real `EUROPE_COUNTRIES` registry, so they cannot silently drift if that registry changes — the same discipline NW04 applied to the public Abroad flag map.
4. **The provenance-downgrade RPC is downgrade-only and proposed, never applied.** A student can only ever move their own section's provenance DOWN to `SELF_ENTERED` — there is no code path, in the SQL or in the calling TypeScript, that can move it up into a counsellor-attributed state. See `NW05_03_SHARED_PROFILE.md` and the new security-audit test for how this is verified at the source level.
5. **The entitlements fix is a pure read-side join, not a new write path.** `recompute_invoice_status()` already existed and was already correct; the fix only teaches the entitlement *reader* to actually consult it. This means the fix is strictly more restrictive than before — nothing that was previously denied can now be granted.
6. **Responsive QA for `/studio`/`/studio/career`/`/studio/abroad` is a structural (source-level) review, not a live Playwright pass.** This environment's `NEXT_PUBLIC_SUPABASE_URL` is a placeholder — these routes are both authenticated and fully data-dependent, so a live browser pass would show only redirect/error states, not real content. See `NW05_08_QA_REPORT.md` §3 for the full disclosure and the exact manual verification steps for a real staging environment.

## 7. What NW05 explicitly did not touch

- Any payment, checkout, pricing-calculation, or Razorpay-related code (the ₹1,999 GST-inclusive checkout risk remains exactly as found, untouched and unresolved).
- Any Supabase migration file under `supabase/migrations/` (only `supabase/migrations-proposed/` gained one new, unapplied file).
- Any admin/counsellor-facing page or workflow.
- `HomeHero.tsx`, the public marketing pages, or any NW04 deliverable.
