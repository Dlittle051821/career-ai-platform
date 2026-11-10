import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * CC-23 source-level regressions for the student-journey fixes. The behaviour
 * itself is exercised by the CC-23 browser journeys (C15, C16, F3, G1, H1, H7);
 * these tests stop the fixes being silently undone.
 */
const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("CC-23 onboarding wizard", () => {
  const hook = read("src/components/sections/profile/onboarding/useProfileWizard.tsx");
  const wizard = read("src/components/sections/profile/onboarding/OnboardingWizard.tsx");

  it("guards against several saves starting from one burst of clicks", () => {
    expect(hook).toMatch(/const busyRef = useRef\(false\)/);
    expect(hook).toMatch(/if \(busyRef\.current\) return;\s*busyRef\.current = true;/);
    expect(hook).toMatch(/finally \{\s*busyRef\.current = false;/);
  });

  it("moves focus to the new step heading after a step change (not on first render)", () => {
    expect(wizard).toMatch(/<h1 ref=\{headingRef\} tabIndex=\{-1\}/);
    expect(wizard).toMatch(/firstStepRender\.current = false;\s*return;/);
    expect(wizard).toMatch(/headingRef\.current\?\.focus\(\)/);
  });

  it("tells a student whose session ended to log in again, and keeps the connection message for network failures", () => {
    expect(hook).toContain("export const SESSION_ENDED_ERROR");
    expect(hook).toMatch(/\(await hasSessionEnded\(\)\) \? SESSION_ENDED_ERROR : SAVE_CONNECTION_ERROR/);
    expect(hook).toMatch(/error\.name === "AuthSessionMissingError" \|\| status === 401 \|\| status === 403/);
    expect(hook).toMatch(/catch \{\s*return false;/);
    expect(wizard).toMatch(/stepError === SESSION_ENDED_ERROR/);
    expect(wizard).toContain("/login?next=${encodeURIComponent(`/profile/onboarding?step=${step}`)}");
  });
});

describe("CC-23 Discovery Session honesty", () => {
  const page = read("src/app/(site)/discovery-session/book/page.tsx");
  it("does not tell students they can choose a time", () => {
    expect(page).not.toContain("Choose a convenient time and our team will confirm your session.");
    expect(page).toContain("a counsellor will contact you to agree a time");
  });
  it("repeats the request-not-a-slot and no-notifications notes on the existing-request view", () => {
    expect(page).toMatch(/activeSession\.scheduledAt \? null : \(/);
    expect(page).toContain("This is a request, not a booked slot yet. Nextwise does not send email or app notifications");
  });
});

describe("CC-23 narrow screens and keyboard-scrollable tables", () => {
  it("pricing cards fit a 320 px screen", () => {
    expect(read("src/components/sections/pricing/PricingCategoryFilter.tsx")).toContain('className="mt-9 grid grid-cols-1 gap-7');
    const card = read("src/components/sections/pricing/PublicPricingPlanCard.tsx");
    // `whitespace-normal!` (important) is needed: cn() does not merge classes, and the Button base
    // class `whitespace-nowrap` comes later in the generated CSS.
    expect(card.match(/w-full justify-center whitespace-normal! text-center/g)?.length).toBe(3);
  });

  it("official-source buttons may wrap and the Study Europe grids fit 320 px", () => {
    const sources = read("src/components/sections/europe-explorer/EuropeOfficialSourcesSection.tsx");
    expect(sources).toContain("w-full justify-center whitespace-normal! text-center");
    expect(sources).toContain('className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"');
    expect(read("src/components/sections/europe-explorer/EuropeCountryCards.tsx")).toContain('className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"');
    expect(read("src/components/sections/education/TrustedExternalSearchCard.tsx")).toContain('className="whitespace-normal! text-center"');
  });

  it.each([
    "src/components/sections/pricing/PricingComparisonTable.tsx",
    "src/components/sections/europe-explorer/EuropeComparisonSection.tsx",
    "src/components/sections/education/CourseComparisonTable.tsx",
    "src/components/sections/compare/ComparisonTable.tsx",
    "src/components/sections/ComparisonTable.tsx",
  ])("%s: the sideways-scrolling table is a focusable, named region", (file) => {
    expect(read(file)).toMatch(/<div tabIndex=\{0\} role="region" aria-label="[^"]+\(scrolls sideways on small screens\)" className="overflow-x-auto/);
  });
});
