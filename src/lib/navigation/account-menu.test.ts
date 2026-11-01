import { describe, expect, it } from "vitest";
import {
  ACCOUNT_MENU_FALLBACK_LABEL,
  getAccountMenuLinks,
  isKnownAccountType,
  resolveAccountMenuLabel,
} from "./account-menu";

describe("resolveAccountMenuLabel", () => {
  it("maps student profile to the Student label", () => {
    expect(resolveAccountMenuLabel("student")).toBe("Student");
  });

  it("maps admin profile to the Admin label", () => {
    expect(resolveAccountMenuLabel("admin")).toBe("Admin");
  });

  it("maps counsellor profile to the Counsellor label", () => {
    expect(resolveAccountMenuLabel("counsellor")).toBe("Counsellor");
  });

  it("falls back to the neutral Account label when the role hasn't loaded yet", () => {
    expect(resolveAccountMenuLabel(null)).toBe(ACCOUNT_MENU_FALLBACK_LABEL);
    expect(resolveAccountMenuLabel(undefined)).toBe(ACCOUNT_MENU_FALLBACK_LABEL);
  });

  it("falls back to the neutral Account label for an unrecognized account_type, never Student", () => {
    expect(resolveAccountMenuLabel("finance")).toBe(ACCOUNT_MENU_FALLBACK_LABEL);
    expect(resolveAccountMenuLabel("finance")).not.toBe("Student");
    expect(resolveAccountMenuLabel("")).toBe(ACCOUNT_MENU_FALLBACK_LABEL);
  });
});

describe("isKnownAccountType", () => {
  it("recognizes student, admin, and counsellor", () => {
    expect(isKnownAccountType("student")).toBe(true);
    expect(isKnownAccountType("admin")).toBe(true);
    expect(isKnownAccountType("counsellor")).toBe(true);
  });

  it("rejects unknown values and missing values", () => {
    expect(isKnownAccountType("super_admin")).toBe(false);
    expect(isKnownAccountType(null)).toBe(false);
    expect(isKnownAccountType(undefined)).toBe(false);
  });
});

describe("getAccountMenuLinks", () => {
  it("gives a student Dashboard and Payments, routed correctly", () => {
    const links = getAccountMenuLinks("student");
    expect(links.map((l) => l.href)).toEqual(["/dashboard", "/payments"]);
    expect(links.find((l) => l.kind === "dashboard")?.label).toBe("Dashboard");
    expect(links.find((l) => l.kind === "payments")?.label).toBe("Payments");
  });

  it("never gives a student an admin link", () => {
    const links = getAccountMenuLinks("student");
    expect(links.some((l) => l.href === "/admin")).toBe(false);
  });

  it("gives an admin the Admin Dashboard, routed to /admin", () => {
    const links = getAccountMenuLinks("admin");
    expect(links).toEqual([{ kind: "admin-dashboard", label: "Admin Dashboard", href: "/admin" }]);
  });

  it("never gives an admin the student Dashboard/Payments links", () => {
    const links = getAccountMenuLinks("admin");
    expect(links.some((l) => l.href === "/dashboard")).toBe(false);
    expect(links.some((l) => l.href === "/payments")).toBe(false);
  });

  // NW08.5 FIX — supersedes the old assertion that counsellors route to
  // /admin. That was correct when this test was written (no separate
  // counsellor route existed yet) but went stale once NW07 built a real,
  // separate, permission-gated Counsellor Studio at src/app/counsellor/**
  // — see account-menu.ts's COUNSELLOR_LINKS docblock for the full
  // explanation. This milestone's authenticated-area audit caught the
  // mismatch and fixed both the source and this pinned assertion together,
  // per this codebase's "document the supersession, never silently weaken a
  // test" convention.
  it("gives a counsellor the Counsellor Workspace link, routed to their own /counsellor studio", () => {
    const links = getAccountMenuLinks("counsellor");
    expect(links).toEqual([{ kind: "counsellor-workspace", label: "Counsellor Workspace", href: "/counsellor" }]);
  });

  it("never gives a counsellor the admin dashboard link — /admin is a different, admin-only entry point", () => {
    const links = getAccountMenuLinks("counsellor");
    expect(links.some((l) => l.href === "/admin")).toBe(false);
  });

  it("never gives a counsellor the student Dashboard/Payments links", () => {
    const links = getAccountMenuLinks("counsellor");
    expect(links.some((l) => l.href === "/dashboard")).toBe(false);
    expect(links.some((l) => l.href === "/payments")).toBe(false);
  });

  it("gives no role-specific links for an unrecognized or missing account type", () => {
    expect(getAccountMenuLinks("finance")).toEqual([]);
    expect(getAccountMenuLinks(null)).toEqual([]);
    expect(getAccountMenuLinks(undefined)).toEqual([]);
  });
});
