# Branding guide — CareerPath AI → NextWise

This document explains the branding update that renamed the product from its Milestone 1-9 working name,
"CareerPath AI", to its official name, **NextWise**. It covers what changed, what deliberately did not change,
how to rename the brand again in the future, and — because this update cannot reach everything from inside the
repository — exactly which steps a project owner still needs to do by hand in the Supabase dashboard and in any
legal documents.

Nothing in this document should be read as a claim that the rename reached systems outside this codebase (the
Supabase project's own auth email templates, any DNS/domain configuration, any third-party dashboards) unless
the manual steps in §5 have actually been carried out and verified.

## Table of contents

1. What changed
2. Logo assets: provenance and usage
3. The central brand configuration
4. What was intentionally NOT renamed, and why
5. Manual steps outside this repository (Supabase auth emails)
6. Legal pages requiring owner confirmation
7. Renaming the brand again in the future
8. Known limitations

---

## 1. What changed

Every user-visible instance of "CareerPath AI" / "CareerPathAI" / "Career Path AI" in the application's UI,
metadata, PDFs, and documentation was replaced with **NextWise**, sourced from one place:
`src/config/site.ts`. The official NextWise logo (supplied as a set of PNG renders) was optimized and integrated
as the site's icon, favicon, app icons, and Open Graph/social image. No M1-M9 feature, route, table, or workflow
was redesigned, removed, or altered in behavior — this was a naming and asset swap, not a rebuild.

## 2. Logo assets: provenance and usage

All logo files live under `public/brand/`. They were derived from supplied source renders (not redrawn,
recolored, or stylistically altered) via cropping/trimming transparent padding, generating standard icon/favicon
sizes, and compositing (never stretching) onto fixed-size canvases where a fixed canvas was needed (favicon,
apple touch icon, social share image).

| File | Derived from | Use |
|---|---|---|
| `nextwise-logo-horizontal.png` | supplied wide transparent render (icon + "NEXTWISE" wordmark + "Know What's Next." tagline) | Contexts with a fixed, known light background — currently the invoice/receipt PDF header |
| `nextwise-logo-horizontal-dark.png` | supplied render flattened on its own navy field | Reference "dark" lockup; not currently embedded in a UI surface (see below) |
| `nextwise-icon.png` | supplied transparent icon-only render (the "N" ribbon + arrow mark) | The site-wide `Logo` component (header, footer, mobile nav, admin sidebar, auth pages) |
| `nextwise-icon-32/192/256/512.png` | resized from `nextwise-icon.png` | favicon, app icons, manifest icons, Razorpay checkout `image` |
| `nextwise-apple-touch-icon.png` | `nextwise-icon.png` composited on an opaque white 180×180 square | Apple touch icon (iOS fills transparency with black otherwise) |
| `nextwise-social-share.png` | `nextwise-logo-horizontal-dark.png` letterboxed on its own sampled navy field, 1200×630 | Open Graph / Twitter card image |

**Why the header/footer/admin sidebar use the icon + code-rendered text, not the flattened horizontal lockup:**
the supplied horizontal lockup is baked onto (or transparent against) one specific background. The app has two
different surface colors the logo appears on — light (`bg-surface`) and a dark navy (`bg-primary`, `#1c2b4a`) —
and neither supplied flattened asset matches `#1c2b4a` exactly (the dark render's own background is closer to
near-black `#000c24`), so placing it there would show a visible mismatched rectangle. Rather than recolor or
re-crop the supplied artwork (explicitly out of scope), `src/components/navigation/Logo.tsx` uses the
transparent icon mark (which reads correctly on both light and dark surfaces) next to a `NextWise` text label
whose color is set by CSS to match whatever surface it's on. The full flattened lockup is reserved for the two
places the surrounding background is fixed and known: the PDF header (always white) and the Open Graph image
(its own canvas).

Two supplied source renders were intentionally not shipped as separate assets: a second, slightly different
colorway of the transparent horizontal lockup, and an abstract dark "mood" render of the mark (no wordmark, not
a usable lockup at any size). Consolidating to one canonical asset per use case avoids shipping visually
inconsistent near-duplicates; the abstract render remains available in the original upload if wanted for future
marketing use, but was not integrated anywhere.

## 3. The central brand configuration

`src/config/site.ts` already existed as the project's documented single source of truth for brand identity
before this update (it was under-used — see below) and remains that source now, extended with:

- `BRAND_NAME`, `BRAND_PRODUCT_NAME`, `BRAND_SHORT_NAME` — all `"NextWise"`
- `BRAND_TAGLINE` — `"Know What's Next."` (the tagline on the supplied logo lockup)
- `BRAND_SHORT_DESCRIPTION` — the description used in metadata and the footer
- `BRAND_LOGO` — every logo asset path plus known dimensions (so `<Image>` usages always set explicit
  `width`/`height`, avoiding layout shift)
- `SITE_URL` — now read from `NEXT_PUBLIC_APP_URL` (already used elsewhere for payment-link URLs) instead of a
  hardcoded empty string, so metadata's canonical URL and Open Graph image URLs resolve correctly once that
  variable is set in production
- `CONTACT.emailLabel` — the placeholder support-email domain was updated to `@nextwise.example` (still
  explicitly marked `(placeholder)` — no real support inbox exists yet; see §6)

**Before this update, `BRAND_NAME` was defined but not consistently used** — most pages hardcoded the literal
string "CareerPath AI" instead of importing the constant, despite the file's own docblock instructing otherwise.
This update fixed every one of those call sites in addition to renaming the constant, so the "single source of
truth" claim in the file's docblock is now actually true.

## 4. What was intentionally NOT renamed, and why

Per the branding update's own constraints, these technical identifiers were left exactly as they were:

| Identifier | Value kept | Why |
|---|---|---|
| npm package name | `careerpath-ai` (`package.json` `name` field, `package-lock.json`) | Purely a technical package identifier; renaming risks breaking any external tooling, deployment config, or lockfile assumptions keyed on it, for zero user-visible benefit |
| Local repository/folder name | `careerpath-ai` | Same reasoning; also outside this update's file-delivery scope |
| Database table names, function names, migration filenames | Unchanged (e.g. `applications`, `billing_settings`, `0004_admin_system.sql`) | Renaming tables/functions requires new migrations and risks breaking RLS policies, foreign keys, and every data-access module referencing them by name, for no user-visible benefit — schema identifiers are not brand surface |
| Environment variable names | Unchanged (`RAZORPAY_KEY_ID`, `NEXT_PUBLIC_APP_URL`, etc.) | Same reasoning; also would require every deployment's env configuration to be updated in lockstep |
| API routes / URL paths | Unchanged | Not brand surface; changing them would break bookmarks and any external links |
| Razorpay identifiers, stored payment/provider IDs | Unchanged | Historical transaction data — must never be rewritten |
| `supabase/migrations/0004_admin_system.sql` line 600 (a `comment on column` string containing "CareerPath AI") | Unchanged | This is an already-applied historical migration; the instruction governing this update explicitly says not to modify old migrations. The string is an internal DB metadata comment (visible only to someone inspecting the schema directly, e.g. via `\d+` in `psql`), not user-facing UI text. A future migration could update the column comment if desired, but that is a judgment call left to the project owner rather than assumed necessary for a branding pass |
| `docs/global-education-data-guide.md`, other Milestone-specific guides | Not scanned/rewritten beyond what a repo-wide search found (none contained the old brand string) | Out of scope unless they actually referenced the old name |

Nothing in `.git` history, if a `.git` directory exists in your own clone, was rewritten — this update only
changes file contents going forward, exactly like any other commit.

## 5. Manual steps outside this repository (Supabase auth emails)

**This repository contains no custom email-sending code.** Every account-related email (signup confirmation,
password reset, magic link, email change) is Supabase Auth's own built-in transactional email, configured
entirely in the Supabase dashboard — not in this codebase — so this update could not reach it. If you want those
emails to say "NextWise" instead of the old name (or instead of Supabase's generic default), do this by hand:

1. Open your Supabase project dashboard → **Authentication** → **Email Templates**.
2. For each template (Confirm signup, Invite user, Magic Link, Change Email Address, Reset Password), replace
   any literal product-name text in the subject and body with "NextWise". These templates are plain
   HTML/Go-template text stored by Supabase, not files in this repo.
3. Open **Authentication** → **Settings** → **SMTP Settings** (or **Emails** in newer dashboard layouts) and set
   the "Sender Name" (From name) to "NextWise" if you have a custom SMTP provider configured. If you're using
   Supabase's default email sending, the sender name is fixed by Supabase and cannot be customized without
   configuring your own SMTP provider.
4. If any email template hardcodes a link back to the app (a "confirm your account" URL), confirm it points at
   your production `NEXT_PUBLIC_APP_URL`, not a local development URL — Supabase templates default to
   `{{ .SiteURL }}`, which is a project-level setting under **Authentication** → **URL Configuration**, not
   something this codebase controls.

None of this can be verified or changed by editing files in this repository — it requires dashboard access to
your specific Supabase project.

## 6. Legal pages requiring owner confirmation

The following pages and settings mention the product by name, or make claims that depend on who the legal
entity behind the product actually is. This update replaced the *product name* on each of them (a straightforward
find-and-replace of "CareerPath AI" → "NextWise" in visible copy) but did **not** alter their substantive legal
claims, and did not invent any legal-entity detail. Review each before relying on them:

- [ ] `/terms` (`src/app/(site)/terms/page.tsx`) — placeholder Terms of Service; the page itself already states
  it is "pending professional legal review before launch"
- [ ] `/privacy` — check for any remaining product-name references and confirm data-handling claims still match
  actual practice
- [ ] `/refund-policy` — confirm refund terms still match actual practice under the new name
- [ ] Admin **Billing settings** (`billing_settings.legal_entity_name`, `business_address`, `gstin`, etc.) — these
  are admin-entered, default to `null`, and were **not** touched or auto-populated with "NextWise". If your
  registered legal entity name differs from the product name (common — e.g. "NextWise" the product, "Example
  Learning Private Limited" the registered company), enter the real legal entity name here yourself; never let
  the product name stand in for it
- [ ] `CONTACT.emailLabel` in `src/config/site.ts` — still an explicitly labeled placeholder
  (`hello@nextwise.example (placeholder)`); replace with a real, monitored support address before launch
- [ ] Any printed/PDF footer note (`billing_settings.invoice_footer_note`) — admin-entered, untouched by this
  update; review it separately if it references the old name

This update deliberately did not "fix" any of these by inventing a registration number, address, or tax ID —
per the standing instruction to never fabricate legal/business details.

## 7. Renaming the brand again in the future

Everything in §3 lives in `src/config/site.ts`. To rename the product again:

1. Update the `BRAND_*` constants in `src/config/site.ts`.
2. Replace the files under `public/brand/` with new logo assets (keep the same filenames, or update
   `BRAND_LOGO`'s paths and dimensions to match new files).
3. Update `src/app/favicon.ico`, `src/app/icon.png`, and `src/app/apple-icon.png` (Next.js's special
   `app/`-root icon file convention — see `node_modules/next/dist/docs/01-app/03-api-reference/
   03-file-conventions/01-metadata/app-icons.md` in this project's own Next.js install for the exact rules,
   since this project pins a Next.js version with file-convention behavior that can differ from older docs
   you may have seen elsewhere).
4. Search the repo for any remaining hardcoded product-name strings the way this update did (`grep -rn` for the
   old name across `src/`, `supabase/`, `docs/`, `README.md`, `.env.example`, `package.json`) — every page that
   already imports `BRAND_NAME` from `@/config/site` will pick up the new name automatically; anything still
   hardcoding a literal string will not.
5. Repeat the manual Supabase steps in §5 for the new name.

## 8. Known limitations

- The Razorpay checkout modal's merchant `name`/`image` fields (`src/components/payments/PayButton.tsx`) are
  controlled by this app, but the underlying Razorpay *account* display name (shown on the user's bank/card
  statement) is configured in the Razorpay dashboard, not here — update it there separately if desired.
- `next/image`'s automatic optimization is not exercised for the PDF logo (pdf-lib embeds the raw PNG bytes
  directly, which is correct and necessary for a PDF — `next/image` is a browser-only concern).
- The Open Graph image (`nextwise-social-share.png`) is a static, pre-rendered PNG rather than a dynamically
  generated `opengraph-image.tsx` route — sufficient for a single fixed site-wide image, but if per-page social
  images are ever wanted, that would need Next.js's `ImageResponse` file-convention route instead.
- `SITE_URL` (and therefore the canonical/Open Graph URLs) is empty until `NEXT_PUBLIC_APP_URL` is set in
  production — this mirrors the pre-existing, deliberate "no invented domain" convention already documented in
  `src/config/site.ts`'s history, not a regression introduced by this update.
