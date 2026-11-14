# NEXTWISE UI/UX reference register

One record per page: the **currently approved** design only. When the owner approves a new design
for a page, its record is replaced, and the old one moves to the history at the end.

Reference videos and screenshots are **visual requirements**. They don't replace the source code
or a technical specification: the source at the recorded commit is the authority, and the
screenshots show what it renders.

**Approved design version for every row: V5.6.3.**
- Source: tag `nextwise-ui-v563-approved`, commit `893d816`.
- Reference deployment: https://nextwise-world-58p81wrss-nextwise.vercel.app/.
- Screenshots (in `docs/ui-reference/pages/`) were captured from a production build of `893d816`
  in Linux Chromium: viewports 1440 × 900 and 390 × 844, homepage after 6.5 s, other pages after
  1.8 s.

## Record format (copy for a new or changed page)

| Field | Value |
|---|---|
| Page name | |
| Route | |
| Reference video | filename (+ SHA-256) or link |
| Desktop screenshot | `docs/ui-reference/pages/<page>-1440.webp` |
| Mobile screenshot | `docs/ui-reference/pages/<page>-390.webp` |
| Approved design version | e.g. V5.6.3 |
| Source commit or worktree | full SHA, plus branch or worktree path |
| Interaction description | what the visitor can do, and what responds |
| Animation timing requirements | durations and delays, and the reduced-motion behaviour |
| Responsive behaviour | breakpoints and what changes at each |
| Accessibility expectations | landmarks, headings, keyboard, focus, contrast, axe result |
| Functional dependencies | data sources, auth, feature flags, APIs |
| Approval status | Proposed / Approved (by whom, date) / Superseded |

## H. Homepage `/` (full record)

| Field | Value |
|---|---|
| Reference video | `nextwise-v563-home-reference-1440.mp4` (SHA-256 `252a19ee1eef57b30a93f298232ab69ff2340d13f6d1d8f6437dbf19f7d7da0a`) and `nextwise-v563-home-reference-390.mp4` (`e5fd0f4043d15443a92e82650cc6731b711f4a00c00287f6ba59271bcd7b8a8e`), kept in the baseline kit (`C:\ClaudeBuilds\Milestones\NEXTWISE-UI-V563-BASELINE-LOCK\reference-video\`) |
| Screenshots | `pages/home-1440.webp`, `pages/home-390.webp`; frame-accurate checkpoints in `tests/visual/__baseline__/home-0*-*.png` (3 viewports) |
| Approved design version | V5.6.3 |
| Source commit | `893d816` (`feature/v563-career-intelligence-refinement`) |
| Interaction | The opening animation plays automatically: the original N reveal, then the hero "Too many choices. One clearer direction." One wheel, swipe or key press moves exactly one chapter: hero → Two Pathways → Career Intelligence → Study Abroad → Student Studio → How we guide you → Your next step. Two Pathways: Discovery → `/career-discovery`, Clarity → `/courses`. Career Intelligence tabs: Robotics & Autonomous Systems Engineer (default), Climate & Energy Systems Engineer, Space Systems Engineer; "Explore Career Paths" → `/careers`, the profile link → `/careers/<slug>`. |
| Animation timing | Scroll input is held for the first 4.2 s of the intro (`INTRO.holdScroll` 4200 ms; fast-forward until 5200 ms). A chapter transition plays about 1150 ms per 0.95 scroll units (minimum 650 ms). Checkpoints: N at 1.2 s; hero at rest at 6 s; each chapter 3 s after its gesture. Career tab change settles within 1.5 s. Under reduced motion, no entrance motion and static frames. |
| Responsive | 1440, 1024, 768, 390 and 360 px: header capsule scales with the stage; the phone menu has Home first; the Career Intelligence background sheets are hidden on phones; tabs at least 44 px on touch. |
| Accessibility | Skip link; "Homepage sections" navigation; keyboard chapter navigation (PageDown, arrows, Space); WAI-ARIA tablist with roving focus, Home and End; inactive panels `inert`; reduced motion respected. |
| Functional dependencies | None on the database: static content and assets only. In public-marketing mode (the release candidate), Log in and Sign up keep their look but lead to `/book-counselling`, and the browser makes no Supabase call. |
| Approval status | **Approved**: founder, 14 Nov 2026 (canonical baseline) |

## Shared UI (part of every page)

| Element | Reference | Approval |
|---|---|---|
| Global header (logo, Home, Explore, Free tools, How it works, Pricing, Log in, Sign up) | `tests/visual/__baseline__/page-01b-header-strict-*.png`, `nav-01-menu-open-*.png` | Approved V5.6.3 |
| Page hero | `page-01-how-it-works-hero-*.png`, `page-02-contact-hero-*.png` | Approved V5.6.3 |
| Footer and contacts | `pages/*-1440.webp` (footer below the fold is checked by `verify:baseline`, not by screenshot) | Approved V5.6.3 |

## Pages

| Page | Route | Desktop | Mobile | Design | Animation | Responsive | Accessibility | Functional dependencies | Status |
|---|---|---|---|---|---|---|---|---|---|
| Homepage | `/` | `pages/home-1440.webp` | `pages/home-390.webp` | See record H below. | Opening animation; chapter navigation; scenes 2–3 per the visual checkpoints | Full-screen chapter story; one gesture = one chapter; phone layout | Skip link, keyboard chapter navigation, reduced motion (static frames), tablist (WAI-ARIA) | Static content; no DB | **Approved** (V5.6.3 baseline) |
| How It Works | `/how-it-works` | `pages/how-it-works-1440.webp` | `pages/how-it-works-390.webp` | PageHero with steps card | Hero entrance (settled under reduced motion) | Hero stacks on phones | One h1, landmarks, axe 0 | Static | **Approved** (V5.6.3 baseline) |
| Career Intelligence | `/career` | `pages/career-1440.webp` | `pages/career-390.webp` | PageHero | — | Responsive grid | axe 0 | Static | **Approved** (V5.6.3 baseline) |
| Explore Careers | `/careers` | `pages/careers-1440.webp` | `pages/careers-390.webp` | PageHero, career library | — | Responsive grid | axe 0 | Reads published careers (Supabase, public read) | **Approved** (V5.6.3 baseline) |
| Career profile (example) | `/careers/[slug]` | `pages/careers--ai-engineer-1440.webp` | `pages/careers--ai-engineer-390.webp` | Career detail | — | Responsive | axe 0 | Published career record | **Approved** (V5.6.3 baseline) |
| Career Discovery | `/career-discovery` | `pages/career-discovery-1440.webp` | `pages/career-discovery-390.webp` | Guided discovery preview | — | Responsive | axe 0 | Static (preview) | **Approved** (V5.6.3 baseline) |
| Compare Careers | `/compare` | `pages/compare-1440.webp` | `pages/compare-390.webp` | Compare tool | — | Responsive | axe 0 | Published careers | **Approved** (V5.6.3 baseline) |
| Universities | `/universities` | `pages/universities-1440.webp` | `pages/universities-390.webp` | University explorer | — | Responsive | axe 0 | Published education data | **Approved** (V5.6.3 baseline) |
| Courses | `/courses` | `pages/courses-1440.webp` | `pages/courses-390.webp` | Course explorer | — | Responsive | axe 0 | Published education data | **Approved** (V5.6.3 baseline) |
| Compare Courses | `/courses/compare` | `pages/courses--compare-1440.webp` | `pages/courses--compare-390.webp` | Course comparison | — | Responsive | axe 0 | Published education data | **Approved** (V5.6.3 baseline) |
| Study Abroad | `/abroad` | `pages/abroad-1440.webp` | `pages/abroad-390.webp` | PageHero | — | Responsive | axe 0 | Static + published data | **Approved** (V5.6.3 baseline) |
| Study in Europe | `/study-europe` | `pages/study-europe-1440.webp` | `pages/study-europe-390.webp` | Destination explorer | — | Responsive | axe 0 | Published education data | **Approved** (V5.6.3 baseline) |
| Study Options | `/study-options` | `pages/study-options-1440.webp` | `pages/study-options-390.webp` | Options guide | — | Responsive | axe 0 | Static | **Approved** (V5.6.3 baseline) |
| Pricing | `/pricing` | `pages/pricing-1440.webp` | `pages/pricing-390.webp` | Plans; payment closed notice | — | Responsive | axe 0 | Pricing data; payments gated off | **Approved** (V5.6.3 baseline) |
| About | `/about` | `pages/about-1440.webp` | `pages/about-390.webp` | PageHero | — | Responsive | axe 0 | Static | **Approved** (V5.6.3 baseline) |
| Contact | `/contact` | `pages/contact-1440.webp` | `pages/contact-390.webp` | PageHero, official contacts | — | Responsive | axe 0 | Static (mailto/tel only) | **Approved** (V5.6.3 baseline) |
| For Parents | `/parents` | `pages/parents-1440.webp` | `pages/parents-390.webp` | PageHero | — | Responsive | axe 0 | Static | **Approved** (V5.6.3 baseline) |
| Trust Center | `/trust` | `pages/trust-1440.webp` | `pages/trust-390.webp` | PageHero | — | Responsive | axe 0 | Static | **Approved** (V5.6.3 baseline) |
| Privacy Policy | `/privacy` | `pages/privacy-1440.webp` | `pages/privacy-390.webp` | Legal page | — | Responsive | axe 0 | Static | **Approved** (V5.6.3 baseline) |
| Terms | `/terms` | `pages/terms-1440.webp` | `pages/terms-390.webp` | Legal page | — | Responsive | axe 0 | Static | **Approved** (V5.6.3 baseline) |
| Refund Policy | `/refund-policy` | `pages/refund-policy-1440.webp` | `pages/refund-policy-390.webp` | Legal page | — | Responsive | axe 0 | Static | **Approved** (V5.6.3 baseline) |
| Book a free session | `/book-counselling` | `pages/book-counselling-1440.webp` | `pages/book-counselling-390.webp` | Discovery Session entry | — | Responsive | axe 0 | Auth state (accounts); public-marketing mode: email/phone | **Approved** (V5.6.3 baseline) |

Videos for individual pages other than the homepage: none yet. Each new page task adds its own
video (protocol §9).

## History

| Date | Page | Change | Status |
|---|---|---|---|
| 14 Nov 2026 | All | Register created from the V5.6.3 canonical baseline | Approved |
