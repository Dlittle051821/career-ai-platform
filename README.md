# CareerPath AI — Milestone 1

**CareerPath AI** is a temporary working brand name for a career-first education and guidance platform for
students and families in Odisha, India, with an initial international focus on Europe. This repository contains
**Milestone 1**: a polished, responsive public website and reusable UI foundation.

Milestone 1 is frontend-only. There is no backend, database, authentication, payments, or AI integration yet — see
[What's not implemented yet](#whats-not-implemented-yet) below.

## Stack

- [Next.js](https://nextjs.org) (App Router, React Server Components by default)
- TypeScript (`strict` mode)
- Tailwind CSS v4 (CSS-first theme, design tokens as CSS variables in `src/app/globals.css`)
- [Lucide React](https://lucide.dev) for icons
- `next/font` (Plus Jakarta Sans for body text, Fraunces for headings) for typography — no external font CDNs

No backend services, databases, or paid APIs are required to run this project.

## Prerequisites

- Node.js 20+ and npm

## Getting started

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

## Available scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the local development server |
| `npm run build` | Create a production build |
| `npm run start` | Serve the production build (run `build` first) |
| `npm run lint` | Run ESLint (flat config, `eslint-config-next`) |
| `npm run typecheck` | Run `tsc --noEmit` |

All four of `lint`, `typecheck`, `build`, and a manual route/interaction QA pass (see `qa/`) were run against this
codebase before delivery.

## Routes

| Route | Page |
| --- | --- |
| `/` | Home |
| `/how-it-works` | How It Works |
| `/career-discovery` | Career Discovery |
| `/study-options` | India and Abroad Study Options |
| `/parents` | For Parents |
| `/pricing` | Pricing |
| `/trust` | Trust Center |
| `/about` | About |
| `/contact` | Contact |
| `/book-counselling` | Book free counselling |
| `/privacy` | Privacy Policy (placeholder) |
| `/terms` | Terms of Service (placeholder) |
| `/refund-policy` | Refund Policy (placeholder) |
| *(any unmatched path)* | Custom 404 |

## Everything here is mock/demo data

This milestone intentionally ships with **no live backend**. Specifically:

- All pricing, package scope, FAQs, journey stages, trust-verification items, and team placeholders live in typed
  config/data files under `src/config/` and `src/data/` — edit those files to change content sitewide.
- The Contact, Book Counselling, and Career Discovery waitlist forms validate input entirely in the browser. On a
  valid submission they show an explicit **"Form preview completed"** message and state that nothing was
  transmitted or stored. No `fetch`/network call is made, and no personal data is written to `localStorage` or
  logged to the console.
- The Trust Center defaults every unverified claim (company registration, team credentials, etc.) to **Pending
  verification** or **Planned** — never "Verified" — until real, owner-supplied documentation exists.
- "Student login" opens an honest **coming soon** dialog rather than a fake sign-in form.
- Pricing is explicitly labelled **provisional/sample** throughout, and every pricing CTA links to
  `/book-counselling`, never to a payment flow.

### What's not implemented yet

By design, this milestone does **not** include:

- Backend, database, or Supabase integration
- Real user authentication or student accounts
- Claude API / AI calls of any kind (no live career-recommendation engine or assessment scoring)
- Payment processing
- Real appointment booking, calendar integration, or CRM
- Email/SMS/WhatsApp integration
- Admin backend or file/document uploads
- Verified legal documents (Privacy Policy, Terms, Refund Policy are structural placeholders pending legal review)
- Real university, visa, salary, scholarship, or employment data/claims

## Directory structure

```
src/
  app/                  Route segments (App Router). Each folder = one route; page.tsx + metadata.
  components/
    layout/              Container, Section — page-level layout primitives
    navigation/           Header, Footer, MobileNav, LanguageSelector, StudentLoginModal, Logo
    ui/                   Button, Badge, TrustBadge, Card, SectionHeading, Breadcrumbs, DemoNotice, ComingSoon
    sections/              Reusable page sections (PageHero, CTASection, FaqAccordion, JourneySteps,
                            PricingCard, ComparisonTable) plus page-specific subfolders
                            (home/, contact/, book-counselling/, career-discovery/, legal/)
    forms/                Form primitives: FormField, Input, Select, Textarea, Checkbox
  config/                site.ts — brand name, nav, contact placeholders, legal status, languages
  data/                  Typed mock content: pricing, FAQs, journey stages, trust items, etc.
  lib/                   utils.ts (className helper, currency formatting), validation.ts (form validation)
  types/                 Shared TypeScript types
qa/                      Small Playwright smoke-test scripts used to verify routes, interactions, and
                          responsive layout during development (not required to run the site; see below).
```

### Renaming the brand

`CareerPath AI` is a temporary working name. It — and the tagline, contact placeholders, and legal status — live in
a single file: `src/config/site.ts`. Update `BRAND_NAME` there to rename the product sitewide.

### Optional: re-running the QA scripts

The scripts in `qa/` were used during development to check every route for console/page errors, horizontal overflow
at 320px–1920px, and key interactions (mobile nav, FAQ accordion, form validation, demo-submit states). They are not
part of the app and are not required to run the site. To re-run them, install Playwright's Chromium build separately
(`npm install -D playwright && npx playwright install chromium`), start the production server, then run
`node qa/check.mjs`, `node qa/interactions.mjs`, or `node qa/overflow-all.mjs` against it.

## Design notes

- Design tokens (colors, radii, shadows) are defined once as CSS variables in `src/app/globals.css` under Tailwind
  v4's `@theme` block, and consumed via generated utilities (`bg-primary`, `text-muted`, etc.) — no hard-coded hex
  values in components.
- The mobile menu and "Student login" dialog use the native `<dialog>` element (`showModal()`), which gives correct
  focus handling and Escape-to-close for free, without extra ARIA wiring.
- The FAQ accordion uses native `<details>`/`<summary>` for the same reason — fully keyboard accessible with zero
  client-side JavaScript.
- The desktop navigation switches to a hamburger menu below the `xl` (1280px) breakpoint so the full link set,
  language switcher, and CTA never crowd or overflow at in-between widths like 1024–1279px.
