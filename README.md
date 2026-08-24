# CareerPath AI — Milestone 1 + Milestone 2

**CareerPath AI** is a temporary working brand name for a career-first education and guidance platform for
students and families in Odisha, India, with an initial international focus on Europe. This repository contains:

- **Milestone 1**: a polished, responsive public website and reusable UI foundation.
- **Milestone 2**: real student accounts — registration, login, logout, password reset, and protected pages —
  backed by Supabase Auth and a `profiles` database table.

Career discovery results, roadmap content, and counselling activity are still demo/illustrative data — see
[What's not implemented yet](#whats-not-implemented-yet) below. Accounts and login themselves are real.

## Stack

- [Next.js](https://nextjs.org) (App Router, React Server Components by default)
- TypeScript (`strict` mode)
- Tailwind CSS v4 (CSS-first theme, design tokens as CSS variables in `src/app/globals.css`)
- [Lucide React](https://lucide.dev) for icons
- `next/font` (Plus Jakarta Sans for body text, Fraunces for headings) for typography — no external font CDNs
- [Supabase](https://supabase.com) (`@supabase/supabase-js` + `@supabase/ssr`) for authentication and the
  `profiles` table — see [Milestone 2 — Supabase setup](#milestone-2--supabase-setup) below

## Prerequisites

- Node.js 20+ and npm
- A free [Supabase](https://supabase.com) project (only required to test registration/login — the site still
  builds and the public pages still work without one)

## Getting started

```bash
npm install
npm run dev
```

Then open http://localhost:3000. To test registration/login, complete
[Milestone 2 — Supabase setup](#milestone-2--supabase-setup) first.

## Milestone 2 — Supabase setup

You only need to do this once. Everything below happens in your Supabase project's dashboard at
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

**Step 3 — Create the database table.**
1. In the Supabase dashboard, click **SQL Editor** in the left sidebar.
2. Click **New query**.
3. Open `supabase/migrations/0001_profiles.sql` from this project, and paste its entire contents into the query
   editor.
4. Click **Run**.

This creates the `profiles` table, turns on Row Level Security (so students can only ever see their own data), and
sets up automatic profile creation whenever someone registers.

**Step 4 — Check your email confirmation setting (optional).**
Supabase → **Authentication** → **Providers** → **Email**. If **"Confirm email"** is turned on, new students must
click a link in their email before they can log in — this is the recommended setting for production. For quicker
local testing, you can turn it off; just remember to turn it back on before real students use the site. Either way,
this app handles both cases automatically (see the Milestone 2 summary you were given for details).

**Step 5 — Set your site URL (needed for email links to work).**
Supabase → **Authentication** → **URL Configuration**. Set **Site URL** to `http://localhost:3000` for local
testing. Under **Redirect URLs**, add `http://localhost:3000/auth/callback`. When you later deploy the site (e.g.
to Vercel) with a real domain, come back here and update both to your real domain — `https://yourdomain.com` and
`https://yourdomain.com/auth/callback`.

That's it — `npm run dev` and try registering a student account.

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
| `/register` | Create a student account (real, Supabase-backed) |
| `/login` | Log in (real) |
| `/forgot-password` | Request a password reset email (real) |
| `/reset-password` | Choose a new password from a reset email link (real) |
| `/auth/callback` | Internal route — completes email confirmation / password reset links |
| `/dashboard` | Student dashboard — **protected**, logged-out visitors are redirected to `/login` |
| `/roadmap` | Illustrative career roadmap — **protected** |
| *(any unmatched path)* | Custom 404 |

## What's real vs. demo data

**Real (Milestone 2):** registration, login, logout, password reset, and session handling are fully wired to
Supabase Auth. A student's name/email/phone (shown on `/dashboard`) is their real, securely stored data — protected
by Row Level Security so no student can read another student's profile.

**Still demo/mock data:**

- All pricing, package scope, FAQs, journey stages, trust-verification items, and team placeholders live in typed
  config/data files under `src/config/` and `src/data/` — edit those files to change content sitewide.
- The Contact, Book Counselling, and Career Discovery waitlist forms validate input entirely in the browser. On a
  valid submission they show an explicit **"Form preview completed"** message and state that nothing was
  transmitted or stored. No `fetch`/network call is made, and no personal data is written to `localStorage` or
  logged to the console.
- The Trust Center defaults every unverified claim (company registration, team credentials, etc.) to **Pending
  verification** or **Planned** — never "Verified" — until real, owner-supplied documentation exists.
- The dashboard's "Career discovery" and "Counselling" status, and everything on `/roadmap`, are illustrative —
  clearly labelled with a demo notice — until Milestone 3 adds real career discovery data.
- Pricing is explicitly labelled **provisional/sample** throughout, and every pricing CTA links to
  `/book-counselling`, never to a payment flow.

### What's not implemented yet

By design, this milestone does **not** include:

- The Student Digital Profile questionnaire, education history, skills, or career scoring (Milestone 3+)
- Claude API / AI calls of any kind (no live career-recommendation engine or assessment scoring)
- Google/OAuth login (the groundwork is in place — see the Milestone 2 summary — but not enabled)
- Payment processing
- Real appointment booking, calendar integration, or CRM
- Email/SMS/WhatsApp integration beyond Supabase's own auth emails (confirmation, password reset)
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
