import { describe, expect, it } from "vitest";
import { profileCompletenessMessage } from "./ProfileCompletenessCard";

/**
 * NW01 Part C — dedicated regression coverage for the confirmed defect:
 * `percent >= 75 ? "Almost there!" : ...` kept showing "Almost there!"
 * even once a profile genuinely reached 100%. Every boundary below is a
 * real value `calculateCompletion()` (src/lib/profile/completion.ts) can
 * actually return.
 */
describe("profileCompletenessMessage", () => {
  it("0%: 'Let's get started.'", () => {
    expect(profileCompletenessMessage(0).heading).toBe("Let's get started.");
  });

  it("a partial percent below 75: 'Keep going — every section helps.'", () => {
    for (const percent of [1, 20, 50, 74]) {
      expect(profileCompletenessMessage(percent).heading).toBe("Keep going — every section helps.");
    }
  });

  it("75 up to (but not including) 100: 'Almost there!'", () => {
    for (const percent of [75, 80, 99]) {
      expect(profileCompletenessMessage(percent).heading).toBe("Almost there!");
    }
  });

  it("NW01 Part C — genuinely 100% complete never says 'Almost there!' and says the profile is complete instead", () => {
    const { heading, subcopy } = profileCompletenessMessage(100);
    expect(heading).not.toBe("Almost there!");
    expect(heading).toBe("Your profile is complete!");
    expect(subcopy).not.toMatch(/remaining sections/i);
  });

  it("a below-100 percent still asks the student to complete remaining sections", () => {
    expect(profileCompletenessMessage(80).subcopy).toMatch(/remaining sections/i);
  });
});
