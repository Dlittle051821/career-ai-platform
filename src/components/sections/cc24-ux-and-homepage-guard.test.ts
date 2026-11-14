import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import baseline from "./cc24-v54-baseline-hashes.json";

/**
 * CC-24 — UX regressions fixed in CC-24, plus a byte-level guard that the
 * V5.4 homepage, the master logo and their assets are exactly what was
 * deployed at a1017b9 (line endings normalized, so the guard behaves the
 * same on Windows CRLF checkouts and on Linux).
 *
 * CIUX-01 re-pinned exactly four of these files, on the owner's CIUX-01
 * instruction to integrate the global navigation into the homepage and add
 * a Quick Explore section: src/app/(site)/page.tsx (renders QuickExplore
 * after the story), NextwiseV54Home.tsx (the header pills now render the
 * shared NavMenus) and V54Account.tsx (the mobile menu renders the shared
 * MobileNavGroups) and src/lib/home/v54/v54.test.ts (its page assertion
 * now expects the story followed by QuickExplore). Every other homepage, logo and asset pin is unchanged
 * from a1017b9, and a pixel comparison against the cc26 baseline showed the
 * story scenes unchanged (docs/ciux/CIUX-01-TESTING.md).
 *
 * CIUX-01B re-pinned five more, on the owner's CIUX-01B instruction to give
 * the homepage and every public page ONE authoritative header: the homepage
 * now renders the global SiteHeader (NextwiseV54Home.tsx), its header CSS
 * moved to src/styles/site-header.css (v54.css keeps only the engine-driven
 * position, scale and intro fade), V54Account.tsx keeps only the hero call
 * to action, and the two V5.4 test files assert the same navigation
 * guarantees where the header now lives (v54.test.ts, v54-ux.test.ts). The
 * homepage is pixel-identical to CIUX-01 b15c162 in 16 of 16 reduced-motion
 * frames, header included (docs/ciux/CIUX-01B-TESTING.md).
 *
 * NW-V5.6.2 (approved 13 Nov 2026) re-pins NextwiseV54Home.tsx only: scene 2
 * renders v562/TwoPathways in backdrop panel 1. The CIUX-01B SiteHeader
 * (with Home), the hero, the N, the engine and every other pin are unchanged.
 *
 * NW-V5.6.3 (14 Nov 2026, awaiting the owner's approval) re-pins two files,
 * nothing else: NextwiseV54Home.tsx (scene 3 renders v563/CareerPreview) and
 * src/lib/brand/master-logo.ts (Master Logo v2.0, the owner-supplied pink-tinted
 * artwork; the v1 files stay pinned and in place). The hero, the N and its
 * artwork, the engine, v54.css and the Two Pathways scene are unchanged.
 */

const ROOT = path.resolve(import.meta.dirname, "../../..");
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");

function normalizedSha256(rel: string): string {
  let bytes = readFileSync(path.join(ROOT, rel));
  const isText = !bytes.subarray(0, 8000).includes(0);
  if (isText) bytes = Buffer.from(bytes.toString("latin1").replace(/\r\n/g, "\n"), "latin1");
  return createHash("sha256").update(bytes).digest("hex");
}

describe("V5.4 homepage, logo and assets are unchanged from a1017b9", () => {
  const entries = Object.entries(baseline as Record<string, string>);

  it("pins every homepage and brand file (39)", () => {
    expect(entries.length).toBe(39);
    expect(entries.map(([f]) => f)).toContain("src/components/sections/home/v54/NextwiseV54Home.tsx");
    expect(entries.map(([f]) => f)).toContain("src/app/(site)/page.tsx");
  });

  it.each(entries)("%s", (file, sha) => {
    expect(normalizedSha256(file)).toBe(sha);
  });
});

describe("show/hide password toggles have a 32x32 px hit area (WCAG 2.5.8, CC-23 H6)", () => {
  it.each(["src/components/sections/auth/LoginForm.tsx", "src/components/sections/auth/RegisterForm.tsx", "src/components/sections/auth/ResetPasswordForm.tsx"])(
    "%s",
    (file) => {
      const src = read(file);
      const toggle = src.match(/aria-label=\{show\w* \? "Hide password" : "Show password"\}\s+className="([^"]+)"/);
      expect(toggle).not.toBeNull();
      expect(toggle?.[1]).toContain("h-8 w-8");
      expect(toggle?.[1]).toContain("inline-flex");
      // the input keeps room for the 32px button (pr-11 = 44px)
      expect(src).toContain('className="pr-11"');
    }
  );
});

describe("onboarding explains what * means (CC-23 C11)", () => {
  it("shows the legend under every step heading except Review", () => {
    const wizard = read("src/components/sections/profile/onboarding/OnboardingWizard.tsx");
    expect(wizard).toMatch(/step < TOTAL_STEPS \? \([\s\S]*\{REQUIRED_FIELDS_NOTE\}/);
    const hook = read("src/components/sections/profile/onboarding/useProfileWizard.tsx");
    expect(hook).toContain("Fields marked * are needed to finish your profile. You can continue or save and come back to them later.");
  });
});

describe("course country chips say what they change (CC-23 E4)", () => {
  it("/courses explains that the chips pick the official portal, not the list", () => {
    expect(read("src/app/(site)/courses/page.tsx")).toContain("To narrow the course list itself, use the Country filter.");
  });
  it("the shared component renders the note only when given", () => {
    const c = read("src/components/sections/education/LaunchCountryDiscovery.tsx");
    expect(c).toContain('{note ? <p className="mt-2 text-xs text-muted">{note}</p> : null}');
    expect(read("src/app/(site)/universities/page.tsx")).not.toContain("note=");
  });
});

describe("profile inputs carry the server-side limits", () => {
  it.each([
    ["src/components/sections/profile/onboarding/steps/AboutYouStep.tsx", 4],
    ["src/components/sections/profile/onboarding/steps/CareerGoalsStep.tsx", 5],
    ["src/components/sections/profile/onboarding/steps/EducationStep.tsx", 4],
    ["src/components/sections/profile/onboarding/steps/ExperienceStep.tsx", 3],
    ["src/components/sections/profile/onboarding/steps/InterestsStep.tsx", 1],
  ])("%s has %i maxLength limits", (file, count) => {
    expect(read(file).match(/maxLength=\{PROFILE_TEXT_LIMITS\.\w+\}/g)?.length).toBe(count);
  });
  it("the add buttons stop at the server's row limits", () => {
    expect(read("src/components/sections/profile/onboarding/steps/EducationStep.tsx")).toContain("disabled={records.length >= MAX_EDUCATION_RECORDS}");
    expect(read("src/components/sections/profile/onboarding/steps/ExperienceStep.tsx")).toContain("disabled={records.length >= MAX_EXPERIENCE_RECORDS}");
  });
  it("the Discovery Session note has the same limit as the server", () => {
    expect(read("src/components/sections/discovery-session/DiscoverySessionBookingForm.tsx")).toContain("maxLength={DISCOVERY_SESSION_NOTES_MAX_LENGTH}");
  });
});

describe("welcome page path choice is checked at runtime", () => {
  it("rejects anything but the two real paths before writing", () => {
    const src = read("src/app/(site)/welcome/actions.ts");
    const guard = src.indexOf('if (choice !== "discovery_session" && choice !== "self_serve") redirect("/welcome");');
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(src.indexOf(".update({ onboarding_path: choice"));
  });
});
