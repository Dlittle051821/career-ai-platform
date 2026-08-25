# Career Data Guide

This is the reference for adding, editing, or reviewing careers in the Milestone 4 Career Knowledge Base. It assumes no prior familiarity with this part of the codebase.

## 1. Where career data lives

Career data is authored as TypeScript, not written directly into Supabase:

- `src/data/careers/taxonomy.ts` — the shared taxonomy every career must draw from: career families, fields of study, industries, tags, and the `CareerSeed` interface itself.
- `src/data/careers/*.ts` (one file per family cluster, e.g. `engineering.ts`, `finance.ts`) — each exports an array of `CareerSeed` objects.
- `src/data/careers/index.ts` — imports every family file and merges them into one `ALL_CAREERS` array. **Add a new family file's import/spread here or it will never be seeded.**

From there, two scripts take over:

- `npm run validate:careers` runs `scripts/validate-career-data.ts`, which checks every career against the taxonomy and fails loudly on anything wrong.
- `npm run seed:generate` runs `scripts/generate-career-seed-sql.ts`, which reads `ALL_CAREERS` and writes `supabase/seed/0001_careers_seed.sql` — the file you actually paste into Supabase.

Never hand-edit `supabase/seed/0001_careers_seed.sql` — it's generated and will be overwritten the next time someone runs `seed:generate`.

## 2. Adding a new career

1. Open the seed file for the right family (or create a new one if none fits — see §6).
2. Add a new object to that file's exported array, matching the `CareerSeed` interface in `taxonomy.ts`. Copy an existing entry as a starting point; the "EV Systems Engineer" example in the Milestone 4 spec is the intended quality bar.
3. Every field marked required in `CareerSeed` must be filled in. See §3 for the minimum needed to reach `approved` status.
4. Run `npm run validate:careers`. Fix anything it flags before moving on.
5. Run `npm run seed:generate` to regenerate `supabase/seed/0001_careers_seed.sql`.
6. Paste the regenerated file into the Supabase SQL Editor and run it (see the main Milestone 4 report for exact steps). It's an idempotent upsert — running it again is always safe.

## 3. Required fields and "approved" status

Every career needs, at minimum: `careerKey`, `familyKey`, `title`, `slug`, `summary`, `whatYouDo`, `typicalEnvironment`, `typicalEntryLevel`, and a `dataQualityStatus`.

`dataQualityStatus` is one of:

- `draft` — incomplete or unreviewed. Never shown to students.
- `reviewed` — content-complete but not yet signed off. Still not shown to students.
- `approved` — the only status visible in the Career Explorer and on `/careers/[slug]` (RLS enforces `is_active = true AND data_quality_status = 'approved'` — see §5).

Before marking a career `approved`, it needs:

- a title, family, and summary
- at least 2 subject entries
- at least 3 interest entries
- at least 3 skill entries
- at least one work-preference entry
- at least one career-priority entry
- at least one education route
- at least one industry

`npm run validate:careers` checks all of this and prints a warning (not a hard failure) for any `approved` career that falls short — treat those warnings as blocking before you actually run the seed against production.

## 4. Stable keys — the most important rule

Every relationship in this schema (subjects, interests, skills, work preferences, career priorities, education fields, industries, tags) is stored as a **stable snake_case key**, never a display label. This is deliberate: a future Milestone 5 recommendation engine will compare a career's keys directly against a student's Milestone 3 profile keys, so the two taxonomies have to line up exactly.

Five taxonomies are **shared verbatim with the Milestone 3 Student Digital Profile** — never invent a new key for these, always use what's already in `src/data/profile-options.ts`:

| Field on `CareerSeed` | Source of truth |
|---|---|
| `subjects[].subjectKey` | `SUBJECT_OPTIONS` |
| `interests[].interestKey` | `INTEREST_OPTIONS` |
| `skills[].skillKey` | `TECHNICAL_SKILL_OPTIONS` + `TRANSFERABLE_SKILL_OPTIONS` |
| `workPreferences[].preferenceKey` | `WORK_PREFERENCE_OPTIONS` |
| `careerPriorities[].priorityKey` | `CAREER_PRIORITY_OPTIONS` |
| `educationRoutes[].educationLevel` | `EDUCATION_LEVEL_OPTIONS` |

Three taxonomies are **new in Milestone 4** (Milestone 3 has no equivalent concept), centralized in `src/data/careers/taxonomy.ts`:

| Field | Source |
|---|---|
| `educationRoutes[].fieldKey` / `specializationKey` | `FIELD_OF_STUDY_OPTIONS` |
| `industryKeys[]` | `INDUSTRY_OPTIONS` |
| `tagKeys[]` | `CAREER_TAG_OPTIONS` |

**If you need a concept that doesn't exist in either list**, do not invent a mismatched key inline. Add it to the appropriate list in `taxonomy.ts` (for a new M4-only concept) or flag it as a possible gap in the M3 `profile-options.ts` taxonomy (for a shared concept) — never route around it with a one-off key that only your career uses. `validate-career-data.ts` will fail the build on any key it doesn't recognize, which is the safety net for this rule.

## 5. Why students can't edit this data

Master career data uses a different Row Level Security model than the Milestone 2/3 tables. Student data (`profiles`, `student_*`) is owner-scoped: a row belongs to exactly one `user_id` and only that user can read or write it. Career data belongs to nobody — it's product catalogue data — so instead:

- `anon` and `authenticated` get exactly one SELECT policy per table, gated on `is_active = true` (and `data_quality_status = 'approved'` for `careers` and everything that joins to it).
- **No INSERT/UPDATE/DELETE policy exists for `anon` or `authenticated` on any career table.** With RLS enabled and no write policy, Postgres denies the write outright — there's no way for the app (logged in or not) to modify this data.

The only way to write career data is the Supabase SQL Editor (or a service-role key), which only you control. This is intentional — there's no separate admin-role system yet, and none is needed for Milestone 4.

## 6. Adding a new career family

1. Add an entry to `CAREER_FAMILIES` in `taxonomy.ts` with a unique `key`, a `name`, `description`, and a `order` that fits the existing spacing (families are ordered in steps of 10).
2. Create a new `src/data/careers/<name>.ts` file exporting a `CareerSeed[]` array for that family.
3. Import and spread it into `ALL_CAREERS` in `src/data/careers/index.ts`.
4. Run `validate:careers` then `seed:generate` as usual.

## 7. Scoring convention — read this before touching any score

Two different things in this schema look like "scores" and are easy to conflate:

**`careers.scores.*`** (`internationalMobility`, `remoteWork`, `entrepreneurship`, `salaryPotential`, `jobSecurity`, `creativity`, `socialImpact`, `leadershipOpportunity`, `travel`, `researchIntensity`, `technicalDepth`) — an internal 1-5 heuristic per career, used as future Milestone 5 matching input. **These are curated editorial judgments, not verified market data, not psychometric measurements, and not scientifically validated.** The app deliberately never shows these as raw numbers to a student — `src/lib/careers/characteristics.ts` converts a score of 4-5 into a qualitative chip (e.g. "Strong salary potential") and nothing lower is shown at all. Keep it that way in any new UI: no percentages, no "X/5" displays, no claims of precision.

**`importance` / `score`** on the requirement/profile child tables (subjects, interests, skills, work preferences, career priorities) — also 1-5, but this is "how relevant is this to the career," not a claim about the student. A subject with `importance: 5` means "central to this career," not "you must already be excellent at this."

When scoring a new career, be consistent with existing entries in the same family — read a few neighboring careers before assigning numbers so the scale means the same thing across the dataset.

## 8. Validation

Run `npm run validate:careers` any time you touch seed data. It checks, across every file combined (not just the one you edited):

- `careerKey` and `slug` are unique
- every `familyKey`, `subjectKey`, `interestKey`, `skillKey`, `preferenceKey`, `priorityKey`, `educationLevel`, `fieldKey`, `industryKey`, and `tagKey` exists in the taxonomy
- every `relatedCareerKeys` entry points at a real career (and never at itself)
- all 1-5 fields are actually in range
- required fields are present
- `approved` careers meet the §3 minimum (warning, not hard failure)

It exits non-zero on any error — wire it into CI if this project gets one; for now, run it by hand before every `seed:generate`.

## 9. Seeding safely

`npm run seed:generate` writes `supabase/seed/0001_careers_seed.sql`. Every statement in that file is either an upsert keyed on a stable business key (`family_key`, `industry_key`, `tag_key`, `career_key`) or a delete-then-insert for a career's child rows — **running the file twice never creates duplicates**, and re-running it after editing seed data correctly updates existing rows (including removing rows for anything you deleted from the TypeScript). This was verified against a real Postgres instance with the actual `0003_career_database.sql` schema before this milestone shipped: running the generated seed twice in a row produced identical row counts.

Paste-and-run in the Supabase SQL Editor, same as every other migration/seed in this project — no CLI or local database tooling required.
