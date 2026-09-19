import { describe, expect, it } from "vitest";
import { buildOrientationSummary, EMPTY_DISCOVERY_SELECTIONS, type GuidedDiscoverySelections } from "./orientation";

describe("buildOrientationSummary", () => {
  it("gives an honest, encouraging summary when every step was skipped", () => {
    const summary = buildOrientationSummary(EMPTY_DISCOVERY_SELECTIONS);
    expect(summary.headline).toMatch(/skipped/i);
    expect(summary.bullets.length).toBeGreaterThan(0);
    expect(summary.bullets.join(" ")).not.toMatch(/%|score|match/i);
  });

  it("reflects decision focus, education stage, and location preference back in plain language", () => {
    const selections: GuidedDiscoverySelections = {
      ...EMPTY_DISCOVERY_SELECTIONS,
      decisionFocus: ["career", "affordability"],
      educationStage: "school_12",
      locationPreference: "india",
    };
    const summary = buildOrientationSummary(selections);
    const text = summary.bullets.join(" ").toLowerCase();
    expect(text).toContain("career");
    expect(text).toContain("afford");
    expect(text).toContain("class 12");
    expect(text).toContain("india");
    expect(summary.headline).toMatch(/here's what/i);
  });

  it("never fabricates a score, percentage, or AI-generated framing regardless of input", () => {
    const selections: GuidedDiscoverySelections = {
      decisionFocus: ["career", "course", "india_or_abroad", "colleges", "affordability", "unsure"],
      educationStage: "undergraduate",
      interestAreas: ["science_tech", "business_finance"],
      locationPreference: "unsure",
      confidence: 1,
      helpNeeded: ["talk_to_someone"],
    };
    const summary = buildOrientationSummary(selections);
    const text = `${summary.headline} ${summary.bullets.join(" ")}`.toLowerCase();
    expect(text).not.toMatch(/\bai\b|artificial intelligence|algorithm|score of|% match/);
  });

  it("gives distinct copy for low vs. high confidence", () => {
    const low = buildOrientationSummary({ ...EMPTY_DISCOVERY_SELECTIONS, confidence: 1 });
    const high = buildOrientationSummary({ ...EMPTY_DISCOVERY_SELECTIONS, confidence: 5 });
    expect(low.bullets.join(" ")).not.toBe(high.bullets.join(" "));
  });

  it("only mentions help-needed choices that were actually selected", () => {
    const summary = buildOrientationSummary({ ...EMPTY_DISCOVERY_SELECTIONS, helpNeeded: ["understand_costs"] });
    const text = summary.bullets.join(" ").toLowerCase();
    expect(text).toContain("understanding costs");
    expect(text).not.toContain("talking to a real person");
  });
});
