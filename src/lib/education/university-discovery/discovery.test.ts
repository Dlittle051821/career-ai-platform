import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { EUROPE_COUNTRIES } from "@/data/europe-explorer";
import { getOfficialResourceCopy, getUniversityDestination, OFFICIAL_RESOURCE_COPY, UNIVERSITY_DESTINATIONS } from "./destinations";
import { getVerifiedOffer, VERIFIED_PLAN_SLUG } from "./offer";
import { reconcileAccessState, resolveView, type DialogViewState } from "@/components/sections/university-discovery/VerifiedAccessDialog";
import { containsUnsupportedPartnershipLanguage } from "@/lib/education/external-search/attribution";

const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");

describe("University Discovery V3 — destinations", () => {
  it("are exactly the approved Europe configuration, in its order (no second country list)", () => {
    expect(UNIVERSITY_DESTINATIONS.map((d) => d.code)).toEqual(EUROPE_COUNTRIES.map((c) => c.code));
    expect(UNIVERSITY_DESTINATIONS.map((d) => d.name)).toEqual(["Germany", "Ireland", "Netherlands", "France", "Sweden", "Denmark"]);
  });

  it("each has an approved photograph, its location and a descriptor", () => {
    for (const d of UNIVERSITY_DESTINATIONS) {
      expect(d.image.fallback).toMatch(/^\/home-v4\/dest-[a-z]{2}-1024\.jpg$/);
      expect(d.photoLocation.length).toBeGreaterThan(3);
      expect(d.descriptor.length).toBeGreaterThan(10);
    }
  });

  it("resolve by slug or ISO code and reject anything else", () => {
    expect(getUniversityDestination("germany")?.code).toBe("DE");
    expect(getUniversityDestination("DE")?.slug).toBe("germany");
    expect(getUniversityDestination("usa")).toBeNull();
    expect(getUniversityDestination("../admin")).toBeNull();
    expect(getUniversityDestination(undefined)).toBeNull();
  });

  it("official-resource copy claims no partnership and matches by official domain", () => {
    for (const copy of Object.values(OFFICIAL_RESOURCE_COPY)) expect(containsUnsupportedPartnershipLanguage(copy.summary)).toBe(false);
    expect(getOfficialResourceCopy("www.Hochschulkompass.de")?.category).toBe("Institution directory");
    expect(getOfficialResourceCopy("example.org")).toBeNull();
  });
});

describe("University Discovery V3 — the single Nextwise Verified offer", () => {
  it("is Rs 1,999 from the approved catalogue, with no other plan and no Rs 199 price", () => {
    const offer = getVerifiedOffer({});
    expect(offer.planTitle).toBe("Nextwise Verified");
    expect(offer.priceLabel).toBe("₹1,999");
    expect(offer.checkoutHref).toBe(`/pricing/checkout/${VERIFIED_PLAN_SLUG}`);
    for (const file of ["src/components/sections/university-discovery/VerifiedAccessDialog.tsx", "src/components/sections/university-discovery/FreeDiscovery.tsx"]) {
      const source = read(file);
      expect(source).not.toMatch(/₹\s?199\b|Career Intelligence\s+₹/);
      expect(source).not.toMatch(/₹\s?[\d,]+/); // the price is never typed into a component
    }
  });

  it("offers purchase only while paid checkout is switched on", () => {
    expect(getVerifiedOffer({}).purchaseAvailable).toBe(false);
  });
});

describe("University Discovery V3 — Verified dialog: all eight states reflect the real account", () => {
  const offer = { planTitle: "Nextwise Verified", priceLabel: "₹1,999", checkoutHref: "/pricing/checkout/nextwise-verified", purchaseAvailable: true };
  const closedOffer = { ...offer, purchaseAvailable: false };
  const next = encodeURIComponent("/universities?destination=germany");
  const href = (state: DialogViewState, o = offer) => {
    const primary = resolveView(state, o, next).primary;
    return primary.kind === "link" ? primary.href : null;
  };

  it("1 anonymous: offer, account needed, return path preserved, no purchase link", () => {
    const view = resolveView("anonymous", offer, next);
    expect(view.showPrice).toBe(true);
    expect(href("anonymous")).toBe(`/register?next=${next}`);
    expect(view.status).toMatch(/account/i);
  });

  it("2 signed in, not Verified: checkout only when open; otherwise a disabled action and no purchase link", () => {
    expect(href("signed_in_free")).toBe("/pricing/checkout/nextwise-verified");
    const closed = resolveView("signed_in_free", closedOffer, next);
    expect(closed.primary.kind).toBe("unavailable");
    expect(closed.status).toMatch(/not open yet/i);
  });

  it("3 payment pending: says so, shows no price and never claims success", () => {
    const view = resolveView("payment_pending", offer, next);
    expect(view.showPrice).toBe(false);
    expect(view.title).toMatch(/not complete/i);
    expect(href("payment_pending")).toBe("/payments");
  });

  it("4 Verified: no payment offer again", () => {
    const view = resolveView("verified", offer, next);
    expect(view.showPrice).toBe(false);
    expect(href("verified")).toBe("/universities");
  });

  it("5 session expired: asks to log in again with the return path; offers no access", () => {
    const view = resolveView("session_expired", offer, next);
    expect(view.title).toMatch(/session has ended/i);
    expect(href("session_expired")).toBe(`/login?next=${next}`);
    expect(view.showPrice).toBe(false);
  });

  it("6 payment failed: says the payment did not go through; no access, no success wording", () => {
    const view = resolveView("payment_failed", offer, next);
    expect(view.title).toMatch(/did not go through/i);
    expect(href("payment_failed")).toBe("/payments");
    expect(`${view.title} ${view.body} ${view.status}`).not.toMatch(/you're verified|is active|unlocked/i);
  });

  it("7 network or server error: a retry, never a link into the directory or checkout", () => {
    const view = resolveView("error", offer, next);
    expect(view.primary.kind).toBe("retry");
    expect(view.title).toMatch(/couldn't check/i);
  });

  it("8 access granted by an admin: active, and states that no payment was taken", () => {
    const view = resolveView("verified_by_grant", offer, next);
    expect(href("verified_by_grant")).toBe("/universities");
    expect(view.status).toMatch(/granted by the Nextwise team/i);
    expect(view.showPrice).toBe(false);
  });

  it("only entitled states link into the directory; only an open checkout links to payment", () => {
    const all: DialogViewState[] = ["anonymous", "signed_in_free", "payment_pending", "payment_failed", "verified", "verified_by_grant", "admin", "session_expired", "error"];
    for (const state of all) {
      const entitled = state === "verified" || state === "verified_by_grant" || state === "admin";
      expect(href(state, closedOffer) === "/universities").toBe(entitled);
      expect(href(state, closedOffer) ?? "").not.toContain("/pricing/checkout");
    }
    expect(all.filter((state) => (href(state) ?? "").includes("/pricing/checkout"))).toEqual(["signed_in_free"]);
  });

  it("a session that ended while the page was open is reported as expired, not as a new visitor", () => {
    expect(reconcileAccessState("verified", "anonymous")).toBe("session_expired");
    expect(reconcileAccessState("signed_in_free", "anonymous")).toBe("session_expired");
    expect(reconcileAccessState("anonymous", "anonymous")).toBe("anonymous");
    expect(reconcileAccessState("signed_in_free", "verified_by_grant")).toBe("verified_by_grant");
    expect(reconcileAccessState("verified", "signed_in_free")).toBe("signed_in_free");
  });

  it("the dialog has no timed or hard-coded status, re-checks the account on the server and cannot wait forever", () => {
    const source = read("src/components/sections/university-discovery/VerifiedAccessDialog.tsx");
    // No timers in the component: every status comes from the server's answer. The one deadline lives in withDeadline().
    expect(source).not.toMatch(/SIGNED IN|ENTITLEMENT ACTIVE|setTimeout|setInterval/);
    expect(source).toContain("withDeadline(refreshUniversityAccessAction(), CHECK_TIMEOUT_MS)");
    expect(source).toContain("<dialog");
    expect(source).toContain("aria-labelledby");
    const action = read("src/app/(site)/universities/access-actions.ts");
    expect(action).toMatch(/export async function refreshUniversityAccessAction\(\)/); // no caller-supplied identity
    expect(action).toContain("getUniversityAccess()");
  });
});

describe("University Discovery V3 — pages decide access on the server before any query", () => {
  it("/universities returns the public experience before searchUniversities for visitors without access", () => {
    const page = read("src/app/(site)/universities/page.tsx");
    const gate = page.indexOf("if (!canUseUniversityDirectory(access))");
    expect(gate).toBeGreaterThan(-1);
    expect(gate).toBeLessThan(page.indexOf("searchUniversities({"));
  });

  it("/courses returns official portals before searchCourses for every student account", () => {
    const page = read("src/app/(site)/courses/page.tsx");
    const gate = page.indexOf("if (!canUseInternalCourseDatabase(access))");
    expect(gate).toBeGreaterThan(-1);
    expect(gate).toBeLessThan(page.indexOf("searchCourses({"));
  });

  it("student-facing course detail and comparison routes redirect before any programme lookup", () => {
    const detail = read("src/app/(site)/courses/[universitySlug]/[courseSlug]/page.tsx");
    const redirectAt = detail.indexOf('redirect("/courses?moved=course")');
    expect(redirectAt).toBeGreaterThan(-1);
    expect(redirectAt).toBeLessThan(detail.indexOf("const courseLookup ="));
    const compare = read("src/app/(site)/courses/compare/page.tsx");
    const compareRedirect = compare.indexOf('redirect("/courses?moved=compare")');
    expect(compareRedirect).toBeGreaterThan(-1);
    expect(compareRedirect).toBeLessThan(compare.indexOf("await getCoursesByIds("));
  });

  it("official portals leave through the validated /go redirect, never a raw URL", () => {
    const card = read("src/components/sections/university-discovery/OfficialResourceCard.tsx");
    expect(card).toContain("/go/course-search/");
    expect(card).not.toMatch(/href=\{result\.url\}/);
    expect(card).toContain('rel="noopener noreferrer"');
  });
});
