# Recommendation Engine Guide (Milestone 5)

This is the reference for how `/recommendations` ranks careers, and how to safely change the way it scores. It assumes familiarity with the Milestone 3 Student Digital Profile and Milestone 4 Career Knowledge Base — see `docs/career-data-guide.md` for the latter.

## 1. What this is — and isn't

The recommendation engine is a **deterministic, rules-based, structured decision-support tool**. It compares a student's own profile data against career data using explicit, documented arithmetic — nothing more.

It is explicitly **not**:

- A scientifically validated psychometric assessment.
- An AI system. There is no model call, no LLM, no Claude API involved anywhere in scoring — see §9.
- A source of medical, psychological, legal, admissions, salary, visa, or employment guarantees.
- Infallible. A lower-ranked career is not "unsuitable" — it just has less matching evidence right now.

Every page that shows recommendations carries a disclaimer to this effect (`GuidanceNotice` on `/recommendations`). Keep that disclaimer in sync with this document if either changes.

## 2. Where the code lives

All of it is in `src/lib/recommendations/` — a framework-independent module with no dependency on Next.js, React, or Supabase:

- `weights.ts` — every tunable constant (dimension weights, thresholds, caps). No magic numbers live anywhere else in this module.
- `types.ts` — the engine's input/output shapes.
- `normalize.ts` — turns a `StudentProfileSnapshot` (Milestone 3) into fast lookup maps, plus the `hasMinimumProfileDataForRecommendations` gate.
- `dimensions.ts` — one pure function per scoring dimension (§4).
- `bands.ts` — turns a raw score + evidence coverage into a qualitative match band (§6).
- `explain.ts` — turns per-dimension results into the reasons/gaps/matched-signals shown on a card.
- `engine.ts` — orchestrates the above per career, combines dimension scores, and ranks/sorts the whole list.
- `index.ts` — the only file other code should import from.

Data access lives outside this module, in `src/lib/supabase/careers.ts`'s `getCareersForMatching()` (§8) and `src/lib/supabase/student-profile.ts`'s existing `getStudentProfileSnapshot()`. The `/recommendations` page (`src/app/recommendations/page.tsx`) wires the two together.

Tests live alongside the code as `*.test.ts` files, run with `npm run test` (Vitest — see §11).

## 3. Input signals

Every input is a stable snake_case key shared between `src/data/profile-options.ts` (Milestone 3) and career data (Milestone 4) — the engine never invents a new taxonomy key. The signals used are:

| Signal | Student source | Career source |
|---|---|---|
| Subjects | `student_subject_strengths` (rating 1-5) | `career_subject_requirements` (importance, minimum strength) |
| Interests | `student_interests` (strength 1-5, optional) | `career_interest_requirements` (importance) |
| Skills (technical + transferable) | `student_skills` (level: beginner/intermediate/advanced) | `career_skill_requirements` (importance, recommended level) |
| Work preferences | `student_work_preferences` (rating 1-5, all 18 keys) | `career_work_preference_profile` (score 1-5) |
| Career priorities | `student_career_priorities` (rating 1-5) | `career_priority_profile` (score 1-5) |
| Education level | most-advanced `student_education.education_level` | `career_education_routes.education_level`, `careers.minimum_education_key` |
| Mobility | `student_study_preferences.study_abroad` / `.relocate_international` | `careers.international_mobility_score` |
| Career-level heuristics | `student_career_priorities` (as a proxy for what the student values) + technical skill portfolio | `careers.*_score` (11 fields — see §5) |

**Known limitation — field of study is not scored.** `student_education.field_of_study` is free text captured during onboarding, not a stable key from `FIELD_OF_STUDY_OPTIONS`. Comparing free text against a career's `fieldKey` would mean inventing an unreliable fuzzy-match heuristic on ungoverned data, so this dimension deliberately scores education **level** only. If a future milestone adds a structured field-of-study picker to onboarding (using `FIELD_OF_STUDY_OPTIONS` as its source of truth), this is the first place to extend.

## 4. Scoring dimensions

Each dimension in `dimensions.ts` produces a `DimensionResult`: a 0-1 `rawScore`, whether it `hasEvidence` at all, an `evidenceStrength` (0-1, how much of the career's relevant data the student's profile actually covered), plus `reasons`/`gaps`/`matchedKeys` for the explanation layer.

The general pattern (subjects/interests/skills): each item the career cares about is weighted by the career's own `importance` field, and only counted toward the score if the student has data for that exact key. Items the student has no data for are excluded from the score entirely — never scored as 0 (see §7) — and become candidate "gaps" if the career weights them highly.

Work preferences and career priorities are handled differently: both sides rate the same key on a 1-5 scale, so the comparison is an *agreement* score (how close the two ratings are), weighted by how far from neutral (3) the career's own rating is — a career's strong opinion (1 or 5) is more informative than a lukewarm one (3).

Career-level heuristics (`careers.scores.*`) are driven by how much the student says they care about the matching career priority — see the `PRIORITY_TO_SCORE_FIELD` map in `dimensions.ts` for exactly which priority key feeds which heuristic field. `technicalDepth` has no matching priority key, so it's derived instead from the average level of the student's own technical skills.

Education combines two checks: does the student's level exactly match one of the career's typical entry routes (weighted by that route's `relevance`), and does the student's level meet the career's `minimumEducationKey` if one is set (capped low, not zeroed, if not — see §7).

Mobility compares `study_abroad` / `relocate_international` answers against `internationalMobility`. It's intentionally narrow — there's no other domestic-mobility signal in Milestone 3 to compare against yet.

## 5. Weights

All weights live in `DIMENSION_WEIGHTS` in `weights.ts`:

```
subjects: 18, interests: 18, skills: 14, workPreferences: 10,
careerPriorities: 14, careerHeuristics: 10, education: 12, mobility: 4
```

These are **relative**, not fixed percentages — the engine renormalizes across whichever dimensions actually have evidence for a given student/career pair (see §7), so a dimension's weight only needs to reflect its importance relative to the others. They happen to sum to 100 for readability.

**To adjust a weight safely:** change the constant in `weights.ts`, add a one-line comment explaining why, then run `npm run test`. The test fixtures assert on match-band boundaries and relative ordering, not exact internal scores, so most single-weight tweaks won't break them — but a large swing (e.g. doubling a weight) can shift a fixture across a band threshold and is worth checking by eye. Never hardcode a weight anywhere outside this file.

## 6. Match bands — qualitative only

Internally, each career gets an `internalScore` (0-100) and an `internalEvidenceCoverage` (0-1). **Neither is ever shown to a student.** They exist purely for computation, sorting, and tests (`RecommendationResult.internalScore` is explicitly documented as internal-only in `types.ts`).

What students see is one of four fixed bands (`MATCH_BAND_LABELS` in `bands.ts`):

- **Strong match** — high score, high evidence coverage.
- **Promising match** — good score, or a high score with only moderate evidence (see §7 — evidence coverage can only ever pull a band down, never up).
- **Worth exploring** — the floor for any career with adequate evidence. There is deliberately no negative/discouraging band.
- **Limited evidence** — evidence coverage is too low to say much either way, regardless of what the raw score happens to be.

Thresholds live in `MATCH_SCORE_THRESHOLDS` and `EVIDENCE_THRESHOLDS` in `weights.ts`.

## 7. Missing-data handling

Two different rules, both important:

1. **A dimension with zero evidence is excluded from the score, not scored as 0.** If a student hasn't rated any work preferences at all, the `workPreferences` dimension contributes nothing — its weight is left out of the renormalized average entirely, rather than counting as "you failed this dimension." See `engine.ts`'s `scoreCareer` for the renormalization.
2. **A below-minimum answer is capped low, not zeroed.** A subject rated below a career's `minimumStrength`, or an education level below a career's `minimumEducationKey`, is capped at `BELOW_MINIMUM_FIT_CAP` (0.4) rather than 0 — a single below-minimum subject shouldn't sink an otherwise strong match, and it always surfaces as a gap so the student can see why.

A profile with too little data to rank meaningfully at all is caught earlier, before scoring even runs — see `hasMinimumProfileDataForRecommendations` in `normalize.ts` (needs at least 2 of the 5 core signal categories filled in). `/recommendations` shows an incomplete-profile state instead of a ranked list in that case.

## 8. Avoiding N+1 queries

`getCompleteCareerProfile()` in `src/lib/supabase/careers.ts` (Milestone 4) loads one career's full profile via ~10 queries — fine for the career-detail page, where exactly one career loads per request. Calling it once per career for a ~100-career catalogue would mean roughly a thousand queries for a single `/recommendations` load.

`getCareersForMatching()`, added in this milestone, loads **every** approved career's full matching profile in a fixed number of bulk queries (one per child table, each filtered with `.in("career_id", allIds)`) — so the query count stays flat regardless of catalogue size. It returns `CareerMatchProfile[]` (`src/types/career.ts`) — a trimmed sibling of `CareerDetail` that skips `aliases` (search-only) and returns industry/tag keys directly rather than joined objects, since matching only needs keys.

## 9. No AI, no randomness

Every function in `src/lib/recommendations/` is a pure function of its inputs: same student profile + same career data always produces the same ranking, deterministically. There is no call to any AI/LLM API (Claude or otherwise) anywhere in the scoring path, and no use of `Math.random()` or similar. This is enforced by construction (nothing in the module has network access) rather than by a runtime check, and should stay that way — if a future milestone wants an AI-assisted layer, it belongs in a clearly separate, clearly labeled feature, not folded into this engine's ranking.

## 10. Deterministic tie-breaking

Careers with identical scores sort in a fixed order (`compareResults` in `engine.ts`): evidence coverage (higher first), then featured flag, then title (alphabetical), then career key as an absolute final tiebreaker (guaranteed unique). Re-running the engine on unchanged data always produces the same order.

## 11. Testing

`npm run test` runs Vitest over `src/lib/recommendations/**/*.test.ts`. Coverage includes: a strong multi-signal match scoring higher than a weak one, missing optional data being excluded rather than penalized, a substantially incomplete profile producing a valid zero-evidence result (no throw, no `NaN`), importance-weighted subject scoring, below-minimum-strength capping, deterministic tie-breaking (including repeated-run stability), qualitative band derivation at the threshold boundaries, and explanation generation (bounded length, human-readable labels, no raw keys leaking into UI-facing text). `fixtures.test-helpers.ts` holds the shared test-data builders — it's excluded from the test run itself (only `*.test.ts` files match `vitest.config.mts`'s `include`).

## 12. Known limitations

- Field-of-study matching is not implemented (§3) — education scoring is level-only.
- Work-preference and career-priority "gaps" are not surfaced per-key (the onboarding UI collects all 18/16 keys as one section, so partial completion isn't really a per-item gap the way an unrated subject is).
- The engine has no persistence — every `/recommendations` load recomputes from current data, which keeps results always-fresh but means there's no history of how a student's matches changed over time. Revisit if a future milestone wants that.
- Mobility scoring only covers international relocation/study intent — there's no domestic-mobility signal in the current Milestone 3 schema to compare against a career's characteristics.
