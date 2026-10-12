import { describe, expect, it } from "vitest";
import { isAnyNavLinkActive, isNavLinkActive } from "./active-nav";

describe("isNavLinkActive", () => {
  it("matches Home only for the exact root path, never a sub-route", () => {
    expect(isNavLinkActive("/", "/")).toBe(true);
    expect(isNavLinkActive("/courses", "/")).toBe(false);
    expect(isNavLinkActive("/about", "/")).toBe(false);
  });

  it("matches a non-root link on its exact path", () => {
    expect(isNavLinkActive("/courses", "/courses")).toBe(true);
  });

  it("matches a non-root link on any of its sub-routes", () => {
    expect(isNavLinkActive("/courses/mit/computer-science-bsc", "/courses")).toBe(true);
  });

  it("does not match an unrelated route, including one that merely shares a prefix string", () => {
    expect(isNavLinkActive("/university-guide", "/universities")).toBe(false);
    expect(isNavLinkActive("/pricing", "/courses")).toBe(false);
  });

  it("returns false for a null/undefined pathname rather than throwing", () => {
    expect(isNavLinkActive(null, "/courses")).toBe(false);
    expect(isNavLinkActive(undefined, "/courses")).toBe(false);
  });
});

describe("isAnyNavLinkActive", () => {
  it("is true when the pathname matches any href in the group (Explore dropdown use case)", () => {
    const hrefs = ["/careers", "/courses", "/universities", "/study-options"];
    expect(isAnyNavLinkActive("/courses", hrefs)).toBe(true);
    expect(isAnyNavLinkActive("/universities/mit", hrefs)).toBe(true);
  });

  it("is false when the pathname matches none of the group's hrefs", () => {
    const hrefs = ["/careers", "/courses", "/universities", "/study-options"];
    expect(isAnyNavLinkActive("/pricing", hrefs)).toBe(false);
    expect(isAnyNavLinkActive("/", hrefs)).toBe(false);
  });

  it("is false for an empty group", () => {
    expect(isAnyNavLinkActive("/courses", [])).toBe(false);
  });
});
