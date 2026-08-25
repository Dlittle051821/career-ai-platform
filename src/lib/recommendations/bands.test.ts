import { describe, it, expect } from "vitest";
import { determineMatchBand, evidenceLevelFor } from "./bands";

describe("evidenceLevelFor", () => {
  it("bands coverage into low/moderate/high", () => {
    expect(evidenceLevelFor(0)).toBe("low");
    expect(evidenceLevelFor(0.29)).toBe("low");
    expect(evidenceLevelFor(0.3)).toBe("moderate");
    expect(evidenceLevelFor(0.59)).toBe("moderate");
    expect(evidenceLevelFor(0.6)).toBe("high");
    expect(evidenceLevelFor(1)).toBe("high");
  });
});

describe("determineMatchBand", () => {
  it("a high score with high evidence is a strong match", () => {
    expect(determineMatchBand(80, 0.8)).toBe("strong_match");
  });

  it("a high score with only moderate evidence is capped at promising, never strong", () => {
    // Requirement: sparse profiles must never be presented as highly reliable matches.
    expect(determineMatchBand(90, 0.4)).toBe("promising_match");
  });

  it("low evidence always forces Limited evidence, regardless of how high the raw score is", () => {
    expect(determineMatchBand(95, 0.1)).toBe("limited_evidence");
    expect(determineMatchBand(0, 0.1)).toBe("limited_evidence");
  });

  it("a middling score with strong evidence is worth exploring, not a discouraging label", () => {
    expect(determineMatchBand(40, 0.8)).toBe("worth_exploring");
  });

  it("a promising-range score with high evidence is a promising match", () => {
    expect(determineMatchBand(55, 0.8)).toBe("promising_match");
  });
});
