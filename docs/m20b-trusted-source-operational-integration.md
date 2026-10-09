# M20B — Trusted Country Source Operational Integration

## Baseline

`release/m10` @ `481ba4e` ("M20A trusted launch country source registry"),
95 test files / 1632 tests, `tsc`/lint/build all clean on a fresh isolated
clone before any M20B change.

## Existing operational architecture (traced end to end before changing anything)

```
public.external_search_providers / external_search_mappings / external_search_clicks   (supabase/migrations/0009_trusted_course_search.sql)
          │
          ▼
src/lib/supabase/education/external-search.ts   — getTrustedSearchResults() / recordExternalSearchClick() / recordMappingGapEventForPrimaryResult()
          │                                         (public/student read path; RLS-scoped to active=true/mapping_status='active')
          ▼
src/lib/education/external-search/adapter.ts    — buildProviderSearchResult() (pure: active/degree-level gating, deep-link-then-landing-page fallback)
          │
          ├─▶ src/lib/education/external-search/url-validation.ts — validateExternalUrl()/isVerificationStale() (pure; HTTPS-only, no javascript:, domain-allowlisted)
          │
          ▼
src/components/sections/education/TrustedExternalSearchCard.tsx   — student-facing card, rendered from /courses and /universities
          │
          ▼
src/app/go/course-search/[mappingId]/route.ts
src/app/go/course-search/provider/[providerId]/route.ts            — the ONLY outbound redirect path; re-validates server-side right before redirecting; records the click
```

Admin side (unchanged, not touched by M20B):
`src/lib/supabase/admin/external-search.ts` (CRUD for providers/mappings,
click/search-gap reporting) gated by the existing
`trusted-portals:read`/`trusted-portals:write` permission strings in
`src/lib/admin/permissions.ts`.

Country-code handling: `country_code` everywhere is ISO 3166-1 alpha-2
(`public.countries.iso_alpha2`) — `GB`, never `UK`. M20B introduces no new
country-code vocabulary; every new file uses the exact same codes M20A's
`LAUNCH_COUNTRY_CODES` already defined.

### Active/inactive filtering (pre-existing, unchanged)

- `listActiveProvidersForDestination()` queries `.eq("active", true)` — an inactive provider is never fetched for a student at all.
- `buildProviderSearchResult()` additionally returns `{available: false, reason: "provider_inactive"}` for any provider it is handed that isn't active — belt-and-braces, not the only gate.
- RLS (`0009_trusted_course_search.sql`) independently restricts an anon/authenticated non-admin client to `active = true` providers and `mapping_status = 'active'` mappings of active providers — this is the actual authoritative gate; the two checks above are defense in depth on top of it.

### Redirect routes (pre-existing, unchanged, re-audited)

Both `/go/course-search/[mappingId]` and `/go/course-search/provider/[providerId]` accept **only an internal UUID path segment** — never a `?url=` or any other client-suppliable URL — which is what makes an open redirect structurally impossible here, not merely discouraged. Each route independently: (1) shape-checks the id, (2) loads the row (RLS already hides anything inactive), (3) re-confirms `active`/`mapping_status` explicitly, (4) **re-validates** the final URL against the provider's own `official_domain` via `validateExternalUrl()` right before redirecting — never reuses a URL without re-checking it — and (5) records the click server-side from already-validated ids. M20B changed nothing in either route file; this audit confirms they already satisfy every "GO ROUTES" requirement in this milestone's own brief.

## M20A integration points

M20A's registry — `src/lib/education/external-search/launch-country-sources.ts`'s `LAUNCH_COUNTRY_PRIMARY_SOURCES` / `getLaunchCountryPrimarySource()` — is the **only** place "which provider is this launch country's primary" is decided. M20B does not duplicate that decision anywhere; every new M20B file calls into it.

### M20A seed/registry review (verified, not assumed)

`supabase/seed/0008_m20a_launch_country_sources_seed.sql` was re-read in full for this milestone. Confirmed:

- Idempotent: every insert uses `on conflict (slug) do nothing` — a second run inserts zero duplicate rows.
- No destructive update: the file contains no `update`/`delete` statement at all, only `insert`.
- Germany's pre-existing DAAD row (from UX07's own `0006_trusted_course_search_seed.sql`) is not referenced or touched.
- All five new rows use deterministic, hand-chosen slugs (`study-uk-british-council`, `educationusa`, `government-of-canada-study`, `study-australia`, `education-in-ireland`) — never a generated/random identifier — so re-running the seed, or referencing these providers from new code (as `launch-country-sources.ts` already does), is always deterministic.
- Every `base_url`/`official_domain` is HTTPS and matches the registry's own `primaryDomain` exactly (asserted by M20A's own `launch-country-sources.test.ts`, re-confirmed by this milestone's reading of both files side by side).
- `active = true` on all five, `provider_type = 'course_search'` (the existing, correct vocabulary — no new enum value needed).
- No unsupported schema field — the file inserts only columns `0009_trusted_course_search.sql` already defines.

**No defect found.** The seed is included in this package unchanged, exactly as M20A produced it — M20B adds no new seed file of its own, because no new data was required: six primaries across six countries were already fully seeded once M20A's own seed is applied (Germany via UX07's seed, the other five via M20A's).

### How primary source selection works (new, M20B)

`src/lib/education/external-search/launch-primary-result.ts` (new, pure, no DB access):

- `isLaunchPrimaryResult(result, destinationCountryCode)` — true only when `result.providerSlug` equals the slug `getLaunchCountryPrimarySource(destinationCountryCode)` returns. Delegates entirely to M20A's registry; never infers primary status from display order, provider type, or any other heuristic; never hardcodes a second country→provider table.
- `compareTrustedSearchResults(a, b, destinationCountryCode)` — the complete, now-unit-tested ordering rule: a genuine filtered deep link still always sorts first (the pre-existing UX07 rule, unchanged); the launch-country primary is the tie-break among equally-filtered results; every other relative order is left exactly as `Array.prototype.sort`'s guaranteed stability preserves it.

### How specialist providers coexist

UX07's own, pre-existing provider rows for five of the six launch
countries (UCAS/GB, College Navigator·NCES/US, EduCanada/CA, CRICOS/AU,
CAO/IE) are untouched by M20A and untouched by M20B. They remain valid,
active (where they already were), `country_code`-matching rows that
`listActiveProvidersForDestination()` still returns alongside the new
launch-primary for the same country — `getTrustedSearchResults()` already
supports many providers per destination by design. M20B's only change
there is ordering (see above): the primary now appears before the
specialist among non-deep-link results, so the two are never confused,
without either being hidden or treated as mutually exclusive.

### Attribution behavior (new, M20B integration into existing UI)

`TrustedExternalSearchCard.tsx` (existing component, small targeted edit):
for a result where `isLaunchPrimaryResult(result, result.countryCode)` is
true, its header eyebrow now reads M20A's `TRUSTED_SOURCE_ATTRIBUTION_LABEL`
("Official study source") instead of the card's pre-existing generic
"Official external portal" label. Every other result — every non-launch
country, and every launch country's own non-primary specialist provider —
keeps the original wording verbatim. The card's pre-existing "{provider} is
not part of NextWise — availability and content on that site are managed
entirely by {provider}" disclosure, its domain badge, its verification-date
line, and its `/go/course-search/**`-only link behavior are all unchanged.
No partnership/endorsement/affiliation language was added anywhere — a
static source-text audit test (`trusted-source-card-attribution.test.ts`)
confirms the card's own source text never trips
`containsUnsupportedPartnershipLanguage()`.

### URL safety (unchanged, re-confirmed)

`validateExternalUrl()` was not modified. M20B's only new code path that
touches a URL at all is the pre-existing `/go/**` redirect routes
(unchanged) and the pre-existing adapter (unchanged) — M20B adds no new
URL-construction logic of its own, so there is nothing new to introduce an
open-redirect, protocol-relative, userinfo, or look-alike-domain bypass
through. The existing allow-list-anchored, HTTPS-only, `javascript:`/
`data:`-rejecting behavior is exactly as it was.

## Seed strategy (for the real repo — not executed by this package)

`supabase/seed/0008_m20a_launch_country_sources_seed.sql` (M20A's file,
reviewed above, included unchanged in this package) is the one seed this
milestone's install instructions ask you to run, against your own
Supabase project, at your own discretion. See
`M20B_INSTALL_INSTRUCTIONS.md` for the exact steps, including re-running
it a second time to demonstrate idempotency and the verification queries
to run afterward. **No seed was executed against any real database while
building this package.**

## What M20C can now rely on

- `isLaunchPrimaryResult()`/`compareTrustedSearchResults()` as the one place "is this the primary / how should results be ordered" is decided — a future country-landing-page build can reuse either without re-deriving the logic.
- `getTrustedSearchResults()` already returns launch-primary-first-among-equals ordering for any of the six launch countries, with no further plumbing required.
- The student-facing card already distinguishes a launch-primary result visually (via its eyebrow label) without any new prop or layout — M20C can lean on this as-is, or extend it further, starting from a result that already renders correctly today.

## What was deliberately NOT changed

- No new database table, column, or migration — every field M20B needed already existed (reused in full from M20A/UX07).
- No change to `src/lib/admin/permissions.ts` or any RLS/RPC — `trusted-portals:read`/`trusted-portals:write` are exactly as they were; no admin UI was added.
- No change to the `/go/course-search/**` route files themselves — they were audited and found already compliant with every safety requirement this milestone asked for.
- No change to `adapter.ts` or `url-validation.ts` — both reused exactly as-is.
- No large new student-facing layout or country-discovery page — that is explicitly M20C's scope; the card change here is a single conditional label, not a redesign.
- No change to any SEO file, Vercel configuration, environment variable, or payment/pricing path.
- The known footer placeholder-email launch-cleanup item (if present) was not touched — out of scope for this milestone and not required by any file M20B touched.
