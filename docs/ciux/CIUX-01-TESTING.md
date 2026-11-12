# CIUX-01: Testing evidence (deliverable H)

Runs were made in a Linux container on a copy of the tree identical to cc26 `8659828`, with production builds (`next build` + `next start`) of the baseline (port 3030) and CIUX-01 (port 3031) side by side, against a local disposable Supabase stack (no QA or production project used). The owner's Finish script repeats the static checks on Windows before committing.

## Automated suites

| Check | Result |
|---|---|
| Vitest, full suite | **181 files, 3129 passed, 1 skipped, 0 failed** |
| New tests `src/config/ciux-navigation.test.ts` | 20 passed (contact values and links, single source, no unapproved claims, demo form gone, nav routes exist, required destinations, no lost NW08.5 link, no resume link, single active item, button variants and sizes, coral/navy tokens, no purple, reduced motion) |
| TypeScript `tsc --noEmit` | 0 errors |
| ESLint `src` | 0 errors; 18 warnings, identical to baseline (all pre-existing `<img>` warnings) |
| `next build` | Succeeds |

### Tests changed on purpose (superseded, not weakened)

| Test | Old assertion | New assertion | Why |
|---|---|---|---|
| `config/site.test.ts` | `CONTACT.emailLabel` contains no "@" | equals exactly the two approved addresses | Owner approved real addresses in CIUX-01 |
| `lib/navigation/nw04-public-website-audit.test.ts` (2 tests) | Header and MobileNav map `MAIN_NAV_ITEMS` as a flat row | Header uses `NavMenus`, MobileNav uses `MobileNavGroups`, both map `NAV_GROUPS`; still no legacy dropdowns | Brief asks for grouped dropdowns; the "one shared source" rule is kept, and "no lost link" is now asserted in the new test file |
| `lib/home/v54/v54.test.ts` | page returns only `<NextwiseV54Home />` | page renders `<NextwiseV54Home />` then `<QuickExplore />` | Brief asks for Quick Explore on the homepage |
| `components/sections/cta-section-background-prop.test.ts` | CTA outline button uses `!text-on-primary` | CTA uses `outline-inverse`, whose class line has white text and no `text-primary` | Same intent (label readable on the band) via a real variant |
| `components/sections/cc24-v54-baseline-hashes.json` | 39 pins from a1017b9 | 4 pins re-computed: `page.tsx`, `NextwiseV54Home.tsx`, `V54Account.tsx`, `v54.test.ts`; 35 unchanged | Documented in the guard test's header |

## Homepage preservation

Script: `homecmp.cjs`. Reduced motion, 8 scroll positions, desktop 1440×900 and iPhone 13, header strip masked (its menu contents changed by design), pixel threshold 8/255.

| Viewport | Story frames | Pixels differing | Story DOM (header removed) |
|---|---|---|---|
| Desktop | 7 of 7 inside the story | 0 (one frame max delta 1/255, under threshold) | Identical length (59,319 chars) |
| iPhone 13 | 6 of 6 inside the story | 0 | Identical length (58,306 chars) |

The remaining frames differ only because the page is taller: they show the new QuickExplore section and the new footer. No console errors on either build. The N intro, chapter scenes and their CTAs are untouched (the engine, chapters, tour and scene code under `lib/home/v54` and the V5.4 stylesheets are unchanged; only `v54.test.ts` in that folder was edited, as listed above).

## Navigation behaviour

Script: `interact.cjs`, run on the homepage and on `/careers`, desktop and iPhone 13. **38 of 38 passed**:

- Enter opens a menu; the panel is visible and inside the viewport.
- Arrow Down moves focus into the panel; arrow keys in the panel do not scroll the page or move homepage chapters.
- Escape closes and returns focus to the trigger; outside click closes.
- Mouse hover opens and leaving closes; hover then click keeps it open.
- A menu link navigates and the menu is closed afterwards.
- Mobile: menu opens, groups toggle, all rows at least 44 px, the free session CTA is present, no horizontal overflow, Escape closes.

## Responsive and accessibility matrix

Script: `matrix.cjs`. 23 public routes × 360/390/768/1024/1440 px = 115 checks per build. axe-core rules wcag2a, wcag2aa, wcag21aa, wcag22aa at 390 and 1440 px.

| | Baseline | CIUX-01 |
|---|---|---|
| Horizontal overflow | 0 | 0 |
| axe violations (nodes) | 132 (colour contrast) | **0** |
| Header/footer targets under 24 px | 6 per mobile page (footer links 18 px) | 0 |

## Performance (before → after)

Script: `perf.cjs`, median of 3 loads, local production builds, gzip sizes of loaded JS and CSS.

| Page | Device | LCP ms | CLS | JS gz KB | CSS gz KB |
|---|---|---|---|---|---|
| `/` | desktop | 664 → 588 | 0.127 → 0.127 | 237.6 → 238.0 | 30.4 → 32.5 |
| `/careers` | desktop | 520 → 628 | 0.004 → 0.003 | 241.1 → 244.4 | 30.4 → 32.5 |
| `/contact` | desktop | 152 → 140 | 0.004 → 0.003 | 236.6 → 238.0 | 30.4 → 32.5 |
| `/pricing` | desktop | 500 → 544 | 0.004 → 0.003 | 237.2 → 239.6 | 30.4 → 32.5 |
| `/how-it-works` | desktop | 324 → 408 | 0.004 → 0.003 | 234.3 → 236.8 | 30.4 → 32.5 |
| `/` | mobile | 456 → 484 | 0.026 → 0.026 | 236.6 → 237.0 | 30.4 → 32.5 |
| `/careers` | mobile | 424 → 364 | 0 → 0 | 233.3 → 235.7 | 30.4 → 32.5 |
| `/pricing` | mobile | 440 → 276 | 0 → 0 | 237.2 → 239.6 | 30.4 → 32.5 |

Reading: JS grows by 0.4–3.3 KB gzip (the menu components), CSS by 2.1 KB gzip. LCP differences go both ways and are within run-to-run noise on a local machine; CLS is unchanged. The added Sora font is one more web font request; it is preloaded by `next/font`.

## Protected work

- None of the 45 CC-18 protected files changed (checked against the CC-18 manifest).
- No file under Supabase schemas or migrations, RLS, auth/session, counsellor authorization, entitlements, payments, billing, checkout, invoices, e-mail delivery or environment variables changed (checked by path).
- Payments and paid AI remain off (`cc22b-payments-off.test.ts` passes).

## Not done here

- Real-device testing (iOS Safari, Android Chrome) and screen-reader passes (VoiceOver, NVDA): recommended before release.
- Lighthouse on the deployed preview: run after the owner deploys the branch to a preview.
