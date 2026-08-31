import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseArgv, validateEducationCsvFile } from "./validate-education-data";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "education-csv-test-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function writeCsv(name: string, content: string): string {
  const filePath = path.join(dir, name);
  writeFileSync(filePath, content, "utf8");
  return filePath;
}

describe("validateEducationCsvFile", () => {
  it("passes a well-formed universities CSV with no errors or warnings", () => {
    const file = writeCsv(
      "universities.csv",
      [
        "name,slug,country_iso_alpha2,source_url",
        "Example University,example-university,DE,https://example.edu/about",
      ].join("\n"),
    );
    const result = validateEducationCsvFile(file, "universities");
    expect(result.errors).toEqual([]);
    expect(result.rows).toHaveLength(1);
  });

  it("reports a missing required column at the header level, row 1, and skips per-row checks", () => {
    const file = writeCsv("universities.csv", ["name,country_iso_alpha2", "Example University,DE"].join("\n"));
    const result = validateEducationCsvFile(file, "universities");
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({ row: 1, col: "slug" });
    expect(result.rows).toEqual([]);
  });

  it("flags an empty required column value on its own data row", () => {
    const file = writeCsv("universities.csv", ["name,slug,country_iso_alpha2", ",example-university,DE"].join("\n"));
    const result = validateEducationCsvFile(file, "universities");
    expect(result.errors.some((e) => e.col === "name" && e.row === 2)).toBe(true);
  });

  it("flags an invalid slug format", () => {
    const file = writeCsv("universities.csv", ["name,slug,country_iso_alpha2", "Example University,Not A Slug!,DE"].join("\n"));
    const result = validateEducationCsvFile(file, "universities");
    expect(result.errors.some((e) => e.col === "slug" && /not a valid slug/i.test(e.message))).toBe(true);
  });

  it("flags an invalid country_iso_alpha2 code", () => {
    const file = writeCsv("universities.csv", ["name,slug,country_iso_alpha2", "Example University,example-university,Germany"].join("\n"));
    const result = validateEducationCsvFile(file, "universities");
    expect(result.errors.some((e) => e.col === "country_iso_alpha2")).toBe(true);
  });

  it("flags an invalid currency code on any column whose header contains 'currency'", () => {
    const file = writeCsv(
      "courses.csv",
      ["university_slug,name,slug,application_fee_currency", "example-university,Example Course,example-course,dollars"].join("\n"),
    );
    const result = validateEducationCsvFile(file, "courses");
    expect(result.errors.some((e) => e.col === "application_fee_currency")).toBe(true);
  });

  it("applies the correct required-columns list per entity type", () => {
    // course_tuition_fees requires several columns none of the other types do.
    const file = writeCsv("tuition-fees.csv", ["university_slug,course_slug", "example-university,example-course"].join("\n"));
    const result = validateEducationCsvFile(file, "course_tuition_fees");
    const missingCols = result.errors.filter((e) => e.row === 1).map((e) => e.col);
    expect(missingCols).toEqual(expect.arrayContaining(["student_category", "amount", "currency_code", "academic_year"]));
  });

  it("throws a plain Error (not a crash) when the file doesn't exist", () => {
    expect(() => validateEducationCsvFile(path.join(dir, "does-not-exist.csv"), "universities")).toThrow(/could not be read|could not read/i);
  });

  it("does not throw on a well-formed courses CSV and resolves per-column checks independently per row", () => {
    const file = writeCsv(
      "courses.csv",
      [
        "university_slug,name,slug,source_url",
        "example-university,Valid Course,valid-course,https://example.edu/course",
        "example-university,Bad Slug Course,Not Valid!,https://example.edu/course2",
      ].join("\n"),
    );
    const result = validateEducationCsvFile(file, "courses");
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({ row: 3, col: "slug" });
  });
});

describe("parseArgv", () => {
  it("parses --file and --entity", () => {
    expect(parseArgv(["--file=a.csv", "--entity=universities"])).toEqual({ file: "a.csv", entity: "universities", help: false });
  });

  it("recognizes --help and -h", () => {
    expect(parseArgv(["--help"]).help).toBe(true);
    expect(parseArgv(["-h"]).help).toBe(true);
  });

  it("returns undefined for omitted flags", () => {
    expect(parseArgv([])).toEqual({ help: false });
  });
});
