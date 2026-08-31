import { describe, expect, it } from "vitest";
import {
  extractDomain,
  isValidAlpha2,
  isValidAlpha3,
  isValidCurrencyCodeFormat,
  isValidSlug,
  normalizeCountryCode,
  normalizeCurrencyCode,
  normalizeNameForMatching,
  normalizeQualificationLevel,
  normalizeSlug,
  normalizeUrlForMatching,
  normalizeWhitespace,
} from "./normalize";

describe("normalizeWhitespace", () => {
  it("collapses internal whitespace runs to a single space", () => {
    expect(normalizeWhitespace("Technical   University\n\nof   Munich")).toBe("Technical University of Munich");
  });

  it("trims leading/trailing whitespace", () => {
    expect(normalizeWhitespace("  Oxford  ")).toBe("Oxford");
  });

  it("returns empty string for null/undefined/empty input", () => {
    expect(normalizeWhitespace(null)).toBe("");
    expect(normalizeWhitespace(undefined)).toBe("");
    expect(normalizeWhitespace("")).toBe("");
  });
});

describe("normalizeUrlForMatching", () => {
  it("lowercases host, strips www. and a trailing slash", () => {
    expect(normalizeUrlForMatching("https://WWW.Example.edu/admissions/")).toBe("example.edu/admissions");
  });

  it("adds a scheme when missing so bare domains still parse", () => {
    expect(normalizeUrlForMatching("example.edu")).toBe("example.edu");
  });

  it("returns null for unparseable input", () => {
    expect(normalizeUrlForMatching("not a url at all!!")).toBeNull();
  });

  it("returns null for empty input", () => {
    expect(normalizeUrlForMatching("")).toBeNull();
    expect(normalizeUrlForMatching(null)).toBeNull();
  });
});

describe("extractDomain", () => {
  it("extracts the bare lowercased host without www.", () => {
    expect(extractDomain("https://www.Harvard.edu/apply")).toBe("harvard.edu");
  });

  it("returns null for unparseable input", () => {
    expect(extractDomain("###")).toBeNull();
  });
});

describe("currency code helpers", () => {
  it("normalizes to uppercase, trimmed", () => {
    expect(normalizeCurrencyCode(" inr ")).toBe("INR");
  });

  it("validates a correct 3-letter code", () => {
    expect(isValidCurrencyCodeFormat("EUR")).toBe(true);
    expect(isValidCurrencyCodeFormat("eur")).toBe(true);
  });

  it("rejects an invalid code", () => {
    expect(isValidCurrencyCodeFormat("EURO")).toBe(false);
    expect(isValidCurrencyCodeFormat("12")).toBe(false);
    expect(isValidCurrencyCodeFormat("")).toBe(false);
  });
});

describe("country code helpers", () => {
  it("normalizes to uppercase, trimmed", () => {
    expect(normalizeCountryCode(" de ")).toBe("DE");
  });

  it("validates alpha-2 and alpha-3 formats separately", () => {
    expect(isValidAlpha2("DE")).toBe(true);
    expect(isValidAlpha2("DEU")).toBe(false);
    expect(isValidAlpha3("DEU")).toBe(true);
    expect(isValidAlpha3("DE")).toBe(false);
  });
});

describe("normalizeQualificationLevel", () => {
  it("buckets common bachelor's phrasing to 'undergraduate'", () => {
    expect(normalizeQualificationLevel("Bachelor of Science")).toBe("undergraduate");
    expect(normalizeQualificationLevel("BSc (Hons)")).toBe("undergraduate");
  });

  it("buckets common master's phrasing to 'postgraduate'", () => {
    expect(normalizeQualificationLevel("Master of Science")).toBe("postgraduate");
    expect(normalizeQualificationLevel("MSc")).toBe("postgraduate");
  });

  it("buckets PhD phrasing to 'doctorate'", () => {
    expect(normalizeQualificationLevel("PhD in Computer Science")).toBe("doctorate");
  });

  it("falls back to a lowercased value for unrecognized text rather than throwing", () => {
    expect(normalizeQualificationLevel("Some Bespoke Credential")).toBe("some bespoke credential");
  });

  it("returns empty string for empty input", () => {
    expect(normalizeQualificationLevel(null)).toBe("");
  });
});

describe("normalizeNameForMatching", () => {
  it("produces the same normalized form for two differently-formatted names of the same institution", () => {
    const a = normalizeNameForMatching("The University of Oxford");
    const b = normalizeNameForMatching("University of Oxford");
    expect(a).toBe(b);
  });

  it("strips diacritics", () => {
    expect(normalizeNameForMatching("École Polytechnique")).toBe("ecole polytechnique");
  });

  it("is case-insensitive", () => {
    expect(normalizeNameForMatching("MIT")).toBe(normalizeNameForMatching("mit"));
  });
});

describe("normalizeSlug / isValidSlug", () => {
  it("produces a valid slug from a messy name", () => {
    const slug = normalizeSlug("Technical University of Munich (TUM)");
    expect(isValidSlug(slug)).toBe(true);
    expect(slug).toBe("technical-university-of-munich-tum");
  });

  it("has no leading/trailing hyphens even for punctuation-heavy input", () => {
    expect(normalizeSlug("--Hello, World!--")).toBe("hello-world");
  });

  it("rejects a slug with uppercase or invalid characters", () => {
    expect(isValidSlug("Not-Valid")).toBe(false);
    expect(isValidSlug("has_underscore")).toBe(false);
    expect(isValidSlug("")).toBe(false);
  });
});
