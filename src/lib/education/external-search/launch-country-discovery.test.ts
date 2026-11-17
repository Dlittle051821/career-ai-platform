import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { LAUNCH_COUNTRY_CODES, LAUNCH_COUNTRY_NAMES, isLaunchCountryCode } from "./launch-countries";
import { getLaunchCountryPrimarySource } from "./launch-country-sources";

/**
 * M20C — Trusted Country Discovery UX.
 *
 * Same static source-text audit convention as
 * trusted-source-card-attribution.test.ts (M20B) and
 * graphics-source-audit.test.ts (UX09) — no React Testing Library/jsdom in
 * this project (see vitest.config.mts's own docblock), so the three new/
 * changed files below are read as plain text rather than rendered. A few
 * assertions ALSO exercise real, already-exported pure functions
 * (isLaunchCountryCode, getLaunchCountryPrimarySource) directly, rather
 * than just matching strings, wherever that's possible without a DOM.
 */
const COMPONENT_PATH = path.join(__dirname, "..", "..", "..", "components", "sections", "education", "LaunchCountryDiscovery.tsx");
const COURSES_PAGE_PATH = path.join(__dirname, "..", "..", "..", "app", "(site)", "courses", "page.tsx");
const UNIVERSITIES_PAGE_PATH = path.join(__dirname, "..", "..", "..", "app", "(site)", "universities", "page.tsx");

const componentSource = readFileSync(COMPONENT_PATH, "utf8");
const coursesPageSource = readFileSync(COURSES_PAGE_PATH, "utf8");
const universitiesPageSource = readFileSync(UNIVERSITIES_PAGE_PATH, "utf8");
const freeDiscoverySource = readFileSync(path.join(__dirname, "..", "..", "..", "components", "sections", "university-discovery", "FreeDiscovery.tsx"), "utf8");

describe("LaunchCountryDiscovery — single source of truth, no re-derived country list", () => {
  it("imports LAUNCH_COUNTRY_CODES/LAUNCH_COUNTRY_NAMES from M20A's registry rather than declaring its own list", () => {
    expect(componentSource).toContain('from "@/lib/education/external-search/launch-countries"');
    expect(componentSource).toContain("LAUNCH_COUNTRY_CODES");
    expect(componentSource).toContain("LAUNCH_COUNTRY_NAMES[code]");
  });

  it("never hardcodes a literal seven-country-code array of its own, in the component or in either page", () => {
    const literalArrayPattern = /\[\s*["']IN["']\s*,\s*["']DE["']\s*,\s*["']IE["']\s*,\s*["']NL["']\s*,\s*["']FR["']\s*,\s*["']SE["']\s*,\s*["']DK["']\s*\]/;
    expect(componentSource).not.toMatch(literalArrayPattern);
    expect(coursesPageSource).not.toMatch(literalArrayPattern);
    expect(universitiesPageSource).not.toMatch(literalArrayPattern);
  });

  it("renders every launch country's display name from LAUNCH_COUNTRY_NAMES, never a literal abbreviation", () => {
    expect(LAUNCH_COUNTRY_NAMES.IN).toBe("India");
    expect(componentSource).not.toMatch(/>\s*UK\s*</);
    expect(componentSource).not.toContain('"UK"');
  });

  it("both pages derive their selected/unavailable launch-country state from isLaunchCountryCode, never a hand-rolled equality chain", () => {
    expect(coursesPageSource).toContain("isLaunchCountryCode(destinationCode)");
    // University Discovery V3 (owner-approved replacement of the M20C strip on /universities): the destination is
    // resolved by the shared approved-destination config, never a hand-rolled equality chain.
    expect(universitiesPageSource).toContain("getUniversityDestination(");
    expect(universitiesPageSource).not.toMatch(/=== "DE"|=== "IE"|=== "NL"/);
  });
});

describe("LaunchCountryDiscovery — accessibility and mobile layout", () => {
  it("is a labeled <nav> of a real <ul role=\"list\">, not a generic unlabeled <div> grid", () => {
    expect(componentSource).toMatch(/<nav aria-label="[^"]+"/);
    expect(componentSource).toContain('role="list"');
  });

  it("marks the current selection with aria-current, for both the 'All countries' reset and an individual country chip", () => {
    const occurrences = componentSource.match(/aria-current=/g) ?? [];
    expect(occurrences.length).toBeGreaterThanOrEqual(2);
  });

  it("marks an unavailable launch country as aria-disabled (rendered as a non-link <span>) rather than silently omitting it or rendering a dead link", () => {
    expect(componentSource).toContain('aria-disabled="true"');
    expect(componentSource).toContain("unavailableCodes.includes(code)");
  });

  it("wraps chips with flex-wrap so the strip never forces horizontal page scroll on narrow viewports", () => {
    expect(componentSource).toContain("flex-wrap");
  });

  it("every selectable chip is a real <Link> (works with JavaScript disabled, every selection is a shareable URL) rather than an onClick-driven button", () => {
    expect(componentSource).not.toContain("onClick");
    expect(componentSource).toContain("import Link from \"next/link\"");
  });
});

describe("LaunchCountryDiscovery — query-param preservation and per-page independence", () => {
  it("/courses builds its href from the SAME activeFiltersForPagination record Pagination already uses, overriding only `destination` — every other filter survives a chip click", () => {
    expect(coursesPageSource).toMatch(/function buildDestinationHref\(code: LaunchCountryCode \| null\)/);
    expect(coursesPageSource).toMatch(/const next: Record<string, string \| string\[\]> = \{ \.\.\.activeFiltersForPagination \}/);
    expect(coursesPageSource).toContain("next.destination = code");
  });

  it("/courses never feeds `destination` into the internal searchCourses() call — the internal catalogue and the trusted-search destination stay independent, exactly as they already were before M20C", () => {
    const searchCoursesCallMatch = coursesPageSource.match(/searchCourses\(\{[\s\S]*?\}\),/);
    expect(searchCoursesCallMatch).not.toBeNull();
    expect(searchCoursesCallMatch?.[0]).not.toContain("destinationCode");
  });

  // University Discovery V3 — the three M20C assertions about /universities' buildCountryHref and
  // unavailableLaunchCodes described the launch-country strip above the old public directory. The owner-approved
  // V3 brief replaces that page: free visitors pick a destination (`destination` param, public portals only) and
  // the Verified directory filters by `country`. The two params never mix.
  it("/universities keeps the public destination choice and the Verified directory country filter apart", () => {
    expect(universitiesPageSource).toContain("params.destination");
    expect(universitiesPageSource).toContain("parseDirectoryFilters(params)");
    const gate = universitiesPageSource.indexOf("if (!canUseUniversityDirectory(access))");
    expect(gate).toBeGreaterThan(-1);
    expect(universitiesPageSource.indexOf("parseDirectoryFilters(params)")).toBeGreaterThan(gate);
  });

  it("/universities never fabricates availability — portals come only from the trusted-source registry", () => {
    expect(universitiesPageSource).toContain("getTrustedSearchResults(");
    expect(universitiesPageSource).toContain("resources={trusted?.results ?? []}");
  });
});

describe("LaunchCountryDiscovery — honest empty states (no silent vanish, no fabricated numbers)", () => {
  it("/universities shows an explicit message when a launch (or any) country is selected but no trusted portal is active for it — the section no longer disappears silently", () => {
    // V3: the message lives in the shared FreeDiscovery section the page renders.
    expect(universitiesPageSource).toContain("<FreeDiscovery");
    expect(freeDiscoverySource).toMatch(/No trusted official portal|no official portal/i);
    // Before M20C this whole section only rendered when results existed —
    // confirm the stale all-or-nothing condition is gone.
    expect(universitiesPageSource).not.toMatch(/singleSelectedCountry && trustedSearch && trustedSearch\.results\.length > 0/);
  });

  it("/courses only claims an internal-catalogue count for the selected destination when the internal `country` filter unambiguously matches it — never when they could refer to different countries", () => {
    expect(coursesPageSource).toContain("destinationInternalCountMatches");
    expect(coursesPageSource).toMatch(/countryIds\.length === 1 && countryIds\[0\] === destinationCountryRow\.id/);
  });

  it("/courses' empty trusted-search message names the actual resolved destination rather than a generic 'this destination'", () => {
    expect(coursesPageSource).toContain("No trusted official portal is currently activated for ${destinationDisplayName} in our system yet.");
  });
});

describe("LaunchCountryDiscovery — specialist-vs-primary non-replacement and DAAD regression guard", () => {
  it("every launch country still resolves to exactly one primary source, and Germany's remains DAAD, unaffected by the new discovery UX", () => {
    for (const code of LAUNCH_COUNTRY_CODES) {
      expect(getLaunchCountryPrimarySource(code)).not.toBeNull();
    }
    expect(getLaunchCountryPrimarySource("DE")?.providerSlug).toBe("daad-international-programmes");
  });

  it("isLaunchCountryCode rejects a non-launch country and a garbage value the same way the pages rely on for `selectedLaunchCode`/`unavailableLaunchCodes`", () => {
    expect(isLaunchCountryCode("GB")).toBe(false);
    expect(isLaunchCountryCode("ZZ")).toBe(false);
    expect(isLaunchCountryCode("IN")).toBe(true);
  });
});

describe("LaunchCountryDiscovery — preserved pre-existing behavior (regression guard)", () => {
  it("/courses still renders CompareProvider/CompareBar and Pagination — the compare and pagination flows are untouched by this pass", () => {
    expect(coursesPageSource).toContain("<CompareProvider>");
    expect(coursesPageSource).toContain("<CompareBar />");
    expect(coursesPageSource).toContain("<Pagination");
  });

  it("/universities still renders its own Pagination, UniversityFilterBar, and GuidanceNotice", () => {
    expect(universitiesPageSource).toContain("<Pagination");
    expect(universitiesPageSource).toContain("<DirectoryFilterBar"); // V3 replacement of UniversityFilterBar
    expect(universitiesPageSource).toContain("<GuidanceNotice");
  });

  it("both pages still fetch countries via listActiveCountries() — M20C added no new country-fetching path", () => {
    expect(coursesPageSource).toContain("listActiveCountries()");
    // V3: the directory reads its country options through the access-checked facets reader.
    expect(universitiesPageSource).toContain("listDirectoryFacets(");
  });
});
