/**
 * Milestone 9 — dependency-free CSV parsing/serialization with CSV
 * (formula) injection protection, per OWASP guidance
 * (https://owasp.org/www-community/attacks/CSV_Injection). No DB access —
 * pure functions operating on strings/arrays only, so both the admin
 * import-preview UI (client-safe subset) and the server-side import
 * processor (src/lib/supabase/admin/education-imports.ts) can share the
 * exact same parsing/sanitization logic.
 *
 * Deliberately hand-rolled rather than a dependency: the project's
 * dependency list (package.json) has no CSV library, the format needed here
 * is plain RFC-4180-ish CSV (comma-separated, double-quote-quoted fields,
 * `""` as an escaped quote), and keeping this in-house means the
 * formula-injection guard is applied at the one place text enters/leaves
 * the system, not spread across a third-party API surface.
 */

/** A raw leading tab or carriage return is itself part of the classic CSV/formula injection vector (e.g. a cell literally starting with "\t=cmd") — checked against the UNTRIMMED first character, since trimming would strip exactly these bytes and hide them. */
const RAW_LEADING_DANGEROUS_CHARS = ["\t", "\r"];

/** After stripping leading plain spaces (which Excel/Sheets/LibreOffice do before evaluating a cell), any of these starting the remainder marks it as formula-triggering. */
const SPACE_TRIMMED_DANGEROUS_CHARS = ["=", "+", "-", "@"];

/**
 * Neutralizes a single cell value against CSV/formula injection: prefixes
 * it with a single quote (so spreadsheet software treats it as literal
 * text) if either (a) it raw-starts with a tab or carriage return, or (b)
 * after stripping leading plain spaces it starts with =, +, -, or @. Safe
 * to call on every cell unconditionally — an already-safe value is
 * returned unchanged.
 */
export function sanitizeCsvCellForFormulaInjection(value: string): string {
  if (!value) return value;
  if (RAW_LEADING_DANGEROUS_CHARS.includes(value[0])) {
    return `'${value}`;
  }
  const leading = value.replace(/^ +/, "");
  if (leading.length === 0) return value;
  if (SPACE_TRIMMED_DANGEROUS_CHARS.includes(leading[0])) {
    return `'${value}`;
  }
  return value;
}

/** Escapes a single cell for CSV output: wraps in double quotes and doubles any embedded double quotes if the value contains a comma, quote, or newline. Does NOT apply formula-injection sanitization — call sanitizeCsvCellForFormulaInjection first if the value came from/is destined for untrusted spreadsheet-opened output. */
export function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export interface CsvParseResult {
  headers: string[];
  rows: string[][];
  /** Non-fatal structural warnings, e.g. a row with a different column count than the header. */
  warnings: string[];
}

const MAX_CSV_BYTES = 10 * 1024 * 1024; // 10 MB — server-side import size limit (spec: "file-size/row-count limits")
const MAX_CSV_ROWS = 20000; // excludes header row

export class CsvSizeLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CsvSizeLimitError";
  }
}

/**
 * Parses RFC-4180-ish CSV text into headers + rows. Handles quoted fields
 * (including embedded commas/newlines/escaped `""`), \r\n and \n line
 * endings, and a trailing blank line. Throws CsvSizeLimitError if the input
 * exceeds MAX_CSV_BYTES or MAX_CSV_ROWS — this is enforced here (not only
 * at the HTTP layer) so any caller of this function gets the same
 * protection against a pathological file being parsed into memory.
 */
export function parseCsv(text: string): CsvParseResult {
  if (typeof text !== "string") {
    throw new CsvSizeLimitError("CSV input must be a string.");
  }
  const byteLength = Buffer.byteLength(text, "utf8");
  if (byteLength > MAX_CSV_BYTES) {
    throw new CsvSizeLimitError(`CSV file is ${Math.round(byteLength / 1024 / 1024)}MB, which exceeds the ${MAX_CSV_BYTES / 1024 / 1024}MB import limit.`);
  }

  const records: string[][] = [];
  let field = "";
  let record: string[] = [];
  let inQuotes = false;
  let i = 0;
  const len = text.length;

  const pushField = () => {
    record.push(field);
    field = "";
  };
  const pushRecord = () => {
    pushField();
    records.push(record);
    record = [];
  };

  while (i < len) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ",") {
      pushField();
      i += 1;
      continue;
    }
    if (ch === "\r") {
      if (text[i + 1] === "\n") i += 1;
      pushRecord();
      i += 1;
      continue;
    }
    if (ch === "\n") {
      pushRecord();
      i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }
  // Final field/record, unless the file ended cleanly on a newline (in
  // which case field === "" and record === [] already, so nothing to add).
  if (field.length > 0 || record.length > 0) {
    pushRecord();
  }

  // Drop fully-blank trailing rows (a single empty string field).
  while (records.length > 0) {
    const last = records[records.length - 1];
    if (last.length === 1 && last[0] === "") {
      records.pop();
    } else {
      break;
    }
  }

  if (records.length === 0) {
    return { headers: [], rows: [], warnings: ["The CSV file has no rows."] };
  }

  const [headerRow, ...dataRows] = records;
  const headers = headerRow.map((h) => h.trim());

  if (dataRows.length > MAX_CSV_ROWS) {
    throw new CsvSizeLimitError(`CSV file has ${dataRows.length} data rows, which exceeds the ${MAX_CSV_ROWS}-row import limit. Split the file and import in batches.`);
  }

  const warnings: string[] = [];
  const rows: string[][] = dataRows.map((row, idx) => {
    if (row.length !== headers.length) {
      warnings.push(`Row ${idx + 2}: expected ${headers.length} columns, found ${row.length}.`);
    }
    return row;
  });

  return { headers, rows, warnings };
}

/** Maps parsed CSV rows to an array of plain objects keyed by header, trimming every cell. Cells beyond the header length are dropped; missing trailing cells become "". */
export function csvRowsToRecords(headers: string[], rows: string[][]): Array<Record<string, string>> {
  return rows.map((row) => {
    const record: Record<string, string> = {};
    headers.forEach((header, idx) => {
      record[header] = (row[idx] ?? "").trim();
    });
    return record;
  });
}

/** Serializes headers + row objects back to CSV text, applying formula-injection sanitization to every cell — used for the "download rejected rows" and CSV export features, since both re-open in spreadsheet software. */
export function recordsToCsv(headers: string[], records: Array<Record<string, string>>): string {
  const lines = [headers.map(escapeCsvCell).join(",")];
  for (const record of records) {
    const line = headers
      .map((header) => escapeCsvCell(sanitizeCsvCellForFormulaInjection(record[header] ?? "")))
      .join(",");
    lines.push(line);
  }
  return lines.join("\r\n");
}
