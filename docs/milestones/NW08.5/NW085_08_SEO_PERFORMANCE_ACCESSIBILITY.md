# NW08.5.9 — SEO, Performance & Accessibility Pass

## 1. Method and a standing honesty rule

Per the brief's own instruction, this document never invents a Lighthouse,
Core Web Vitals, or axe score — no such tooling was run against a live,
deployed build in this environment, and quoting a number without actually
measuring it would be exactly the kind of fabrication the brief prohibits
elsewhere (fabricated stats/rankings). Everything below is either (a) read
directly from source as a verifiable fact about the code, or (b) explicitly
marked as something that needs a real, tooled measurement this environment
cannot produce.

## 2. SEO — already largely correct, one staleness restated (not new)

- **Sitemap/robots:** `src/app/sitemap.ts` and `src/app/robots.ts` are
  real, data-backed (career/university/course entries come from live
  Supabase queries, not a hardcoded list), correctly exclude every
  authenticated/private/admin route, and both resolve against the real
  canonical production origin (`https://www.nextwise.world`).
- **Structured data:** `src/lib/seo/structured-data.ts` emits
  Organization/WebSite/BreadcrumbList JSON-LD built only from facts
  already stated elsewhere in the app (brand name, description, logo) —
  no invented founding date, address, social profiles, or review ratings.
- **Metadata:** `(site)/layout.tsx` sets a real `metadataBase`, OpenGraph
  (`type: website`, a real social-share image with explicit width/height/
  alt, `locale: en_IN`), and Twitter card metadata — all sourced from
  `src/config/site.ts`'s brand constants, not placeholder text.
- **Known staleness, already disclosed, restated rather than re-fixed in
  two places:** `NW085_01_PUBLIC_PAGE_AUDIT.md` §5 already found that
  `sitemap.ts`'s own docblock claims a site-wide blanket noindex is still
  active when `(site)/layout.tsx` shows it was removed in "M17A Step 6."
  This same stale claim also appears in `src/lib/seo/structured-data.ts`'s
  `getOrganizationJsonLd()` docblock ("The site currently ships with
  `robots: { index: false, follow: false }`... so this has no practical
  effect on search results yet"). Both are comments only — neither file's
  actual *code* depends on the stale claim, so nothing is functionally
  wrong — but both are now inaccurate prose. Per the decision already made
  for the first instance (documented, not edited, to keep this stage's
  diff limited to what the brief actually asked for), the second instance
  is recorded here rather than silently patched. A future pass correcting
  both comments together would be a trivial, genuinely zero-risk cleanup.

## 3. Performance — policy and real conventions, no measured numbers

- **Fonts:** both families (`Plus_Jakarta_Sans`, `Fraunces`) load via
  `next/font/google` with `display: "swap"` (`src/lib/fonts.ts`) — self-
  hosted at build time by Next.js, not a runtime `<link>` to
  fonts.googleapis.com, and `swap` avoids invisible-text-on-load (FOIT).
- **Images:** 8 components use `next/image` (automatic responsive
  `srcset`/format negotiation); the 9 raw `<img>` call sites found
  (`CareersHero`, `EuropeExplorerHero`, `DiscoverySessionHero`,
  `DiscoveryEntryHero`, `HowItWorksHero`, `DiscoveryPillars`) are every one
  a purely decorative hero backdrop/annotation image, each already passing
  `{...getGraphicAriaProps({ kind: "decorative" })}` and `alt=""` — a
  previously-audited, tested pattern (`hero-composition-audit.test.ts`,
  `graphics-source-audit.test.ts`), not an unreviewed gap. `next/image`'s
  main benefit (responsive srcset/format negotiation) matters most for
  content-bearing images sized by real data, which these are not.
- **Server Action body limit:** `next.config.ts` sets a deliberate,
  documented `bodySizeLimit: "12mb"` scoped to the one feature that needs
  it (the admin CSV import pipeline), not a blanket increase.
- **No code change made here.** Nothing found during this pass needed a
  performance fix; the one open, already-disclosed performance-adjacent
  item (no shared loading-skeleton primitive; ~30 dynamic routes still
  have neither `loading.tsx` nor `error.tsx`) is `NW085_DESIGN_SYSTEM.md`
  §4 / `NW085_07_AUTHENTICATED_UX_AUDIT.md` §5's finding, not duplicated
  here.
- **What would need real tooling, not claimed here:** actual Core Web
  Vitals (LCP/CLS/INP) numbers, bundle-size regression against a prior
  build, and image-weight audits of the real (non-placeholder) hero/
  detail-page assets once they exist. None of these can be honestly
  reported without running Lighthouse/`next build --profile` against a
  deployed instance, which is out of this environment's scope (no
  deploys, per the standing constraint).

## 4. Accessibility — spot-checked conventions, not a full axe sweep

- **Modals:** all three dialogs in the app (`MobileNav`,
  `ViewAllServicesDialog`, and this milestone's new `RegistrationPrompt`)
  use the native `<dialog>` element (`showModal()`/`close()`) — one
  consistent, browser-native accessible-modal pattern (built-in focus
  trap, native Escape handling, `::backdrop`, automatic focus restoration
  to the trigger on close), not three different hand-rolled
  implementations.
- **Reduced motion:** handled once, globally, in `src/app/globals.css` via
  a single `@media (prefers-reduced-motion: reduce)` rule — not
  duplicated per-component, so there is exactly one place to check (and
  one place that could drift) rather than many.
- **Decorative vs. meaningful images:** `getGraphicAriaProps({ kind:
  "decorative" })` + `alt=""` is applied consistently to every purely
  decorative image found in §3 above; `DiscoveryPillars.tsx`'s icon-style
  illustrations instead pass a real `illustrationAlt` string, showing the
  distinction is actually being made per-image, not applied blanket.
  `AdminTable`/`StatusBadge`/form `Input`/`Select` components (already
  reviewed in UX01-02/UX03-04) continue to carry `scope="col"`,
  associated `<label>`s via `FormField`, and `aria-busy`/`aria-disabled`
  where relevant.
- **New this milestone — `RegistrationPrompt.tsx`:** already built and
  documented (`NW085_06_REGISTRATION_PROMPT.md`) with explicit dialog
  semantics, focus management, Escape-to-close, and reduced-motion
  handling as first-class requirements, not retrofitted.
- **What a full pass would still need:** an automated axe-core/Lighthouse
  accessibility run against rendered pages (color-contrast-in-context,
  full keyboard-navigation walk of every interactive widget, screen-reader
  spot checks) — not performable here since this project has no jsdom/
  Testing-Library setup and no live browser session (see the inherited
  summary's note on this codebase's test infrastructure). This is a
  disclosed limitation of this audit method, not a claim that no issues
  exist.

## 5. Verification

No source files were changed in this stage (§2's staleness note is
restated, not re-edited, per the decision already made for its first
instance). `npx tsc --noEmit`, `npx vitest run`, and `npm run lint` all
still pass at the same state reported in `NW085_07`'s verification
section — not re-run redundantly here since nothing changed. Full
aggregate regression is reported once more in `NW085_09_QA_REPORT.md`.
