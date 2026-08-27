# CareerPath AI

**CareerPath AI** is a temporary working brand name for a career-first education and guidance platform for
students and families in Odisha, India, with an initial international focus on Europe. This repository currently
contains seven milestones:

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
- **Milestone 7**: a full internal admin system at `/admin` — role-based staff access (six roles, database-backed,
  enforced server-side and by Row Level Security) covering students, universities, courses, applications, leads,
  payments, agreements, counsellors, analytics, conversion tracking, and content management, plus an append-only
  audit log. Payments and agreements are operational tracking only — this is not a payment processor and there is
  no e-signature integration. See `docs/admin-system-guide.md` for the full reference.

Roadmap content and counselling activity on the dashboard are still demo/illustrative data — see
[What's real vs. demo data](#whats-real-vs-demo-data) below. Everything else listed above is real, including the
Milestone 7 admin system once its migration is applied and at least one super admin is granted (see
[Admin system setup](#admin-system-setup)).

## Stack

- [Next.js](https://nextjs.org) (App Router, React Server Components by default)
- TypeScript (`strict` mode)
- Tailwind CSS v4 (CSS-first theme, design tokens as CSS variables in `src/app/globals.css`)
- [Lucide React](https://lucide.dev) for icons
- `next/font` (Plus Jakarta Sans for body text, Fraunces for headings) for typography — no external font CDNs
- [Supabase](https://supabase.com) (`@supabase/supabase-js` + `@supabase/ssr`) for authentication and every
  database table — see [Database setup](#database-setup) below
- [Vitest](https://vitest.dev) for unit tests — the recommendation engine, the career-comparison matrix builder, and
  the Milestone 7 admin system's pure logic (permissions, money, status transitions, analytics math, content safety,
  audit redaction, pagination) are the automated test suites in this repo (see [Available scripts](#available-scripts))

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
4. `supabase/migrations/0004_admin_system.sql` — the 15 admin-system tables and role model (Milestone 7). Optional
   if you don't need `/admin` — everything else in this repo works without it. See
   [Admin system setup](#admin-system-setup) below for the extra one-time step this migration needs (granting
   yourself the first admin role).
5. `supabase/migrations/0005_payments_billing.sql` — the invoicing/payments/refunds/webhook-events tables and
   functions behind Milestone 8 (`/payments`, `/admin/invoices`, `/admin/refunds`, `/admin/payment-events`,
   `/admin/billing-settings`). Requires `0004_admin_system.sql` first (reuses its role model). Optional if you don't
   need online payments — everything else in this repo works without it. See
   [Payments setup](#payments-setup) below for the extra one-time step this migration needs.

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

## Admin system setup

Optional — skip this if you don't need `/admin`. After running migration `0004_admin_system.sql` (Step 3 above):

1. Register a normal account through `/register` with the email you want to administer with.
2. In the Supabase SQL Editor, run the commented-out `BOOTSTRAP` block at the end of
   `supabase/migrations/0004_admin_system.sql`, replacing the placeholder email with that account's real one. No
   account is ever made an admin automatically — this manual step is deliberate (see `docs/admin-system-guide.md`
   §3 for why).
3. Sign in and visit `/admin`.

Full architecture, the six-role permission model, database schema, RLS reasoning, and every module's behavior and
limitations are documented in `docs/admin-system-guide.md`. An optional, entirely fictional dev seed file
(`supabase/seed/0002_admin_dev_seed.sql`, separate from the Milestone 4 career seed) is available if you want sample
records to look at — never run automatically, safe to skip.

## Payments setup

Optional — skip this if you don't need `/payments` or `/admin/invoices`. After running migration
`0005_payments_billing.sql` (Step 5 above, which itself requires `0004_admin_system.sql`):

1. Add `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET` to `.env.local` — get TEST MODE values
   from your [Razorpay Dashboard](https://dashboard.razorpay.com/) under **Settings → API Keys** and
   **Settings → Webhooks** (webhook URL: `https://<your-domain>/api/webhooks/razorpay`). The app runs fine without
   these — invoices can be created and viewed, but online checkout shows "Payment gateway is not configured" until
   they're set.
2. Run the one commented-out `UPDATE` statement in the `BOOTSTRAP` section at the end of
   `supabase/migrations/0005_payments_billing.sql`, pasting the SAME `RAZORPAY_KEY_SECRET` /
   `RAZORPAY_WEBHOOK_SECRET` values as step 1. This is a separate, deliberate manual step — checkout/webhook
   signature verification reads these two secrets from this database table, not from environment variables, so both
   places need them (see `docs/payments-billing-guide.md` §4 for why).
3. In the Supabase SQL Editor, run the commented-out `BOOTSTRAP` block in `0004_admin_system.sql` too if you haven't
   already (see [Admin system setup](#admin-system-setup) above) — an invoice can only be created/issued by an
   `admin`/`finance`/`super_admin` role.
4. Visit `/admin/billing-settings` to fill in your business name/address (and GST details, if applicable — GST
   fields never appear on an invoice until genuinely configured here) before issuing your first invoice.

Full architecture, the state machines, the Razorpay test-mode walkthrough, webhook local-testing instructions, and
every limitation (offline vs. gateway-verified payments, no email delivery, GST disclaimer) are documented in
`docs/payments-billing-guide.md`.

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
| `npm run test` | Run the recommendation engine's, career-comparison's, admin, and payments/billing unit tests (Vitest) |

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
| `/payments` | Your invoices and payment status — **protected**, real (Milestone 8) |
| `/payments/[invoiceId]` | One invoice: details, download PDF, pay via Razorpay if payable — **protected**, real (Milestone 8) |
| `/pay/[token]` | Resolves a copyable payment-link token to `/payments/[invoiceId]`, ownership-checked — **protected**, real (Milestone 8) |
| `/admin` | Admin dashboard — **admin-only** (any role), real (Milestone 7) |
| `/admin/students`, `/admin/universities`, `/admin/courses`, `/admin/applications`, `/admin/leads`, `/admin/payments`, `/admin/agreements`, `/admin/counsellors`, `/admin/analytics`, `/admin/content`, `/admin/audit-log` | Admin modules — **admin-only**, role/permission-scoped (Milestone 7). See `docs/admin-system-guide.md` §2. |
| `/admin/invoices`, `/admin/invoices/new`, `/admin/invoices/[id]` | Create/issue/void invoices, record offline payments, generate payment links, initiate refunds — **admin-only**, real (Milestone 8) |
| `/admin/refunds` | Refund history across all invoices — **admin-only**, real (Milestone 8) |
| `/admin/payment-events` | Razorpay webhook delivery log (redacted) — **admin-only**, real (Milestone 8) |
| `/admin/billing-settings` | Business/GST details that gate tax fields on invoices — **admin-only**, real (Milestone 8) |
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
- The admin system (Milestone 7) — `/admin` and every module under it read and write real database rows, enforced
  by a real database-backed role model and real RLS policies (no mock authorization anywhere). The legacy
  **Payments** module (`/admin/payments`) is explicitly tracking-only, not a live integration: it records what an
  admin believes happened; no code path there processes, captures, or moves money — it is left untouched by
  Milestone 8 (see "Relationship to the Milestone 7 payments table" below). **Agreements** records status an admin
  has verified some other way; there is no e-signature provider. Both say so directly on their forms — see
  `docs/admin-system-guide.md` §7–8.
- Payments, invoicing and receipts (Milestone 8) — `/admin/invoices` and `/payments` are a real, separate,
  gateway-integrated system: invoices are created/issued by an admin, students pay via a genuine Razorpay Checkout
  integration, and a payment is only ever marked captured from cryptographically verified evidence (a verified
  webhook or an admin's "refresh from gateway" reconciliation) — never just because a browser returned to a success
  page. Refunds call the real Razorpay refund API. Invoice/receipt PDFs are generated server-side. **What's
  genuinely limited:** GST/tax fields only ever appear once real business details are entered at
  `/admin/billing-settings` (never fabricated); there is no email provider, so payment links are copy/share only —
  the UI says "Email delivery not configured" rather than claiming to have sent anything; an "offline" (manually
  recorded) payment is always visibly distinct from a gateway-verified one, in every screen and every PDF. See
  `docs/payments-billing-guide.md` for the full architecture, limitations, and Razorpay test-mode walkthrough.

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
- Automated email/SMS delivery of payment links, invoices, or receipts — Milestone 8 generates a secure payment
  link and downloadable PDFs, but delivery is "copy the link yourself"; if no email provider is configured the UI
  says **"Email delivery not configured"** rather than pretending to send anything (see
  `docs/payments-billing-guide.md`).
- Legally compliant GST tax invoices out of the box — Milestone 8 only labels a document a GST tax invoice, and only
  includes GSTIN/tax fields, when GST registration has genuinely been configured and validated in Billing Settings;
  otherwise it issues a plain (non-GST) invoice. Nothing fabricates a GSTIN, tax rate, or legal entity name (see
  `docs/payments-billing-guide.md`).
- Payment gateways other than Razorpay, and Razorpay in any mode other than whatever mode its dashboard keys are
  issued for (test vs. live is controlled entirely by which keys you configure — see
  `docs/payments-billing-guide.md`).
- The legacy Milestone 7 Payments module is unchanged and still records only that a payment happened or is
  expected; it does not process, capture, or move money and is not connected to Milestone 8's gateway integration
  (see `docs/admin-system-guide.md` §7 and `docs/payments-billing-guide.md` for how the two relate).
- Real appointment booking or calendar integration.
- Email/SMS/WhatsApp sending — Milestone 7's Leads module records notes and follow-up dates only; it never sends a
  real message, and says so on the form.
- E-signature — the Milestone 7 Agreements module tracks signature status manually; there is no signing provider
  (see `docs/admin-system-guide.md` §8).
- File/document uploads — Agreements' `document_reference_url` is a plain link field, not storage.
- Verified legal documents (Privacy Policy, Terms, Refund Policy are structural placeholders pending legal review).
- Real university, visa, salary, scholarship, or employment data/claims — career data in Milestone 4/5 is curated
  editorial content, not verified market data.
- Field-of-study matching in the recommendation engine (education-level matching only — see
  `docs/recommendation-engine-guide.md` §3 for why).
- Comparing more than 3 careers at once, or saving/exporting a comparison (see
  `docs/career-comparison-guide.md` §8–9).
- Any public page reading Milestone 7's `content_items` (CMS) table or the `is_visible` flag on universities/courses
  — existing typed/static site copy from earlier milestones is unchanged; publishing content through `/admin/content`
  currently has no public-facing reader yet (see `docs/admin-system-guide.md` §9).
- Live application-status sync with any university's own system — Milestone 7's Applications module is a manually
  maintained internal record, never a real integration.

## Directory structure

```
src/
  app/
    (site)/              Public + student site route group — Header/Footer root layout (Milestones 1-6)
    admin/               Admin system routes — separate root layout, no public chrome (Milestone 7)
  components/
    layout/              Container, Section — page-level layout primitives
    navigation/           Header, Footer, MobileNav, AccountMenu, LanguageSelector, Logo
    ui/                   Button, Badge, TrustBadge, Card, SectionHeading, Breadcrumbs, DemoNotice,
                            GuidanceNotice, ComingSoon
    sections/              Reusable page sections plus page-specific subfolders — home/, contact/,
                            book-counselling/, career-discovery/, legal/, profile/ (onboarding wizard),
                            careers/ (Career Explorer), recommendations/, compare/ (Career Comparison)
    forms/                Form primitives: FormField, Input, Select, Textarea, Checkbox
    admin/                 Shared admin UI (AdminShell, AdminTable, StatusBadge, FilterBar, ...) plus one
                            subfolder per module (universities/, courses/, students/, leads/, ...)
  config/                site.ts — brand name, nav, contact placeholders, legal status, languages
  data/                  Typed content: pricing/FAQs/journey/trust items, profile-options.ts (Milestone 3
                          taxonomy), careers/ (Milestone 4 career seed data + taxonomy)
  lib/
    fonts.ts               Shared font config for both root layouts (Milestone 7)
    supabase/             Supabase clients, auth actions, and all database read/write functions
                            admin/ — one data-access file per admin module (Milestone 7)
                            admin-auth.ts — getCurrentAdmin()/requireAdmin*() (Milestone 7)
    admin/                  Pure admin business logic: permissions, money, status transitions, analytics
                            math, content safety, audit redaction, pagination (Milestone 7) — see
                            docs/admin-system-guide.md
    recommendations/       Milestone 5 scoring engine — see docs/recommendation-engine-guide.md
    profile/               Profile-completion calculator, onboarding draft helpers
    careers/               Career label/characteristic helpers + compare.ts (Milestone 6 comparison-matrix
                            builder) — see docs/career-comparison-guide.md
    utils.ts, validation.ts
  types/                 Shared TypeScript types (student-profile.ts, career.ts, database.ts, admin.ts)
qa/                      Small Playwright smoke-test scripts used to verify routes, interactions, and
                          responsive layout during development (not required to run the site; see below).
scripts/                 validate-career-data.ts, generate-career-seed-sql.ts (Milestone 4 tooling)
supabase/
  migrations/            0001_profiles.sql, 0002_student_profile.sql, 0003_career_database.sql,
                          0004_admin_system.sql (Milestone 7)
  seed/                  0001_careers_seed.sql — generated, never hand-edited (see docs/career-data-guide.md)
                          0002_admin_dev_seed.sql — optional, fictional, never auto-run (Milestone 7)
docs/                    career-data-guide.md, recommendation-engine-guide.md, career-comparison-guide.md,
                          admin-system-guide.md (Milestone 7)
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
