# NW05.5 — Abroad Workspace (`/studio/abroad`)

Status: **COMPLETE**

## 1. What changed

- `src/lib/abroad/scope.ts` (new) — `isAbroadDestinationName()` / `getAbroadDestinationPreferences()`, both pure, always derived from the real `EUROPE_COUNTRIES` registry.
- `src/lib/abroad/scope.test.ts` (new, 11 tests)
- `src/components/abroad/AbroadReadinessCard.tsx` (new)
- `src/components/dashboard/DiscoverySessionCard.tsx` (modified — additive `activeSessionLabel` prop, default unchanged)
- `src/app/studio/abroad/page.tsx` (rewritten)
- `src/app/studio/abroad/loading.tsx`, `error.tsx` (new)

No database change. Every data source this stage uses already existed: `education_saved_items` (saved items), `get_my_applications()` (already resolves `universityCountryName` — confirmed during NW05.1's audit, which corrected an earlier assumption that no country field existed on applications), the Student Digital Profile, and the Discovery Session system.

## 2. Section-by-section mapping to the brief

| Brief requirement | Implementation |
|---|---|
| Launch destinations via the authoritative registry | Unchanged from NW03.3/NW04 — the flag map and country list are typed against `EuropeCountryCode`/`EUROPE_COUNTRIES` |
| University Shortlist (no fictional choices) | `SavedShortlistCard`, fed only saved universities/courses whose resolved `countryName` is one of the 6 Abroad destinations (`isAbroadDestinationName()`) |
| Course/Programme Exploration | Unchanged — real `/courses` link |
| Abroad Readiness | **New** `AbroadReadinessCard` — 6 rows; see §3 |
| Application Journey (real statuses only) | `ApplicationsCard`, fed only the student's real applications whose `universityCountryName` is Abroad-scoped |
| Guidance (no simulated availability) | `DiscoverySessionCard` reused with the real `getMyActiveDiscoverySession()` result and a generic `activeSessionLabel="Discovery Session"` (not the Career-specific default label) |
| Abroad-specific recommendations stay honestly not-built | The one remaining `ComingSoon`, now explicit that this is deferred to a future milestone, not simulated |

## 3. Abroad Readiness — what's real and what's honestly not tracked

| Row | Status |
|---|---|
| Academic profile | Real — `calculateCompletion()`'s percent/status (the one Student Digital Profile every section of this product already shares) |
| Destination preference | Real — `getAbroadDestinationPreferences()` reads the student's own `preferred_study_destinations` (a general, not Abroad-specific, profile field) and reports only the subset that matches a real Abroad launch destination |
| Budget planning | Real — the existing, generic `budgetBand` field |
| Programme shortlist | Real — the same Abroad-scoped saved-item count shown in the Saved Items section |
| Language test planning | **Not tracked** — no field exists anywhere in this schema for this; shown as "Not yet tracked", never a fabricated status, and never treated as a blocker |
| Document planning | **Not tracked** — same treatment |

No row is ever used to derive visa or admission eligibility, and a missing optional field is never shown as a disqualification — both per the brief's explicit instruction.

## 4. A disclosed, pre-existing data gap: Denmark

`COUNTRY_OPTIONS` (`src/data/profile-options.ts`, the general profile field a student uses to name a preferred study destination) has **no `"denmark"` entry** — Germany, Ireland, Netherlands, France, and Sweden are all selectable, but Denmark is not, despite being one of the 6 Abroad launch destinations in `EUROPE_COUNTRIES`. `getAbroadDestinationPreferences()` cannot and does not work around this (it would require either inventing a key the rest of the product doesn't recognise, or silently misreporting another country as Denmark) — it simply reports the real, current gap by never being able to return "Denmark". This is noted here as a genuine product gap for the Abroad onboarding work a future milestone may pick up (the NW05.1 audit's own §5 already scoped a richer, dedicated Abroad onboarding form as future-only work, not this stage's).

## 5. Why no new "Abroad-specific" profile fields were added

Confirmed again in this stage (consistent with NW05.1's audit decision): adding new columns for target study level, language-test status, or document readiness would need a schema migration this milestone's "reuse first, extend minimally, new tables only if justified" instruction does not support for a foundation-stage feature. Every row in Abroad Readiness above is built from data the product already collects.

## 6. Validation

| Check | Result |
|---|---|
| `npx tsc --noEmit` | Clean — 0 errors |
| `npx vitest run` | 132 files / 2159 tests — all passing (+1 file / +11 tests from `scope.test.ts` over the NW05.3 baseline) |
| `npm run lint` | 0 errors, 18 pre-existing warnings (unchanged) |
| `npm run build` | Succeeds |
