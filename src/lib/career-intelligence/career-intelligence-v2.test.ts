import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CAREER_OPTIONS_GROUP, HEADER_NAV, HEADER_NAV_HREFS } from "@/config/site";
import { PLAN_CAPABILITIES, planHasCapability } from "@/config/plan-capabilities";
import { resolveActiveNavHref } from "@/lib/navigation/active-nav";
import { ACCOUNT_ENTRY_PREFIXES, PUBLIC_EXACT_PATHS, classifyPublicMarketingRequest } from "@/lib/launch/launch-mode";
import { calculateCompletion } from "@/lib/profile/completion";
import { getRecommendations } from "@/lib/recommendations";
import { allCareerPriorities, buildRichCareer, buildSnapshot, educationRecord, fullWorkPreferences, interest, skill, studentProfile, studyPreferences, subjectStrength } from "@/lib/recommendations/fixtures.test-helpers";
import { canViewCareerIntelligence, resolveCareerIntelligenceAccess } from "./access";
import {
  ASSESSMENT_SECTIONS,
  answersFromSnapshot,
  checkSection,
  completedSectionKeys,
  emptyAnswers,
  isAssessmentComplete,
  planGuestTransfer,
  sanitizeAnswers,
  snapshotFromAnswers,
  type AssessmentAnswers,
} from "./assessment/model";
import { glanceFromAnswers } from "./assessment/glance";
import { TEASER_FIELDS, illustrativeTeaser, projectTeaser } from "./teaser";

const SRC = path.resolve(import.meta.dirname, "../..");
const read = (rel: string) => readFileSync(path.join(SRC, rel), "utf8");
const code = (rel: string) => read(rel).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const walk = (dir: string, out: string[] = []): string[] => {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(name) && !/\.test\./.test(name)) out.push(full);
  }
  return out;
};

/** A complete set of answers, using production option keys only. */
function completeAnswers(): AssessmentAnswers {
  return sanitizeAnswers({
    education: { currentStatus: "school_12", educationLevel: "class_12", educationStatus: "ongoing", fieldOfStudy: "Science (PCM)" },
    subjects: { mathematics: 5, physics: 5, computer_science: 4 },
    interests: { robotics: 3, programming: 3, ai_data: 3 },
    skills: { python: "beginner", problem_solving: "intermediate" },
    work: { technical_problem_solving: 5, enjoys_machines: 4, enjoys_designing_creating: 4, enjoys_research_analysis: 4 },
    priorities: { fast_career_growth: 5, international_career: 4, creativity: 4, job_security: 3, high_salary: 3 },
    goals: { clarity: "some_ideas", dreamJobTitle: null, careerIdeas: ["robotics engineer"] },
    study: { studyFurther: "yes", studyAbroad: "maybe", relocateWithinIndia: "yes", relocateInternational: "maybe", destinations: ["germany"] },
    plans: { budgetBand: "10_20l", fundingSource: "combination", loanOpenness: "maybe" },
  });
}

describe("Career Intelligence V2 — header", () => {
  it("adds Pricing after Destination, linking to /pricing, desktop and phone (both render HEADER_NAV)", () => {
    const last = HEADER_NAV[HEADER_NAV.length - 1];
    expect(last.kind).toBe("link");
    expect(last.kind === "link" && last.link).toMatchObject({ label: "Pricing", href: "/pricing" });
    expect(HEADER_NAV[HEADER_NAV.length - 2].kind === "group" && HEADER_NAV[HEADER_NAV.length - 2]).toBeTruthy();
    for (const rel of ["components/navigation/NavMenus.tsx", "components/navigation/MobileNavGroups.tsx"]) expect(code(rel)).toContain("HEADER_NAV.map");
  });

  it("marks Pricing as the active place on /pricing and its checkout pages", () => {
    expect(resolveActiveNavHref("/pricing", HEADER_NAV_HREFS)).toBe("/pricing");
    expect(resolveActiveNavHref("/pricing/checkout/nextwise-verified", HEADER_NAV_HREFS)).toBe("/pricing");
    expect(resolveActiveNavHref("/career/preview", HEADER_NAV_HREFS)).toBe("/career");
  });

  it("labels Career Intelligence as a free assessment", () => {
    expect(CAREER_OPTIONS_GROUP.links[1]).toMatchObject({ href: "/career", badge: { label: "Free assessment", tone: "free" } });
  });
});

describe("Career Intelligence V2 — assessment model", () => {
  it("has the eight approved sections in order", () => {
    expect(ASSESSMENT_SECTIONS.map((s) => s.rail)).toEqual(["Education", "Subject strengths", "Interests", "Skills", "Work style", "Priorities and goals", "Study and location", "Budget and plans"]);
  });

  it("validates only what is required and counts up to the profile's own minimums", () => {
    const a = emptyAnswers();
    expect(checkSection("subjects", a).message).toBe("Rate at least 3 subjects (0 of 3 so far).");
    a.subjects = { mathematics: 5, physics: 4 };
    expect(checkSection("subjects", a).message).toBe("Rate at least 3 subjects (2 of 3 so far).");
    a.subjects.chemistry = 3;
    expect(checkSection("subjects", a).ok).toBe(true);
    // optional questions never block
    const c = completeAnswers();
    c.education.fieldOfStudy = null;
    c.study.destinations = [];
    expect(isAssessmentComplete(c)).toBe(true);
    // a "clear" goal needs the career named; "not sure" needs nothing more
    c.goals = { clarity: "clear", dreamJobTitle: null, careerIdeas: [] };
    expect(checkSection("priorities", c).ok).toBe(false);
    c.goals = { clarity: "not_sure", dreamJobTitle: null, careerIdeas: [] };
    expect(checkSection("priorities", c).ok).toBe(true);
  });

  it("sanitises anything from the browser: unknown keys, bad ratings and personal fields are dropped", () => {
    const a = sanitizeAnswers({
      email: "student@example.com",
      dateOfBirth: "2008-01-01",
      education: { currentStatus: "school_12", educationLevel: "class_99", city: "Pune" },
      subjects: { mathematics: 5, physics: 9, chemistry: 2.5, __proto__: 5, not_a_subject: 4 },
      skills: { python: "guru", problem_solving: "advanced" },
      goals: { clarity: "clear", dreamJobTitle: "x".repeat(500) },
      study: { destinations: ["germany", "mars", "germany"] },
    });
    expect(JSON.stringify(a)).not.toMatch(/student@example\.com|2008-01-01|Pune/);
    expect(a.education).toEqual({ currentStatus: "school_12", educationLevel: null, educationStatus: null, fieldOfStudy: null });
    expect(a.subjects).toEqual({ mathematics: 5 });
    expect(a.skills).toEqual({ problem_solving: "advanced" });
    expect(a.goals.dreamJobTitle).toHaveLength(120);
    expect(a.study.destinations).toEqual(["germany"]);
  });

  it("a complete assessment is a complete Student Digital Profile (same tables, same completion rule)", () => {
    const snapshot = snapshotFromAnswers(completeAnswers());
    expect(calculateCompletion(snapshot).status).toBe("completed");
    expect(isAssessmentComplete(answersFromSnapshot(snapshot))).toBe(true);
  });

  it("reads an existing profile back into the assessment", () => {
    const snapshot = buildSnapshot({
      profile: studentProfile({ currentStatus: "undergraduate" }),
      education: [educationRecord({ educationLevel: "class_12", status: "completed", endYear: 2022 }), educationRecord({ educationLevel: "bachelors", status: "ongoing" })],
      subjectStrengths: [subjectStrength("mathematics", 5)],
      interests: [interest("robotics", null)],
      skills: [skill("python", "advanced")],
    });
    const a = answersFromSnapshot(snapshot);
    expect(a.education).toMatchObject({ currentStatus: "undergraduate", educationLevel: "bachelors", educationStatus: "ongoing" });
    expect(a.interests).toEqual({ robotics: 3 });
    expect(a.skills).toEqual({ python: "advanced" });
    expect(completedSectionKeys(a)).toEqual(["education"]);
  });
});

describe("Career Intelligence V2 — moving guest answers into an account", () => {
  it("the account wins per section; only unanswered sections are filled from the browser", () => {
    const account = emptyAnswers();
    account.subjects = { english: 2 };
    const guest = completeAnswers();
    const plan = planGuestTransfer(account, guest);
    expect(plan.keep).toEqual(["subjects"]);
    expect(plan.transfer).toEqual(["education", "interests", "skills", "work", "priorities", "study", "plans"]);
  });

  it("is deterministic and a second run transfers nothing", () => {
    const guest = completeAnswers();
    expect(planGuestTransfer(emptyAnswers(), guest)).toEqual(planGuestTransfer(emptyAnswers(), guest));
    expect(planGuestTransfer(guest, guest).transfer).toEqual([]);
  });

  it("never takes a user id from the browser: the actions read the session on the server", () => {
    const actions = code("app/(site)/career/actions.ts");
    expect(actions).toMatch(/^"use server";/);
    expect(actions).toContain("supabase.auth.getUser()");
    expect(actions).not.toMatch(/userId\s*[:,)]|user_id/);
    for (const fn of ["saveCareerAssessmentSection(sectionKey: string, rawAnswers: unknown)", "claimGuestCareerAssessment(rawAnswers: unknown)", "getGuestCareerTeaser(rawAnswers: unknown)"]) expect(actions).toContain(fn);
    // every save goes through the existing student-profile actions
    expect(actions).toContain('from "@/lib/supabase/student-profile-actions"');
    expect(actions).not.toMatch(/\.from\(|\.insert\(|\.upsert\(|\.delete\(/);
  });

  it("stores no personal identifier on the device and never logs answers", () => {
    const store = code("lib/career-intelligence/assessment/guest-store.ts");
    expect(store).toContain("JSON.stringify({ answers, step, updatedAt: Date.now() })");
    const sources = [code("app/(site)/career/actions.ts"), code("lib/career-intelligence/teaser-server.ts")];
    // one fixed message per log line; the only value ever interpolated is the section name
    for (const src of sources) for (const m of src.matchAll(/console\.(log|warn|error)\(([^;]*)\);/g)) expect(m[2]).toMatch(/^(`[^`$]*(\$\{key\}[^`$]*)?`|"[^"]*")$/);
  });
});

describe("Career Intelligence V2 — the free teaser crosses the boundary alone", () => {
  const snapshot = buildSnapshot({
    profile: studentProfile({ currentStatus: "school_12" }),
    education: [educationRecord({ educationLevel: "class_12" })],
    subjectStrengths: [subjectStrength("mathematics", 5), subjectStrength("physics", 5), subjectStrength("computer_science", 4)],
    interests: [interest("robotics", 5), interest("programming", 4), interest("ai_data", 4)],
    skills: [skill("python", "intermediate"), skill("problem_solving", "advanced")],
    workPreferences: fullWorkPreferences({ technical_problem_solving: 5 }),
    careerPriorities: allCareerPriorities({ fast_career_growth: 5 }),
    studyPreferences: studyPreferences(),
  });
  const careers = [
    buildRichCareer({ id: "c1", careerKey: "robotics_engineer", slug: "robotics-engineer", title: "Robotics Engineer" }),
    buildRichCareer({ id: "c2", careerKey: "data_scientist", slug: "data-scientist", title: "Data Scientist" }),
    buildRichCareer({ id: "c3", careerKey: "mech", slug: "mechanical-engineer", title: "Mechanical Engineer" }),
  ];
  const { results } = getRecommendations(snapshot, careers);

  it("projects exactly the approved fields from the engine's first result", () => {
    expect(results.length).toBeGreaterThan(1);
    const teaser = projectTeaser(results[0]);
    expect(teaser).not.toBeNull();
    expect(Object.keys(teaser!).sort()).toEqual([...TEASER_FIELDS].sort());
    expect(teaser!.title).toBe(results[0].title);
    expect(teaser!.reason).toBe(results[0].reasons[0].label);
  });

  it("carries no fit band, score, evidence, other reasons, gaps, matched signals or other careers", () => {
    const json = JSON.stringify(projectTeaser(results[0]));
    expect(json).not.toMatch(/matchBand|evidence|internal|score|gaps|matched|educationRoutes|strong_match|promising_match|worth_exploring|%/i);
    for (const other of results.slice(1)) expect(json).not.toContain(other.title);
    for (const reason of results[0].reasons.slice(1)) expect(json).not.toContain(reason.label);
  });

  it("the illustrative fallback is labelled as such and claims nothing personal", () => {
    const t = illustrativeTeaser();
    expect(t.kind).toBe("illustrative");
    expect(t.reason).toMatch(/In a real preview/);
  });

  it("the server generator returns only the projection and is server-only", () => {
    const gen = code("lib/career-intelligence/teaser-server.ts");
    expect(gen).toMatch(/^import "server-only";/);
    expect(gen).toMatch(/return \(top && projectTeaser\(top\)\) \|\| illustrativeTeaser\(\);/);
    expect(gen).not.toMatch(/return results|return \{ results/);
  });

  it("no client component computes recommendations or imports the server generator", () => {
    for (const f of walk(path.join(SRC, "components/career-intelligence"))) {
      const src = readFileSync(f, "utf8");
      expect(src, f).not.toMatch(/getRecommendations|getCareersForMatching|teaser-server|computeCareerTeaser/);
    }
  });

  it("the preview page renders the teaser contract only, and sends a paid student to the report", () => {
    const page = code("app/(site)/career/preview/page.tsx");
    expect(page).not.toMatch(/getRecommendations|getCareersForMatching/);
    expect(page).toContain("computeCareerTeaser(snapshot)");
    expect(page.indexOf('if (canViewCareerIntelligence(access)) redirect("/career/report")')).toBeGreaterThan(-1);
  });

  it("the glance is the student's own answers, not a result", () => {
    expect(glanceFromAnswers(completeAnswers())).toEqual({ subjects: ["Mathematics", "Physics"], interests: ["Robotics", "Programming", "AI / Data"], priorities: ["fast career growth", "international career"] });
  });
});

describe("Career Intelligence V2 — paid report and entitlement", () => {
  it("the report checks access before reading the profile, loading careers or scoring", () => {
    const page = code("app/(site)/career/report/page.tsx");
    const gate = page.indexOf('await requireCareerIntelligence("report")');
    expect(gate).toBeGreaterThan(-1);
    for (const later of ["getStudentProfileSnapshot()", "getCareersForMatching()", "getRecommendations(snapshot, careers)"]) expect(gate).toBeLessThan(page.indexOf(later));
    expect(page).not.toMatch(/\d+\s?%|internalScore/);
  });

  it.each([
    [["issued"], "payment_pending"],
    [["partially_paid"], "payment_pending"],
    [["overdue"], "payment_pending"],
    [["failed"], "free"],
    [["draft"], "free"],
    [[null], "free"],
    [["void"], "revoked"],
    [["refunded"], "revoked"],
    [["partially_refunded"], "revoked"],
    [["paid"], "active"],
    [["refunded", "paid"], "active"],
  ] as const)("invoice statuses %j → %s", (statuses, state) => {
    const s = resolveCareerIntelligenceAccess({ isSignedIn: true, isStaff: false, qualifyingInvoiceStatuses: statuses });
    expect(s).toBe(state);
    expect(canViewCareerIntelligence(s)).toBe(state === "active");
  });

  it("only plans with the capability are offered; Nextwise Explore is not", () => {
    expect(planHasCapability("nextwise-explore", "career_intelligence")).toBe(false);
    expect(Object.keys(PLAN_CAPABILITIES).filter((slug) => planHasCapability(slug, "career_intelligence")).sort()).toEqual(
      // NW-PRICING-V3 adds Study Abroad Lite and Premium; the retired plans keep the capability for their buyers
      ["bachelor-abroad-plus", "bachelor-abroad-premium", "master-abroad-plus", "master-abroad-premium", "nextwise-essential", "nextwise-verified", "study-abroad-lite", "study-abroad-premium"].sort(),
    );
  });

  it("choosing a plan or coming back from payment grants nothing: no purchase, insert or entitlement write anywhere in the new code", () => {
    const files = [...walk(path.join(SRC, "components/career-intelligence")), ...walk(path.join(SRC, "app/(site)/career")), ...walk(path.join(SRC, "lib/career-intelligence/assessment")), path.join(SRC, "lib/career-intelligence/plans.ts")];
    for (const f of files) {
      const src = readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
      expect(src, f).not.toMatch(/purchasePricingPlan|purchase_pricing_plan|razorpay|createOrder|pricing_purchases|from\("invoices"\)|Entitlement\(|\.insert\(|\.upsert\(|\.update\(/i);
    }
  });

  it("the checkout is reached only when online payment is open, and never simulated", () => {
    const dialog = code("components/career-intelligence/UnlockDialog.tsx");
    expect(dialog).toMatch(/purchasesOpen \?/);
    expect(dialog).toContain("/pricing/checkout/");
    expect(code("lib/career-intelligence/plans.ts")).toContain("!arePaidFeaturesForcedOff() && isPaidCheckoutEnabled()");
    for (const f of [...walk(path.join(SRC, "components")), ...walk(path.join(SRC, "app"))]) {
      expect(readFileSync(f, "utf8"), f).not.toMatch(/Simulate (successful|failed) payment|Simulate payment pending|demo state|Prototype · Demo/i);
    }
  });

  it("₹1,999 comes from the approved constant, GST included, never added again", () => {
    const plans = code("lib/career-intelligence/plans.ts");
    expect(plans).toContain("NEXTWISE_VERIFIED.payableMinorUnits");
    expect(plans).toContain('"final price, GST included"');
    expect(plans).not.toMatch(/tax|gst\s*\*/i);
  });
});

describe("Career Intelligence V2 — routes", () => {
  it("the free screens are public pages; the report needs an account", () => {
    for (const p of ["/career", "/career/assessment", "/career/assessment/complete", "/career/preview", "/career/plans"]) expect(PUBLIC_EXACT_PATHS).toContain(p);
    expect(ACCOUNT_ENTRY_PREFIXES).toContain("/career/report");
    expect(classifyPublicMarketingRequest("GET", "/career/report")).toEqual({ action: "redirect", location: "/book-counselling" });
  });
});
