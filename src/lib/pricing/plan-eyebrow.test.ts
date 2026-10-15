import { describe, expect, it } from "vitest";
import { planEyebrowLabel } from "./plan-eyebrow";
import { PR01_ACTIVE_CATALOG } from "./pr01-catalog";

describe("planEyebrowLabel", () => {
  it("gives every one of the 7 active plans a non-null eyebrow label", () => {
    for (const plan of PR01_ACTIVE_CATALOG) {
      expect(planEyebrowLabel(plan.slug)).not.toBeNull();
    }
  });

  it("returns null (renders nothing) for an unknown slug rather than a guessed label", () => {
    expect(planEyebrowLabel("some-future-plan")).toBeNull();
  });
});
