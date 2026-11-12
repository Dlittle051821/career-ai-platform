import { readFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
// @ts-expect-error -- plain ESM script without type declarations
import { buildBaseStrip, checkRightsRecord, compositionChecks, readRaw, REQUIRED_RIGHTS_FIELDS } from "./validate-v54-portrait.mjs";

/**
 * CC-26 — the V5.4 portrait replacement gate. The current portrait has no
 * documented rights; a licensed replacement must keep the approved framing
 * and must come with a completed rights record before it can go live.
 */

type Check = { id: string; ok: boolean; detail: string };
const ROOT = process.cwd();
const ref = JSON.parse(readFileSync(path.join(ROOT, "docs/home-v5-4/portrait-composition-reference.json"), "utf8"));
const current = readFileSync(path.join(ROOT, "public/home-v54/v54-portrait.png"));
const failed = (checks: Check[]) => checks.filter((c) => !c.ok).map((c) => c.id);

describe("V5.4 portrait replacement gate", () => {
  it("the approved framing passes every composition check", async () => {
    expect(failed(compositionChecks(await readRaw(current), ref))).toEqual([]);
  });

  it("a subject moved 300 px to the right is rejected (framing not preserved)", async () => {
    // sharp runs extract before extend within one pipeline, so shift in two steps.
    const padded = await sharp(current)
      .extend({ left: 300, right: 0, top: 0, bottom: 0, background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    const shifted = await sharp(padded).extract({ left: 0, top: 0, width: 1860, height: 1174 }).png().toBuffer();
    const f = failed(compositionChecks(await readRaw(shifted), ref));
    expect(f).toEqual(expect.arrayContaining(["bounds", "position", "silhouette"]));
  });

  it("a colour image is rejected (the approved portrait is black and white)", async () => {
    const tinted = await sharp(current).tint({ r: 200, g: 120, b: 60 }).png().toBuffer();
    expect(failed(compositionChecks(await readRaw(tinted), ref))).toContain("greyscale");
  });

  it("a different size is rejected", async () => {
    const small = await sharp(current).resize(930, 587).png().toBuffer();
    expect(failed(compositionChecks(await readRaw(small), ref))).toContain("size");
  });

  it("the rights gate refuses no record, the blank template and a partly filled record", () => {
    expect(checkRightsRecord(null).ok).toBe(false);
    const template = readFileSync(path.join(ROOT, "docs/cc26/templates/PORTRAIT-RIGHTS-RECORD.template.md"), "utf8");
    const blank = checkRightsRecord(template);
    expect(blank.ok).toBe(false);
    for (const field of REQUIRED_RIGHTS_FIELDS) expect(blank.detail).toContain(field);
    const partial = template.replace("<legal name of the photographer, studio or stock agency>", "Fictional Studio Ltd");
    expect(checkRightsRecord(partial).ok).toBe(false);
  });

  it("the rights gate accepts a record with every required field completed", () => {
    const filled = ["| Field | Value |", "|---|---|", ...REQUIRED_RIGHTS_FIELDS.map((f: string) => `| ${f} | fictional completed value |`)].join("\n");
    expect(checkRightsRecord(filled)).toEqual({ ok: true, detail: "all required fields completed" });
  });

  it("builds the 1860x1 base strip used under the portrait", async () => {
    const strip = await buildBaseStrip(await readRaw(current));
    const meta = await sharp(strip).metadata();
    expect([meta.width, meta.height, meta.channels]).toEqual([1860, 1, 4]);
  });
});
