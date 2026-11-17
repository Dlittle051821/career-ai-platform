import { describe, expect, it } from "vitest";
import { directoryHref, hasActiveDirectoryFilters, parseDirectoryFilters, parseHighlights, parseRankings } from "./directory";
import { grantStatus, isUuid, validateGrantInput, validateReason } from "@/lib/admin/university-access-grants";

const NOW = new Date("2026-11-17T12:00:00.000Z");

describe("University Discovery V3 — directory filters are validated on the server", () => {
  it("accepts only known values and falls back to safe defaults", () => {
    const filters = parseDirectoryFilters({ q: "Köln", country: "not-a-uuid", category: "made_up", ownership: "secret", area: "'; drop table", sort: "sideways", page: "-4" });
    expect(filters).toMatchObject({ q: "Köln", country: "", category: "", ownership: "", area: "", sort: "verified", page: 1 });
    expect(hasActiveDirectoryFilters(filters)).toBe(true);
  });

  it("keeps valid values, takes the first of repeated params, and reports no filters for an empty query", () => {
    const filters = parseDirectoryFilters({ country: "11111111-2222-3333-4444-555555555555", category: ["university_of_applied_sciences", "university"], ownership: "public", area: "engineering", page: "3" });
    expect(filters).toMatchObject({ country: "11111111-2222-3333-4444-555555555555", category: "university_of_applied_sciences", ownership: "public", area: "engineering", page: 3 });
    expect(hasActiveDirectoryFilters(parseDirectoryFilters({}))).toBe(false);
  });

  it("builds clean links: empty filters, the default sort and page 1 are left out, and a change resets the page", () => {
    const filters = parseDirectoryFilters({ state: "Nordrhein-Westfalen", area: "engineering", page: "4" });
    const href = directoryHref(filters, { area: "" });
    expect(href).toContain("state=Nordrhein-Westfalen");
    expect(href).not.toMatch(/area=|page=|sort=|q=/);
    expect(directoryHref(parseDirectoryFilters({}))).toBe("/universities");
  });
});

describe("University Discovery V3 — highlights and rankings are shown only with a source", () => {
  it("drops malformed entries instead of rendering unsupported claims", () => {
    expect(parseHighlights(null)).toEqual([]);
    expect(parseHighlights("Top university")).toEqual([]);
    expect(parseRankings([{ rank: 1 }, "QS #1", null])).toEqual([]);
  });

  it("keeps a ranking that names its provider and year, including a tied rank", () => {
    const [ranking] = parseRankings([{ provider: "QS World University Rankings by Subject", year: 2026, rank: "=39", category: "Mineral & Mining Engineering", scope: "subject", source_url: "https://example.org/qs" }]);
    expect(ranking).toMatchObject({ provider: "QS World University Rankings by Subject", year: 2026, rank: "=39" });
  });
});

describe("University Discovery V3 — admin grant input", () => {
  it("requires a real reason and normalises whitespace", () => {
    expect(validateReason("  ok ").ok).toBe(false);
    expect(validateReason(undefined).ok).toBe(false);
    expect(validateReason("x".repeat(501)).ok).toBe(false);
    expect(validateReason("  Paid   offline,\n receipt 42 ")).toEqual({ ok: true, reason: "Paid offline, receipt 42" });
  });

  it("accepts no expiry, and rejects past, impossible and over-long expiry dates", () => {
    expect(validateGrantInput("Paid offline, receipt 42", "", NOW)).toMatchObject({ ok: true, expiresAt: null });
    expect(validateGrantInput("Paid offline, receipt 42", "2027-05-31", NOW)).toMatchObject({ ok: true, expiresAt: "2027-05-31T23:59:59.000Z" });
    expect(validateGrantInput("Paid offline, receipt 42", "2026-11-01", NOW).ok).toBe(false);
    expect(validateGrantInput("Paid offline, receipt 42", "2027-02-31", NOW).ok).toBe(false);
    expect(validateGrantInput("Paid offline, receipt 42", "2030-01-01", NOW).ok).toBe(false);
    expect(validateGrantInput("Paid offline, receipt 42", "next week", NOW).ok).toBe(false);
  });

  it("derives status from the record: revoked wins over expired, expired over active", () => {
    expect(grantStatus({ revokedAt: null, expiresAt: null }, NOW)).toBe("active");
    expect(grantStatus({ revokedAt: null, expiresAt: "2026-11-01T00:00:00Z" }, NOW)).toBe("expired");
    expect(grantStatus({ revokedAt: "2026-11-02T00:00:00Z", expiresAt: "2026-11-01T00:00:00Z" }, NOW)).toBe("revoked");
  });

  it("only accepts a real account id as the student", () => {
    expect(isUuid("9ce6bd13-238b-4d53-98df-a86ae3b23beb")).toBe(true);
    expect(isUuid("me")).toBe(false);
    expect(isUuid(null)).toBe(false);
  });
});
