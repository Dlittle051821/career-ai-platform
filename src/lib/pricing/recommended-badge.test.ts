import { describe, expect, it } from "vitest";
import { recommendedBadgeLabel } from "./recommended-badge";
import { PR01_ACTIVE_CATALOG } from "./pr01-catalog";

describe("recommendedBadgeLabel", () => {
  it("gives Bachelor Abroad Premium and Master Abroad Premium their own distinct, user-specified badge text", () => {
    expect(recommendedBadgeLabel("bachelor-abroad-premium")).toBe("Most Recommended");
    expect(recommendedBadgeLabel("master-abroad-premium")).toBe("Best for Full Support");
    expect(recommendedBadgeLabel("bachelor-abroad-premium")).not.toBe(recommendedBadgeLabel("master-abroad-premium"));
  });

  it("falls back to the neutral 'Recommended' label for any other slug, never an empty or undefined string", () => {
    expect(recommendedBadgeLabel("nextwise-explore")).toBe("Recommended");
    expect(recommendedBadgeLabel("some-future-plan")).toBe("Recommended");
  });

  it("only the two plans the catalog fixture marks is_recommended actually receive a distinct (non-fallback) badge", () => {
    const recommendedSlugs = PR01_ACTIVE_CATALOG.filter((p) => p.isRecommended).map((p) => p.slug);
    for (const slug of recommendedSlugs) {
      expect(recommendedBadgeLabel(slug)).not.toBe("Recommended");
    }
  });
});
