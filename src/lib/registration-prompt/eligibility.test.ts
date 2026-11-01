import { describe, expect, it } from "vitest";
import {
  ENGAGED_THRESHOLD_MS,
  SUPPRESSION_DURATION_MS,
  canShowRegistrationPrompt,
  computeDismissUntil,
  isPathEligibleForPrompt,
  isSuppressedByPriorDismissal,
} from "./eligibility";

describe("ENGAGED_THRESHOLD_MS / SUPPRESSION_DURATION_MS — the brief's own exact numbers", () => {
  it("engaged threshold is ~45 seconds", () => {
    expect(ENGAGED_THRESHOLD_MS).toBe(45_000);
  });

  it("suppression window is exactly 7 days", () => {
    expect(SUPPRESSION_DURATION_MS).toBe(7 * 24 * 60 * 60 * 1000);
  });
});

describe("isPathEligibleForPrompt", () => {
  it("is eligible on ordinary public discovery pages", () => {
    for (const path of ["/", "/careers", "/career", "/abroad", "/universities", "/courses", "/pricing", "/about", "/trust", "/compare", "/study-options"]) {
      expect(isPathEligibleForPrompt(path), `expected ${path} to be eligible`).toBe(true);
    }
  });

  it("is never eligible on auth-utility pages", () => {
    for (const path of ["/login", "/register", "/forgot-password", "/reset-password"]) {
      expect(isPathEligibleForPrompt(path), `expected ${path} to be excluded`).toBe(false);
    }
  });

  it("is never eligible on the checkout flow, even though /pricing itself stays eligible", () => {
    expect(isPathEligibleForPrompt("/pricing/checkout/some-plan")).toBe(false);
    expect(isPathEligibleForPrompt("/pricing")).toBe(true);
  });

  it("is never eligible on private/authenticated/admin routes", () => {
    for (const path of ["/dashboard", "/profile", "/saved", "/applications/123", "/payments", "/admin", "/admin/students", "/studio", "/discovery-session/book", "/recommendations", "/roadmap", "/agreements/1", "/pay/abc"]) {
      expect(isPathEligibleForPrompt(path), `expected ${path} to be excluded`).toBe(false);
    }
  });

  it("is never eligible with a null/undefined pathname", () => {
    expect(isPathEligibleForPrompt(null)).toBe(false);
    expect(isPathEligibleForPrompt(undefined)).toBe(false);
  });

  it("does not false-positive-exclude a page that merely starts with an excluded word (prefix matching is slash-bounded)", () => {
    // Not a real route in this codebase, but exercises the matching rule
    // itself: "/loginhelp" must not be excluded just because it starts
    // with the same characters as "/login".
    expect(isPathEligibleForPrompt("/loginhelp")).toBe(true);
  });
});

describe("isSuppressedByPriorDismissal", () => {
  it("is not suppressed when no dismissal has ever been recorded", () => {
    expect(isSuppressedByPriorDismissal(Date.now(), null)).toBe(false);
  });

  it("is suppressed while now is before the stored dismissedUntil", () => {
    const now = 1_000_000;
    expect(isSuppressedByPriorDismissal(now, now + 1)).toBe(true);
  });

  it("is no longer suppressed once now reaches/passes the stored dismissedUntil", () => {
    const now = 1_000_000;
    expect(isSuppressedByPriorDismissal(now, now)).toBe(false);
    expect(isSuppressedByPriorDismissal(now, now - 1)).toBe(false);
  });
});

describe("computeDismissUntil", () => {
  it("adds exactly the 7-day suppression window to the given timestamp", () => {
    const now = 1_700_000_000_000;
    expect(computeDismissUntil(now)).toBe(now + SUPPRESSION_DURATION_MS);
  });
});

describe("canShowRegistrationPrompt — the one combined gate", () => {
  const baseInput = {
    isAuthenticated: false,
    pathname: "/careers",
    alreadyShownThisVisit: false,
    nowMs: 1_700_000_000_000,
    dismissedUntilMs: null as number | null,
  };

  it("allows showing when every condition is met", () => {
    expect(canShowRegistrationPrompt(baseInput)).toBe(true);
  });

  it("never shows to an authenticated user, even on an eligible page with no suppression", () => {
    expect(canShowRegistrationPrompt({ ...baseInput, isAuthenticated: true })).toBe(false);
  });

  it("never shows on an excluded page", () => {
    expect(canShowRegistrationPrompt({ ...baseInput, pathname: "/login" })).toBe(false);
  });

  it("never shows twice in the same visit", () => {
    expect(canShowRegistrationPrompt({ ...baseInput, alreadyShownThisVisit: true })).toBe(false);
  });

  it("never shows during an active 7-day suppression window", () => {
    expect(canShowRegistrationPrompt({ ...baseInput, dismissedUntilMs: baseInput.nowMs + 1 })).toBe(false);
  });

  it("shows again once the suppression window has elapsed", () => {
    expect(canShowRegistrationPrompt({ ...baseInput, dismissedUntilMs: baseInput.nowMs - 1 })).toBe(true);
  });
});
