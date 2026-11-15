import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { EUROPE_COUNTRIES } from "@/data/europe-explorer";
import { getOfficialResourceCopy, getUniversityDestination, OFFICIAL_RESOURCE_COPY, UNIVERSITY_DESTINATIONS } from "./destinations";
import { getVerifiedOffer, VERIFIED_PLAN_SLUG } from "./offer";
import { resolveView } from "@/components/sections/university-discovery/VerifiedAccessDialog";
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

describe("University Discovery V3 — Verified dialog states reflect the real account", () => {
  const offer = { planTitle: "Nextwise Verified", priceLabel: "₹1,999", checkoutHref: "/pricing/checkout/nextwise-verified", purchaseAvailable: true };
  const next = encodeURIComponent("/universities?destination=germany");

  it("anonymous: offer, account needed, return path preserved", () => {
    const view = resolveView("anonymous", offer, next);
    expect(view.showPrice).toBe(true);
    expect(view.primaryLabel).toBe("Continue with Nextwise Verified");
    expect(view.primaryHref).toBe(`/register?next=${next}`);
    expect(view.status).toMatch(/account/i);
  });

  it("signed in, not Verified: existing checkout when open; no purchase link when closed", () => {
    expect(resolveView("signed_in_free", offer, next).primaryHref).toBe("/pricing/checkout/nextwise-verified");
    const closed = resolveView("signed_in_free", { ...offer, purchaseAvailable: false }, next);
    expect(closed.primaryHref).toBeNull();
    expect(closed.status).toMatch(/not open yet/i);
  });

  it("payment pending: says so, shows no price and never claims success", () => {
    const view = resolveView("payment_pending", offer, next);
    expect(view.showPrice).toBe(false);
    expect(view.title).toMatch(/not complete/i);
    expect(view.primaryHref).toBe("/payments");
  });

  it("Verified: no payment offer again", () => {
    const view = resolveView("verified", offer, next);
    expect(view.showPrice).toBe(false);
    expect(view.primaryLabel).toBe("Explore Universities");
  });

  it("the dialog never shows a status badge that is not driven by accessState", () => {
    const source = read("src/components/sections/university-discovery/VerifiedAccessDialog.tsx");
    expect(source).not.toMatch(/SIGNED IN|ENTITLEMENT ACTIVE|setTimeout|setInterval/);
    expect(source).toContain("<dialog");
    expect(source).toContain("aria-labelledby");
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
    expect(detail.indexOf('redirect("/courses")')).toBeLessThan(detail.indexOf("const courseLookup ="));
    const compare = read("src/app/(site)/courses/compare/page.tsx");
    expect(compare.indexOf('redirect("/courses")')).toBeLessThan(compare.indexOf("await getCoursesByIds("));
  });

  it("official portals leave through the validated /go redirect, never a raw URL", () => {
    const card = read("src/components/sections/university-discovery/OfficialResourceCard.tsx");
    expect(card).toContain("/go/course-search/");
    expect(card).not.toMatch(/href=\{result\.url\}/);
    expect(card).toContain('rel="noopener noreferrer"');
  });
});
