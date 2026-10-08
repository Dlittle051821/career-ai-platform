import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "fs";
import { createHash } from "crypto";
import path from "path";

/**
 * UX09 — favicon/browser-tab-icon fix regression guard.
 *
 * The bug: src/app/icon.svg was a leftover, pre-rebrand placeholder (added
 * at "M1 - Website foundation complete", confirmed via `git log --oneline
 * -- src/app/icon.svg`, and never touched since) — a generic navy-square
 * compass/arrow glyph, NOT the approved Nextwise symbol. Next.js's icon
 * metadata resolves favicon.ico -> icon.png -> icon.svg -> apple-icon.png in
 * that order, and most modern browsers prefer an SVG favicon over a PNG one
 * when both are present — so this stale file was silently winning the
 * browser tab over the correct src/app/icon.png, even though icon.png
 * itself was already right. The fix is deletion only: no new artwork was
 * drawn, no logo was redrawn or approximated (the task's own absolute rule)
 * — src/app/icon.png and src/app/apple-icon.png were already byte-identical
 * to the approved compact symbol in public/brand/, confirmed below.
 *
 * This guard fails if either regresses: a future icon.svg reappearing
 * (shadowing icon.png again), or icon.png/apple-icon.png drifting from the
 * approved public/brand/ source (a redraw, a recolor, a bad export).
 */

const APP_DIR = path.join(__dirname, "..", "app");
const BRAND_DIR = path.join(__dirname, "..", "..", "public", "brand");

function sha256(filePath: string): string {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

describe("favicon / browser-tab-icon brand consistency (UX09 fix)", () => {
  it("has no src/app/icon.svg — the stale pre-rebrand placeholder that shadowed the correct icon.png must stay deleted", () => {
    expect(existsSync(path.join(APP_DIR, "icon.svg"))).toBe(false);
  });

  it("src/app/icon.png is byte-identical to the approved compact Nextwise symbol (public/brand/nextwise-icon-256.png) — never redrawn", () => {
    const iconPath = path.join(APP_DIR, "icon.png");
    const approvedPath = path.join(BRAND_DIR, "nextwise-icon-256.png");
    expect(existsSync(iconPath)).toBe(true);
    expect(existsSync(approvedPath)).toBe(true);
    expect(sha256(iconPath)).toBe(sha256(approvedPath));
  });

  it("src/app/apple-icon.png is byte-identical to the approved apple-touch-icon asset (public/brand/nextwise-apple-touch-icon.png) — never redrawn", () => {
    const appleIconPath = path.join(APP_DIR, "apple-icon.png");
    const approvedPath = path.join(BRAND_DIR, "nextwise-apple-touch-icon.png");
    expect(existsSync(appleIconPath)).toBe(true);
    expect(existsSync(approvedPath)).toBe(true);
    expect(sha256(appleIconPath)).toBe(sha256(approvedPath));
  });

  it("has a favicon.ico present (the .ico fallback Next.js resolves first, for browsers/contexts that don't use icon.png/svg at all)", () => {
    expect(existsSync(path.join(APP_DIR, "favicon.ico"))).toBe(true);
  });

  it("manifest.ts references BRAND_LOGO.icon192/icon512 (the approved compact symbol's size variants) and never a raw icon.svg path", () => {
    const manifestSource = readFileSync(path.join(APP_DIR, "manifest.ts"), "utf8");
    expect(manifestSource).toMatch(/BRAND_LOGO\.icon192/);
    expect(manifestSource).toMatch(/BRAND_LOGO\.icon512/);
    expect(manifestSource).not.toMatch(/icon\.svg/);
  });
});
