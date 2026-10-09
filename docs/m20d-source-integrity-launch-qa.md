# M20D FINAL — Source Integrity, Trusted-Link QA & Launch-Country Readiness

**Type:** Audit-and-hardening milestone (no redesign, no new features).
**Baseline:** `release/m10` @ `821c4a7` ("M20C trusted country discovery UX"), 98 test files / 1675 tests.
**Result baseline:** 99 test files / 1688 tests (13 new tests, 0 removed, 0 skipped, 0 production files modified).

## 1. Baseline gate

Real repo (`C:\carrier.ai`, as reproduced in a disposable isolated clone — the device bridge was not connected this session; see `M20D_COMPLETION_REPORT.md` "Environment note"):

- `git rev-parse HEAD` → `821c4a7f712ebe5af37ba9c50839c119df9ffe79`
- `git log -1 --oneline` → `821c4a7 M20C trusted country discovery UX`
- `git status --short` → empty (clean)
- `npx tsc --noEmit` → clean
- `npm run lint` → clean
- `npm test` → **98 files / 1675 tests, all passed** — exact match to the task's expected baseline
- `npm run build` → succeeded, full route manifest including both `/go/course-search/**` routes, `/courses`, `/universities`

Baseline confirmed exactly as the task brief asserted. No "baseline has moved" handling was needed.

## 2. Trusted-source chain architecture summary

The chain is a single, consistent pipeline, unchanged by this audit:

1. **Registry layer (M20A, pure TS, no DB):** `launch-countries.ts` (`LAUNCH_COUNTRY_CODES`, `LAUNCH_COUNTRY_NAMES` — GB/"United Kingdom", never "UK"), `launch-country-sources.ts` (`LAUNCH_COUNTRY_PRIMARY_SOURCES` — exactly one `providerSlug` per country, re-labelling existing provider rows rather than duplicating their data), `attribution.ts` (approved labels + `UNSUPPORTED_PARTNERSHIP_PHRASES` + `containsUnsupportedPartnershipLanguage`).
2. **Data layer (UX07, reused unmodified):** `external_search_providers` / `external_search_mappings` / `external_search_clicks` tables (`supabase/migrations/0009_trusted_course_search.sql`), with RLS restricting anon/authenticated reads to `active = true` rows and admin-only writes. `src/lib/supabase/education/external-search.ts` (`listActiveProvidersForDestination`, `findActiveMappings`, `getTrustedSearchResults`, `getMappingWithProviderById`, `getProviderById`, `recordExternalSearchClick`).
3. **Resolution layer (UX07/M20B):** `adapter.ts`'s `buildProviderSearchResult` — inactive-provider check, degree-level gating, then a strict attempt order (verified non-stale deep link → manual instructions → landing page → fallback URL → fail-closed `no_valid_url_available`), each URL re-validated by `url-validation.ts`'s `validateExternalUrl` (HTTPS-only, no credentials, no `javascript:`, dot-anchored domain allow-list) immediately before use. `launch-primary-result.ts`'s `isLaunchPrimaryResult`/`compareTrustedSearchResults` orders the launch-primary first among any same-country results.
4. **Redirect layer (UX07, defense-in-depth):** `/go/course-search/[mappingId]` and `/go/course-search/provider/[providerId]` — UUID-shape-checked path param only, no `?url=`/searchParams redirect path, re-validates the stored URL a second time immediately before `NextResponse.redirect`, logs the click server-side.
5. **UX layer (M20C):** `LaunchCountryDiscovery.tsx` (chip nav, `aria-current`, real `<Link>` elements — natively keyboard operable, `flex-wrap` so no horizontal mobile scroll trap), `TrustedExternalSearchCard.tsx` (attribution label, `target="_blank" rel="noopener noreferrer"`, visible external-link icon, `aria-live` status region), wired into `/courses` and `/universities`.

No change to this architecture was needed or made. Every item below is the result of auditing it, not redesigning it.

## 3. Launch-primary source integrity audit (13-point check × 6 countries)

| Country | Provider slug | Official domain | Base URL HTTPS | Fallback HTTPS | Provider type | Attribution wording | No partnership language | Duplicate primary | Specialist-as-primary risk |
|---|---|---|---|---|---|---|---|---|---|
| DE | `daad-international-programmes` | `daad.de` | ✅ | n/a | `course_search` | approved | none found | none (see §6, DAAD pair is reviewed-safe) | none — `daad-degree-programmes` never named primary (now asserted by test) |
| GB | `study-uk-british-council` | `study-uk.britishcouncil.org` | ✅ | n/a | `course_search` | approved | none found | none | UCAS stays specialist-only |
| US | `educationusa` | `educationusa.state.gov` | ✅ | n/a | `course_search` | approved | none found | none | College Navigator/NCES stays specialist-only |
| CA | `government-of-canada-study` | `canada.ca` | ✅ | n/a | `course_search` | approved | none found | none | EduCanada stays specialist-only (and inactive per seed) |
| AU | `study-australia` | `studyaustralia.gov.au` | ✅ | n/a | `course_search` | approved | none found | none | CRICOS stays specialist-only |
| IE | `education-in-ireland` | `educationinireland.com` | ✅ | n/a | `course_search` | approved | none found | none | CAO stays specialist-only (and inactive per seed) |

Country-code convention: `LAUNCH_COUNTRY_NAMES.GB === "United Kingdom"`; no code or UI path defines a country code literal of `"UK"` — confirmed by grep sweep and by a new regression test (`m20d-source-integrity.test.ts`). The string "UK" appears only (a) inside the provider's own real proper name "Study UK — British Council" (not something this project invented), and (b) in one casual descriptive sentence ("studying in the UK") — neither is the country-identity label, which is always `GB`/"United Kingdom".

Safe-fallback-when-no-deep-mapping (point 13): confirmed by `adapter.test.ts`'s existing "Germany broader-catalogue fallback" coverage and the adapter's three-tier attempt order — no country can show a bare "primary exists but has nothing to link to" state.

**Result: PASS for all 6 countries. Zero launch-primary integrity blockers.**

## 4. Real database audit

The task brief's own "KNOWN REAL DATABASE STATE" section is taken as ground truth per its explicit instruction, not re-derived. A SELECT-only verification script (`docs/sql/m20d-verification-queries.sql`) is provided for the project owner to run by hand against the real database to confirm that asserted state matches reality. **No SQL was, or will be, executed against the real database by this milestone.**

No optional remediation SQL file was created, because the task brief's own known-state section already confirms all 6 launch-primary rows are active and the DAAD mapping is restored — there is no confirmed launch-blocking database gap to remediate. Per the task's explicit instruction ("If there are no launch-blocking gaps: do not create remediation SQL"), none was created.

## 5. Specialist provider completeness audit

| Specialist | Country | Classification | Status |
|---|---|---|---|
| UCAS (`ucas-course-search`) | GB | A — required for launch UX (specialist role, not primary) | Present, active, has one manual-instructions mapping — healthy |
| NCES/College Navigator (`college-navigator`) | US | A | Present, active (landing page) — healthy |
| EduCanada (`educanada-program-search`) | CA | B — optional specialist | Present, **inactive** (seeded pending verification, never activated) — missing-but-non-blocking |
| CRICOS (`cricos`) | AU | A | Present, active (landing page) — healthy |
| CAO (`cao-course-search`) | IE | B | Present, **inactive** (seeded pending verification) — missing-but-non-blocking |
| DAAD Degree Programmes (`daad-degree-programmes`) | DE | C/B — legacy-adjacent specialist, not launch-blocking | Present, active (landing page only, no deep link) — healthy but see §6 duplicate-pair note |

No specialist provider is classified D (inactive placeholder requiring removal) or E (unsafe/example/test-only) among the six audited above. The two `.example`-domain rows in the historical seed (`qedu`, `study-in-belgium`) are category E but are **not** launch-country specialists and are already inactive by default — see §6. **No specialist provider was auto-inserted or activated.** EduCanada and CAO remaining inactive is a product decision outside this milestone's "minimal to correct" mandate, not a defect — flagged as LOW in §12.

## 6. Historical seed safety audit & provider duplicate audit

**`supabase/seed/0006_trusted_course_search_seed.sql` (UX07's original, 23 providers):** technically idempotent (`on conflict (slug) do nothing`, zero updates/deletes), but **re-running it blindly would NOT be safe** — it would silently insert roughly 18 unreviewed, non-launch-relevant specialist/inactive rows (most of Europe's country list, two `.example` placeholder domains: `qedu`/ES, `study-in-belgium`/BE-French) with no current product confirmation they are still intended. This is exactly the "silently add inactive placeholder providers" risk the task brief forbids. **Conclusion: historical-seed-re-runnable = NO**, unless a product owner explicitly re-reviews and re-approves the full row list first.

**`supabase/seed/0008_m20a_launch_country_sources_seed.sql` (M20A's own, 5 rows):** narrow, all 5 rows are real, active, HTTPS domains directly tied to the confirmed launch-primary registry, zero mapping rows added, explicitly documented as additive-only. **Conclusion: safe to re-run.**

**DAAD International Programmes vs. DAAD Degree Programmes:** both rows are `active = true`. This means Germany's trusted-search results legitimately include both cards. This is **not a database duplicate** (distinct slugs, distinct purposes — one is a verified deep-link/filtered-results source, the other a general landing page) and **not a UI defect**: `compareTrustedSearchResults` already orders the launch-primary (`daad-international-programmes`) first, and only the primary carries the "Official study source"/"Trusted national source" launch badge (`isLaunchPrimaryResult`). A new regression test (`m20d-source-integrity.test.ts`) now asserts `daad-degree-programmes` can never be named Germany's registry primary. **Classified LOW/MEDIUM, non-blocking, documented rather than code-changed**, per the task's own "not necessarily database duplicates" framing.

**Study UK vs. UCAS / Government of Canada vs. EduCanada / Study Australia vs. CRICOS / Education in Ireland vs. CAO:** same pattern — each pair is a distinct (national-portal, specialist-tool) relationship, not a duplicate. None of the four specialist counterparts is active+primary-shaped in a way that could compete with its country's registry-designated primary. No action needed.

## 7. URL safety hardening

`validateExternalUrl`/`hostnameMatchesAllowedDomain` were read in full and probed empirically (Node `URL` parser) against every edge case the task lists:

| Edge case | Behavior | Code change needed |
|---|---|---|
| HTTPS accepted | ✅ accepted | no |
| HTTP rejected | ✅ `not_https` | no |
| `javascript:` rejected | ✅ `javascript_protocol` (regex pre-check before parsing) | no |
| `data:` rejected | ✅ `not_https` (parses with protocol `data:`, fails the https check) | no — **new test added** |
| Protocol-relative (`//evil.com/x`) rejected | ✅ `unparseable` (`new URL()` throws with no base) | no — **new test added** |
| Look-alike domain rejected | ✅ `host_not_allowlisted` | no (pre-existing coverage) |
| Userinfo-trick rejected | ✅ `has_credentials` | no (pre-existing coverage) |
| Subdomain anchoring | ✅ dot-anchored, substring look-alikes rejected | no (pre-existing coverage) |
| Trailing-dot host | ✅ stripped before comparison | no (pre-existing coverage) |
| Uppercase normalization | ✅ lowercased before comparison | no (pre-existing coverage) |
| IDN/punycode homoglyph domains | ✅ native `URL` parser IDNA-converts to ASCII punycode, which cannot equal/endWith a plain-ASCII allowed domain → `host_not_allowlisted` | no — **new bonus test added** |
| Malformed URL | ✅ fail-closed `unparseable` | no (pre-existing coverage) |
| Arbitrary query-string redirect | ✅ never read/accepted anywhere in the chain | no |

**No production code changes were required.** Four new tests close the only real coverage gaps found (protocol-relative, `data:`, IDN-homoglyph bonus, plus the DAAD-primary-identity test from §6), all in the new file `src/lib/education/external-search/m20d-source-integrity.test.ts`.

## 8. Go-route QA

Both `/go/course-search/[mappingId]/route.ts` and `/go/course-search/provider/[providerId]/route.ts` were read byte-for-byte and confirmed unchanged from the M20B audit: UUID-shape check → DB lookup (RLS-gated) → explicit mapping/provider active checks → re-validation of `verifiedUrl`→`baseUrl`→`fallbackUrl` in order via `validateExternalUrl`, immediately before redirecting → server-side click logging (user/timestamp DB-trigger-stamped, never client-supplied) → `NextResponse.redirect`. **No `?url=` or any client-suppliable destination parameter exists on either route.** New static-source-audit tests assert this explicitly for both routes (same convention as `trusted-source-card-attribution.test.ts`). **No route rewrite was needed or performed.**

## 9. DAAD deep-link QA

The restored mapping (DE / `mechanical-engineering` / `bachelors` / `daad-international-programmes` / `mapping_status = active` / verified deep-link) matches the `external_search_mappings` schema exactly (checked against `0009_trusted_course_search.sql`'s CHECK constraints and the partial-unique "one active per combination" index). `adapter.test.ts`'s pre-existing "Germany + Bachelor's + Mechanical Engineering" test block confirms `buildProviderSearchResult` prefers this stored deep link when matched, and its own fallback block confirms provider-level fallback still works for any unmatched Germany search (different subject/degree). No fake mapping exists or was created for any other subject/degree combination — confirmed by direct inspection of `0006`'s seed (exactly 2 mapping rows total: DAAD's and UCAS's) and `0008`'s seed (0 mapping rows added).

## 10. Launch-country UX QA — `/courses` and `/universities`

`LaunchCountryDiscovery.tsx` renders chips as real `<Link>` elements (native keyboard focus + activation, no custom key handling needed), with `aria-current="true"` on the selected chip, `role="list"`/`<ul>`/`<li>` semantics, and `flex-wrap` layout (no horizontal-scroll trap at any width). Selection state is never color-only: the selected chip differs by border, background fill, and `aria-current`, not color alone. The project's global `:focus-visible` rule (confirmed present in `src/app/globals.css`) gives every chip a visible focus ring. Unavailable countries render as a non-interactive `<span aria-disabled="true">` with an explanatory `title`, never a dead/clickable-looking control.

`TrustedExternalSearchCard.tsx` carries `aria-labelledby`, an `aria-live="polite"` status region (screen-reader announcement on result changes), `target="_blank" rel="noopener noreferrer"` plus a visible `ExternalLink` icon on every outbound CTA (never a bare, unmarked external link), and uses only the safe `/go/**` route for its CTA `href` (confirmed by the same static audit used in §8's route tests plus the pre-existing `trusted-source-card-attribution.test.ts`). Internal course/university results and the trusted-source card are visually and structurally distinct sections, never merged.

Pre-existing coverage (`launch-country-discovery.test.ts`, `trusted-source-card-attribution.test.ts`, and the full `/courses`/`/universities` test suites, all still green at 1688/1688) already exercises query-param stability, unrelated-filter survival, non-launch-country behavior, and empty-state messaging. **Result: PASS. No code changes required or made to either page or either component.**

## 11. Attribution / trust-language audit

Grep sweep of `src/components/sections/education/**`, `src/app/(site)/courses/**`, `src/app/(site)/universities/**`, and `src/lib/education/**` for `partner|endorsed|verified partner|in partnership` found **zero occurrences in rendered copy, props, or JSX text**. Every match found is either (a) inside `attribution.ts`'s own `UNSUPPORTED_PARTNERSHIP_PHRASES` list/docblock — the deny-list itself, not usage of a denied phrase — or (b) explanatory code comments describing the rule. **Result: PASS. No forbidden language found anywhere in student-facing copy; nothing to fix.**

## 12. Real-world source network check

Checked from the isolated sandbox via a direct HTTPS GET (descriptive custom User-Agent, 15s timeout, no scraping, no anti-bot bypass attempted) against each country's intended public source URL:

| Country | URL | Result |
|---|---|---|
| DE | DAAD verified deep-link URL | **200 OK** |
| GB | `study-uk.britishcouncil.org` | **403** — consistent with automated-request bot-protection responding to a non-browser client; not evidence the source is broken for real users. Not bypassed, per the task's explicit instruction. |
| US | `educationusa.state.gov` | **200 OK** |
| CA | `canada.ca` study-guidance URL | **Inconclusive** — first attempt: transport-level failure (`CURL_FAILED`, 0 bytes). Diagnostic retry (verbose HTTP/2): TLS 1.3 handshake completed cleanly, request sent, then `HTTP/2 stream was not closed cleanly: INTERNAL_ERROR`. A second retry forcing HTTP/1.1 timed out with 0 bytes received. The clean TLS handshake on the first retry, combined with a clean handshake-but-no-response pattern on the second, is most consistent with this sandbox's outbound network path (proxy/egress policy) being unable to complete a request to this specific host, rather than canada.ca itself being down — but this could not be fully confirmed from within the isolated environment. **Reported honestly as an inconclusive network-check result for this one domain, not as a BLOCKER and not fabricated as a PASS.** Recommend the project owner verify `canada.ca` reachability manually from a normal network. |
| AU | `studyaustralia.gov.au` | **200 OK** |
| IE | `educationinireland.com` | **200 OK**, clean redirect to `/en/` |

**5 of 6 domains verified reachable (200). 1 (Study UK) returned 403, most likely bot-protection. 1 (Canada) is inconclusive due to a sandbox-network anomaly, not reported as either PASS or definitive failure.** None of this is a code or architecture defect — it is an audit observation about external-site reachability from this environment, not a launch blocker in the trusted-source system itself.

## 13. Accessibility & mobile/responsive QA

Reasoned/audited at the four required breakpoints (390/768/1024/1440px) via the existing Tailwind utility classes in both components: `flex flex-wrap` on the chip list guarantees wrapping rather than overflow at any width; the trusted-source card uses `p-5 sm:p-6` (no fixed width forcing horizontal scroll) and the existing CTA/button components already used throughout the site (no new button component introduced); long source/authority names are plain text in a flex/wrap context, not truncated or fixed-width, so they wrap cleanly. Tap targets use the same `px-3.5 py-1.5` chip sizing and existing `Button`/`Link` components used sitewide, already meeting the project's existing tap-target conventions (not re-litigated here — no new component was introduced that would need a fresh sizing review). No reduced-motion-sensitive animation was found (`transition-colors` only, not a motion effect `prefers-reduced-motion` would need to suppress). No focus trap: every control is a normal, singly-tabbable `<Link>`/`<a>`/`<button>`. **Result: PASS. No redesign performed or needed, per the task's explicit "do not start UX10 redesign work" instruction.**

## 14. Security / authorization

`grep` confirmed `trusted-portals:read`/`trusted-portals:write` still present at the same locations in `src/lib/admin/permissions.ts` (unchanged). RLS policies in `0009_trusted_course_search.sql` (unchanged, re-read in full) continue to restrict provider/mapping writes to admin roles and clicks-table reads to admin/analyst roles, with anon/authenticated limited to active-only reads and insert-only on clicks (server-trigger-stamped `user_id`/`occurred_at`, never client-suppliable). No public write path, no secret in client code, no permission widening found or introduced.

## 15. Database / migration

No migration created. Migrations remain at `0022_authoritative_submission_invariant.sql`; no `0023` was added because no genuine schema blocker was found — every field the audit needed already exists in the existing `external_search_providers`/`external_search_mappings` schema.

## 16. Analytics, SEO, Payments

**Analytics:** not implemented (M21 is out of scope). Documented-only future event names for M21 to pick up: `launch_country_selected`, `trusted_source_opened`, `trusted_source_unavailable`, `country_empty_state_seen`. No migration, no event-constraint change.
**SEO:** not touched. No bug was discovered that was "directly relevant" per the task's own gating condition.
**Payments:** not touched. Razorpay/refunds/pricing/invoices/GST/agreements were not read or modified.

## 17. Preservation check

Full suite (1688/1688) still passes, including every pre-existing M16 (student application workflow), M17 (application documents), M17B (SEO), M18 (counsellor processing), M19 (authoritative submission invariant), UX07 (trusted global course search), UX08/UX09 (application/visual/admin), M20A/M20B/M20C test file. `git status --short` inside the sandbox clone shows exactly one new, untracked file — nothing else in the tree was touched. No regression possible to any prior milestone's code, since none of it was edited.

## 18. What was deliberately NOT changed

No production source file was modified. No new schema, no new migration, no remediation SQL, no new UI, no new country page, no analytics implementation, no redesign of M20A/B/C or UX10, no change to `/courses`/`/universities`/either `/go/**` route, no change to `attribution.ts`'s approved/forbidden phrase lists, no change to either seed file, no change to admin provider tooling. The only change in this package is one new, additive test file closing explicit coverage gaps identified against the task's 24-item required-test list.

## 19. M21 readiness

Trusted launch sources: READY. Country discovery UX: READY. Redirect safety: READY. Source integrity: READY (contingent on the project owner manually confirming the real-DB state matches §4's expectations and resolving the Canada network-check ambiguity in §12 — neither is a code defect). Analytics milestone: READY to begin on a clean baseline (no instrumentation yet exists to migrate around).
