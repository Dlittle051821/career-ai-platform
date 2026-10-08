import { describe, expect, it } from "vitest";
import { getGraphicAriaProps } from "./accessible-graphic";

describe("getGraphicAriaProps()", () => {
  it("returns only aria-hidden for a decorative graphic — never a role or label alongside it", () => {
    const props = getGraphicAriaProps({ kind: "decorative" });
    expect(props).toEqual({ "aria-hidden": "true" });
    expect(props.role).toBeUndefined();
    expect(props["aria-label"]).toBeUndefined();
  });

  it("returns role=img and the caller's label for a meaningful graphic — never aria-hidden", () => {
    const props = getGraphicAriaProps({ kind: "meaningful", label: "Application progress: documents submitted, awaiting review" });
    expect(props).toEqual({
      role: "img",
      "aria-label": "Application progress: documents submitted, awaiting review",
    });
    expect(props["aria-hidden"]).toBeUndefined();
  });

  it("never hides a meaningful graphic, even with an empty-string label", () => {
    const props = getGraphicAriaProps({ kind: "meaningful", label: "" });
    expect(props["aria-hidden"]).toBeUndefined();
    expect(props.role).toBe("img");
  });

  it("is a pure function — the same input always produces an equal, independent output", () => {
    const input = { kind: "meaningful" as const, label: "Career direction found" };
    const a = getGraphicAriaProps(input);
    const b = getGraphicAriaProps(input);
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
  });
});
