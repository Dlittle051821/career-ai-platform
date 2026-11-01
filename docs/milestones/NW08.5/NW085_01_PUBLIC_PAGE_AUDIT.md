# NW08.5.2 — Public Page Audit

## 0. Method and a disclosed limitation

This audit is a **source-level inspection** of every public route's real
App Router file (`src/app/(site)/**`) plus the components/data each one
renders — reading the actual code, the actual metadata exports, the
actual data sources, and the actual pre-existing test suite's own
assertions about each page. It is **not** a live, rendered browser pass:
this sandbox has no reachable Supabase project and no browser to drive
(the same disclosed constraint every milestone in this session has
carried — see `NW085_09_QA_REPORT.md` §3). Every finding below is backed
by a specific file/line of evidence, not visual inspection, and this
document says so rather than claiming otherwise.

## 1. Full public route inventory (actual App Router structure, not the brief's illustrative list)

Found under `src/app/(site)/` (the public route group) by listing every
`page.tsx`/`layout.tsx`:

/, /about, /abroad, /agreements/[id], /applications, /applications/[id],
/book-counselling, /career, /career-discovery, /careers, /careers/[slug],
/compare, /contact, /courses, /courses/[universitySlug]/[courseSlug],
/courses/compare, /discovery-session/book, /forgot-password,
/how-it-works, /login, /parents, /pay/[token], /payments,
/payments/[invoiceId], /pricing, /pricing/checkout/[slug], /privacy,
/profile/onboarding, /refund-policy, /register, /reset-password,
/roadmap, /saved, /study-europe, /study-options, /terms, /trust,
/universities, /universities/[slug], /welcome, plus the route-group
`not-found.tsx` (404).

**Two real routes the brief's own illustrative list omitted**, found only
by actually inspecting the tree rather than relying on the brief's list
(exactly what the brief's own §05 instruction asks for): `/study-europe`
(the real "Country Explorer" detail page `/abroad` links out to — see §5
below) and `/agreements/[id]` (a private, signature-related detail page,
already noindexed and outside this audit's public scope).

## 2. Nav/IA — see NW085_02_NAVIGATION_ARCHITECTURE.md

Covered in its own document: the six-item primary nav, the
`WorkspaceEntryLink`, `SECONDARY_NAV`/`FOOTER_NAV`, and the removal of
`ExploreMenu.tsx`/`NavDropdown.tsx`. Not repeated here.

## 3. Per-page findings

Severity key: **P0** security/privacy/checkout/misleading-critical,
**P1** broken/seriously confusing, **P2** important UX weakness, **P3**
minor polish. A page with no findings below has none at this severity
threshold — it was inspected, not skipped.

### `/` (Home)
Covered in `NW085_03_HOMEPAGE_REDESIGN.md`. **P2 (fixed):** hero headline/
support copy didn't match the brief's exact required text; hero had no
search affordance. **Status: fixed this milestone.**

### `/careers` (Explore Careers)
Real server-side search (`searchCareers()`), no login required, no match
percentages/fabricated stats (`CareerInsightsPanel.tsx`'s own docblock
documents this as a deliberate, pre-existing rule). Canonical is static
regardless of filter/query params (`M17A Step 5`). **No findings.**

### `/career` (Career Intelligence)
Front-door/landing page composing existing routes; explicitly frames
itself as distinct from `/careers` per its own docblock. Does not present
unimplemented AI recommendations as live — the real recommendation engine
(`src/lib/recommendations/`) exists and is used by `/compare` and
`/dashboard` for signed-in students with profile data, which is real
functionality, not NW09's separate future AI-counsellor integration (a
distinct, not-yet-started capability named explicitly in this milestone's
brief as out of scope). **No findings.**

### `/abroad` (Study Abroad / Nextwise Abroad)
Reads `EUROPE_COUNTRIES` directly from `src/data/europe-explorer.ts` — the
single canonical six-country (Germany, Ireland, Netherlands, France,
Sweden, Denmark) registry also used by `/study-europe` and the homepage's
`TrustedStudyExplorer`. No USA/UK/Canada/Australia anywhere in rendered
output. States plainly it "works standalone — no career discovery sign-up
needed." **No findings.**

### `/study-europe` (Country Explorer — the real destination-detail page `/abroad` links to)
Every official-source link (`src/data/europe-explorer.ts`) is a directly
verified government/education-authority URL for one of the six countries
— not fabricated, not routed through a DB table that only covers two of
them (a deliberate architecture decision recorded in `TrustedStudyExplorer.tsx`'s
own docblock). **No findings.**

### `/universities`, `/courses`
Real search + filters against the education database; `LaunchCountryDiscovery`
scoped to `LAUNCH_COUNTRY_CODES` (the separate, pre-existing M20 global
six-country registry — DE/GB/US/CA/AU/IE — which is NOT the same list as
the Abroad/Europe six and is explicitly, correctly documented as such in
`TrustedStudyExplorer.tsx`'s own docblock: "a different, GLOBAL set"). No
invented tuition/rankings/scholarships. **P3:** the M20 global registry's
inclusion of US/UK/Canada/Australia here is correct and pre-existing (this
page is a global course/university search, not the Europe-only Abroad
product), but worth stating explicitly in this audit so a future reader
doesn't mistake it for a violation of the six-country Abroad rule — it
isn't; the two registries serve two different, correctly-scoped products.

### `/compare`, `/courses/compare`
Already permanently noindexed with a static canonical (`M17A Step 5`) as
a documented, intentional crawl-trap mitigation — correct, matches the
brief's own "clean query-param handling" requirement. Honest empty states
(`GuidanceNotice`); no fabricated occupational stats. **No findings.**

### `/career-discovery`
Explicitly, prominently labelled as a preview: "This page previews how
future career discovery will work. It does not run a live assessment
yet — what you see is a structural preview, clearly labelled," plus a
`DemoNotice` repeating that the full scored engine is still in
development and the interactive quiz "does not score or store anything."
Exactly the honesty standard the brief asks for. **No findings.**

### `/study-options`
Explicit "not marketing claims" framing in its own metadata description;
uses `DemoNotice`, no invented costs/probabilities. **No findings.**

### `/how-it-works`
Rebuilt against an approved reference in UX10-HW01; keeps the real HOME_FAQS
data; dual-pathway presentation without forcing either. **No findings.**

### `/pricing`
Preserves the real, approved "Nextwise Verified is ₹1,999" pricing from
`listPublicPricingPlans()`/the real plan catalogue — not altered or
hardcoded by this milestone. Checkout is not activated by anything in
this milestone. Explicitly states "does not guarantee admission,
scholarships, visas, employment or immigration outcomes." **The known
financial-safety issue is restated, not resolved, per §6 below.**

### `/about`
**P2 (fixed):** the page's own "what's live today" disclosure had gone
stale — it still said "Milestone 1 build... frontend-only interactions,"
which understates how much of the site is now genuinely functional
(real accounts, applications, payments, counselling). Fixed this
milestone to describe the real current state while keeping the one
disclosure that is still accurate: a student-facing AI recommendation
engine is not yet live. No fabricated founder bios — explicitly refuses
to invent any ("We won't invent founder biographies or credentials").

### `/book-counselling`
Rebuilt in UX10-DS02 specifically to replace a prior version whose
success state admitted the submission "was not transmitted, booked, or
stored anywhere" — the real, database-backed booking flow now lives at
`/discovery-session/book`, and this page is an honest landing that sends
visitors there rather than running its own fake form. **No findings.**

### `/trust`
Uses `TrustBadge`/`ComingSoon`/`DemoNotice` components that explicitly
distinguish confirmed vs. pending-verification information (per the
brief's own requirement for this exact page) rather than asserting
blanket trust claims. **No findings.**

### `/contact`
**P1 (fixed):** `CONTACT.emailLabel` was `"hello@nextwise.example
(placeholder)"` — an RFC 2606 reserved "example" domain presented on a
real page as a contact method, exactly the fabricated-looking business
email the brief explicitly prohibits. Fixed this milestone: now reads
"Email support — coming soon," the same honest treatment already used
for phone and the physical office on the same page.

### `/parents`
Explicit fraud-warning-signs section, no invented cost figures (`COST_PLANNING_FRAMEWORK`
is a framework/checklist, not fabricated numbers), `ComingSoon` used
honestly. **No findings.**

### `/login`, `/register`, `/forgot-password`, `/reset-password`
Each independently carries its own permanent `robots: { index: false,
follow: false }` (page-level metadata, not relying solely on the
now-removed site-wide blanket noindex — see §6). Real Supabase Auth, no
second auth system. Safe-redirect validation (`getSafeRedirectPath`)
already in place. **No findings.**

### `/welcome`
Independently noindexed; redirect-protected via `PROTECTED_PATHS` as
defense in depth; "LOCKED requirement: never a mandatory long profile
form" honored per its own docblock. **No findings.**

### 404 (`not-found.tsx`)
Independently noindexed, honest copy, two real recovery links (home,
book counselling). **No findings.**

### `/discovery-session/book`, `/applications*`, `/payments*`, `/saved`, `/profile/onboarding`, `/roadmap`, `/pricing/checkout/[slug]`, `/pay/[token]`, `/agreements/[id]`
Authenticated/private; all independently excluded from the sitemap and
disallowed in `robots.ts` (confirmed by reading both files directly, not
assumed). Out of this public-page audit's scope by design; any UX
findings for these belong in `NW085_07_AUTHENTICATED_UX_AUDIT.md`.

## 4. Cross-cutting content findings, fixed this milestone

| # | Finding | Severity | Page(s) | Fix |
|---|---|---|---|---|
| 1 | Primary nav exposed four grouping labels ("Products"/"For Students"/"Resources"/"About") the brief explicitly asks to remove, via three independently-maintained arrays rather than one config | P1 | sitewide | `NW085_02_NAVIGATION_ARCHITECTURE.md` |
| 2 | Fabricated-looking placeholder business email (`hello@nextwise.example`) presented as a contact method | P1 | `/contact`, footer | Removed; honest "coming soon" copy |
| 3 | Homepage hero headline/support copy didn't match the brief's exact required text; no functional search in the hero | P2 | `/` | `NW085_03_HOMEPAGE_REDESIGN.md` |
| 4 | `/about`'s "what's live today" disclosure was stale, understating real functionality | P2 | `/about` | Updated to the real current state |

No P0 finding was identified anywhere in the public site during this
audit.

## 5. A documentation accuracy note (self-caught during this audit, not a code change)

`src/app/sitemap.ts`'s own docblock states the site-wide blanket noindex
from `src/app/(site)/layout.tsx` is still in effect ("Submitting this
sitemap to Search Console before that blanket noindex is lifted will
correctly show every URL as Excluded by noindex tag"). Reading
`layout.tsx` itself shows this is **stale**: that blanket noindex was
already removed in a step labelled "M17A Step 6 — the controlled
indexability release," and `layout.tsx`'s own `metadata` export carries
no `robots` field at all today, meaning the site's real current state is
the default indexable one (subject to every route's own independent,
correctly-scoped `robots` override — auth pages, `/welcome`, `/compare`,
`/courses/compare`, 404, all confirmed still independently noindexed per
§3 above). This is a pre-existing stale comment in `sitemap.ts`, not a
behavior bug — nothing in this milestone changes indexability — but it's
recorded here so a future reader does not mistakenly believe the site is
still blanket-noindexed. Left as a documentation note rather than edited
in place, since `sitemap.ts`'s own code is correct and unaffected; see
`NW085_08_SEO_PERFORMANCE_ACCESSIBILITY.md` for the full SEO state.

## 6. Known, pre-existing risks restated (not resolved) per this milestone's own instruction

1. **Nextwise Verified ₹1,999 GST/checkout risk.** `src/lib/pricing/plan-purchase-tax.ts`'s
   own docblock confirms the root cause in detail: the live Postgres
   `purchase_pricing_plan()` function computes tax on top of every plan's
   price once GST is configured (`billing_settings.gst_registered`),
   regardless of that plan version's own `tax_status` column — so a
   `tax_status = 'unconfigured'` plan (the real seeded Nextwise Verified
   plan) would be overcharged (₹1,999 → ₹2,358.82 at 18% GST) the moment
   GST is turned on, unless the already-written, already-reviewed
   proposed migration (`supabase/migrations-proposed/
   NW01_fix_purchase_pricing_plan_tax_handling.sql`) is approved and
   applied first. That migration remains unapplied. GST does not appear
   to be configured in this environment today, so the bug is currently
   dormant, not actively overcharging anyone — but it is a live landmine,
   not a fixed issue, and nothing in this milestone touches checkout code
   or applies that migration.
2. **NW07's proposed counsellor-studio migration** remains unapplied;
   nothing built in NW08.5 depends on it.
3. **NW05–NW07 migration state** generally remains as NW08's own audit
   left it — unverified against a real production database in this
   sandbox (no reachable Supabase project here).

## 7. What this audit did not do

It did not run a live browser against any page, did not sign in as any
role, and did not pixel-verify any breakpoint — see §0 and
`NW085_09_QA_REPORT.md` §3 for the full disclosed limitation and the
manual verification steps a real environment should run.
