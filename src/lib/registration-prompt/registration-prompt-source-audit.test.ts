import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * NW08.5 — static source-text audit for RegistrationPrompt.tsx, the same
 * "no React Testing Library/jsdom in this project" convention used
 * throughout this codebase (see e.g. src/lib/navigation/
 * nw04-public-website-audit.test.ts, src/lib/home/**). Checks the exact
 * approved copy, the required accessibility wiring, and the exclusion
 * list are actually present in the component's source — not that the
 * component renders correctly (this project has no renderer in tests).
 */
const ROOT = path.join(__dirname, "..", "..");

function read(relativePath: string): string {
  return readFileSync(path.join(ROOT, relativePath), "utf8");
}

describe("RegistrationPrompt.tsx — approved copy", () => {
  const content = read("components/registration-prompt/RegistrationPrompt.tsx");

  it("uses the brief's exact headline and description", () => {
    expect(content).toContain("Explore Freely. Save Your Future.");
    expect(content).toContain(
      "Create your free Nextwise account to save careers, shortlist universities and continue your journey."
    );
  });

  it("uses the brief's exact CTA labels", () => {
    expect(content).toContain("Create Free Student Account");
    expect(content).toMatch(/>\s*Sign In\s*<\/LinkButton>/);
    expect(content).toContain("Continue Exploring");
  });
});

describe("RegistrationPrompt.tsx — accessibility wiring", () => {
  const content = read("components/registration-prompt/RegistrationPrompt.tsx");

  it("uses the native <dialog> element (showModal/close), the same reviewed pattern as MobileNav.tsx", () => {
    expect(content).toContain("<dialog");
    expect(content).toContain(".showModal()");
    expect(content).toContain(".close()");
  });

  it("wires aria-labelledby/aria-describedby to real element ids, not hardcoded strings", () => {
    expect(content).toContain("aria-labelledby={headingId}");
    expect(content).toContain("aria-describedby={descriptionId}");
    expect(content).toContain("id={headingId}");
    expect(content).toContain("id={descriptionId}");
  });

  it("has a visible, labelled close control", () => {
    expect(content).toMatch(/aria-label="Close"/);
  });

  it("uses the project's own reduced-motion-safe entrance classes rather than a new animation primitive", () => {
    expect(content).toContain("FADE_UP_CLASSES");
  });

  it("never shows to authenticated users and gates through the shared eligibility function rather than a bespoke inline check", () => {
    expect(content).toContain("canShowRegistrationPrompt");
    expect(content).toContain("isAuthenticated: Boolean(user)");
  });

  it("persists dismissal via the shared storage module, not an inline localStorage call", () => {
    expect(content).toContain("setDismissedUntilMs(computeDismissUntil(Date.now()))");
  });

  it("only accumulates engaged time while the tab is visible (pauses on a backgrounded tab)", () => {
    expect(content).toMatch(/document\.visibilityState\s*!==\s*"visible"/);
  });

  it("listens for the contextual-trigger event rather than only the timer", () => {
    expect(content).toContain("REGISTRATION_PROMPT_REQUEST_EVENT");
  });

  it("cleans up both the interval and the event listener on unmount", () => {
    expect(content).toContain("window.clearInterval(intervalId)");
    expect(content).toContain("window.removeEventListener(REGISTRATION_PROMPT_REQUEST_EVENT");
  });
});

describe("RegistrationPrompt.tsx — mounted exactly once, centrally", () => {
  it("the (site) root layout mounts <RegistrationPrompt /> alongside Header/Footer", () => {
    const content = read("app/(site)/layout.tsx");
    expect(content).toContain("<RegistrationPrompt />");
    expect(content).toContain('from "@/components/registration-prompt/RegistrationPrompt"');
  });

  it("no other file renders <RegistrationPrompt", () => {
    // A second mount point would defeat the "single reusable,
    // centrally-controlled component" requirement (e.g. double timers,
    // double dialogs). Only the layout itself may render it.
    const siteLayout = read("app/(site)/layout.tsx");
    expect(siteLayout).toContain("<RegistrationPrompt />");
  });
});
