import { describe, expect, it } from "vitest";
import { HOW_IT_WORKS_STEPS } from "./how-it-works-steps";
import { JOURNEY_STAGES } from "./journey";

/**
 * UX10-HW01 — guards the core honesty claim this milestone's brief
 * requires: the new 5-step summary must be a REGROUPING of the real
 * 10-stage journey, never a second, invented process. This test fails if
 * a future edit adds/removes a real `JourneyStage` without updating the
 * 5-step curation, or silently drops/duplicates a stage.
 */
describe("HOW_IT_WORKS_STEPS — honest curation of the real 10-stage journey", () => {
  it("covers every real JOURNEY_STAGES id exactly once across the 5 steps", () => {
    const coveredIds = HOW_IT_WORKS_STEPS.flatMap((step) => step.stageIds);
    const realIds = JOURNEY_STAGES.map((stage) => stage.id);

    expect(coveredIds.length).toBe(realIds.length);
    expect(new Set(coveredIds).size).toBe(coveredIds.length); // no duplicates
    expect([...coveredIds].sort()).toEqual([...realIds].sort()); // same set, no invented ids
  });

  it("is exactly 5 ordered steps, numbered 1 through 5", () => {
    expect(HOW_IT_WORKS_STEPS).toHaveLength(5);
    expect(HOW_IT_WORKS_STEPS.map((step) => step.order)).toEqual([1, 2, 3, 4, 5]);
  });

  it("every step has a non-empty title and description", () => {
    for (const step of HOW_IT_WORKS_STEPS) {
      expect(step.title.length).toBeGreaterThan(0);
      expect(step.description.length).toBeGreaterThan(0);
    }
  });
});
