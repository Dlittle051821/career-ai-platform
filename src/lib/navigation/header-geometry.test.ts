import { describe, expect, it } from "vitest";
import { HEADER_GEOMETRY_SCRIPT, headerGeometry } from "./header-geometry";
import { stageModeFor } from "@/lib/home/v54/stage";

/** Runs the inline pre-paint script against a fake document and returns its geometry function. */
function scriptGeometry() {
  const props = new Map<string, string>();
  const attrs = new Map<string, string>();
  const fakeDoc = {
    documentElement: {
      clientWidth: 1440,
      style: { setProperty: (k: string, v: unknown) => props.set(k, String(v)) },
      setAttribute: (k: string, v: string) => attrs.set(k, v),
    },
  };
  const fakeWindow: Record<string, unknown> = {};
  new Function("document", "window", "innerWidth", "innerHeight", "addEventListener", HEADER_GEOMETRY_SCRIPT)(
    fakeDoc,
    fakeWindow,
    1440,
    900,
    () => {}
  );
  const g = fakeWindow.__nwhGeometry as (w: number, h: number) => { m: string; z: number; x: number; y: number; o: number };
  return { g, props, attrs };
}

const VIEWPORTS: [number, number][] = [
  [360, 640], [375, 667], [390, 664], [390, 844], [412, 915], [430, 932], [600, 900], [699, 500], [700, 500],
  [768, 1024], [820, 1180], [834, 1112], [1024, 768], [1024, 1366], [1280, 720], [1280, 800], [1366, 768],
  [1440, 700], [1440, 900], [1536, 864], [1680, 1050], [1920, 1080], [2560, 1440], [3840, 2160],
];

describe("CIUX-01B global header geometry", () => {
  it("matches the approved homepage header at 1440 × 900 (86 px bar, 40 px inset, 24 px from the top)", () => {
    expect(headerGeometry(1440, 900)).toEqual({ mode: "d", z: 1, x: 40, y: 24, offset: 110 });
  });

  it("uses the homepage stage rule for desktop vs portrait (stageModeFor)", () => {
    for (const [w, h] of VIEWPORTS) expect(headerGeometry(w, h).mode, `${w}×${h}`).toBe(stageModeFor(w, h));
  });

  it("the inline pre-paint script computes exactly what headerGeometry() computes, at every viewport", () => {
    const { g } = scriptGeometry();
    for (const [w, h] of VIEWPORTS) {
      const a = headerGeometry(w, h);
      const b = g(w, h);
      expect({ mode: b.m, z: b.z, x: b.x, y: b.y, offset: b.o }, `${w}×${h}`).toEqual(a);
    }
  });

  it("the script sets the variables the header stylesheet reads, on <html>", () => {
    const { props, attrs } = scriptGeometry();
    expect([...props.keys()].sort()).toEqual(["--nwh-offset", "--nwh-x", "--nwh-y", "--nwh-z"]);
    expect(props.get("--nwh-offset")).toBe("110px");
    expect(attrs.get("data-nwh-mode")).toBe("d");
  });

  it("keeps the header legible: zoom never below 0.62 (desktop) or 0.85 (portrait), never above 2", () => {
    for (const [w, h] of VIEWPORTS) {
      const { mode, z } = headerGeometry(w, h);
      expect(z).toBeGreaterThanOrEqual(mode === "d" ? 0.62 : 0.85);
      expect(z).toBeLessThanOrEqual(2);
    }
  });

  it("mirrors the homepage engine's own formula (src/lib/home/v54/motion.ts)", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const motion = readFileSync(resolve(import.meta.dirname, "../home/v54/motion.ts"), "utf8");
    // the constants the shared geometry depends on are still the engine's constants
    expect(motion).toContain('const W = mode === "d" ? 1440 : 390');
    expect(motion).toContain('H = mode === "d" ? 900 : 844');
    expect(motion).toContain('const z = clamp(sc, mode === "d" ? 0.62 : 0.85, 2);');
    expect(motion).toContain('const inset = mode === "d" ? 40 : 14;');
    expect(motion).toContain('(mode === "d" ? 24 : 14) * sc) / z');
  });
});
