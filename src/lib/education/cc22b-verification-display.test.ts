import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { isVerifiedEducationRecord, lastCheckedLabel, NOT_YET_VERIFIED_LABEL, shouldShowRankings } from "./verification-display";
import { DataStatusBadge } from "@/components/sections/education/DataStatusBadge";
import { UnverifiedRecordNotice } from "@/components/sections/education/UnverifiedRecordNotice";

const ROOT = path.resolve(__dirname, "../../..");
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");

describe("CC-22B — unverified education records are never presented as verified", () => {
  it("only the exact 'verified' status counts", () => {
    for (const s of ["unverified", "needs_review", "Verified", "", null, undefined]) expect(isVerifiedEducationRecord(s)).toBe(false);
    expect(isVerifiedEducationRecord("verified")).toBe(true);
  });

  it("an unverified record shows 'Not yet verified' even when its freshness band is 'current'", () => {
    for (const status of ["unverified", "needs_review"]) {
      const html = renderToStaticMarkup(createElement(DataStatusBadge, { verificationStatus: status, freshnessBand: "current" }));
      expect(html).toContain(NOT_YET_VERIFIED_LABEL);
      expect(html).not.toContain("Current");
    }
  });

  it("a verified record keeps its freshness label", () => {
    const html = renderToStaticMarkup(createElement(DataStatusBadge, { verificationStatus: "verified", freshnessBand: "current" }));
    expect(html).not.toContain(NOT_YET_VERIFIED_LABEL);
  });

  it("rankings are hidden and the date is not called 'Last verified' unless verified", () => {
    expect(shouldShowRankings("needs_review")).toBe(false);
    expect(shouldShowRankings("verified")).toBe(true);
    expect(lastCheckedLabel("unverified")).toBe("Last data update");
    expect(lastCheckedLabel("verified")).toBe("Last verified");
  });

  it("the notice links to the official source in a new tab with an accessible hint", () => {
    const html = renderToStaticMarkup(createElement(UnverifiedRecordNotice, { officialUrl: "https://www.example.edu/", officialLabel: "Visit the official website" }));
    expect(html).toContain('href="https://www.example.edu/"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain("(opens in a new tab)");
  });

  it("the course explorer no longer claims 'NextWise verified results' and no page claims 'verified so far'", () => {
    const courses = read("src/app/(site)/courses/page.tsx");
    const universities = read("src/app/(site)/universities/page.tsx");
    expect(courses).not.toMatch(/NextWise verified results/);
    for (const src of [courses, universities]) {
      expect(src).not.toMatch(/verified so far/);
      expect(src).not.toMatch(/when it was last verified/);
    }
  });

  it("every public card and detail header uses the verification-aware badge, never the bare freshness badge", () => {
    for (const rel of [
      "src/components/sections/education/UniversityCard.tsx",
      "src/components/sections/education/CourseCard.tsx",
      "src/app/(site)/universities/[slug]/page.tsx",
      "src/app/(site)/courses/[universitySlug]/[courseSlug]/page.tsx",
      "src/app/(site)/saved/page.tsx",
    ]) {
      const src = read(rel);
      expect(src).toMatch(/<DataStatusBadge /);
      expect(src).not.toMatch(/<FreshnessBadge band=\{(university|course)\.freshnessBand\} \/>/);
    }
  });

  it("the public summaries select and expose verification_status", () => {
    expect(read("src/lib/supabase/education/universities.ts")).toMatch(/last_verified_at, verification_status, countries \( name \)/);
    expect(read("src/lib/supabase/education/courses.ts")).toMatch(/verificationStatus: row\.verification_status/);
  });
});
