import { describe, expect, it } from "vitest";
import {
  canUseInternalCourseDatabase,
  canUseUniversityDirectory,
  resolveUniversityAccess,
  UNIVERSITY_DIRECTORY_PLAN_SLUGS,
  type UniversityAccessState,
} from "./access";

const facts = (over: Partial<Parameters<typeof resolveUniversityAccess>[0]> = {}) => ({
  isSignedIn: true,
  isAdmin: false,
  qualifyingInvoiceStatuses: [] as (string | null)[],
  ...over,
});

describe("University Discovery V3 — access model", () => {
  it("a logged-out visitor is anonymous, whatever else is claimed", () => {
    expect(resolveUniversityAccess(facts({ isSignedIn: false, isAdmin: true, qualifyingInvoiceStatuses: ["paid"] }))).toBe("anonymous");
  });

  it("a signed-in student with no qualifying purchase is free", () => {
    expect(resolveUniversityAccess(facts())).toBe("signed_in_free");
  });

  it("only a PAID invoice grants verified access", () => {
    expect(resolveUniversityAccess(facts({ qualifyingInvoiceStatuses: ["paid"] }))).toBe("verified");
    expect(resolveUniversityAccess(facts({ qualifyingInvoiceStatuses: ["issued", "paid"] }))).toBe("verified");
  });

  it.each(["draft", "void", "refunded", "partially_refunded"])("a %s invoice grants nothing", (status) => {
    expect(resolveUniversityAccess(facts({ qualifyingInvoiceStatuses: [status] }))).toBe("signed_in_free");
  });

  it("a purchase without an invoice grants nothing", () => {
    expect(resolveUniversityAccess(facts({ qualifyingInvoiceStatuses: [null] }))).toBe("signed_in_free");
  });

  it.each(["issued", "partially_paid", "overdue"])("a %s invoice is reported as pending, never as verified", (status) => {
    expect(resolveUniversityAccess(facts({ qualifyingInvoiceStatuses: [status] }))).toBe("payment_pending");
  });

  it("staff are classified as admin", () => {
    expect(resolveUniversityAccess(facts({ isAdmin: true }))).toBe("admin");
  });

  it("the directory is open to verified students and staff only", () => {
    const open: UniversityAccessState[] = ["verified", "admin"];
    const all: UniversityAccessState[] = ["anonymous", "signed_in_free", "payment_pending", "verified", "admin"];
    for (const state of all) expect(canUseUniversityDirectory(state)).toBe(open.includes(state));
  });

  it("no student tier, including verified, may use the internal course database", () => {
    const all: UniversityAccessState[] = ["anonymous", "signed_in_free", "payment_pending", "verified"];
    for (const state of all) expect(canUseInternalCourseDatabase(state)).toBe(false);
    expect(canUseInternalCourseDatabase("admin")).toBe(true);
  });

  it("the qualifying plans are the Verified plan and the plan that includes it — no Rs 199 plan exists", () => {
    expect(UNIVERSITY_DIRECTORY_PLAN_SLUGS).toEqual(["nextwise-verified", "nextwise-essential"]);
  });
});
