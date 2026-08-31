/**
 * Milestone 9 — CLI import of Global Education Data CSV files directly into
 * Supabase, bypassing the Admin UI, for `universities` and `courses` ONLY.
 *
 * Run with:
 *   npm run import:education-data -- --file=<path> --entity=universities|courses [--strategy=skip|update] [--yes]
 *
 * SCOPE: this tool deliberately supports only `--entity=universities` and
 * `--entity=courses` — the other five Milestone 9 import entity types
 * (`campuses`, `course_intakes`, `course_tuition_fees`,
 * `course_admission_requirements`, `scholarships`) need multi-table
 * referential/duplicate-detection logic that only the Admin UI's Data
 * Imports feature (/admin/education/imports —
 * src/lib/supabase/admin/education-imports.ts) currently implements
 * safely. Any other entity type is refused with a clear message rather than
 * a half-correct reimplementation.
 *
 * This script re-implements (does NOT import) the `validateUniversityRow`
 * and `validateCourseRow` field mappings from
 * src/lib/supabase/admin/education-imports.ts, faithfully, so a CLI-imported
 * row looks identical to what the Admin UI would have produced. That file
 * is "server-only"-marked, cookie/session-scoped Next.js app code this CLI
 * tool cannot import — it needs a live Next.js request context this
 * standalone Node process doesn't have. One deliberate simplification:
 * course rows never resolve `campus_name` -> `campus_id` here (always left
 * null) — campus import is out of this tool's scope anyway, and adding a
 * third bulk lookup just for a best-effort optional field wasn't worth the
 * coupling. Keep this file's two row-mapping functions in sync BY HAND with
 * their originals if those ever change.
 *
 * Uses a plain `@supabase/supabase-js` `createClient(url, serviceRoleKey)`
 * — the service-role key BYPASSES ROW LEVEL SECURITY by design. This is the
 * one place in the whole app a service-role key is used; it must never be
 * importable from src/** or reachable from the browser (see .env.example).
 *
 * Every write is gated behind an explicit y/N confirmation (or --yes for
 * CI) that shows exact create/update/skip counts BEFORE anything is
 * written — see confirmOrAbort() below. Imported rows always land as
 * publication_status: "draft" — never auto-published.
 */

import { createClient } from "@supabase/supabase-js";
import { validateEducationCsvFile } from "./validate-education-data";
import { confirmOrAbort, getStringFlag, loadEducationCliEnv, parseCliArgs, requireEnvVar } from "./lib/education-cli-shared";
import { isValidAlpha2, isValidCurrencyCodeFormat, isValidSlug, normalizeSlug } from "../src/lib/education/normalize";
import type { ImportRowIssue } from "../src/types/education";

loadEducationCliEnv();

type SupportedEntity = "universities" | "courses";

// ---------------------------------------------------------------------------
// Cell-parsing helpers — copied from src/lib/supabase/admin/education-imports.ts
// (private/unexported there) so this script's row mapping matches exactly.
// ---------------------------------------------------------------------------

function err(field: string, message: string): ImportRowIssue {
  return { field, message };
}
function optionalText(record: Record<string, string>, key: string): string | null {
  const raw = (record[key] ?? "").trim();
  return raw || null;
}
function parseListCell(record: Record<string, string>, key: string): string[] {
  const raw = (record[key] ?? "").trim();
  if (!raw) return [];
  return raw.split(/[,;]/).map((v) => v.trim()).filter(Boolean);
}
function parseBooleanCell(record: Record<string, string>, key: string): boolean | null {
  const raw = (record[key] ?? "").trim().toLowerCase();
  if (!raw) return null;
  if (["true", "yes", "1", "y"].includes(raw)) return true;
  if (["false", "no", "0", "n"].includes(raw)) return false;
  return null;
}
function parseAmountToMinor(record: Record<string, string>, key: string, issues: ImportRowIssue[]): number | null {
  const raw = (record[key] ?? "").trim();
  if (!raw) return null;
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    issues.push(err(key, `"${raw}" is not a valid non-negative amount.`));
    return null;
  }
  return Math.round(parsed * 100);
}
function parseIntCell(record: Record<string, string>, key: string, issues: ImportRowIssue[], min?: number, max?: number): number | null {
  const raw = (record[key] ?? "").trim();
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || (min !== undefined && parsed < min) || (max !== undefined && parsed > max)) {
    issues.push(err(key, `"${raw}" is not a valid whole number${min !== undefined && max !== undefined ? ` between ${min} and ${max}` : ""}.`));
    return null;
  }
  return parsed;
}
function parseDateCell(record: Record<string, string>, key: string, issues: ImportRowIssue[]): string | null {
  const raw = (record[key] ?? "").trim();
  if (!raw) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    issues.push(err(key, `"${raw}" is not a valid date (expected YYYY-MM-DD).`));
    return null;
  }
  return raw;
}
function parseUrlCell(record: Record<string, string>, key: string, issues: ImportRowIssue[]): string | null {
  const raw = (record[key] ?? "").trim();
  if (!raw) return null;
  try {
    new URL(raw);
  } catch {
    issues.push(err(key, `"${raw}" is not a valid URL.`));
    return null;
  }
  return raw;
}

// ---------------------------------------------------------------------------
// Row mapping — faithful ports of validateUniversityRow / validateCourseRow
// ---------------------------------------------------------------------------

export interface RowResult {
  errors: ImportRowIssue[];
  warnings: ImportRowIssue[];
  writeFields: Record<string, unknown> | null;
  /** lower-cased already, so business-key comparison is a plain === */
  businessKey: string | null;
}

export interface ImportContext {
  countryIdByIso: Map<string, string>;
  universityBySlug: Map<string, { id: string; name: string }>;
}

/** Exported for scripts/import-education-data.test.ts — this is the single most important function in this file to keep correct, since it's a hand-maintained duplicate of validateUniversityRow in src/lib/supabase/admin/education-imports.ts. */
export function buildUniversityRow(record: Record<string, string>, ctx: ImportContext): RowResult {
  const errors: ImportRowIssue[] = [];
  const warnings: ImportRowIssue[] = [];

  const name = (record.name ?? "").trim();
  if (!name) errors.push(err("name", "Name is required."));

  let slug = (record.slug ?? "").trim();
  if (!slug && name) slug = normalizeSlug(name);
  if (!isValidSlug(slug)) errors.push(err("slug", `"${slug}" is not a valid slug (lowercase letters, numbers, hyphens).`));

  const isoRaw = (record.country_iso_alpha2 ?? "").trim().toUpperCase();
  if (!isValidAlpha2(isoRaw)) {
    errors.push(err("country_iso_alpha2", `"${isoRaw}" is not a valid 2-letter country code.`));
  }
  const countryId = ctx.countryIdByIso.get(isoRaw) ?? null;
  if (isoRaw && isValidAlpha2(isoRaw) && !countryId) {
    errors.push(err("country_iso_alpha2", `"${isoRaw}" is not a country this platform currently has configured.`));
  }

  const applicationFeeCurrency = optionalText(record, "application_fee_currency")?.toUpperCase() ?? null;
  if (applicationFeeCurrency && !isValidCurrencyCodeFormat(applicationFeeCurrency)) {
    errors.push(err("application_fee_currency", `"${applicationFeeCurrency}" is not a valid ISO 4217 currency code.`));
  }
  const applicationFeeMinorUnits = parseAmountToMinor(record, "application_fee_amount", errors);

  const websiteUrl = parseUrlCell(record, "website", warnings);
  const sourceUrl = parseUrlCell(record, "source_url", warnings);
  if (!sourceUrl) warnings.push(err("source_url", "No source URL provided — this record will be flagged for review."));
  const sourceAccessDate = parseDateCell(record, "source_access_date", warnings);
  const lastVerifiedAt = parseDateCell(record, "last_verified_at", warnings);
  const foundingYear = parseIntCell(record, "founding_year", warnings, 1000, 2100);

  if (errors.length > 0) {
    return { errors, warnings, writeFields: null, businessKey: null };
  }

  return {
    errors,
    warnings,
    businessKey: `slug:${slug.toLowerCase()}`,
    writeFields: {
      name,
      slug,
      country_id: countryId,
      country: isoRaw,
      city: optionalText(record, "city"),
      state_region: optionalText(record, "state_region"),
      street_address: optionalText(record, "street_address"),
      postal_code: optionalText(record, "postal_code"),
      website: websiteUrl,
      admissions_url: parseUrlCell(record, "admissions_url", warnings),
      international_admissions_url: parseUrlCell(record, "international_admissions_url", warnings),
      institution_type: optionalText(record, "institution_type"),
      ownership_type: optionalText(record, "ownership_type"),
      founding_year: foundingYear,
      accreditation_organization: optionalText(record, "accreditation_organization"),
      study_levels: parseListCell(record, "study_levels"),
      study_modes: parseListCell(record, "study_modes"),
      summary: optionalText(record, "summary"),
      scholarships_available: parseBooleanCell(record, "scholarships_available"),
      application_fee_minor_units: applicationFeeMinorUnits,
      application_fee_currency: applicationFeeCurrency,
      data_source: optionalText(record, "data_source"),
      source_url: sourceUrl,
      source_access_date: sourceAccessDate,
      last_verified_at: lastVerifiedAt,
      verification_status: ["unverified", "needs_review", "verified"].includes((record.verification_status ?? "").trim())
        ? record.verification_status.trim()
        : "needs_review",
      publication_status: "draft",
    },
  };
}

/** Exported for scripts/import-education-data.test.ts — see buildUniversityRow's comment above; same rationale. */
export function buildCourseRow(record: Record<string, string>, ctx: ImportContext): RowResult {
  const errors: ImportRowIssue[] = [];
  const warnings: ImportRowIssue[] = [];

  const slugRaw = (record.university_slug ?? "").trim().toLowerCase();
  let university: { id: string; name: string } | null = null;
  if (!slugRaw) {
    errors.push(err("university_slug", "A university_slug is required to link this row to an existing university."));
  } else {
    university = ctx.universityBySlug.get(slugRaw) ?? null;
    if (!university) {
      errors.push(err("university_slug", `No active university found with slug "${slugRaw}". Import universities first, or check the spelling.`));
    }
  }

  const name = (record.name ?? "").trim();
  if (!name) errors.push(err("name", "Course name is required."));
  let slug = (record.slug ?? "").trim();
  if (!slug && name) slug = normalizeSlug(name);
  if (!isValidSlug(slug)) errors.push(err("slug", `"${slug}" is not a valid slug.`));

  // Deliberate simplification vs. the Admin UI: campus_name -> campus_id
  // resolution is skipped entirely here. campus_id is always null — see
  // this file's top-of-file docblock.

  const applicationFeeCurrency = optionalText(record, "application_fee_currency")?.toUpperCase() ?? null;
  if (applicationFeeCurrency && !isValidCurrencyCodeFormat(applicationFeeCurrency)) {
    errors.push(err("application_fee_currency", `"${applicationFeeCurrency}" is not a valid ISO 4217 currency code.`));
  }
  const applicationFeeMinorUnits = parseAmountToMinor(record, "application_fee_amount", errors);
  const durationValueRaw = optionalText(record, "duration_value");
  const durationValue = durationValueRaw ? Number.parseFloat(durationValueRaw) : null;
  if (durationValueRaw && (!Number.isFinite(durationValue) || (durationValue as number) < 0)) errors.push(err("duration_value", `"${durationValueRaw}" is not a valid duration.`));

  const sourceUrl = parseUrlCell(record, "source_url", warnings);
  if (!sourceUrl) warnings.push(err("source_url", "No source URL provided — this record will be flagged for review."));
  const lastVerifiedAt = parseDateCell(record, "last_verified_at", warnings);

  if (errors.length > 0 || !university) {
    return { errors, warnings, writeFields: null, businessKey: null };
  }

  return {
    errors,
    warnings,
    businessKey: `${university.id}:${slug.toLowerCase()}`,
    writeFields: {
      university_id: university.id,
      campus_id: null,
      name,
      slug,
      program_code: optionalText(record, "program_code"),
      subject_area: optionalText(record, "subject_area"),
      discipline: optionalText(record, "discipline"),
      education_level: optionalText(record, "qualification_level"),
      qualification_title: optionalText(record, "qualification_title"),
      award: optionalText(record, "award"),
      duration_value: durationValue,
      duration_unit: optionalText(record, "duration_unit"),
      study_pace: optionalText(record, "study_pace"),
      delivery_mode: optionalText(record, "delivery_mode"),
      teaching_language: optionalText(record, "teaching_language"),
      tuition_domestic_or_international: optionalText(record, "tuition_domestic_or_international"),
      application_fee_minor_units: applicationFeeMinorUnits,
      application_fee_currency: applicationFeeCurrency,
      application_url: parseUrlCell(record, "application_url", warnings),
      course_url: parseUrlCell(record, "course_url", warnings),
      intake_periods: parseListCell(record, "intake_periods"),
      min_academic_requirement: optionalText(record, "min_academic_requirement"),
      career_outcomes: optionalText(record, "career_outcomes"),
      professional_accreditation: optionalText(record, "professional_accreditation"),
      data_source: optionalText(record, "data_source"),
      source_url: sourceUrl,
      last_verified_at: lastVerifiedAt,
      verification_status: ["unverified", "needs_review", "verified"].includes((record.verification_status ?? "").trim())
        ? record.verification_status.trim()
        : "needs_review",
      publication_status: "draft",
    },
  };
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

function printUsage(): void {
  console.log(`
Usage: npm run import:education-data -- --file=<path> --entity=universities|courses [--strategy=skip|update] [--yes]

Imports a Global Education Data CSV file directly into Supabase using a
service-role key (bypasses Row Level Security). Only --entity=universities
and --entity=courses are supported — see this file's top-of-file comment
for why the other five Milestone 9 entity types are out of scope for this
CLI tool.

Options:
  --file=<path>        Path to the CSV file to import (required).
  --entity=<type>       "universities" or "courses" (required).
  --strategy=<skip|update>  What to do when a row matches an existing record
                         by business key. Default: skip.
  --yes                 Skip the interactive y/N confirmation (for CI).
  --help                Show this message and exit.

Requires environment variables (loaded from .env.local, falling back to
already-exported shell/CI vars):
  NEXT_PUBLIC_SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
`);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const { flags, help } = parseCliArgs(argv);

  if (help || argv.length === 0) {
    printUsage();
    process.exit(0);
  }

  const file = getStringFlag(flags, "file");
  const entity = getStringFlag(flags, "entity");
  const strategyRaw = getStringFlag(flags, "strategy") ?? "skip";
  const autoYes = flags.yes === true;

  if (!file || !entity) {
    console.error("Both --file=<path> and --entity=<type> are required. Run with --help for usage.");
    process.exit(1);
  }
  if (strategyRaw !== "skip" && strategyRaw !== "update") {
    console.error(`--strategy must be "skip" or "update", got "${strategyRaw}".`);
    process.exit(1);
  }
  const strategy = strategyRaw as "skip" | "update";

  if (entity !== "universities" && entity !== "courses") {
    console.error(
      `Entity type "${entity}" is not supported by this CLI tool — it needs multi-table referential/duplicate-detection logic that only the Admin UI's Data Imports feature (/admin/education/imports) currently implements safely. Use the Admin UI for this entity type.`,
    );
    process.exit(1);
  }
  const entityType = entity as SupportedEntity;

  // Step 1 — offline, no-DB structural pre-check (reused from script 1).
  let validation;
  try {
    validation = validateEducationCsvFile(file, entityType);
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  }
  if (validation.errors.length > 0) {
    console.error(`\n${file} failed the offline structural pre-check — fix these before importing:\n`);
    for (const issue of validation.errors) {
      console.error(`ERROR ${issue.file}:${issue.row}:${issue.col} — ${issue.message}`);
    }
    console.error(`\n${validation.errors.length} error(s). No database connection was made.\n`);
    process.exit(1);
  }
  for (const issue of validation.warnings) {
    console.log(`WARN ${issue.file}:${issue.row}${issue.col ? `:${issue.col}` : ""} — ${issue.message}`);
  }

  let url: string;
  let serviceRoleKey: string;
  try {
    url = requireEnvVar("NEXT_PUBLIC_SUPABASE_URL", "Copy .env.example to .env.local and fill in your Supabase project URL.");
    serviceRoleKey = requireEnvVar(
      "SUPABASE_SERVICE_ROLE_KEY",
      "Find it in your Supabase project's Settings -> API -> service_role secret, and add it to .env.local. NEVER commit it or prefix it with NEXT_PUBLIC_.",
    );
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  }

  const supabase = createClient(url, serviceRoleKey);

  // Step 2/3 — build the lookup context and map every row.
  const ctx: ImportContext = { countryIdByIso: new Map(), universityBySlug: new Map() };
  if (entityType === "universities") {
    const { data, error } = await supabase.from("countries").select("id, iso_alpha2");
    if (error) {
      console.error(`Could not load countries: ${error.message}`);
      process.exit(1);
    }
    for (const c of data ?? []) ctx.countryIdByIso.set((c.iso_alpha2 as string).toUpperCase(), c.id as string);
  } else {
    const { data, error } = await supabase.from("universities").select("id, name, slug").eq("is_active", true).is("merged_into_id", null);
    if (error) {
      console.error(`Could not load universities: ${error.message}`);
      process.exit(1);
    }
    for (const u of data ?? []) ctx.universityBySlug.set((u.slug as string).toLowerCase(), { id: u.id as string, name: u.name as string });
  }

  const table: SupportedEntity = entityType;
  const builder = entityType === "universities" ? buildUniversityRow : buildCourseRow;

  const mapped = validation.rows.map((record, idx) => ({ rowNumber: idx + 2, record, result: builder(record, ctx) }));
  const invalidRows = mapped.filter((m) => m.result.errors.length > 0);
  const validRows = mapped.filter((m) => m.result.errors.length === 0 && m.result.writeFields && m.result.businessKey);

  if (invalidRows.length > 0) {
    console.log(`\n${invalidRows.length} row(s) failed referential/field validation and will NOT be written:\n`);
    for (const m of invalidRows) {
      for (const issue of m.result.errors) {
        console.log(`ERROR ${file}:${m.rowNumber}:${issue.field ?? ""} — ${issue.message}`);
      }
    }
  }

  // Step 4 — fetch existing business keys in bulk.
  const existingKeys = new Map<string, string>();
  if (entityType === "universities") {
    const { data, error } = await supabase.from("universities").select("id, slug").is("merged_into_id", null);
    if (error) {
      console.error(`Could not check existing universities: ${error.message}`);
      process.exit(1);
    }
    for (const r of data ?? []) existingKeys.set(`slug:${(r.slug as string).toLowerCase()}`, r.id as string);
  } else {
    const { data, error } = await supabase.from("courses").select("id, slug, university_id").is("merged_into_id", null);
    if (error) {
      console.error(`Could not check existing courses: ${error.message}`);
      process.exit(1);
    }
    for (const r of data ?? []) existingKeys.set(`${r.university_id as string}:${(r.slug as string).toLowerCase()}`, r.id as string);
  }

  // businessKey is already formatted to match existingKeys' own key format
  // exactly ("slug:xxx" for universities, "<university_id>:<slug>" for
  // courses — see buildUniversityRow/buildCourseRow above and the bulk
  // fetch just above), so a direct map lookup is all that's needed.
  const plan = validRows.map((m) => ({ ...m, existingId: existingKeys.get(m.result.businessKey as string) ?? null }));

  const toCreate = plan.filter((p) => !p.existingId);
  const toSkip = strategy === "skip" ? plan.filter((p) => p.existingId) : [];
  const toUpdate = strategy === "update" ? plan.filter((p) => p.existingId) : [];

  const pluralize = (n: number, singularSuffix: string, pluralSuffix: string) => (n === 1 ? singularSuffix : pluralSuffix);
  const entityWord = (n: number) => (entityType === "universities" ? `universit${pluralize(n, "y", "ies")}` : `course${pluralize(n, "", "s")}`);

  console.log(`\nThis will CREATE ${toCreate.length} ${entityWord(toCreate.length)}, UPDATE ${toUpdate.length} ${entityWord(toUpdate.length)}, SKIP ${toSkip.length} ${entityWord(toSkip.length)} in Supabase project ${url}.`);
  if (invalidRows.length > 0) {
    console.log(`${invalidRows.length} row(s) failed validation above and will not be written.`);
  }
  console.log("Imported rows always land as publication_status: \"draft\" (never auto-published).");

  const proceed = await confirmOrAbort("Continue?", autoYes);
  if (!proceed) {
    console.log("Aborted. No changes were written.");
    process.exit(0);
  }

  // Step 6/7 — execute.
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let failed = invalidRows.length;
  const today = new Date().toISOString().slice(0, 10);

  for (const p of plan) {
    const writeFields = p.result.writeFields as Record<string, unknown>;
    try {
      let resultingId: string;
      if (p.existingId && strategy === "skip") {
        skipped++;
        continue;
      } else if (p.existingId && strategy === "update") {
        const { error } = await supabase.from(table).update(writeFields).eq("id", p.existingId);
        if (error) throw new Error(error.message);
        resultingId = p.existingId;
        updated++;
      } else {
        const { data, error } = await supabase.from(table).insert(writeFields).select("id").single();
        if (error || !data) throw new Error(error?.message ?? "Insert failed.");
        resultingId = (data as { id: string }).id;
        existingKeys.set(p.result.businessKey as string, resultingId);
        created++;
      }

      // Step 5 — provenance upsert, shape matching education-imports.ts's commitImportBatch (~line 1212-1228).
      const provenanceEntityType = entityType === "universities" ? "university" : "course";
      const { error: provenanceError } = await supabase.from("education_data_provenance").upsert(
        {
          entity_type: provenanceEntityType,
          entity_id: resultingId,
          source_provider: "cli_import",
          source_type: "csv_import",
          source_url: (writeFields.source_url as string | undefined) ?? null,
          source_record_id: null,
          retrieved_at: today,
          last_verified_at: (writeFields.last_verified_at as string | undefined) ?? null,
          import_batch_id: null,
          raw_record_checksum: null,
          verification_status: (writeFields.verification_status as string | undefined) ?? "needs_review",
          data_quality_status: "unknown",
        },
        { onConflict: "entity_type,entity_id" },
      );
      if (provenanceError) {
        console.log(`WARN row ${p.rowNumber}: record written but provenance upsert failed: ${provenanceError.message}`);
      }
    } catch (writeError) {
      failed++;
      console.log(`ERROR row ${p.rowNumber}: ${writeError instanceof Error ? writeError.message : String(writeError)}`);
    }
  }

  console.log(`\nDone. Created: ${created}, Updated: ${updated}, Skipped: ${skipped}, Failed: ${failed}.\n`);
  process.exit(failed > 0 ? 1 : 0);
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  });
}
