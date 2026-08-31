/**
 * Milestone 9 — offline, structural pre-check for a Global Education Data
 * CSV file, before it ever touches the Admin UI's Data Imports feature.
 *
 * Run with: npm run validate:education-data -- --file=<path> --entity=<type>
 *
 * WHAT THIS IS: a fast, dependency-free, NO-DATABASE-CONNECTION sanity
 * check. It parses the file with the same `parseCsv` the app itself uses
 * (src/lib/education/csv.ts), confirms the header row has every column the
 * chosen entity type requires, and runs lightweight per-cell format checks
 * with the pure helpers this project already ships
 * (src/lib/education/normalize.ts: `isValidSlug`, `isValidAlpha2`,
 * `isValidCurrencyCodeFormat`) plus a generic "required column is
 * non-empty" check.
 *
 * WHAT THIS IS NOT — and cannot replace: it does NOT catch referential
 * errors (e.g. a `university_slug` that doesn't match any university
 * actually in the database) or duplicate-record detection, because both of
 * those require a live, authenticated, RLS-scoped database session that a
 * standalone Node script cannot hold. That authoritative validation step is
 * the Admin UI's Data Imports -> Validate flow
 * (/admin/education/imports/new — see src/lib/supabase/admin/education-imports.ts's
 * `validateImportBatch`). Treat a clean run of THIS script as "the file is
 * well-formed enough to attempt an import", not "this file is safe to
 * commit to the database".
 *
 * This script has ZERO import coupling into src/lib/supabase/admin/** (that
 * tree is "server-only"-marked, cookie/session-scoped Next.js app code) or
 * any env/DB access — it is intentionally standalone so it can run in any
 * context (a laptop with no .env.local, a CI job with no DB credentials) a
 * data contributor might have before ever touching Supabase.
 */

import { readFileSync } from "node:fs";
import { CsvSizeLimitError, csvRowsToRecords, parseCsv } from "../src/lib/education/csv";
import { isValidAlpha2, isValidCurrencyCodeFormat, isValidSlug } from "../src/lib/education/normalize";
import { IMPORT_ENTITY_TYPES, type ImportEntityType } from "../src/types/education";

// ---------------------------------------------------------------------------
// REQUIRED_COLUMNS — copied verbatim from the private, unexported
// `REQUIRED_COLUMNS` constant in src/lib/supabase/admin/education-imports.ts
// (search for it there). MUST BE KEPT IN SYNC WITH THAT FILE BY HAND: this
// script cannot import it directly (that file is "server-only" app code
// this CLI tool must stay decoupled from — see the docblock above), so if
// the admin importer's required-column list ever changes, update the copy
// below in the same commit.
// ---------------------------------------------------------------------------
const REQUIRED_COLUMNS: Record<ImportEntityType, string[]> = {
  universities: ["name", "slug", "country_iso_alpha2"],
  campuses: ["university_slug", "name"],
  courses: ["university_slug", "name", "slug"],
  course_intakes: ["university_slug", "course_slug", "intake_name"],
  course_tuition_fees: ["university_slug", "course_slug", "student_category", "amount", "currency_code", "academic_year"],
  course_admission_requirements: ["university_slug", "course_slug", "accepted_qualification"],
  scholarships: ["scope", "name"],
};

export interface EducationCsvIssue {
  file: string;
  /** CSV row number as a human would count it: the header is row 1, so the first data row is row 2 — matches the convention used by education-imports.ts's own row numbering. 1 for header-level issues. */
  row: number;
  col: string;
  level: "error" | "warning";
  message: string;
}

export interface EducationCsvValidationResult {
  errors: EducationCsvIssue[];
  warnings: EducationCsvIssue[];
  rows: Record<string, string>[];
}

function issue(level: "error" | "warning", file: string, row: number, col: string, message: string): EducationCsvIssue {
  return { file, row, col, level, message };
}

/**
 * Parses and structurally validates one CSV file for one entity type.
 * Pure/synchronous, no DB, no network — reused by `import-education-data.ts`
 * as its offline pre-check before it opens any database connection.
 */
export function validateEducationCsvFile(filePath: string, entityType: ImportEntityType): EducationCsvValidationResult {
  const errors: EducationCsvIssue[] = [];
  const warnings: EducationCsvIssue[] = [];

  let text: string;
  try {
    text = readFileSync(filePath, "utf8");
  } catch (e) {
    throw new Error(`Could not read file "${filePath}": ${e instanceof Error ? e.message : String(e)}`);
  }

  let parsed;
  try {
    parsed = parseCsv(text);
  } catch (e) {
    if (e instanceof CsvSizeLimitError) {
      throw new Error(e.message);
    }
    throw new Error(`"${filePath}" could not be parsed as CSV.`);
  }

  for (const w of parsed.warnings) {
    const match = /^Row (\d+):/.exec(w);
    warnings.push(issue("warning", filePath, match ? Number.parseInt(match[1], 10) : 1, "", w));
  }

  const requiredColumns = REQUIRED_COLUMNS[entityType];
  const missingColumns = requiredColumns.filter((col) => !parsed.headers.includes(col));
  for (const col of missingColumns) {
    errors.push(issue("error", filePath, 1, col, `Missing required column "${col}". See docs/import-templates/ for the expected header row.`));
  }
  if (missingColumns.length > 0) {
    // A missing required column makes every row's per-cell checks against
    // that column meaningless (and it's already the CSV import pipeline's
    // own convention — see validateImportBatch — to reject up front on a
    // wrong template rather than emit one identical error per row).
    return { errors, warnings, rows: [] };
  }

  const rows = csvRowsToRecords(parsed.headers, parsed.rows);

  rows.forEach((record, idx) => {
    const rowNumber = idx + 2; // header is row 1

    // Generic "required column is non-empty" check.
    for (const col of requiredColumns) {
      if (!(record[col] ?? "").trim()) {
        errors.push(issue("error", filePath, rowNumber, col, `Required column "${col}" is empty.`));
      }
    }

    for (const header of parsed.headers) {
      const value = (record[header] ?? "").trim();
      if (!value) continue;

      if (header === "slug" || header.endsWith("_slug")) {
        if (!isValidSlug(value)) {
          errors.push(issue("error", filePath, rowNumber, header, `"${value}" is not a valid slug (lowercase letters, numbers, single hyphens, no leading/trailing hyphen).`));
        }
      }

      if (header === "country_iso_alpha2") {
        if (!isValidAlpha2(value)) {
          errors.push(issue("error", filePath, rowNumber, header, `"${value}" is not a valid 2-letter (ISO 3166-1 alpha-2) country code.`));
        }
      }

      if (header.toLowerCase().includes("currency")) {
        if (!isValidCurrencyCodeFormat(value)) {
          errors.push(issue("error", filePath, rowNumber, header, `"${value}" is not a valid ISO 4217 currency code (3 uppercase letters).`));
        }
      }
    }
  });

  return { errors, warnings, rows };
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

function printUsage(): void {
  console.log(`
Usage: npm run validate:education-data -- --file=<path> --entity=<type>

Offline, no-database structural pre-check for a Global Education Data CSV
file. See this file's top-of-file comment for exactly what it does and does
not catch.

Options:
  --file=<path>     Path to the CSV file to check (required).
  --entity=<type>   One of the entity types below (required).
  --help            Show this message and exit.

Entity types:
${IMPORT_ENTITY_TYPES.map((t) => `  - ${t}`).join("\n")}
`);
}

/** Exported for scripts/validate-education-data.test.ts. */
export function parseArgv(argv: string[]): { file?: string; entity?: string; help: boolean } {
  const result: { file?: string; entity?: string; help: boolean } = { help: false };
  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") {
      result.help = true;
    } else if (arg.startsWith("--file=")) {
      result.file = arg.slice("--file=".length);
    } else if (arg.startsWith("--entity=")) {
      result.entity = arg.slice("--entity=".length);
    }
  }
  return result;
}

function main(): void {
  const argv = process.argv.slice(2);
  const { file, entity, help } = parseArgv(argv);

  if (help || argv.length === 0) {
    printUsage();
    process.exit(0);
  }

  if (!file || !entity) {
    console.error("Both --file=<path> and --entity=<type> are required. Run with --help for usage.\n");
    process.exit(1);
  }

  if (!(IMPORT_ENTITY_TYPES as readonly string[]).includes(entity)) {
    console.error(`Unknown entity type "${entity}". Must be one of: ${IMPORT_ENTITY_TYPES.join(", ")}\n`);
    process.exit(1);
  }

  let result: EducationCsvValidationResult;
  try {
    result = validateEducationCsvFile(file, entity as ImportEntityType);
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  }

  console.log(`\nvalidate-education-data — ${file} (entity: ${entity})\n`);

  for (const w of result.warnings) {
    const location = w.col ? `${w.file}:${w.row}:${w.col}` : `${w.file}:${w.row}`;
    console.log(`WARN  ${location} — ${w.message}`);
  }
  for (const e of result.errors) {
    const location = e.col ? `${e.file}:${e.row}:${e.col}` : `${e.file}:${e.row}`;
    console.log(`ERROR ${location} — ${e.message}`);
  }

  console.log(`\n${result.rows.length} row(s) checked, ${result.errors.length} error(s), ${result.warnings.length} warning(s).\n`);

  if (result.errors.length > 0) {
    console.log("This is a structural pre-check only — it does not catch referential errors or duplicates. Use the Admin UI's Data Imports -> Validate step for the authoritative check.\n");
    process.exit(1);
  }
  process.exit(0);
}

if (require.main === module) {
  main();
}
