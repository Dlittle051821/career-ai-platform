import { describe, expect, it } from "vitest";
import { confirmOrAbort, getStringFlag, maskConnectionStringPassword, parseCliArgs, requireEnvVar } from "./education-cli-shared";

describe("parseCliArgs", () => {
  it("parses --flag=value pairs", () => {
    const result = parseCliArgs(["--file=data.csv", "--entity=courses"]);
    expect(result.flags).toEqual({ file: "data.csv", entity: "courses" });
    expect(result.help).toBe(false);
  });

  it("parses a bare --flag as boolean true", () => {
    const result = parseCliArgs(["--yes"]);
    expect(result.flags.yes).toBe(true);
  });

  it("recognizes --help and -h as help", () => {
    expect(parseCliArgs(["--help"]).help).toBe(true);
    expect(parseCliArgs(["-h"]).help).toBe(true);
    expect(parseCliArgs([]).help).toBe(false);
  });

  it("ignores anything that isn't a -- flag (no positional-argument support)", () => {
    const result = parseCliArgs(["positional", "--file=x"]);
    expect(result.flags).toEqual({ file: "x" });
  });

  it("splits only on the first = so a value containing = survives intact", () => {
    const result = parseCliArgs(["--file=postgres://user:pass@host/db?sslmode=require"]);
    expect(result.flags.file).toBe("postgres://user:pass@host/db?sslmode=require");
  });
});

describe("getStringFlag", () => {
  it("returns the string value when present", () => {
    expect(getStringFlag({ file: "a.csv" }, "file")).toBe("a.csv");
  });

  it("returns undefined for a bare boolean flag", () => {
    expect(getStringFlag({ yes: true }, "yes")).toBeUndefined();
  });

  it("returns undefined when the flag is absent", () => {
    expect(getStringFlag({}, "file")).toBeUndefined();
  });
});

describe("confirmOrAbort", () => {
  it("returns true immediately without prompting when autoYes is true", async () => {
    // No stdin interaction happens on this path — safe to run in any test
    // environment (CI included) without mocking readline.
    await expect(confirmOrAbort("Proceed?", true)).resolves.toBe(true);
  });
});

describe("maskConnectionStringPassword", () => {
  it("masks the password in a standard postgres:// URL", () => {
    const masked = maskConnectionStringPassword("postgres://myuser:supersecret@db.example.com:5432/postgres");
    expect(masked).not.toContain("supersecret");
    expect(masked).toContain("myuser");
    expect(masked).toContain("****");
  });

  it("leaves a URL with no password unchanged", () => {
    const input = "postgres://db.example.com:5432/postgres";
    expect(maskConnectionStringPassword(input)).toBe(input);
  });

  it("falls back to a regex mask for a non-URL keyword=value DSN", () => {
    const masked = maskConnectionStringPassword("host=db.example.com password=supersecret dbname=postgres");
    expect(masked).not.toContain("supersecret");
    expect(masked).toContain("****");
  });

  it("returns unparseable input unchanged rather than throwing", () => {
    expect(() => maskConnectionStringPassword("not a connection string at all")).not.toThrow();
  });
});

describe("requireEnvVar", () => {
  it("returns the value when set", () => {
    const key = "__EDUCATION_CLI_TEST_VAR__";
    process.env[key] = "value";
    try {
      expect(requireEnvVar(key, "see .env.example")).toBe("value");
    } finally {
      delete process.env[key];
    }
  });

  it("throws a plain, guidance-carrying Error when missing", () => {
    const key = "__EDUCATION_CLI_TEST_VAR_MISSING__";
    delete process.env[key];
    expect(() => requireEnvVar(key, "see .env.example for setup.")).toThrow(/__EDUCATION_CLI_TEST_VAR_MISSING__[\s\S]*see \.env\.example/);
  });
});
