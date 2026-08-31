# Global University and Course Data Platform (Milestone 9)

This is the reference for the global university/course data platform added in Milestone 9 — its data model, Row
Level Security (RLS) model, CSV import workflow, duplicate-detection logic, data-quality checks, the three CLI
scripts, and the public/student-facing features built on top of it. It assumes familiarity with Milestone 7 (the
admin system and its role model) and Milestone 3 (student accounts) — it does not modify either.

If you only read one thing before touching this system: **nothing here is claimed to be a complete or exhaustive
university/course database.** Every section below repeats this in context because it's the rule most likely to be
violated by accident — a partially-populated table can *look* authoritative even when it covers a handful of
institutions out of the world's tens of thousands.

## 1. What this platform is — and is not

This is an **extensible** platform for global university and course data: a schema, an admin content-management
workflow, an import pipeline, and public discovery pages, all designed so that adding a new country, university, or
course is a data-entry operation, never a schema change or a code change.

It is **not**:

- A claim of exhaustive worldwide coverage. As of this milestone, the optional dev seed (§9, and see
  `supabase/seed/0003_global_education_dev_seed.sql`'s own header) contains eight real universities across eight
  countries — a representative starter dataset for exercising the import/verification/publish workflow, not a
  product claim about coverage.
- A source of truth a student should rely on for a real application. Every public page that shows tuition,
  deadlines, or requirements links back to the record's own `source_url` and carries its `last_verified_at` date —
  the student is always pointed back to the institution's own page to confirm before acting.
- A live integration with any university, ranking site, or government data source. The only way data enters this
  system is manual admin entry or a local CSV upload (§4, §10) — there is no scraping and no external API call
  anywhere in this codebase for this feature.

**How to add a new country.** The schema never needs to change to support a new country — see §9.

## 2. Data model

Migration `supabase/migrations/0006_global_university_course_data.sql` is the entire Milestone 9 schema. It adds
new tables and extends two Milestone 7 tables; it never renames or repurposes an existing column, and every
Milestone 9 RLS policy is additive to Milestone 7's (RLS policies are OR'd together in Postgres, so a new policy can
only widen access, never narrow an existing grant). It defines **zero new `SECURITY DEFINER` functions** — every
table is read/written through the calling admin's or student's own authenticated session, the same pattern every
Milestone 7 admin module uses.

| Table | Purpose |
| --- | --- |
| `countries` | ISO 3166-1 reference data (alpha-2/alpha-3 codes, region, currency, language). Seeded with 21 real countries. Adding a country is always just a new row — see §9. |
| `universities` *(extended)* | The Milestone 7 table, with Milestone 9 columns added: normalized `country_id`, address fields, admissions URLs, ownership type, founding year, `ranking` (a JSON array, only ever populated from a citeable source), study levels/modes, a scholarships flag, publication/verification status, and source/provenance fields. The pre-existing `country` (free text), `summary`, and other Milestone 7 columns are untouched. |
| `campuses` | One row per physical/branch campus of a university. At most one `is_main = true` row per university (not a requirement to have one). Coordinates are nullable and only ever populated from a legitimate, citeable source — never estimated or geocoded automatically. |
| `courses` *(extended)* | The Milestone 7 table, with Milestone 9 columns added: campus link, program code, subject/discipline, qualification title/award, structured duration (value + unit), study pace, teaching language, tuition category, intake periods, structured English/standardized-test-requirement JSON (only from an officially documented source), career outcomes, publication/verification status, and source/provenance fields. |
| `course_intakes` | One row per intake/enrolment window for a course — dates, deadlines, capacity status. A database constraint enforces "deadline can't precede the applications-open date" directly, not just in the UI; "intake marked upcoming but its date has passed" is a computed data-quality flag instead (§6), since a `CHECK` constraint can't reference "now" and stay correct as time passes. |
| `course_tuition_fees` | One row per (course, student category, academic year), so historical and future/announced fees coexist without overwriting each other. `currency_code` always preserves the institution's own original currency — this system never auto-converts or displays a converted-as-if-equivalent amount anywhere. |
| `course_admission_requirements` | Structured, per-pathway admission requirements for a course — a course can have several rows to describe different accepted-qualification pathways, optionally scoped to the applicant's home country via `country_context_id` (e.g. "Indian Standard XII, 85%+" vs. "UK A-Levels, BBB" on the same course). |
| `scholarships` | A scholarship attached to either a university or a specific course (never both), with amounts stored in the scholarship's own stated currency. |
| `education_data_provenance` | One current-state provenance/verification record per entity (source, retrieval date, last-verified date, verification status, data-quality status, which import batch produced it). The public-safe subset of this is mirrored as plain columns directly on universities/courses/etc. so public pages can show it under that table's own RLS without needing read access to this admin-only table. |
| `education_import_batches` / `education_import_rows` | One row per CSV import attempt, and one row per parsed CSV row within it, with per-row status/errors/warnings. A batch is never silently partially applied — its status reflects that (`completed_with_errors`, not `completed`) when some rows failed. |
| `education_duplicate_candidates` | A suggested duplicate pair (university or course) awaiting admin review. Status starts `pending` and only ever changes via an explicit admin decision — see §5. |
| `education_saved_items` | A student's own saved universities/courses. Fully student-owned — no admin write path exists, because this is a personal list, not authoritative data. |
| `education_intake_interests` | A student flagging interest in a specific upcoming intake. Same fully-student-owned pattern. |
| `education_course_shares` | A student sharing a course with a counsellor, plus an optional message. See §3 for the honest caveat on `counsellor_id`. |

Historical change-events for these tables reuse the existing Milestone 7 `admin_audit_log` — there is no second,
bespoke history table competing with it.

## 3. RLS model

Every table in §2 has Row Level Security enabled. In plain language:

- **Public (anonymous or any signed-in user, including students)** can read a university/campus/course/intake/
  tuition-fee/admission-requirement/scholarship only once it is genuinely `is_active = true` **and**
  `publication_status = 'published'` (and, for a child record like a course, its parent university must also be
  published and active). A draft, in-review, or archived record is never visible outside admin.
- **`content_editor`** can create and edit records, but only while they stay in `draft`/`in_review` — the RLS
  `with check` clause itself blocks a content editor from using their own insert/update policy to publish or
  archive something. Promoting to `published` is an `admin`/`super_admin` action.
- **`admin` / `super_admin`** can read and write everything, at every publication status.
- **`counsellor`** gets full read access (including drafts, for advising purposes) via the same broad admin-read
  policy every role gets, but has no write policy anywhere on this data — counsellors cannot modify authoritative
  university/course data.
- **Import** (`education_import_batches`/`education_import_rows`) requires `admin`/`super_admin` to write;
  `admin`/`super_admin`/`analyst` can read a batch's results.
- **Duplicate candidates** can be read by `admin`/`super_admin`/`content_editor`/`analyst`; only `admin`/
  `super_admin` can write a resolution.
- **Every student-owned table** — `education_saved_items`, `education_intake_interests`,
  `education_course_shares` — is scoped to `auth.uid()`: a student can only ever see, create, or delete their own
  rows. `admin`/`super_admin`/`analyst` (and, for intake interests, `counsellor`) get an additive read-all policy;
  no admin write policy exists on any of the three, because these are the student's own data, not content the
  system manages on their behalf.
- **`applications`** (the existing Milestone 7 table) got two new, purely additive policies in this migration: a
  student can now read their own applications and can insert a new application for themselves (started from a
  course page). A student still has no `update` policy — stage/decision-status changes remain admin/
  counsellor-only, unchanged from Milestone 7.

**Honest caveat on course shares.** `education_course_shares.counsellor_id` is nullable, and from the student-facing
share flow it is **always left null**. Neither `counsellors` nor `admin_student_meta` (where a student's assigned
counsellor would be looked up) has a student-self-read RLS policy, so a student's own session has no RLS-permitted
way to resolve which counsellor to address — granting one, or bridging into the existing `admin_student_notes`
table, was judged out of scope for this migration's otherwise narrowly-scoped additive RLS. This does not lose the
share: any `admin`/`super_admin`/`analyst` can already read every share regardless of `counsellor_id` via their own
broader read policy, so an unrouted share simply surfaces as a triage item for staff rather than being automatically
addressed to one counsellor.

## 4. CSV import workflow

The admin-facing workflow lives at `/admin/education/imports` (list/history) and `/admin/education/imports/new`
(start a new import), backed by `src/lib/supabase/admin/education-imports.ts`. It follows one fixed sequence:

1. **Upload** a CSV file.
2. **Map** columns (for the supported entity type — see the 7 templates below for the exact expected columns).
3. **Preview** the parsed rows.
4. **Validate without writing** — `validateImportBatch` parses, validates, and normalizes every row and checks it
   for duplicates against existing records, storing per-row results in `education_import_rows`, but never touches
   `universities`/`courses`/etc. This step is safe to re-run any number of times.
5. **Review errors/warnings** and duplicate matches surfaced from step 4.
6. **Choose a duplicate strategy** per batch — `skip`, `update`, or `review` — for any row whose business key
   matches an existing record.
7. **Confirm** — an explicit, separate action (`commitImportBatch`) that requires the batch to already be
   `validated` and an explicit confirmation, matching the platform-wide rule that destructive/upsert operations
   need explicit confirmation.
8. **Process** — each row is validated and written independently (not one all-or-nothing transaction), so a batch
   can partially succeed with a clear per-row record of what happened.
9. **Results**, with a downloadable CSV of just the rejected rows (`/admin/education/imports/[id]/rejected-rows`).

Every row written this way also gets an `education_data_provenance` row (`source_type = 'csv_import'`,
`import_batch_id` set) — every imported entity is traceable back to which batch, and ultimately which file, created
or last touched it.

**CSV templates.** Seven templates live in `docs/import-templates/`, one per importable entity type: `universities.csv`,
`campuses.csv`, `courses.csv`, `intakes.csv`, `tuition-fees.csv`, `admission-requirements.csv`, `scholarships.csv`.
Each has a header row matching that entity's expected columns and one clearly-labelled `EXAMPLE ROW ONLY` data row
to show the shape — never real data, and never meant to be imported as-is. For example, `universities.csv`'s header
is `name,slug,country_iso_alpha2,city,state_region,street_address,postal_code,website,admissions_url,...`, and
`courses.csv`'s starts `university_slug,campus_name,name,slug,program_code,subject_area,discipline,
qualification_level,...` (a course is always addressed by its parent `university_slug`, not a bare course slug —
see §8 for why that matters on the public course-detail route too).

**Safety properties of the pipeline itself:**

- **Formula-injection protection.** Every cell is checked against the classic CSV/spreadsheet-formula-injection
  vectors (a raw leading tab/carriage-return, or — after stripping leading spaces — a leading `=`, `+`, `-`, or `@`)
  and prefixed with a literal-text quote if triggered, per OWASP guidance. This is applied at the one place text
  enters/leaves the system (`src/lib/education/csv.ts`), shared identically by the client-side preview and the
  server-side processor.
- **Size/row limits.** A 10 MB file-size cap and a 20,000-row cap are enforced in the parser itself, not only at
  the HTTP layer, so no caller of the parsing function is exposed to a pathological file being parsed into memory.
- **Dry-run support.** The validate/commit split (steps 4 and 7 above) *is* the dry-run mechanism — you can inspect
  exactly what a batch would do before anything is written.
- **Raw values preserved.** Normalization (for duplicate matching, slug format, etc.) never overwrites what a CSV
  file or admin actually provided — the original raw row is kept in `education_import_rows.raw_data` for audit,
  even for a rejected row, so an admin can download exactly what was submitted alongside why it failed.

## 5. Duplicate detection

Duplicate scoring (`src/lib/education/duplicates.ts`) is **deterministic, not fuzzy or ML-based** — every signal is
an exact match on a normalized value (name, country, city, website domain, source-record ID for universities;
analogous signals for courses), so a given pair of records scores identically no matter how many times it's
evaluated. A signal only counts toward the score when both sides actually have a value; two records that are both
missing a field never score as "matching" on it.

Two threshold constants gate when a pair becomes a suggested duplicate:

- `UNIVERSITY_DUPLICATE_SCORE_THRESHOLD = 0.6`
- `COURSE_DUPLICATE_SCORE_THRESHOLD = 0.6`

A score at or above threshold writes a `pending` row to `education_duplicate_candidates` — **never an automatic
merge.** The admin review workflow at `/admin/education/duplicates` (`scanForDuplicates` /
`rejectDuplicateCandidate` / `mergeDuplicateCandidates` in `src/lib/supabase/admin/education-duplicates.ts`) lets an
admin:

- Compare the two records side by side, with the individual match signals that contributed to the score shown for
  transparency.
- **Reject** the suggestion (status becomes `rejected`, nothing else changes).
- **Confirm and merge**, choosing a survivor and, field by field, which of the losing record's values to preserve
  onto the survivor.

A confirmed merge deliberately does **not** rewrite foreign keys anywhere else in the schema — that would require a
`SECURITY DEFINER` function with elevated privilege, which this migration avoids by design. Instead it sets the
losing record's `merged_into_id` pointer (added to both `universities` and `courses` in migration 0006) and marks it
`is_active = false`; every other table that references the losing record's ID (applications, saved items, etc.) is
left as-is, and a reader that cares about merges follows `merged_into_id`. Every resolution is recorded in the
existing `admin_audit_log`.

**Scale note:** `scanForDuplicates` does a full pairwise comparison of all active, unmerged records of a type — fine
for this platform's current, clearly-labelled starter-dataset scale; a much larger catalog would need a
blocking/indexing pass (e.g. compare only within the same country) before pairwise scoring.

## 6. Data quality & freshness

Rule implementations live in `src/lib/education/data-quality.ts` — pure functions, no DB access, reused by the CSV
import validator, the admin data-quality dashboard (`/admin/education/data-quality`), and record-level
"missing-field" indicators elsewhere in the admin UI. Checks include (non-exhaustive list, by code):

- `missing_source_url` / `missing_last_verified_at` — a record with no citeable source or verification date.
- `stale_verification` — a record whose freshness band (below) has fallen to `stale`.
- `missing_official_url`, `invalid_country_code`, `invalid_currency_code` — format/reference checks.
- `invalid_tuition_amount`, `inactive_parent_university`, `unpublished_parent` — internal-consistency checks on
  courses (e.g. a published course whose parent university isn't published, which would make it invisible to the
  public despite its own status).
- `deadline_before_opening`, `final_deadline_before_priority` — intake deadline-ordering checks (also enforced at
  the database level by a `CHECK` constraint, so these can never be silently violated even outside the admin UI).
- `upcoming_intake_in_past` — an intake still marked "upcoming" whose start date has already passed.
- `invalid_language_test_score_range` — an admission requirement's stated test score outside that test's valid
  range (IELTS/TOEFL/PTE/Duolingo, each with its own real scale).
- Duplicate-slug detection across a set of records (case-insensitive).

**Freshness bands** — `current` / `review_soon` / `stale` / `unknown` — are computed from a record's
`last_verified_at` date at **read time only**, never stored as a column (a database `CHECK`/generated column can't
reference "now" in a way that stays correct as time passes). The default thresholds are 180 days for `current` and
365 days for `review_soon`; anything older is `stale`, and a record with no verification date at all is `unknown`.

**The rule that matters most here: nothing in this system auto-deletes or auto-corrects a stale or flagged record.**
Every check only ever surfaces an issue for a human admin to review and fix.

## 7. The three CLI scripts

Three scripts under `scripts/` give command-line access to a fixed subset of what the Admin UI can do, for local
development and CI use. All three require Node/npm — none require a Supabase CLI or local database tooling beyond
what's already in this repo.

### `npm run validate:education-data -- --file=<path> --entity=<type>`

A pure, **offline** pre-check — no database connection at all. `<type>` is one of the seven `IMPORT_ENTITY_TYPES`:
`universities`, `campuses`, `courses`, `course_intakes`, `course_tuition_fees`, `course_admission_requirements`,
`scholarships` (matching both `src/types/education.ts` and the 7 templates in `docs/import-templates/`). It checks
the CSV's header row against that entity type's required columns, plus per-row format checks (slug format, ISO
country codes, currency codes, non-empty required fields). Exits `1` on any error, `0` otherwise — warnings alone
don't fail it.

This is a **fast offline pre-check only.** It does not — and cannot — catch referential errors (e.g. a
`university_slug` that doesn't exist yet) or duplicate detection; both require a live database and, for duplicates,
the full scoring pipeline in §5. Full validation only happens in the Admin UI's Data Imports → Validate step
(`/admin/education/imports/new`), which runs against a live authenticated session this CLI tool doesn't have.

### `npm run import:education-data -- --file=<path> --entity=universities|courses [--strategy=skip|update] [--yes]`

Connects to Supabase using a **new `SUPABASE_SERVICE_ROLE_KEY` environment variable** — a service-role key that
bypasses RLS. This is the **one and only place in this codebase** a service-role key is used; it is never used by
the Next.js application itself and is never exposed to the browser.

**Deliberately scoped to only `universities` and `courses`.** The other five entity types
(`campuses`, `course_intakes`, `course_tuition_fees`, `course_admission_requirements`, `scholarships`) require
multi-table referential and duplicate-detection logic that only the Admin UI's importer safely implements —
attempting one of them through this CLI tool prints an error directing you to the Admin UI instead, rather than
attempting a shortcut version of that logic here.

The flow:

1. Runs the same offline validation as `validate:education-data` first. If that finds any error, the script aborts
   with **no database writes at all**.
2. For each valid row, resolves it against existing rows by business key — slug for universities, university +
   slug for courses.
3. Per `--strategy` (default behavior documented by the script itself), either skips or updates an existing match,
   or creates a new row when there is none.
4. **Imported rows always land as `publication_status: "draft"`, never auto-published** — matching the Admin UI
   importer's own default. A human still has to review and publish.
5. Writes an `education_data_provenance` row for every created/updated record (`source_type: "csv_import"`,
   `source_provider: "cli_import"`), so a CLI-imported record is exactly as traceable as an Admin-UI-imported one.

**Requires an explicit `y/N` confirmation before writing anything**, after showing a preview count of creates/
updates/skips — bypassable only with `--yes`, intended for CI use.

### `npm run seed:education-data -- [--yes]`

Applies the already-written, idempotent starter dataset at `supabase/seed/0003_global_education_dev_seed.sql`
directly against a Postgres database, via a raw connection string in a **new `SUPABASE_DB_URL` environment
variable** (found in the Supabase dashboard's **Database Settings → Connection string**). This is the **only** one
of the three scripts that needs a raw Postgres connection rather than the Supabase JS client, because it runs the
seed file's raw multi-statement SQL as-is.

The seed file itself is written with `on conflict ... do nothing` throughout, so it is always safe to re-run — it
will never overwrite an admin's later edit to one of its rows, and running it twice never creates duplicates.

Prints what it's about to do and **requires an explicit `y/N` confirmation**, bypassable with `--yes`.

### Env vars, in one place

| Variable | Used by | Notes |
| --- | --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | `import:education-data` only | Server/CLI-only secret. Never prefixed `NEXT_PUBLIC_`. Never used by the app itself. |
| `SUPABASE_DB_URL` | `seed:education-data` only | Server/CLI-only Postgres connection string. Never prefixed `NEXT_PUBLIC_`. Never used by the app itself. |

Both belong in `.env.local` (already git-ignored) and are documented in `.env.example`, alongside the existing
Supabase publishable-key and Razorpay variables — see that file's comments for exactly where to get each value.
Neither is ever read by any code path outside the three `scripts/*-education-data.ts` files.

## 8. Public discovery & student features

| Route | What it is |
| --- | --- |
| `/universities` | Public search/browse of published, active universities — filterable by country, city, study mode. |
| `/universities/[slug]` | A university's public detail page — profile, campuses, and its published courses. |
| `/courses` | Public search/browse of published, active courses — filterable by subject, qualification level, study mode, teaching language, tuition range, intake period, scholarship availability, and more. |
| `/courses/[universitySlug]/[courseSlug]` | A course's public detail page. **Course slugs are only unique per-university, not globally** — hence the two-segment route (`university-slug/course-slug`), never a flat `/courses/[slug]`. |
| `/courses/compare` | Compare 2–4 courses side by side (tuition, duration, entry requirements, and more), selected by course ID via `?ids=...`. Public, no login required. |
| `/saved` | A signed-in student's saved universities/courses. |
| `/applications` | A signed-in student's own applications — reusing the existing Milestone 7 `applications` table (see §3) rather than a second, parallel application system. |

Student actions available from these pages, all backed by the student-owned tables in §2:

- **Save / unsave** a university or course (`education_saved_items`).
- **Track an intake** — record interest in a specific upcoming intake so it can be surfaced later
  (`education_intake_interests`).
- **Share a course with a counsellor**, with an optional message (`education_course_shares`) — see §3's honest
  caveat on how this gets routed to staff.
- **Start an application** from a course page. This always writes into the same `applications` table Milestone 7's
  admin system already manages — there is never a second, competing application record for the same student.

Public list pages deliberately never load the full catalog into the browser — pagination defaults to 20 records per
page (capped at 60) on the public side, smaller than the admin console's own limits, per the "do not load the
complete course database into the browser" rule (`src/lib/education/search.ts`).

## 9. Adding a new country

No migration and no code change is required. Concretely:

1. Insert a row into `countries` with a real ISO 3166-1 alpha-2/alpha-3 code, name, region/subregion, and (if
   applicable) an ISO 4217 currency code — for example:

   ```sql
   insert into public.countries (iso_alpha2, iso_alpha3, name, region, subregion, currency_code, default_language)
   values ('JP', 'JPN', 'Japan', 'Asia', 'Eastern Asia', 'JPY', 'Japanese')
   on conflict (iso_alpha2) do nothing;
   ```

2. That's it. Every table that references `countries.id` (`universities.country_id`, `campuses.country_id`,
   `course_admission_requirements.country_context_id`) already generalizes to any row in that table — nothing about
   the schema, RLS, the CSV templates, or the CLI scripts is hard-coded to the 21 countries seeded by migration
   0006.
3. Add universities/courses for the new country the same way as any other — through the Admin UI or the CSV import
   workflow (§4) — always sourced and cited, never fabricated (§11).

## 10. Source-provider adapters

Bulk data enters this system through a small adapter interface, `EducationSourceProviderAdapter`
(`src/lib/education/source-providers/types.ts`): anything that can turn its own raw input into a parsed set of
CSV-shaped rows (headers + row cells) for the import pipeline to validate and write. `validateImportBatch`
(`src/lib/supabase/admin/education-imports.ts`) calls through this interface — `localCsvAdapter.fetchRawRecords(...)`
— rather than parsing CSV text itself, so a second adapter is a small, additive change, not a rewrite.

Today there is exactly one implementation: `localCsvAdapter` (`src/lib/education/source-providers/local-csv-adapter.ts`),
a thin, real (not decorative) wrapper around `src/lib/education/csv.ts`'s `parseCsv` — an admin-uploaded local CSV
file. There is no scraping, no fake external API integration, and no live connector to any university, ranking site,
or government data source anywhere in this codebase — every fact that enters this system comes from a human either
typing it into the Admin UI directly or uploading a CSV they sourced and cited themselves. A future data-provider
adapter (e.g. a licensed data feed, once one is actually contracted and available) would implement the same
`EducationSourceProviderAdapter` interface — it is a genuinely new integration to build when the time comes, not
something already faked or partially wired up today.

## 11. Never do this

- Never claim exhaustive coverage — "every university," "the world's universities," or similar, anywhere in the UI
  or documentation. This platform is explicitly extensible, never exhaustive.
- Never invent tuition, rankings, deadlines, requirements, or accreditation status. Every fact must trace back to a
  `source_url`/`data_source` an admin can point to; when an official source doesn't state something, leave the
  field null — never guess, round, or infer a "typical" figure.
- Never auto-merge duplicate candidates. A high match score only ever suggests a duplicate (§5) — merging always
  requires an explicit admin decision.
- Never expose a service-role credential to the browser. `SUPABASE_SERVICE_ROLE_KEY` is CLI/server-only, used in
  exactly one place (§7), and must never be prefixed `NEXT_PUBLIC_` or referenced from client code.
- Never add a `SECURITY DEFINER` function without strong justification. Migration 0006 defines zero of them by
  deliberate design — even duplicate merges avoid one (§5).
- Never scrape. No unlicensed (or licensed-but-unbuilt) web scraping of any university, ranking, or government site.
- Never convert currencies silently. `currency_code` on tuition/scholarship records always preserves the
  institution's own stated currency; a future FX-conversion display, if ever added, must be a clearly labelled
  separate layer, never a rewrite of the stored amount.
- Never auto-delete stale records. Data-quality checks (§6) only ever flag; a stale or incomplete record stays
  visible to admins (and, if published, to the public) until a human corrects or archives it.
- Never load the full catalog into the browser. Public list pages are always paginated (§8).
