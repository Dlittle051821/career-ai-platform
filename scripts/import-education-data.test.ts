import { describe, expect, it } from "vitest";
import { buildCourseRow, buildUniversityRow, type ImportContext } from "./import-education-data";

// NOTE: importing this module runs `loadEducationCliEnv()` at module top
// level (a silent, no-op-if-missing `.env.local` load) — harmless in a
// test environment and does not touch the network or a database. Nothing
// under test here does either: buildUniversityRow/buildCourseRow are pure
// functions of (record, ctx) -> RowResult, faithfully mirroring
// validateUniversityRow/validateCourseRow in
// src/lib/supabase/admin/education-imports.ts. These tests exist
// specifically to catch drift between the two hand-maintained copies.

function emptyContext(): ImportContext {
  return { countryIdByIso: new Map(), universityBySlug: new Map() };
}

describe("buildUniversityRow", () => {
  it("builds a complete writeFields payload for a valid row, always as a draft", () => {
    const ctx = emptyContext();
    ctx.countryIdByIso.set("DE", "country-de-id");

    const result = buildUniversityRow(
      {
        name: "Example University",
        slug: "example-university",
        country_iso_alpha2: "de",
        city: "Berlin",
        source_url: "https://example.edu/about",
        last_verified_at: "2026-01-15",
      },
      ctx,
    );

    expect(result.errors).toEqual([]);
    expect(result.businessKey).toBe("slug:example-university");
    expect(result.writeFields).toMatchObject({
      name: "Example University",
      slug: "example-university",
      country_id: "country-de-id",
      country: "DE",
      city: "Berlin",
      source_url: "https://example.edu/about",
      last_verified_at: "2026-01-15",
      publication_status: "draft",
      verification_status: "needs_review",
    });
  });

  it("derives a slug from the name when slug is blank", () => {
    const ctx = emptyContext();
    ctx.countryIdByIso.set("DE", "country-de-id");
    const result = buildUniversityRow({ name: "Example University", slug: "", country_iso_alpha2: "DE" }, ctx);
    expect(result.errors).toEqual([]);
    expect(result.writeFields?.slug).toBe("example-university");
  });

  it("errors when name is missing", () => {
    const result = buildUniversityRow({ name: "", slug: "x", country_iso_alpha2: "DE" }, emptyContext());
    expect(result.errors.some((e) => e.field === "name")).toBe(true);
    expect(result.writeFields).toBeNull();
    expect(result.businessKey).toBeNull();
  });

  it("errors on an invalid country code format", () => {
    const result = buildUniversityRow({ name: "X", slug: "x", country_iso_alpha2: "Germany" }, emptyContext());
    expect(result.errors.some((e) => e.field === "country_iso_alpha2")).toBe(true);
  });

  it("errors when the country code is well-formed but not in the platform's configured countries", () => {
    // Valid alpha-2 shape, but never registered in ctx.countryIdByIso.
    const result = buildUniversityRow({ name: "X", slug: "x", country_iso_alpha2: "ZZ" }, emptyContext());
    expect(result.errors.some((e) => e.field === "country_iso_alpha2" && /not a country this platform/i.test(e.message))).toBe(true);
  });

  it("errors on an invalid application_fee_currency format", () => {
    const ctx = emptyContext();
    ctx.countryIdByIso.set("DE", "country-de-id");
    const result = buildUniversityRow(
      { name: "X", slug: "x", country_iso_alpha2: "DE", application_fee_currency: "euros" },
      ctx,
    );
    expect(result.errors.some((e) => e.field === "application_fee_currency")).toBe(true);
  });

  it("converts a major-unit application fee amount into minor units", () => {
    const ctx = emptyContext();
    ctx.countryIdByIso.set("DE", "country-de-id");
    const result = buildUniversityRow(
      { name: "X", slug: "x", country_iso_alpha2: "DE", application_fee_amount: "75.50", application_fee_currency: "EUR" },
      ctx,
    );
    expect(result.writeFields?.application_fee_minor_units).toBe(7550);
  });

  it("warns rather than errors when source_url is missing", () => {
    const ctx = emptyContext();
    ctx.countryIdByIso.set("DE", "country-de-id");
    const result = buildUniversityRow({ name: "X", slug: "x", country_iso_alpha2: "DE" }, ctx);
    expect(result.errors).toEqual([]);
    expect(result.warnings.some((w) => w.field === "source_url")).toBe(true);
  });

  it("parses comma/semicolon-separated list cells", () => {
    const ctx = emptyContext();
    ctx.countryIdByIso.set("DE", "country-de-id");
    const result = buildUniversityRow(
      { name: "X", slug: "x", country_iso_alpha2: "DE", study_levels: "undergraduate, postgraduate;doctorate" },
      ctx,
    );
    expect(result.writeFields?.study_levels).toEqual(["undergraduate", "postgraduate", "doctorate"]);
  });

  it("defaults an unrecognized verification_status to needs_review rather than accepting an arbitrary string", () => {
    const ctx = emptyContext();
    ctx.countryIdByIso.set("DE", "country-de-id");
    const result = buildUniversityRow({ name: "X", slug: "x", country_iso_alpha2: "DE", verification_status: "definitely_true" }, ctx);
    expect(result.writeFields?.verification_status).toBe("needs_review");
  });

  it("accepts an explicit valid verification_status value", () => {
    const ctx = emptyContext();
    ctx.countryIdByIso.set("DE", "country-de-id");
    const result = buildUniversityRow({ name: "X", slug: "x", country_iso_alpha2: "DE", verification_status: "verified" }, ctx);
    expect(result.writeFields?.verification_status).toBe("verified");
  });
});

describe("buildCourseRow", () => {
  function contextWithUniversity(): ImportContext {
    const ctx = emptyContext();
    ctx.universityBySlug.set("example-university", { id: "univ-id-1", name: "Example University" });
    return ctx;
  }

  it("builds a complete writeFields payload for a valid row, always as a draft with campus_id left null", () => {
    const result = buildCourseRow(
      { university_slug: "example-university", name: "MSc Data Science", slug: "msc-data-science", source_url: "https://example.edu/msc" },
      contextWithUniversity(),
    );
    expect(result.errors).toEqual([]);
    expect(result.businessKey).toBe("univ-id-1:msc-data-science");
    expect(result.writeFields).toMatchObject({
      university_id: "univ-id-1",
      campus_id: null,
      name: "MSc Data Science",
      slug: "msc-data-science",
      publication_status: "draft",
    });
  });

  it("errors when university_slug does not resolve to a known university", () => {
    const result = buildCourseRow(
      { university_slug: "does-not-exist", name: "X", slug: "x" },
      contextWithUniversity(),
    );
    expect(result.errors.some((e) => e.field === "university_slug")).toBe(true);
    expect(result.writeFields).toBeNull();
  });

  it("errors when university_slug is blank", () => {
    const result = buildCourseRow({ university_slug: "", name: "X", slug: "x" }, contextWithUniversity());
    expect(result.errors.some((e) => e.field === "university_slug")).toBe(true);
  });

  it("scopes the business key to the resolved university id, so the same slug under two universities never collides", () => {
    const ctx = contextWithUniversity();
    ctx.universityBySlug.set("other-university", { id: "univ-id-2", name: "Other University" });

    const a = buildCourseRow({ university_slug: "example-university", name: "X", slug: "shared-slug" }, ctx);
    const b = buildCourseRow({ university_slug: "other-university", name: "X", slug: "shared-slug" }, ctx);

    expect(a.businessKey).toBe("univ-id-1:shared-slug");
    expect(b.businessKey).toBe("univ-id-2:shared-slug");
    expect(a.businessKey).not.toBe(b.businessKey);
  });

  it("errors on an invalid duration_value", () => {
    const result = buildCourseRow(
      { university_slug: "example-university", name: "X", slug: "x", duration_value: "not-a-number" },
      contextWithUniversity(),
    );
    expect(result.errors.some((e) => e.field === "duration_value")).toBe(true);
  });

  it("parses a valid numeric duration_value", () => {
    const result = buildCourseRow(
      { university_slug: "example-university", name: "X", slug: "x", duration_value: "1.5" },
      contextWithUniversity(),
    );
    expect(result.writeFields?.duration_value).toBe(1.5);
  });

  it("maps qualification_level column to the education_level write field", () => {
    const result = buildCourseRow(
      { university_slug: "example-university", name: "X", slug: "x", qualification_level: "postgraduate" },
      contextWithUniversity(),
    );
    expect(result.writeFields?.education_level).toBe("postgraduate");
  });
});
