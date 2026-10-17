import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * UX10-DS01 "Discovery Session Redesign" — static source-text audit, same
 * "no React Testing Library/jsdom in this project" convention as every
 * other *-reference-audit.test.ts file in this codebase (e.g.
 * src/lib/home/homepage-source-audit.test.ts,
 * src/lib/profile/profile-reference-audit.test.ts). Covers this
 * milestone's own mandatory regression categories (brief section 17/18):
 * free-session/no-pressure/no-guarantee/parents-welcome/India+Europe
 * wording, no non-approved launch countries on this page, no fabricated
 * stats/partnerships/counsellor identities, and that the real booking
 * form/server action/database-write chain is still wired exactly as it
 * was before this milestone.
 */
const ROOT = path.join(__dirname, "..", "..", "..");
const read = (relPath: string) => readFileSync(path.join(ROOT, relPath), "utf8");

/** Same false-positive-avoidance convention as homepage-source-audit.test.ts's own stripComments(): a component's own docblock may legitimately name something in prose while explaining why it's absent/superseded. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

const PAGE = read("app/(site)/discovery-session/book/page.tsx");
const HERO = read("components/sections/discovery-session/DiscoverySessionHero.tsx");
const STEPS = read("components/sections/discovery-session/SessionStepsSection.tsx");
const DISCUSSION_OUTCOMES = read("components/sections/discovery-session/DiscussionAndOutcomesSection.tsx");
const AUDIENCE_EXPECTATIONS = read("components/sections/discovery-session/AudienceAndExpectationsSection.tsx");
const TRUST_CARD = read("components/sections/discovery-session/SessionTrustCard.tsx");
const REAL_FORM = read("components/sections/discovery-session/DiscoverySessionBookingForm.tsx");
const REAL_ACTION = read("app/(site)/discovery-session/book/actions.ts");
const REAL_BOOK_LIB = read("lib/supabase/discovery-sessions/book.ts");
const MIDDLEWARE = read("lib/supabase/middleware.ts");

const ALL_NEW_SECTION_SOURCE = [PAGE, HERO, STEPS, DISCUSSION_OUTCOMES, AUDIENCE_EXPECTATIONS, TRUST_CARD].join("\n");
const ALL_NEW_SECTION_CODE_ONLY = stripComments(ALL_NEW_SECTION_SOURCE);

describe("DS01 — free, no-pressure, no-guarantee, parents-welcome wording is present on the real page", () => {
  it("free-session wording appears", () => {
    expect(ALL_NEW_SECTION_SOURCE).toMatch(/free/i);
    expect(HERO).toMatch(/free/i);
    expect(DISCUSSION_OUTCOMES).toMatch(/free session/i);
  });

  it("no-pressure wording appears", () => {
    expect(HERO).toMatch(/no pressure/i);
    expect(DISCUSSION_OUTCOMES).toMatch(/no obligation/i);
  });

  it("no admission guarantee and no visa guarantee are both explicitly stated", () => {
    expect(AUDIENCE_EXPECTATIONS).toMatch(/do not provide an admission guarantee/i);
    expect(AUDIENCE_EXPECTATIONS).toMatch(/do not provide a visa guarantee/i);
  });

  it("parents are explicitly welcomed", () => {
    expect(HERO).toMatch(/parents welcome/i);
    expect(AUDIENCE_EXPECTATIONS).toMatch(/parents are welcome to join/i);
    expect(TRUST_CARD).toMatch(/parents can join/i);
  });

  it("India and Europe positioning is present, phrased as India/Europe rather than country-by-country Europe selection", () => {
    expect(HERO).toMatch(/India and Europe/);
    expect(STEPS).toMatch(/India & Europe/);
    expect(DISCUSSION_OUTCOMES).toMatch(/India \/ Europe/);
  });
});

describe("DS01 — no non-approved launch countries, no fabricated stats, no false partnership claims", () => {
  it("never surfaces USA/UK/Canada/Australia anywhere in actual rendered content", () => {
    for (const forbidden of ["United States", "United Kingdom", /\bUSA\b/, /\bUK\b/, "Canada", "Australia"]) {
      if (typeof forbidden === "string") {
        expect(ALL_NEW_SECTION_CODE_ONLY).not.toContain(forbidden);
      } else {
        expect(ALL_NEW_SECTION_CODE_ONLY).not.toMatch(forbidden);
      }
    }
  });

  it("never lists Europe as a country-by-country destination picker — India/Europe/Unsure framing only, per the brief's own section 16", () => {
    for (const country of ["Germany", "Ireland", "Netherlands", "France", "Sweden", "Denmark"]) {
      expect(ALL_NEW_SECTION_CODE_ONLY).not.toContain(country);
    }
  });

  it("no fabricated success percentage or student-count statistic", () => {
    expect(ALL_NEW_SECTION_CODE_ONLY).not.toMatch(/\d{1,3}%\s*(success|admitted|placed)/i);
    expect(ALL_NEW_SECTION_CODE_ONLY).not.toMatch(/\d[\d,]*\+?\s*(students|families)\s*(helped|served|guided)/i);
  });

  it("no partnership/endorsement claim and no fabricated named counsellor or credential", () => {
    expect(ALL_NEW_SECTION_CODE_ONLY).not.toMatch(/official partner|endorsed by|in partnership with/i);
    expect(ALL_NEW_SECTION_CODE_ONLY).not.toMatch(/dr\.|senior counsellor with \d+ years/i);
    // The brief's own instruction for an undefined real session duration —
    // confirms the honest fallback wording is actually present, not a
    // fabricated "30-45 minutes" or similar.
    expect(TRUST_CARD).toMatch(/session duration will be confirmed with your booking/i);
    // Checked against comment-stripped source: this component's own
    // docblock legitimately quotes a fabricated "30-45 minutes" example in
    // prose while explaining why that invented duration is NOT used (same
    // false-positive trap homepage-source-audit.test.ts's stripComments()
    // docblock describes).
    expect(stripComments(TRUST_CARD)).not.toMatch(/\d+[-–]\d+\s*minutes/);
  });
});

describe("DS01 — the real, database-backed booking workflow is preserved exactly, not replaced with a mock UI", () => {
  it("the redesigned page still renders the real DiscoverySessionBookingForm component, not a new disconnected form", () => {
    expect(PAGE).toContain('from "@/components/sections/discovery-session/DiscoverySessionBookingForm"');
    expect(PAGE).toMatch(/<DiscoverySessionBookingForm\s*\/>/);
  });

  it("the real form still submits through bookDiscoverySessionAction -> bookDiscoverySession() -> a real discovery_sessions insert (untouched by this milestone)", () => {
    expect(REAL_FORM).toContain('from "@/app/(site)/discovery-session/book/actions"');
    expect(REAL_FORM).toContain("bookDiscoverySessionAction(");
    expect(REAL_ACTION).toContain("bookDiscoverySession(");
    expect(REAL_BOOK_LIB).toContain('.from("discovery_sessions")');
    expect(REAL_BOOK_LIB).toContain(".insert(");
  });

  it("the real booking success analytics event (discovery_session_booked) is still fired from the real data layer, untouched", () => {
    expect(REAL_BOOK_LIB).toContain('eventName: "discovery_session_booked"');
  });

  it("the real submit CTA copy ('Book my free Discovery Session') and loading/disabled state are unchanged in the real form", () => {
    expect(REAL_FORM).toContain("Book my free Discovery Session");
    expect(REAL_FORM).toMatch(/disabled=\{submitting\}/);
  });

  it("the real form's success state (booked confirmation) and error state (role=\"alert\") both remain reachable", () => {
    expect(REAL_FORM).toMatch(/setBooked\(true\)/);
    expect(REAL_FORM).toMatch(/role="alert"/);
  });

  it("the page's own primary hero/final CTAs never bypass the real form with a fabricated instant-success state", () => {
    expect(stripComments(PAGE)).not.toMatch(/setBooked|setSubmitted\(true\)/);
  });

  it("an authenticated student who already has an active session still sees the real existing-session card, not the form again (duplicate-booking guard preserved)", () => {
    expect(PAGE).toContain("activeSession");
    expect(PAGE).toContain("DISCOVERY_SESSION_STATUS_LABELS");
  });

  it("the page's own auth redirect for a signed-out visitor is preserved exactly (defense in depth, unchanged by this milestone)", () => {
    expect(PAGE).toContain('redirect("/login?next=/discovery-session/book")');
  });

  it("the real middleware-level route protection for the whole /discovery-session subtree is untouched by this milestone", () => {
    expect(MIDDLEWARE).toContain('"/discovery-session"');
  });
});

describe("DS01 — accessibility and structure invariants", () => {
  it("exactly one <h1> across the page's own new section composition (the hero), every other new section uses <h2>", () => {
    const sources = [HERO, STEPS, DISCUSSION_OUTCOMES, AUDIENCE_EXPECTATIONS];
    const counts = sources.map((s) => (s.match(/<h1[\s>]/g) ?? []).length);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(1);
    expect((HERO.match(/<h1[\s>]/g) ?? []).length).toBe(1);
  });

  it("decorative hero question bubbles are aria-hidden and never carry the only copy of a real CTA", () => {
    expect(HERO).toMatch(/QUESTION_BUBBLES/);
    expect(HERO).toMatch(/aria-hidden="true"[\s\S]{0,40}className=\{cn\(/);
  });

  it("the discussion-topics and audience cards are not mandatory form fields — the real form's own fields are untouched", () => {
    expect(REAL_FORM).toContain("preferredContactMethod");
    expect(REAL_FORM).toContain("preferredTimeRange");
    expect(REAL_FORM).toContain("preferredLanguage");
    expect(REAL_FORM).toContain("studentNotes");
    // No new mandatory field name from the discussion-topics list leaks into the real form's state shape.
    for (const fakeField of ["studentName", "guardianName", "budget", "parentExpectations"]) {
      expect(REAL_FORM).not.toContain(fakeField);
    }
  });

  it("the hero's primary CTA scrolls to the real form anchor rather than linking to a different/fake route", () => {
    expect(HERO).toContain('href="#discovery-session-form"');
    expect(PAGE).toContain('id="discovery-session-form"');
  });
});

describe("DS01 — metadata", () => {
  it("page title and description match the brief's direction without keyword stuffing", () => {
    expect(PAGE).toContain("Free Discovery Session | Nextwise");
    expect(PAGE).toMatch(/Book a free Nextwise Discovery Session/);
  });
});
