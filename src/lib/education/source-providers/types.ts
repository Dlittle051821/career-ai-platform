import type { CsvParseResult } from "../csv";

/**
 * Milestone 9 — source-provider adapter interface for the education-data
 * import pipeline (src/lib/supabase/admin/education-imports.ts).
 *
 * An adapter is anything that can produce a parsed set of CSV-shaped rows
 * (headers + row cells) for the import pipeline to validate and write. The
 * pipeline itself (`validateImportBatch`) only ever talks to this
 * interface — it never calls `parseCsv` directly — so a second adapter
 * could be added later without changing anything else in that file.
 *
 * Today there is exactly one implementation: `LocalCsvAdapter` (an
 * admin-uploaded CSV file — see `./local-csv-adapter.ts`). The spec for
 * this milestone is explicit: "do not add fake API integrations and do not
 * scrape websites" — so this interface exists to make a FUTURE, real,
 * licensed data-provider integration (e.g. a university consortium's
 * official data feed, added once such an integration is actually
 * contracted and available) a small, additive change, not a rewrite. It is
 * not a promise that any such integration exists today, and nothing in
 * this codebase should claim otherwise.
 */
export interface EducationSourceProviderAdapter {
  /** Stable machine id (e.g. "local_csv") — not yet persisted anywhere, kept distinct/stable for the day a second adapter exists and a batch needs to record which one produced it. */
  id: string;
  /** Human-readable label, for a future adapter-picker UI (the current Admin UI only ever offers CSV upload, so nothing renders this yet). */
  label: string;
  /** Produces parsed rows from whatever this adapter's raw input is. May throw (e.g. `CsvSizeLimitError` from `../csv`) exactly as the underlying parse step would. */
  fetchRawRecords(input: string): CsvParseResult;
}
