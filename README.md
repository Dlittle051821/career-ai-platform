# CareerPath AI

**CareerPath AI** is a temporary working brand name for a career-first education and guidance platform for
students and families in Odisha, India, with an initial international focus on Europe. This repository currently
contains six milestones:

- **Milestone 1**: a polished, responsive public website and reusable UI foundation.
- **Milestone 2**: real student accounts — registration, login, logout, password reset, and protected pages —
  backed by Supabase Auth and a `profiles` database table.
- **Milestone 3**: the Student Digital Profile — a 12-step onboarding wizard and `/profile` page collecting
  education history, subject strengths, interests, skills, work preferences, career priorities, goals, study/location
  preferences, and funding preferences, all real and stored per-student behind Row Level Security.
- **Milestone 4**: the Career Knowledge Base — a structured library of careers (subjects, interests, skills,
  education routes, industries, tags, and curated heuristic scores) at `/careers` and `/careers/[slug]`.
- **Milestone 5**: the Explainable Career Recommendation Engine — a deterministic, non-AI scoring engine at
  `/recommendations` that ranks the Milestone 4 career library against a student's real Milestone 3 profile, with
  plain-language reasons for each result.
- **Milestone 6**: Career Comparison — a `/compare` tool that puts two or three careers side by side (subjects,
  skills, education routes, characteristics), optionally overlaying each one's own Milestone 5 match band when the
  viewer is signed in with a profile. Read-only, no new database table, no new dependency.

Roadmap content and counselling activity on the dashboard are still demo/illustrative data — see
[What's real vs. demo data](#whats-real-vs-demo-data) below. Everything else listed above is real.

## Stack

- [Next.js](https://nextjs.org) (App Router, React Server Components by default)
- TypeScript (`strict` mode)
- Tailwind CSS v4 (CSS-first theme, design tokens as CSS variables in `src/app/globals.css`)
- [Lucide React](https://lucide.dev) for icons
- `next/font` (Plus Jakarta Sans for body text, Fraunces for headings) for typography — no external font CDNs
- [Supabase](https://supabase.com) (`@supabase/supabase-js` + `@supabase/ssr`) for authentication and every
  database table — see [Database setup](#database-setup) below
- [Vitest](https://vitest.dev) for unit tests — the recommendation engine and the career-comparison matrix builder
  are the only automated test suites in this repo (see [Available scripts](#available-scripts))

## Prerequisites

- Node.js 20+ and npm
- A free [Supabase](https://supabase.com) project (only required to test registration/login, the Student Digital
  Profile, the career library, or recommendations — the public marketing pages still build and work without one)

## Getting started

```bash
npm install
npm run dev
```

Then open http://localhost:3000. To test registration/login and everything downstream of it, complete
[Database setup](#database-setup) first.

## Database setup

You only need to do this once. Steps 1–2 happen in your Supabase project's dashboard at
[supabase.com/dashboard](https://supabase.com/dashboard) — no coding required.

**Step 1 — Get your project's API keys.**
Open your Supabase project → **Settings** (gear icon, bottom of the left sidebar) → **API**. You'll see a
**Project URL** and a **Publishable key** (sometimes shown as `anon` / `public`). You'll need both in Step 2.

**Step 2 — Add them to this project.**
In the project folder, copy `.env.example` to a new file named `.env.local`, then fill in the two values:

```
NEXT_PUBLIC_SUPABASE_URL=<your Project URL>
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<your Publishable key>
```

`.env.local` is already excluded from Git (see `.gitignore`) — it will never be committed or shared. Never put a
**service_role** / **secret** key here; only the public/publishable pair belongs in this file.

**Step 3 — Run the migrations, in order.**
In the Supabase dashboard, click **SQL Editor** → **New query**, then for each file below, paste its entire
contents and click **Run**, in this exact order:

1. `supabase/migrations/0001_profiles.sql` — the `profiles` table (Milestone 2).
2. `supabase/migrations/0002_student_profile.sql` — the 11 `student_*` tables behind the Student Digital Profile
   (Milestone 3).
3. `supabase/migrations/0003_career_database.sql` — the 14 `career_*` / `industries` tables (Milestone 4).

Each migration turns on Row Level Security and sets up any needed triggers — see the comments inside each file for
exactly what it does. Milestones 5 (recommendations) and 6 (comparison) need no new migration — both are computed
live, read-only, from the tables above.

**Step 4 — Seed the career library.**
Career data is authored as TypeScript and generated into SQL — see `docs/career-data-guide.md` for the full
workflow. To load the ~100 seeded careers: run `npm run seed:generate` (writes
`supabase/seed/0001_careers_seed.sql`, already generated and committed — you can skip straight to pasting it if you
haven't changed any career data), then paste that file's contents into the SQL Editor and run it. It's an
idempotent upsert, safe to re-run any time career data changes.

**Step 5 — Check your email confirmation setting (optional).**
Supabase → **Authentication** → **Providers** → **Email**. If **"Confirm email"** is turned on, new students must
click a link in their email before they can log in — this is the recommended setting for production. For quicker
local testing, you can turn it off; just remember to turn it back on before real students use the site.

**Step 6 — Set your site URL (needed for email links to work).**
Supabase → **Authentication** → **URL Configuration**. Set **Site URL** to `http://localhost:3000` for local
testing. Under **Redirect URLs**, add `http://localhost:3000/auth/callback`. When you later deploy the site (e.g.
to Vercel) with a real domain, come back here and update both to your real domain.

That's it — `npm run dev`, register a student account, complete a few steps of the profile wizard, visit
`/recommendations` to see it rank the career library against your own data, and visit `/compare` to put two or
three careers side by side.

## Available scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the local development server |
| `npm run build` | Create a production build |
| `npm run start` | Serve the production build (run `build` first) |
| `npm run lint` | Run ESLint (flat config, `eslint-config-next`) |
| `npm run typecheck` | Run `tsc --noEmit` |
| `npm run validate:careers` | Validate every career in `src/data/careers/` against the shared taxonomy |
| `npm run seed:generate` | Regenerate `supabase/seed/0001_careers_seed.sql` from `src/data/careers/` |
| `npm run test` | Run the recommendation engine's and career-comparison's unit tests (Vitest) |

All of `lint`, `typecheck`, `validate:careers`, `test`, `build`, and a manual route/interaction QA pass (see `qa/`)
are run against this codebase before every milestone is delivered.

## Routes

| Route | Page |
| --- | --- |
| `/` | Home |
| `/how-it-works` | How It Works |
| `/career-discovery` | Career Discovery (marketing page) |
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
| `/register` | Create a student account (real, Supabase-backed) |
| `/login` | Log in (real) |
| `/forgot-password` | Request a password reset email (real) |
| `/reset-password` | Choose a new password from a reset email link (real) |
| `/auth/callback` | Internal route — completes email confirmation / password reset links |
| `/dashboard` | Student dashboard — **protected** |
| `/profile` | Student Digital Profile summary — **protected**, real (Milestone 3) |
| `/profile/onboarding` | 12-step profile wizard — **protected**, real (Milestone 3) |
| `/careers` | Career Explorer — search/browse the career library, public, real (Milestone 4) |
| `/careers/[slug]` | Career detail page — public, real (Milestone 4) |
| `/recommendations` | Personalised career recommendations — **protected**, real (Milestone 5) |
| `/compare` | Compare 2-3 careers side by side — public, real (Milestone 6). Shows a personalised match row too when signed in with a profile. |
| `/roadmap` | Illustrative career roadmap — **protected**, still demo content |
| *(any unmatched path)* | Custom 404 |

"Protected" routes redirect a logged-out visitor to `/login` (see `PROTECTED_PATHS` in
`src/lib/supabase/middleware.ts`).

## What's real vs. demo data

**Real:**

- Registration, login, logout, password reset, and session handling (Milestone 2) — fully wired to Supabase Auth.
- A student's name/email/phone (shown on `/dashboard`) — their real, securely stored data, protected by RLS.
- The Student Digital Profile (Milestone 3) — everything entered in the onboarding wizard or on `/profile` is real,
  private to that student, and backed by the 11 `student_*` tables.
- The Career Explorer (Milestone 4) — `/careers` and `/careers/[slug]` query the real, Supabase-backed career
  library (~100 careers). It's a browsing/search tool only — no personalised ranking there.
- Career recommendations (Milestone 5) — `/recommendations` ranks the real career library against the signed-in
  student's real profile using a deterministic scoring engine (`src/lib/recommendations/`). Nothing here is
  AI-generated, randomized, or a scientifically validated assessment — see
  `docs/recommendation-engine-guide.md` and the disclaimer shown on the page itself. Nothing is persisted:
  every load recomputes from current data, so results can never go stale.
- Career comparison (Milestone 6) — `/compare` reads the same real career library and, for signed-in students,
  reuses the same real Milestone 5 engine output. See `docs/career-comparison-guide.md`.

**Still demo/mock data:**

- All pricing, package scope, FAQs, journey stages, trust-verification items, and team placeholders live in typed
  config/data files under `src/config/` and `src/data/` — edit those files to change content sitewide.
- The Contact, Book Counselling, and Career Discovery waitlist forms validate input entirely in the browser. On a
  valid submission they show an explicit **"Form preview completed"** message and state that nothing was
  transmitted or stored. No `fetch`/network call is made, and no personal data is written to `localStorage` or
  logged to the console.
- The Trust Center defaults every unverified claim (company registration, team credentials, etc.) to **Pending
  verification** or **Planned** — never "Verified" — until real, owner-supplied documentation exists.
- The dashboard's "Counselling" status and everything on `/roadmap` are illustrative — clearly labelled with a demo
  notice.
- Pricing is explicitly labelled **provisional/sample** throughout, and every pricing CTA links to
  `/book-counselling`, never to a payment flow.

### What's not implemented yet

By design, this repository does **not** include:

- Claude API / AI calls of any kind, anywhere — including in the recommendation engine, which is deterministic and
  rules-based by design (see `docs/recommendation-engine-guide.md` §9).
- Google/OAuth login (the groundwork is in place — see the Milestone 2 summary — but not enabled).
- Payment processing.
- Real appointment booking, calendar integration, or CRM.
- Email/SMS/WhatsApp integration beyond Supabase's own auth emails (confirmation, password reset).
- Admin backend or file/document uploads.
- Verified legal documents (Privacy Policy, Terms, Refund Policy are structural placeholders pending legal review).
- Real university, visa, salary, scholarship, or employment data/claims — career data in Milestone 4/5 is curated
  editorial content, not verified market data.
- Field-of-study matching in the recommendation engine (education-level matching only — see
  `docs/recommendation-engine-guide.md` §3 for why).
- Comparing more than 3 careers at once, or saving/exporting a comparison (see
  `docs/career-comparison-guide.md` §8–9).

## Directory structure

```
src/
  app/                  Route segments (App Router). Each folder = one route; page.tsx + metadata.
  components/
    layout/              Container, Section — page-level layout primitives
    navigation/           Header, Footer, MobileNav, AccountMenu, LanguageSelector, Logo
    ui/                   Button, Badge, TrustBadge, Card, SectionHeading, Breadcrumbs, DemoNotice,
                            GuidanceNotice, ComingSoon
    sections/              Reusable page sections plus page-specific subfolders — home/, contact/,
                            book-counselling/, career-discovery/, legal/, profile/ (onboarding wizard),
                            careers/ (Career Explorer), recommendations/, compare/ (Career Comparison)
    forms/                Form primitives: FormField, Input, Select, Textarea, Checkbox
  config/                site.ts — brand name, nav, contact placeholders, legal status, languages
  data/                  Typed content: pricing/FAQs/journey/trust items, profile-options.ts (Milestone 3
                          taxonomy), careers/ (Milestone 4 career seed data + taxonomy)
  lib/
    supabase/             Supabase clients, auth actions, and all database read/write functions
    recommendations/       Milestone 5 scoring engine — see docs/recommendation-engine-guide.md
    profile/               Profile-completion calculator, onboarding draft helpers
    careers/               Career label/characteristic helpers + compare.ts (Milestone 6 comparison-matrix
                            builder) — see docs/career-comparison-guide.md
    utils.ts, validation.ts
  types/                 Shared TypeScript types (student-profile.ts, career.ts, database.ts)
qa/                      Small Playwright smoke-test scripts used to verify routes, interactions, and
                          responsive layout during development (not required to run the site; see below).
scripts/                 validate-career-data.ts, generate-career-seed-sql.ts (Milestone 4 tooling)
supabase/
  migrations/            0001_profiles.sql, 0002_student_profile.sql, 0003_career_database.sql
  seed/                  0001_careers_seed.sql — generated, never hand-edited (see docs/career-data-guide.md)
docs/                    career-data-guide.md, recommendation-engine-guide.md, career-comparison-guide.md
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
- The mobile menu uses the native `<dialog>` element (`showModal()`), which gives correct focus handling and
  Escape-to-close for free, without extra ARIA wiring.
- The FAQ accordion uses native `<details>`/`<summary>` for the same reason — fully keyboard accessible with zero
  client-side JavaScript.
- The desktop navigation switches to a hamburger menu below the `xl` (1280px) breakpoint so the full link set,
  language switcher, and CTA never crowd or overflow at in-between widths like 1024–1279px.
- Career recommendations never show a raw score or percentage to a student — only one of four fixed qualitative
  bands (Strong match / Promising match / Worth exploring / Limited evidence). See
  `docs/recommendation-engine-guide.md` §6.
- The `/compare` table wraps in its own `overflow-x-auto` container rather than letting the page scroll
  horizontally — the same pattern any wide table in this app should follow at narrow viewports.
