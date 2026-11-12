// CC-26 — gate for replacing the V5.4 homepage portrait (public/home-v54/v54-portrait.png).
//
// A replacement may only go live when BOTH hold:
//   1. RIGHTS: a completed rights record (docs/home-v5-4/PORTRAIT-RIGHTS-RECORD.md, copied from
//      docs/cc26/templates/PORTRAIT-RIGHTS-RECORD.template.md) names the licensor, the licence or
//      assignment, the model release and the permitted uses, with no "<...>" placeholder left;
//   2. COMPOSITION: the candidate matches the approved V5.4 framing recorded in
//      docs/home-v5-4/portrait-composition-reference.json (size, greyscale, matte coverage,
//      subject bounds and position, occupancy grid, subject reaching the bottom edge).
//
//   node scripts/home/validate-v54-portrait.mjs <candidate.png> [--rights <record.md>] [--write-base <out.png>]
//
// --write-base builds the 1860x1 base strip (public/home-v54/v54-portrait-base.png) from rows
// 1140-1150 of the candidate: per-column median RGB, maximum alpha.
// Exit code 0 only when every check passes. This script never downloads anything.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

export const REFERENCE_PATH = "docs/home-v5-4/portrait-composition-reference.json";
export const DEFAULT_RIGHTS_PATH = "docs/home-v5-4/PORTRAIT-RIGHTS-RECORD.md";
export const REQUIRED_RIGHTS_FIELDS = [
  "Licensor / copyright owner",
  "Photographer",
  "Licence or assignment reference",
  "Licence scope",
  "Model release reference",
  "Model is 18 or over",
  "Permitted uses",
  "Editing, cropping and retouching permitted",
  "Territory and duration",
  "Approved by (Nextwise)",
];

export async function readRaw(input) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height, channels: info.channels };
}

export function checkRightsRecord(text) {
  if (!text) return { ok: false, detail: "no rights record found" };
  const missing = REQUIRED_RIGHTS_FIELDS.filter((f) => {
    const m = text.match(new RegExp(`^\\|\\s*${f.replace(/[()/.]/g, "\\$&")}\\s*\\|\\s*(.*?)\\s*\\|\\s*$`, "m"));
    return !m || !m[1] || /<[^>]*>/.test(m[1]) || /^(tbd|todo|-|n\/a)$/i.test(m[1]);
  });
  return missing.length ? { ok: false, detail: `incomplete fields: ${missing.join("; ")}` } : { ok: true, detail: "all required fields completed" };
}

export function compositionChecks(img, ref) {
  const { data, width, height, channels } = img;
  const checks = [];
  const add = (id, ok, detail) => checks.push({ id, ok, detail });
  add("size", width === ref.width && height === ref.height, `${width}x${height} (expected ${ref.width}x${ref.height})`);
  if (width !== ref.width || height !== ref.height) return checks;
  add("alpha", channels === 4, `${channels} channels`);
  let alphaAny = 0, opaque = 0, spread = 0, sx = 0, sy = 0;
  let left = width, right = -1, top = height, bottom = -1;
  const cols = ref.grid.cols, rows = ref.grid.rows;
  const cell = Array.from({ length: rows }, () => new Array(cols).fill(0));
  const cellArea = Array.from({ length: rows }, () => new Array(cols).fill(0));
  let bottomOpaque = 0, bottomTotal = 0;
  for (let y = 0; y < height; y++) {
    const gr = Math.min(rows - 1, Math.floor(y / (height / rows)));
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      const a = data[i + 3];
      const gc = Math.min(cols - 1, Math.floor(x / (width / cols)));
      cellArea[gr][gc] += 1;
      if (a > 0) alphaAny++;
      if (a > 128) {
        opaque++;
        cell[gr][gc] += 1;
        spread += Math.abs(data[i] - data[i + 1]) + Math.abs(data[i + 1] - data[i + 2]);
        sx += x; sy += y;
        if (x < left) left = x; if (x > right) right = x; if (y < top) top = y; if (y > bottom) bottom = y;
        if (y >= height - 30 && x >= ref.bbox.left && x <= ref.bbox.right) bottomOpaque++;
      }
      if (y >= height - 30 && x >= ref.bbox.left && x <= ref.bbox.right) bottomTotal++;
    }
  }
  const px = width * height;
  const opaqueCoverage = opaque / px;
  add("greyscale", opaque > 0 && spread / opaque <= 2, `mean channel spread ${(opaque ? spread / opaque : 0).toFixed(2)} (≤ 2 = black and white, as approved)`);
  add("coverage", Math.abs(opaqueCoverage - ref.opaqueCoverage) <= ref.opaqueCoverage * 0.25, `opaque coverage ${(opaqueCoverage * 100).toFixed(1)}% (approved ${(ref.opaqueCoverage * 100).toFixed(1)}% ±25%)`);
  const edges = { left, top, right, bottom };
  const worst = Math.max(...Object.keys(edges).map((k) => Math.abs(edges[k] - ref.bbox[k])));
  add("bounds", right >= 0 && worst <= 80, `subject bounds ${left},${top}–${right},${bottom} (approved ${ref.bbox.left},${ref.bbox.top}–${ref.bbox.right},${ref.bbox.bottom}; max edge shift ${worst}px ≤ 80)`);
  const cx = opaque ? sx / opaque : 0, cy = opaque ? sy / opaque : 0;
  const dc = Math.hypot(cx - ref.centroid.x, cy - ref.centroid.y);
  add("position", dc <= 60, `subject centre ${cx.toFixed(0)},${cy.toFixed(0)} (approved ${ref.centroid.x},${ref.centroid.y}; shift ${dc.toFixed(0)}px ≤ 60)`);
  let inter = 0, uni = 0;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const a = cell[r][c] / cellArea[r][c] > 0.5, b = ref.grid.cellOccupancy[r][c] > 0.5;
    if (a && b) inter++; if (a || b) uni++;
  }
  const iou = uni ? inter / uni : 0;
  add("silhouette", iou >= 0.8, `occupancy-grid overlap ${(iou * 100).toFixed(0)}% (≥ 80% of the approved silhouette)`);
  const fill = bottomOpaque / Math.max(1, bottomTotal);
  add("bottom-edge", bottomTotal > 0 && fill >= ref.bottomFill * 0.6, `subject fills ${(fill * 100).toFixed(0)}% of the bottom 30 rows under the subject (approved ${(ref.bottomFill * 100).toFixed(0)}%; ≥ ${(ref.bottomFill * 60).toFixed(0)}%: the shirt meets the frame)`);
  return checks;
}

export function buildBaseStrip(img) {
  const { data, width, channels } = img;
  const out = Buffer.alloc(width * 4);
  for (let x = 0; x < width; x++) {
    for (let ch = 0; ch < 3; ch++) {
      const vals = [];
      for (let y = 1140; y <= 1150; y++) vals.push(data[(y * width + x) * channels + ch]);
      vals.sort((p, q) => p - q);
      out[x * 4 + ch] = vals[5];
    }
    let a = 0;
    for (let y = 1140; y <= 1150; y++) a = Math.max(a, data[(y * width + x) * channels + 3]);
    out[x * 4 + 3] = a;
  }
  return sharp(out, { raw: { width, height: 1, channels: 4 } }).png().toBuffer();
}

async function main(argv) {
  const candidate = argv[0];
  if (!candidate) {
    console.error("usage: node scripts/home/validate-v54-portrait.mjs <candidate.png> [--rights <record.md>] [--write-base <out.png>]");
    return 2;
  }
  const opt = (name) => { const i = argv.indexOf(name); return i > 0 ? argv[i + 1] : null; };
  const rightsPath = opt("--rights") ?? DEFAULT_RIGHTS_PATH;
  const ref = JSON.parse(readFileSync(path.resolve(REFERENCE_PATH), "utf8"));
  const img = await readRaw(readFileSync(path.resolve(candidate)));
  const checks = compositionChecks(img, ref);
  const rights = checkRightsRecord(existsSync(rightsPath) ? readFileSync(rightsPath, "utf8") : null);
  checks.unshift({ id: "rights", ok: rights.ok, detail: `${rightsPath}: ${rights.detail}` });
  for (const c of checks) console.log(`${c.ok ? "PASS" : "FAIL"}  ${c.id.padEnd(11)} ${c.detail}`);
  const ok = checks.every((c) => c.ok);
  if (ok && opt("--write-base")) {
    writeFileSync(path.resolve(opt("--write-base")), await buildBaseStrip(img));
    console.log(`wrote base strip ${opt("--write-base")}`);
  }
  console.log(ok ? "RESULT: the candidate may replace the portrait (after design approval)." : "RESULT: NOT ACCEPTED — do not replace the portrait.");
  return ok ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then((code) => process.exit(code), (e) => { console.error(e); process.exit(2); });
}
