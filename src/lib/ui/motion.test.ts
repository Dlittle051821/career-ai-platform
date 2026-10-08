import { describe, expect, it } from "vitest";
import {
  FADE_UP_CLASSES,
  FLOW_DASH_CLASSES,
  HOVER_LIFT_CLASSES,
  UI_TRANSITION_DURATIONS_MS,
  getStaggerDelayMs,
} from "./motion";

describe("motion class constants", () => {
  it("every one-shot entrance/transition class string includes an explicit motion-reduce guard", () => {
    expect(FADE_UP_CLASSES).toContain("motion-reduce:animate-none");
    expect(HOVER_LIFT_CLASSES).toContain("motion-reduce:transition-none");
  });

  it("the fade-up guard also resets opacity/transform, not just the animation itself — a bare motion-reduce:animate-none would leave the element frozen at its 0%-opacity starting keyframe", () => {
    expect(FADE_UP_CLASSES).toContain("motion-reduce:opacity-100");
    expect(FADE_UP_CLASSES).toContain("motion-reduce:translate-y-0");
  });

  it("the ambient pathway flow animation is guarded the same way as every other new animation", () => {
    expect(FLOW_DASH_CLASSES).toContain("animate-flow-dash");
    expect(FLOW_DASH_CLASSES).toContain("motion-reduce:animate-none");
  });
});

describe("UI_TRANSITION_DURATIONS_MS", () => {
  it("keeps every one-shot UI transition duration inside the task's own stated 150-500ms band", () => {
    for (const duration of Object.values(UI_TRANSITION_DURATIONS_MS)) {
      expect(duration).toBeGreaterThanOrEqual(150);
      expect(duration).toBeLessThanOrEqual(500);
    }
  });
});

describe("getStaggerDelayMs()", () => {
  it("returns 0 for the first item", () => {
    expect(getStaggerDelayMs(0)).toBe(0);
  });

  it("increases linearly by the step for each subsequent item", () => {
    expect(getStaggerDelayMs(1, 70)).toBe(70);
    expect(getStaggerDelayMs(2, 70)).toBe(140);
  });

  it("caps the delay at maxItems - 1 steps, so a long list never produces a sluggish entrance", () => {
    expect(getStaggerDelayMs(10, 70, 6)).toBe(getStaggerDelayMs(5, 70, 6));
    expect(getStaggerDelayMs(10, 70, 6)).toBe(350);
  });
});
