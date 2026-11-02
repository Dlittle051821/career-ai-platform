import { describe, it, expect } from "vitest";
import { getHomepageImageProps } from "./responsive-image";

describe("responsive homepage images", () => {
  it("serves responsive optimized variants without changing aspect ratio or decorative alt", () => {
    const props = getHomepageImageProps("/hero/nextwise-student-cutout.png", 1086, 1448, "320px");
    expect(props.src).toMatch(/^\/_next\/image\?/);
    expect(props.srcSet).toContain("640w");
    expect(props.sizes).toBe("320px");
    expect(props.width).toBe(1086);
    expect(props.height).toBe(1448);
    expect(props.alt).toBe("");
  });
});
