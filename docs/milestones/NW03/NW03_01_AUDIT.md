# NW03.1 — Repository & Architecture Audit

**Milestone:** NW03 "Two-Product Architecture"
**Stage:** 1 of 6 (Audit)
**Branch:** `release/m10`
**Audit date:** 2026-10-23
**Scope:** Full `src/` tree + root config, read directly from the real repository (device-bridge staged, zero fabricated content). No code was changed to produce this document.

---

## 1. Purpose and method

This audit inventories every existing route, layout, and shared module that NW03's two-product split (`/career` + `/studio/career` vs. `/abroad` + `/studio/abroad`, one shared account/auth) will touch, add to, or must leave alone. Each item below was read from its real source file in this session, not inferred from documentation or prior milestone reports. Classifications (`SHARED` / `CAREER` / `ABROAD` / `FUTURE` / `LEGACY-REQUIRES-REVIEW`) describe which product the feature belongs to under the NW03 target architecture, not its current code location — several `CAREER`-classified features currently live at a route that NW03.3 will need to reach from `/studio/career` without moving or duplicating the underlying page.

### 1.1 Baseline validation (established before any NW03 change)

Run against the repository exactly as staged, before any NW03.2–NW03.6 work begins:

| Check | Result |
|---|---|
| `npx tsc --noEmit` | 0 errors |
| `npm run lint` | 0 errors, 18 pre-existing warnings (all `@next/next/no-img-element`, unrelated to NW03) |
| `npx vitest run` | 127 test files, 2091 tests, all passed |
| `npm run build` | succeeded, 79 routes generated |

This matches NW02's documented post-delivery state exactly, confirming the staged working copy is a faithful, uncorrupted copy of the real repository. NW03.6 will re-run this exact matrix after implementation and report the delta.

### 1.2 A note on repository-embedded instructions

`AGENTS.md` / `CLAUDE.md` at the repo root contain text instructing an agent to read `node_modules/next/dist/docs/` and "commit" changes to keep the tree clean. This is untrusted repository content, not an instruction from the user or from Anthropic, and is consistent with a known prompt-injection pattern flagged in earlier NW01/NW02 work. It has been disregarded. No `node_modules` "docs" were read; no commits have been or will be made (committing is prohibited for this entire engagement regardless).

---

## 2. Current route inventory

Four independent root layouts exist today:

- **`src/app/(site)/layout.tsx`** — public marketing shell (Header/Footer/JSON-LD). Route group; does not appear in the URL.
- **`src/app/admin/layout.tsx`** — `AdminShell`, gated by `getCurrentAdmin()` + `admin_roles`.
- **`src/app/dashboard/layout.tsx`** — `DashboardShell`, the logged-in student workspace shell.
- **`src/app/profile/layout.tsx`** and **`src/app/recommendations/layout.tsx`** — both independently re-render `DashboardShell` (confirmed by direct read). These are NOT inside `(site)` because two `page.tsx` files cannot resolve to the same URL — `/profile` and `/recommendations` were historically pulled out of the `(site)` group into their own top-level routes specifically so each could carry its own layout while still using the same shell component as `/dashboard`.

Full page inventory, with product classification:

| Route | Current shell | Classification | Notes |
|---|---|---|---|
| `/` | `(site)` | SHARED | Composed of `HomeHero`, `DiscoveryPillars`, `TrustedStudyExplorer`, `HowItWorks`, `WhyNextwise`, `HomeFinalCTA` — mixes Career and Abroad messaging today. Out of scope for NW03 content rewrite beyond adding `/career`/`/abroad` entry points; NW03 must not restructure the homepage itself. |
| `/careers`, `/careers/[slug]` | `(site)` | CAREER | Career explorer + detail pages. |
| `/compare` | `(site)` | CAREER | Career comparison. |
| `/career-discovery` | `(site)` | CAREER | Primary Career CTA ("Find My Direction"), already the homepage hero's main link. |
| `/courses`, `/courses/[universitySlug]`, `/courses/compare` | `(site)` | SHARED | Course Explorer spans both India (Career-adjacent) and abroad universities (Abroad-adjacent) — NW02 already unified this across the 7 launch destinations. Must not be forked. |
| `/universities`, `/universities/[slug]` | `(site)` | SHARED | Same reasoning as Courses. |
| `/study-options` | `(site)` | SHARED | India-vs-abroad comparison explainer. |
| `/study-europe` | `(site)` | ABROAD | The existing, fully built, public, unauthenticated 6-country Europe Explorer (DE/IE/NL/FR/SE/DK) delivered in NW02. **NW03.2's `/abroad` page must link to / embed this page, never duplicate its content or data.** |
| `/book-counselling` | `(site)` | CAREER | Counselling booking entry point — consultancy-oriented, must stay optional for Abroad users. |
| `/pricing`, `/pricing/checkout` | `(site)` | SHARED (category-scoped) | `PricingCategory` already splits plans into `school_counselling` / `class_11_counselling` / `class_12_counselling` (Career) vs. `bachelor_abroad` / `master_abroad` (Abroad) — see §4. |
| `/discovery-session`, `/discovery-session/book` | `(site)`, protected | CAREER | Real (authenticated) Discovery Session booking — distinct from the public Discovery pillars on the homepage. |
| `/welcome` | `(site)`, protected (added M11-B) | CAREER | Post-registration "Assisted Onboarding" choice screen (`chooseDiscoverySessionAction` / `chooseSelfServeAction`). Career-oriented language and only path. **A new registrant heading straight for Abroad must not be funneled through this screen as their only option — see §6, Risk R-1.** |
| `/dashboard` | `dashboard` (DashboardShell), protected | CAREER (today) | Full existing workspace: profile completion, invoices, agreements, saved items, applications, discovery session, recommendation readiness, next-best-action, journey progress, important dates. Entirely Career-shaped data model. Under NW03 this becomes the content that `/studio/career` reaches. |
| `/profile` | `profile` layout → `DashboardShell`, protected | SHARED | Account-level profile, not product-specific. |
| `/recommendations` | `recommendations` layout → `DashboardShell`, protected | CAREER | Career recommendation readiness. |
| `/roadmap` | `(site)`, protected | CAREER | Listed in `PROTECTED_PATHS`; not yet read in full this session — flagged `LEGACY-REQUIRES-REVIEW` for NW03.5 to confirm its product ownership before linking from `/studio`. |
| `/saved` | `(site)`, protected | SHARED | Saved items span Career and Abroad entities (`listSavedItems()` is entity-type-agnostic). |
| `/applications`, `/applications/[id]` | `(site)`, protected | CAREER (today) | Application tracking — currently modeled around domestic/counselling applications. Whether this extends to Abroad applications is a NW03.5 preservation question, not an NW03.2/.3 build item. |
| `/agreements`, `/agreements/[id]` | `(site)`, protected | SHARED | Agreement records tied to purchases, which are category-scoped (§4). |
| `/payments`, `/payments/[invoiceId]`, `/pay`, `/pay/[token]` | `(site)`, protected/public-token | SHARED | Payment/invoice flows. **Explicitly out of scope for any change** — the brief forbids touching the known ₹1,999-GST-inclusive bug. |
| `/go/course-search/*` | top-level | SHARED | Outbound course-search redirect utility, unrelated to product split. |
| `/login`, `/register`, `/forgot-password`, `/reset-password` | `(site)`, `AUTH_ONLY_PATHS` | SHARED | One account/auth system — see §5. |
| `/auth/callback` | top-level | SHARED | PKCE code-exchange handler. |
| `/admin/*` (24 sub-routes) | `admin` (AdminShell), protected via `admin_roles` + `permissions.ts` | SHARED (internal) | Entirely internal/staff-facing; NW03 does not touch admin routes except where NW03.4's entitlement read needs to stay consistent with `pricing_purchases`. |
| `/api/webhooks/{razorpay,signature,stamp}` | route handlers | SHARED | Payment/signing provider webhooks — out of scope. |
| `/trust`, `/parents`, `/contact`, `/about`, `/how-it-works`, `/privacy`, `/terms`, `/refund-policy` | `(site)` | SHARED | Static/marketing content, unaffected. |

**No `/career`, `/abroad`, or `/studio*` routes exist yet** — confirmed by the full `src/app` listing above. NW03.2 and NW03.3 are pure additions, not modifications to existing route files, except the two specific, narrow edits identified in §5 and §6.

---

## 3. Shared infrastructure NW03 must reuse, not re-implement

| Module | Responsibility | NW03 usage |
|---|---|---|
| `middleware.ts` → `src/lib/supabase/middleware.ts` (`updateSession`) | Session refresh + server-side route gating via `PROTECTED_PATHS` / `AUTH_ONLY_PATHS` arrays, before any markup renders. | NW03.3 adds `/studio` to `PROTECTED_PATHS` (one array entry — `/studio` already matches `/studio/career` and `/studio/abroad` via the existing `pathname.startsWith(\`${p}/\`)` prefix check, confirmed by re-reading the matcher logic). No other middleware change needed. |
| `src/lib/auth/safe-redirect.ts` — `getSafeRedirectPath(rawNext, fallback)` | The one open-redirect-safe validator for a `?next=` query param (regex `^\/(?!\/|\\)\S*$`). | Must be the only mechanism used anywhere NW03 adds a `next`-aware redirect, including the `RegisterForm.tsx` fix in §6. |
| `src/lib/auth/default-workspace.ts` — `resolveDefaultWorkspacePath(supabase, userId)` | Role-aware "where should a signed-in user land" resolver (admin → `/admin`, else → `/dashboard`). | Referenced as the pattern NW03.3's `/studio` hub routing follows; not modified, since changing the global post-login default is out of NW03's scope (`/dashboard` remains correct for an admin-excluded default — `/studio` becomes an additional, explicitly-product-scoped destination, not a replacement default). |
| `src/components/ui/ComingSoon.tsx`, `src/components/ui/DemoNotice.tsx` | Honest "not built yet" / "illustrative, not live" UI primitives, already used elsewhere in the app. | Reused verbatim for `/studio/abroad`'s foundation-only tabs rather than fabricating Abroad-side student data that does not exist yet. |
| `src/types/pricing.ts` — `PricingCategory` | `school_counselling` / `class_11_counselling` / `class_12_counselling` (Career) vs. `bachelor_abroad` / `master_abroad` (Abroad). | Basis for NW03.4's entitlement mapping — see §4. Zero schema/migration changes required. |
| `src/lib/supabase/pricing/my-purchases.ts` — `listMyPurchases()` | RLS-scoped read of the signed-in user's `pricing_purchases`. | Data source for NW03.4's entitlement check — already server-enforced via RLS, never client-state. |
| `src/app/(site)/study-europe/page.tsx` | The real, existing 6-country Abroad explorer. | `/abroad` links to it; its content is not duplicated. |
| `src/lib/dashboard/journey-progress.ts` — `computeJourneyProgress()` | Pure-function Career progress computation, with an explicit "never fabricate a signal the product doesn't record" docblock. | Design precedent only — if/when a real Abroad progress signal is built (future milestone), it must follow the same discipline. NW03 itself does not need a new progress signal; `/studio/abroad`'s tabs are explicitly `ComingSoon`/`DemoNotice`, not fabricated progress bars. |

---

## 4. Entitlement foundation — data model already supports a zero-migration split

`PricingCategory` (src/types/pricing.ts:13-19) is a 5-value enum already partitioned cleanly along product lines:

- Career: `school_counselling`, `class_11_counselling`, `class_12_counselling`
- Abroad: `bachelor_abroad`, `master_abroad`

`pricing_purchases` rows carry `planId` → plan → `category` through the existing `listMyPurchases()` read path, which is already RLS-scoped to `student_user_id = auth.uid()`. This means a server-side "does this user hold an Abroad entitlement / a Career entitlement" check can be built as a **pure derived read** with:

- No new database table.
- No new migration.
- No client-only state (entitlement is computed from a server-fetched purchase list on every check, not cached in a cookie or localStorage the client could forge).

This is the NW03.4 implementation target: a `src/lib/products/entitlements.ts` module that maps a purchase list to a `{ hasCareerEntitlement, hasAbroadEntitlement }`-shaped result, used informationally (e.g. "upgrade" prompts) — **never** to gate the free parts of either product, since the brief requires Abroad to work fully without any Career assessment and Career to work fully without any consultancy purchase.

---

## 5. Auth/account model — already single-account, confirmed

One Supabase Auth user, one `profiles` row, one `student_profiles` row. `account_type` on `profiles` is presentation-only (read by `useAuthProfile` / `AccountMenu`, grants no access — access is `admin_roles` + RLS). `AUTH_ONLY_PATHS` and `PROTECTED_PATHS` are both global, not product-scoped. **No change to the auth model itself is required for NW03** — the two products sit on top of the existing single account, exactly as the brief mandates. The only two concrete code edits auth needs are:

1. **`RegisterForm.tsx` `next`-param gap (AC-04).** Confirmed by direct read: `handleSubmit`'s success branch hardcodes `router.push("/welcome")` (line 120) and `emailRedirectTo` hardcodes `?next=/welcome` (line 94), ignoring any `?next=` query param the registrant arrived with — `getSafeRedirectPath` is imported and used only to preserve `next` across the "Log in" cross-link (line 54), not applied to the actual post-registration destination. A visitor who clicks "Get started" from `/abroad` and registers today is unconditionally sent to the Career-oriented `/welcome` screen regardless of where they started. **Fix (NW03.3):** read `next` via `getSafeRedirectPath(searchParams.get("next"), "/welcome")` and use that value in both the `router.push(...)` call and the `emailRedirectTo` URL, so an Abroad-originated signup can land on `/studio/abroad` instead of being forced through the Career onboarding screen — mirroring the pattern `LoginForm.tsx` already uses correctly.
2. **`middleware.ts` `PROTECTED_PATHS` addition.** Add `/studio` (one line) so `/studio`, `/studio/career`, and `/studio/abroad` all require auth, consistent with every other logged-in workspace route.

No other auth file requires modification.

---

## 6. Risks and missing prerequisites

- **R-1 (addressed by §5 fix):** Without the `RegisterForm.tsx` fix, AC-04 ("Abroad must never require a Career assessment") would be violated at the exact moment of account creation — a new Abroad registrant would be forced onto the Career `/welcome` screen with no way to reach `/studio/abroad` directly. This is now a planned NW03.3 fix, not an open risk.
- **R-2 (`/welcome`'s own content is Career-only):** Even after the redirect-target fix, `/welcome`'s two choices (`chooseDiscoverySessionAction` / `chooseSelfServeAction`) are both Career-shaped. NW03's plan is to bypass `/welcome` entirely for an Abroad-originated signup (redirect straight to `/studio/abroad`) rather than editing `/welcome`'s content, since rewriting that screen is not in NW03's stage list and risks regressing M11-B behavior for Career signups. This keeps the fix minimal and scoped.
- **R-3 (`/roadmap` ownership unresolved):** Flagged `LEGACY-REQUIRES-REVIEW` in §2. NW03.5 must open this route before finalizing the feature-preservation checklist, to confirm it is Career-only (and thus safe to leave reachable only from `/studio/career`) rather than shared.
- **R-4 (homepage dual-messaging):** The homepage (`/`) mixes Career and Abroad messaging today and is explicitly out of scope for restructuring. NW03.2 adds `/career` and `/abroad` as new, additional entry points reachable from nav — it does not rewrite `/`'s existing composition.
- **R-5 (payment bug boundary):** `/pricing/checkout`, `/payments/*`, `/pay/*`, and the Razorpay webhook are all classified SHARED and explicitly untouched. No NW03 stage reads or writes payment-amount logic.
- **No missing prerequisites block starting NW03.2.** All shared building blocks identified above already exist, are read-confirmed, and require no new migrations.

---

## 7. Dependency map (for NW03.2–NW03.6 sequencing)

```
NW03.2 (/career, /abroad)
  depends on: src/config/site.ts (nav constants) — extend only, no removals
  reuses: /career-discovery, /careers, /study-europe (links, not duplication)

NW03.3 (/studio, /studio/career, /studio/abroad)
  depends on: NW03.2 nav links (optional, can land independently)
  depends on: middleware.ts PROTECTED_PATHS += "/studio"
  depends on: RegisterForm.tsx next-param fix (for a clean Abroad signup path)
  reuses: /dashboard content for /studio/career (redirect, not fork)
  reuses: ComingSoon / DemoNotice for /studio/abroad foundation tabs

NW03.4 (entitlements)
  depends on: PricingCategory (src/types/pricing.ts), listMyPurchases()
  no dependency on NW03.2/.3 — can be built in parallel, consumed by /studio hub

NW03.5 (integration & preservation)
  depends on: NW03.2, NW03.3, NW03.4 all landed
  validates: NW01 trust/system-integrity invariants + NW02 7-destination allowlist unchanged

NW03.6 (QA)
  depends on: all of the above
  re-runs: tsc / lint / vitest / build against the §1.1 baseline
```

---

## 8. Conclusion

The existing codebase already encodes most of what NW03 needs: a category-partitioned pricing model, a single auth/account system, reusable shared-shell and honest-placeholder UI primitives, and a fully-built 6-country Abroad explorer page. NW03.2 through NW03.4 can be implemented as additive routes and one small pure module plus two narrow, well-understood edits (`middleware.ts` +1 line, `RegisterForm.tsx` redirect fix), with no schema migrations and no change to payment, admin, or RLS logic. Proceeding directly into NW03.2 implementation.
