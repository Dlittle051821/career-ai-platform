import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { calculateCompletion } from "./completion";
import { computeSectionProgress } from "./section-progress";
import type { StudentProfileSnapshot } from "@/types/student-profile";

/**
 * UX10-P01 — regression tests for the real `/profile` page, mirroring
 * UX10-D01's own `src/lib/dashboard/dashboard-reference-audit.test.ts`
 * (no fabricated mockup data, real logic reuse, real route structure).
 */

const ROOT = path.resolve(__dirname, "../../..");

const PROFILE_SOURCE_FILES = [
  "src/app/profile/layout.tsx",
  "src/app/profile/page.tsx",
  "src/components/sections/profile/ProfileWorkspace.tsx",
  "src/components/sections/profile/ProfileSummaryCard.tsx",
  "src/components/sections/profile/ProfileSectionNav.tsx",
  "src/components/sections/profile/ProfileFormPanel.tsx",
  "src/components/sections/profile/ProfileWhyItMatters.tsx",
  "src/components/sections/profile/ProfileReadinessCard.tsx",
  "src/components/sections/profile/ProfileCounsellorCard.tsx",
  "src/components/sections/profile/onboarding/useProfileWizard.tsx",
];

// The mockup's own fabricated example data (brief section 19) — must never
// appear anywhere in the real, shipped `/profile` source.
const FORBIDDEN_LITERALS = [
  "DipamJyoti Das",
  "dipam@example.com",
  "15 Mar 1996",
  "1996-03-15",
  "+49 162 1234567",
  "Naval Architecture",
  "78%",
  "Priya Sharma",
];

describe("UX10-P01 reference audit — no fabricated mockup data", () => {
  for (const relativePath of PROFILE_SOURCE_FILES) {
    it(`${relativePath} contains no hardcoded mockup example data`, () => {
      const fullPath = path.join(ROOT, relativePath);
      expect(existsSync(fullPath), `expected ${relativePath} to exist`).toBe(true);
      const content = readFileSync(fullPath, "utf8");
      for (const literal of FORBIDDEN_LITERALS) {
        expect(content, `${relativePath} must not contain "${literal}"`).not.toContain(literal);
      }
    });
  }

  it("the real profile page fetches real data sources, never fabricates them", () => {
    const content = readFileSync(path.join(ROOT, "src/app/profile/page.tsx"), "utf8");
    expect(content).toContain("getCurrentProfile");
    expect(content).toContain("getStudentProfileSnapshot");
    expect(content).toContain("getMySectionProvenanceMap");
    expect(content).toContain("getMyRecommendationReadiness");
  });

  it("the summary card never hardcodes a completion percentage — it takes `completion` as a prop", () => {
    const content = readFileSync(path.join(ROOT, "src/components/sections/profile/ProfileSummaryCard.tsx"), "utf8");
    expect(content).toMatch(/completion\.percent/);
    expect(content).not.toMatch(/>\s*78\s*%/);
  });
});

describe("UX10-P01 reference audit — exactly one route resolves to /profile", () => {
  it("src/app/(site)/profile/page.tsx was removed (route moved, not duplicated)", () => {
    expect(existsSync(path.join(ROOT, "src/app/(site)/profile/page.tsx"))).toBe(false);
  });

  it("src/app/profile/page.tsx is the one real canonical page for /profile", () => {
    expect(existsSync(path.join(ROOT, "src/app/profile/page.tsx"))).toBe(true);
    expect(existsSync(path.join(ROOT, "src/app/profile/layout.tsx"))).toBe(true);
  });

  it("/profile/onboarding is untouched and does not collide with /profile", () => {
    expect(existsSync(path.join(ROOT, "src/app/(site)/profile/onboarding/page.tsx"))).toBe(true);
  });

  it("no dev-preview harness remains in the shipped tree", () => {
    expect(existsSync(path.join(ROOT, "src/app/dev-preview"))).toBe(false);
  });
});

describe("UX10-P01 reference audit — shared student dashboard shell", () => {
  it("src/app/profile/layout.tsx reuses the real DashboardShell — no second sidebar design", () => {
    const content = readFileSync(path.join(ROOT, "src/app/profile/layout.tsx"), "utf8");
    expect(content).toContain("DashboardShell");
    expect(content).not.toMatch(/function\s+\w*Sidebar/);
  });

  it("DashboardShell's own nav list points My Profile at the real /profile route", () => {
    const content = readFileSync(path.join(ROOT, "src/components/dashboard/DashboardShell.tsx"), "utf8");
    expect(content).toMatch(/label:\s*"My Profile",\s*href:\s*"\/profile"/);
  });
});

describe("UX10-P01 reference audit — real business logic, never duplicated", () => {
  it("useProfileWizard is the one place that calls the real Server Actions", () => {
    const content = readFileSync(path.join(ROOT, "src/components/sections/profile/onboarding/useProfileWizard.tsx"), "utf8");
    for (const action of ["saveAboutYou", "saveEducation", "saveCareerGoals", "completeOnboarding", "setOnboardingStep"]) {
      expect(content).toContain(action);
    }
  });

  it("OnboardingWizard.tsx (the unmodified /profile/onboarding page) delegates to the same shared hook, not a second copy", () => {
    const content = readFileSync(path.join(ROOT, "src/components/sections/profile/onboarding/OnboardingWizard.tsx"), "utf8");
    expect(content).toContain("useProfileWizard");
    expect(content).not.toContain("async function saveStepData");
    expect(content).not.toContain("function validateStep");
  });

  it("ProfileFormPanel renders through the shared renderOnboardingStep switch, not its own copy of the 12 step cases", () => {
    const content = readFileSync(path.join(ROOT, "src/components/sections/profile/ProfileFormPanel.tsx"), "utf8");
    expect(content).toContain("renderOnboardingStep");
    expect(content).not.toMatch(/<AboutYouStep/);
  });

  it("the autosave copy is truthful — never shows the mockup's 'saved automatically' claim as user-facing text, since this product has no autosave", () => {
    const content = readFileSync(path.join(ROOT, "src/components/sections/profile/ProfileFormPanel.tsx"), "utf8");
    // Only the JSX text nodes matter here — the file's own docblock
    // legitimately explains, in prose, why that claim is NOT shown.
    expect(content).not.toMatch(/>\s*Your changes are saved automatically\s*</i);
    expect(content).toMatch(/Save your progress before continuing/i);
  });
});

describe("UX10-P01 reference audit — honest empty/missing-data states", () => {
  it("ProfileCounsellorCard shows the brief's own truthful empty-state copy when nothing is verified, never a fabricated 'Verified'", () => {
    const content = readFileSync(path.join(ROOT, "src/components/sections/profile/ProfileCounsellorCard.tsx"), "utf8");
    expect(content).toMatch(/Complete your profile and attend a Discovery Session to unlock counsellor verification/);
  });

  it("ProfileCounsellorCard only ever renders a provenance badge for sections provenanceMap actually marks as touched", () => {
    const content = readFileSync(path.join(ROOT, "src/components/sections/profile/ProfileCounsellorCard.tsx"), "utf8");
    expect(content).toMatch(/provenance\s*!==\s*"SELF_ENTERED"/);
  });

  it("ProfileSummaryCard never claims a student is ready for recommendations without the real readiness level supporting it", () => {
    const content = readFileSync(path.join(ROOT, "src/components/sections/profile/ProfileSummaryCard.tsx"), "utf8");
    expect(content).toMatch(/READY|COUNSELLOR_VERIFIED/);
  });
});

describe("UX10-P01 reference audit — section-progress is real and additive, not a competing calculation", () => {
  const snapshotWithNothing: StudentProfileSnapshot = {
    profile: {
      userId: "test-user",
      dateOfBirth: null,
      gender: null,
      city: null,
      state: null,
      country: "India",
      preferredLanguage: null,
      currentStatus: null,
      profileStatus: "not_started",
      profileCompletionPercent: 0,
      onboardingCurrentStep: 1,
    },
    education: [],
    subjectStrengths: [],
    interests: [],
    skills: [],
    workPreferences: [],
    careerPriorities: [],
    careerGoals: null,
    studyPreferences: null,
    fundingPreferences: null,
    experience: [],
  };

  it("every section's progress percent stays within 0-100", () => {
    const completion = calculateCompletion(snapshotWithNothing);
    const draft = {
      aboutYou: { dateOfBirth: null, gender: null, city: null, state: null, country: "India", preferredLanguage: null, currentStatus: null },
      education: [],
      subjectStrengths: {},
      interests: {},
      interestsOtherText: "",
      skills: {},
      workPreferences: {},
      careerPriorities: {},
      careerGoals: { clarity: null, dreamJobTitle: null, dreamIndustry: null, dreamReason: null, careerIdeas: [], lifeGoalsText: null },
      studyPreferences: {
        studyFurther: null,
        studyAbroad: null,
        preferredStudyDestinations: [],
        preferredWorkDestinations: [],
        relocateWithinIndia: null,
        relocateInternational: null,
      },
      fundingPreferences: { budgetBand: null, fundingSource: null, loanOpenness: null },
      experience: [],
    };
    const progress = computeSectionProgress(draft, completion);
    expect(progress).toHaveLength(completion.sections.length);
    for (const section of progress) {
      expect(section.percent).toBeGreaterThanOrEqual(0);
      expect(section.percent).toBeLessThanOrEqual(100);
    }
    // A brand-new profile has nothing filled in anywhere — every section reads 0%, never a fabricated non-zero default.
    expect(progress.every((s) => s.percent === 0)).toBe(true);
  });
});
