import { describe, expect, it } from "vitest";
import {
  CsvSizeLimitError,
  csvRowsToRecords,
  escapeCsvCell,
  parseCsv,
  recordsToCsv,
  sanitizeCsvCellForFormulaInjection,
} from "./csv";

describe("sanitizeCsvCellForFormulaInjection", () => {
  it.each(["=cmd|'/c calc'!A1", "+1+1", "-1+1", "@SUM(A1:A2)", "\tformula", "\rformula"])(
    "prefixes a leading quote for a formula-triggering value: %s",
    (value) => {
      const result = sanitizeCsvCellForFormulaInjection(value);
      expect(result.startsWith("'")).toBe(true);
      expect(result).toBe(`'${value}`);
    },
  );

  it("leaves an ordinary value untouched", () => {
    expect(sanitizeCsvCellForFormulaInjection("University of Oxford")).toBe("University of Oxford");
  });

  it("does not flag a formula character that is not the leading character", () => {
    expect(sanitizeCsvCellForFormulaInjection("A+B=C")).toBe("A+B=C");
  });

  it("treats a leading-whitespace formula value as still dangerous (Excel trims before evaluating)", () => {
    expect(sanitizeCsvCellForFormulaInjection("  =cmd")).toBe("'  =cmd");
  });

  it("handles empty string without throwing", () => {
    expect(sanitizeCsvCellForFormulaInjection("")).toBe("");
  });
});

describe("escapeCsvCell", () => {
  it("wraps a value containing a comma in quotes", () => {
    expect(escapeCsvCell("Bengaluru, KA")).toBe('"Bengaluru, KA"');
  });

  it("doubles embedded quotes", () => {
    expect(escapeCsvCell('He said "hello"')).toBe('"He said ""hello"""');
  });

  it("leaves a plain value unquoted", () => {
    expect(escapeCsvCell("Oxford")).toBe("Oxford");
  });
});

describe("parseCsv", () => {
  it("parses a simple CSV with headers and rows", () => {
    const result = parseCsv("name,country\nOxford,GB\nMIT,US\n");
    expect(result.headers).toEqual(["name", "country"]);
    expect(result.rows).toEqual([
      ["Oxford", "GB"],
      ["MIT", "US"],
    ]);
    expect(result.warnings).toEqual([]);
  });

  it("handles quoted fields containing commas", () => {
    const result = parseCsv('name,address\n"Test Uni","123 Main St, Suite 4"\n');
    expect(result.rows).toEqual([["Test Uni", "123 Main St, Suite 4"]]);
  });

  it("handles escaped double quotes inside a quoted field", () => {
    const result = parseCsv('name,note\n"Test Uni","She said ""hi"""\n');
    expect(result.rows).toEqual([["Test Uni", 'She said "hi"']]);
  });

  it("handles a quoted field containing a newline", () => {
    const result = parseCsv('name,note\n"Test Uni","Line one\nLine two"\n');
    expect(result.rows).toEqual([["Test Uni", "Line one\nLine two"]]);
  });

  it("handles CRLF line endings", () => {
    const result = parseCsv("name,country\r\nOxford,GB\r\n");
    expect(result.rows).toEqual([["Oxford", "GB"]]);
  });

  it("warns (but does not throw) on a row with a mismatched column count", () => {
    const result = parseCsv("name,country\nOxford,GB,ExtraColumn\n");
    expect(result.warnings.length).toBe(1);
    expect(result.warnings[0]).toContain("Row 2");
  });

  it("returns empty headers/rows and a warning for an empty file", () => {
    const result = parseCsv("");
    expect(result.headers).toEqual([]);
    expect(result.rows).toEqual([]);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("throws CsvSizeLimitError for a file over the byte limit", () => {
    const huge = "name\n" + "a".repeat(11 * 1024 * 1024);
    expect(() => parseCsv(huge)).toThrow(CsvSizeLimitError);
  });

  it("throws CsvSizeLimitError for a file with too many data rows", () => {
    const header = "name\n";
    const rows = Array.from({ length: 20001 }, (_, i) => `Row ${i}`).join("\n");
    expect(() => parseCsv(header + rows)).toThrow(CsvSizeLimitError);
  });
});

describe("csvRowsToRecords", () => {
  it("maps rows to header-keyed, trimmed objects", () => {
    const records = csvRowsToRecords(["name", "country"], [[" Oxford ", "GB"]]);
    expect(records).toEqual([{ name: "Oxford", country: "GB" }]);
  });

  it("fills a missing trailing cell with an empty string", () => {
    const records = csvRowsToRecords(["name", "country"], [["Oxford"]]);
    expect(records).toEqual([{ name: "Oxford", country: "" }]);
  });
});

describe("recordsToCsv", () => {
  it("round-trips through parseCsv for ordinary data", () => {
    const csv = recordsToCsv(["name", "country"], [{ name: "Oxford", country: "GB" }]);
    const parsed = parseCsv(csv);
    expect(parsed.headers).toEqual(["name", "country"]);
    expect(parsed.rows).toEqual([["Oxford", "GB"]]);
  });

  it("neutralizes a formula-injection payload in an exported cell", () => {
    const csv = recordsToCsv(["name", "note"], [{ name: "Oxford", note: "=HYPERLINK(\"http://evil\")" }]);
    expect(csv).toContain("'=HYPERLINK");
  });
});
