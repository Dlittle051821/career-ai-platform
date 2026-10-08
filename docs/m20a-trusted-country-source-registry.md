# M20A — Launch Country Definition + Trusted Source Registry

## Purpose

Nextwise's internal university/course catalogue (Milestone 9's global
education-data platform) will not have complete coverage for every
destination at launch. M20's purpose is to make Nextwise still useful for
study-abroad discovery when that coverage is incomplete — by being able to
point a student to a trusted, authoritative **national** study source for
a given destination, instead of either pretending to have complete
coverage or leaving the student with nothing.

M20A is the first of three milestones (M20A/M20B/M20C) and is scoped
narrowly: **define** the launch countries and their one authoritative
source each, and confirm the data/configuration foundation M20B (search
integration) and M20C (country landing pages) will build on. M20A does
not change any page a student sees — see "What was deliberately NOT
implemented yet" below.

## Launch countries — and why these six

Tier 1 launch countries (ISO 3166-1 alpha-2, this codebase's existing
country-code convention):

| Code | Country |
| --- | --- |
| DE | Germany |
| GB | United Kingdom |
| US | United States |
| CA | Canada |
| AU | Australia |
| IE | Ireland |

These six were specified directly by this milestone's own task brief, not
derived or inferred by this pass. They are a deliberate, hand-curated
product decision — the same "small, explicit, auditable table" discipline
this codebase already uses for `SUBJECT_TAXONOMY`
(`src/lib/education/external-search/taxonomy.ts`) — rather than being
generated from `public.countries` (which holds dozens of countries for
the general education-data platform, unrelated to which ones Nextwise is
prepared to offer a trusted national fallback for at launch).

## Existing architecture found

Before writing anything, this pass searched the real repository for the
terms the task brief itself named as likely already present
(`external_search_providers`, `trusted_source`, `getTrustedSearchResults`,
country mappings) and confirmed: **UX07 already built almost exactly this
system**, under the name "Trusted Global Course Search." Reusing it,
rather than building a second one, is both the task's own explicit
instruction and the only sensible choice once it was found.

### Existing tables (unmodified by M20A)

- `public.external_search_providers` (`supabase/migrations/0009_trusted_course_search.sql`) — one row per trusted, officially-run external source. Already has: `country_code` (FK to `public.countries.iso_alpha2`), `display_name`, `official_domain`, `base_url`/`fallback_url`, `provider_type` (`course_search`/`institution_verification`/`joint_programme`), `strategy` (`verified_deep_link`/`query_parameter_search`/`official_landing_page`/`manual_search_instructions`), `description`, `warning_text` + effective/review dates, `active`, `last_verified_at`, `verified_by`, `supported_degree_levels`. RLS: anyone can read `active = true` rows; `super_admin`/`admin`/`analyst` can read all; `super_admin`/`admin` can write; no delete policy for anyone (deactivate, never delete).
- `public.external_search_mappings` — admin-verified subject+degree+destination deep links or manual-search instructions, scoped to one provider. Not used by M20A (no new mapping rows were added — see below).
- `public.external_search_clicks` — append-only, privacy-conscious outbound-click and search-gap log. Not touched by M20A.

### Existing TypeScript layers (unmodified by M20A)

- `src/types/education-search.ts` / `src/lib/education/external-search/provider-types.ts` — camelCase shapes mirroring the tables above.
- `src/lib/education/external-search/adapter.ts` — pure resolution logic (`buildProviderSearchResult`): decides, from a provider + optional mapping, what URL/instructions/warning to show, enforcing "never build a URL from undocumented filter codes," "only allow-listed HTTPS domains," "fall back to the landing page if a deep link is stale or invalid," and degree-level gating.
- `src/lib/education/external-search/url-validation.ts` — **the existing trusted-source helper this milestone was told to verify and reuse**: `validateExternalUrl()` (HTTPS-only, rejects `javascript:`, rejects embedded credentials, enforces a domain allow-list with subdomain support but no look-alike/substring match) and `isVerificationStale()` (12-month staleness threshold).
- `src/lib/supabase/education/external-search.ts` — the public/student-facing data-access layer, including `getTrustedSearchResults()`.
- `src/lib/supabase/admin/external-search.ts` — the admin CRUD layer (`listProviders`, `createProvider`, `setProviderActive`, `recordProviderVerification`, etc.), gated by the existing `trusted-portals:read`/`trusted-portals:write` permission strings (`src/lib/admin/permissions.ts`).
- `src/components/sections/education/TrustedExternalSearchCard.tsx` — the existing, already-correct student-facing UI card, which already discloses "{provider} is not part of NextWise — availability and content on that site are managed entirely by {provider}."

### Duplicate architecture created

**NO.** M20A added zero new tables, zero new columns, zero new admin
permission strings, and zero new URL-validation logic. Every new file
this milestone added either reads data that already exists (nothing — see
below, M20A's new modules are pure config, not data-access code) or adds
new **rows** to the existing `external_search_providers` table via a new,
idempotent seed file. See "Files created" below for the complete list.

## Registry mechanism used

**No database migration.** The existing schema already represents every
field the task's own "Registry Data Model" section asked for:

| Task's required field | Existing representation |
| --- | --- |
| Country | Resolved from `country_code` via `public.countries` (already how every other part of this codebase shows a country name) |
| Country code | `external_search_providers.country_code` (`iso_alpha2`) |
| Provider/source name | `display_name` |
| Authority/owner | Folded into `display_name` (e.g. "Study UK — British Council") — this codebase has no separate "authority" column, and the task itself says "do not add fields just for completeness if the existing system does not need them operationally" |
| Primary URL | `base_url` |
| Purpose | `description` |
| Source category | `provider_type` (`course_search` — the closest, and correct, existing category; every one of this milestone's six sources does programme/course/institution discovery per its own stated purpose) |
| Active state | `active` |
| Attribution label | Not a stored field — a presentation concern, built at render time from `display_name` by the new `buildTrustedSourceAttribution()` helper (see below) |
| Last reviewed date | `last_verified_at` |
| External-link behavior | `strategy` (all five new rows: `official_landing_page`, since none has a client-given subject-filtered deep link) |

Because every field was already representable, this milestone reports
**Database migration: NONE** rather than `M20A DATABASE EXTENSION
REQUIRED`.

### What M20A actually added

1. **A new, idempotent seed file** — `supabase/seed/0008_m20a_launch_country_sources_seed.sql`. Inserts exactly five new rows into the existing `external_search_providers` table (not a new table): Study UK — British Council (GB), EducationUSA (US), Government of Canada — International Student Guidance (CA), Study Australia — Australian Government (AU), Education in Ireland (IE). Germany's launch-primary source (DAAD International Programmes) already existed, already active, already carrying a real verified deep link, seeded by UX07's own `0006_trusted_course_search_seed.sql` — this file does not touch it. Uses `on conflict (slug) do nothing`, the exact same idempotency convention as the existing seed file.
2. **A new pure TypeScript config module**, `src/lib/education/external-search/launch-countries.ts` — the `LAUNCH_COUNTRY_CODES` list, display names, and a normalizer (`normalizeLaunchCountryCode`), the one place "is this one of the six Tier 1 launch countries" is ever defined.
3. **A new pure TypeScript config module**, `src/lib/education/external-search/launch-country-sources.ts` — `LAUNCH_COUNTRY_PRIMARY_SOURCES`: exactly one row per launch country, pointing at the provider `slug` that is that country's single launch-primary source, plus the authority/domain/purpose text from the task brief. This module never talks to Supabase and never duplicates a provider's live data (active state, verification date, etc. all still live solely in the DB) — it only re-labels which already-existing (or newly seeded) provider row is the designated primary for each of the six launch countries. This is a deliberate, narrow, product-specific designation that does not belong on the general-purpose provider table (which is explicitly designed to allow many provider rows per country) — see the file's own docblock for the full reasoning.
4. **A new pure TypeScript helper module**, `src/lib/education/external-search/attribution.ts` — the shared wording ("Official study source" / "Trusted national source" / "Continue on the official source" / "External website") and a `containsUnsupportedPartnershipLanguage()` guard against phrases like "our partner" or "verified by Nextwise."
5. **Three new test files**, one per module above (`*.test.ts`), covering exactly the invariants the task's own "Testing" section asked for — see "Testing" below.

No existing file was modified. `git status --short` against the real `release/m10` baseline shows only these seven new files.

## Each primary authoritative source

| Country | Primary source | Authority | Domain | Provider row |
| --- | --- | --- | --- | --- |
| Germany | DAAD International Programmes | DAAD — German Academic Exchange Service | daad.de (served from www2.daad.de) | Already existed (UX07), active, with a real verified Bachelor's/Mechanical Engineering deep link — untouched by M20A |
| United Kingdom | Study UK | Study UK — British Council | study-uk.britishcouncil.org | New row, this milestone's seed, `active = true`, `official_landing_page` |
| United States | EducationUSA | EducationUSA (U.S. Department of State) | educationusa.state.gov | New row, this milestone's seed, `active = true`, `official_landing_page` |
| Canada | Government of Canada — International Student Guidance | Government of Canada | canada.ca | New row, this milestone's seed, `active = true`, `official_landing_page` |
| Australia | Study Australia | Study Australia — Australian Government | studyaustralia.gov.au | New row, this milestone's seed, `active = true`, `official_landing_page` |
| Ireland | Education in Ireland | Education in Ireland | educationinireland.com | New row, this milestone's seed, `active = true`, `official_landing_page` |

Each country has **exactly one** source marked launch-primary (enforced
by `launch-country-sources.test.ts`, which asserts no duplicate
`countryCode` and no duplicate `providerSlug` across the whole registry).
UX07's own, pre-existing, different provider rows for five of these six
countries (UCAS for GB, College Navigator/NCES for US, EduCanada for CA,
CRICOS for AU, CAO for IE) are **untouched** and remain in the table as
additional, non-primary, specialist sources — exactly the allowance the
existing architecture's own design already made room for ("additional
specialist sources can be added later").

### Why these five new rows were seeded `active = true`

Most of UX07's own seed rows are `active = false` because the original
specification gave only a bare domain name for them, with an explicit
instruction to verify before activation. This milestone's five new rows
are different: the **task brief itself** gives a concrete, ready-to-use
"Primary domain" for each — the same footing UX07's seed already treated
as sufficient to activate UCAS, CRICOS, and NCES College Navigator as
landing-page providers (a spec-given domain, used as an official landing
page, with no fabricated deep link invented on top of it). `last_verified_at`
is stamped to the seed's run date and `verified_by` is left null, exactly
matching how UX07's own programmatically-seeded active rows were handled.

## Attribution rules

Every trusted-source mention must say the source is an **external
authority**, never a Nextwise partner, endorsement, or owned asset. The
shared constants in `attribution.ts`:

- `TRUSTED_SOURCE_ATTRIBUTION_LABEL` = "Official study source"
- `TRUSTED_NATIONAL_SOURCE_LABEL` = "Trusted national source"
- `CONTINUE_ON_OFFICIAL_SOURCE_LABEL` = "Continue on the official source"
- `EXTERNAL_LINK_BADGE_LABEL` = "External website"

`buildTrustedSourceAttribution(sourceDisplayName)` composes the first and
last of these with the source's own real name, never rewriting it.
`containsUnsupportedPartnershipLanguage(text)` is a small, explicit,
hand-reviewed phrase list (not a fuzzy/sentiment check) catching "our
partner," "Nextwise official partner," "verified by Nextwise," and
similar — this milestone's own registry content (every `authority`/
`purpose` string, and the new seed file's prose) is tested against it.
This is new wording for the country-fallback messaging M20B/M20C will
build; it does not replace or duplicate `TrustedExternalSearchCard.tsx`'s
own, already-correct existing disclosure ("{provider} is not part of
NextWise…"), which this pass left untouched.

## Fallback principle (prepared, not implemented)

M20's eventual behavior: if Nextwise's own catalogue has relevant
results, show them (optionally alongside "continue your research on the
official national source"); if not, show a transparent fallback pointing
at the trusted national source instead of pretending to have coverage.
M20A prepares the data this behavior will need — a stable way to ask "for
this launch country, what is the one trusted source to fall back to?"
(`getLaunchCountryPrimarySource(countryCode)`) — without building any of
the actual UI or catalogue-emptiness detection. That is explicitly M20B's
(search integration) and M20C's (country landing pages) job.

## Security considerations

- No new public write path: M20A adds no new table, no new RPC, no new Server Action. The only new data-access surface is a seed file executed manually against Supabase (never run against the real database by this pass — see Install Instructions), using plain `insert ... on conflict do nothing` against a table whose RLS policies (anyone reads `active = true`, only `super_admin`/`admin` write) already existed and are unchanged.
- No admin permission widened: `trusted-portals:read`/`trusted-portals:write` are unchanged; M20A's new TypeScript modules don't call `requireAdminPermission` at all (they are pure, DB-free config/helpers), so there was nothing to widen.
- No service-role leakage, no client-side secret: every new module is plain, framework-free TypeScript data/logic — no credentials, no server/client boundary concerns.
- URL safety: every domain this milestone names is validated against the existing, unmodified `validateExternalUrl()` (HTTPS-only, no `javascript:`, no embedded credentials, domain-allowlisted with anti-look-alike anchoring) — see `launch-country-sources.test.ts`'s "safe external URL handling" suite. No new URL-validation logic was written.

## Future M20B/M20C integration points

- M20B (search integration): when `getTrustedSearchResults()`'s internal-catalogue lookup comes back empty/incomplete for a launch country, it can call `getLaunchCountryPrimarySource(countryCode)` to get the one provider slug to look up and offer as the fallback, then resolve that slug to its live row the same way `src/lib/supabase/education/external-search.ts` already resolves any other provider.
- M20C (country landing pages): can use `LAUNCH_COUNTRY_CODES`/`LAUNCH_COUNTRY_NAMES` to know which countries get a dedicated landing page at launch, and `buildTrustedSourceAttribution()`/the shared wording constants to render the "Official study source" / "Continue on the official source" affordance consistently with however M20B ends up building the search-side fallback card.
- Both can safely treat `LAUNCH_COUNTRY_PRIMARY_SOURCES` as the single source of truth for "which provider row is this country's launch-primary," without re-deriving it.

## What was deliberately NOT implemented yet

- No page, route, or UI component was added or changed. No student or admin will see any visible change from M20A alone.
- No "catalogue has no/incomplete results" detection logic — that is M20B's job; M20A only prepared the source to fall back to, not the trigger for when to use it.
- No new `external_search_mappings` row for any of the five new providers — none has a client-given, subject-filtered deep link; each is `official_landing_page` only. A future admin (or M20B/M20C) can add a verified deep-link mapping through the existing admin tooling exactly the way UX07's own DAAD/UCAS mappings were added.
- No admin UI page for managing these new rows was built — `src/app/admin/trusted-portals/**` is referenced in the existing data-access layer's own docblock but does not yet exist in this codebase; building it was never in M20A's scope and the existing CRUD functions (`src/lib/supabase/admin/external-search.ts`) already work against these new rows exactly as they work against every other provider row, with no change needed.
- No SEO change: country landing pages are explicitly M20C's responsibility. `robots.ts`/`sitemap.ts`/canonical/structured-data/OG/Twitter metadata are all unchanged (confirmed — this pass touched no file under `src/lib/seo/` or any of those files).
