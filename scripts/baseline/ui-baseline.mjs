#!/usr/bin/env node
/**
 * NEXTWISE UI/UX BASELINE V5.6.3 — locked-file manifest.
 *
 *   node scripts/baseline/ui-baseline.mjs --check
 *       Recomputes every locked file's SHA-256 and compares it with
 *       src/config/ui-baseline/v563-manifest.json. Exit 1 on any difference.
 *
 *   node scripts/baseline/ui-baseline.mjs --write --approved-by "<name>" --reason "<owner decision>"
 *       Rewrites the manifest. Only for an OWNER-APPROVED baseline change
 *       (docs/UI-UX-DEVELOPMENT-PROTOCOL.md §6). It refuses without both flags, and it
 *       appends the change to the manifest's history instead of replacing it.
 *
 * Text files are hashed with CRLF normalised to LF, so Windows and Linux checkouts agree.
 * Binary files (images, fonts, icons) are hashed byte for byte.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const MANIFEST = path.join(ROOT, "src/config/ui-baseline/v563-manifest.json");

/** What the V5.6.3 baseline locks, by group. Directories are walked recursively; tests are excluded. */
export const LOCKED_GROUPS = {
  "brand-and-logo": [
    "public/brand",
    "docs/brand/master-v2-source",
    "src/app/favicon.ico",
    "src/app/icon.png",
    "src/app/apple-icon.png",
    "src/lib/brand/master-logo.ts",
    "src/components/brand/NextwiseBrandLogo.tsx",
    "src/components/navigation/Logo.tsx",
  ],
  "global-header-and-navigation": [
    "src/components/navigation/Header.tsx",
    "src/components/navigation/NavMenus.tsx",
    "src/components/navigation/MobileNav.tsx",
    "src/components/navigation/MobileNavGroups.tsx",
    "src/components/navigation/AccountMenu.tsx",
    "src/components/navigation/Footer.tsx",
    "src/styles/site-header.css",
    "src/lib/navigation",
  ],
  "page-hero-design-language": ["src/components/sections/PageHero.tsx", "src/styles/page-hero.css"],
  "homepage-v54-story-and-original-n": [
    "src/components/sections/home/v54",
    "src/lib/home/v54",
    "src/lib/home/v4",
    "src/components/sections/home/v4",
    "public/home-v54",
    "public/home-v4",
  ],
  "two-pathways-v562": ["src/components/sections/home/v562", "src/lib/home/v562", "public/home-v562"],
  "career-intelligence-v563": ["src/components/sections/home/v563", "src/lib/home/v563"],
  "typography-and-fonts": ["src/lib/fonts.ts"],
};

const BINARY = /\.(png|jpe?g|webp|avif|gif|ico|woff2?|ttf|otf|mp4|webm|pdf)$/i;
const SKIP = /(\.test\.[cm]?[jt]sx?$|\/__snapshots__\/|\.DS_Store$)/;

function walk(rel) {
  const abs = path.join(ROOT, rel);
  if (!existsSync(abs)) return [{ rel, missing: true }];
  if (statSync(abs).isFile()) return [{ rel }];
  return readdirSync(abs)
    .sort()
    .flatMap((n) => walk(path.posix.join(rel, n)));
}

function hashFile(rel) {
  const buf = readFileSync(path.join(ROOT, rel));
  const bytes = BINARY.test(rel) ? buf : Buffer.from(buf.toString("utf8").replace(/\r\n/g, "\n"), "utf8");
  return createHash("sha256").update(bytes).digest("hex");
}

export function currentFiles() {
  const out = {};
  for (const [group, entries] of Object.entries(LOCKED_GROUPS)) {
    for (const e of entries) {
      for (const f of walk(e)) {
        if (SKIP.test(f.rel)) continue;
        out[f.rel] = { group, sha256: f.missing ? "MISSING" : hashFile(f.rel) };
      }
    }
  }
  return out;
}

/** Brand tokens (custom properties named --brand-*, --color-*, --nw-*) declared in the global stylesheets. */
export function currentTokens() {
  const tokens = {};
  for (const rel of ["src/app/globals.css", "src/components/sections/home/v54/v54.css"]) {
    if (!existsSync(path.join(ROOT, rel))) continue;
    const css = readFileSync(path.join(ROOT, rel), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    for (const m of css.matchAll(/(--(?:brand|color|nw)-[a-z0-9-]+)\s*:\s*([^;{}]+);/gi)) {
      const key = `${rel}:${m[1]}`;
      if (!(key in tokens)) tokens[key] = m[2].trim().replace(/\s+/g, " ");
    }
  }
  return tokens;
}

export function compare(manifest) {
  const now = currentFiles();
  const problems = [];
  for (const [rel, rec] of Object.entries(manifest.files)) {
    if (!now[rel]) problems.push(`removed: ${rel}`);
    else if (now[rel].sha256 !== rec.sha256) problems.push(`changed: ${rel} (${rec.group})`);
  }
  for (const rel of Object.keys(now)) if (!manifest.files[rel]) problems.push(`added to a locked area: ${rel}`);
  const tok = currentTokens();
  for (const [k, v] of Object.entries(manifest.tokens)) {
    if (!(k in tok)) problems.push(`token removed: ${k}`);
    else if (tok[k] !== v) problems.push(`token changed: ${k} ${v} -> ${tok[k]}`);
  }
  return problems;
}

function arg(name) {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : undefined;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  if (process.argv.includes("--write")) {
    const approvedBy = arg("--approved-by");
    const reason = arg("--reason");
    if (!approvedBy || !reason) {
      console.error('Refusing: a baseline change needs --approved-by "<name>" and --reason "<owner decision>".');
      process.exit(2);
    }
    const prev = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, "utf8")) : null;
    const next = {
      baseline: "NEXTWISE UI/UX BASELINE V5.6.3",
      tag: "nextwise-ui-v563-approved",
      canonicalCommit: "893d816543f92b6538ee5037991a858d1231bcb5",
      referenceDeployment: "https://nextwise-world-58p81wrss-nextwise.vercel.app/",
      history: [...(prev?.history ?? []), { date: new Date().toISOString().slice(0, 10), approvedBy, reason }],
      files: currentFiles(),
      tokens: currentTokens(),
    };
    writeFileSync(MANIFEST, JSON.stringify(next, null, 2) + "\n");
    console.log(`Wrote ${Object.keys(next.files).length} locked files and ${Object.keys(next.tokens).length} tokens.`);
    process.exit(0);
  }
  const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
  const problems = compare(manifest);
  if (problems.length) {
    console.error(`UI/UX baseline V5.6.3: ${problems.length} locked item(s) differ from the approved baseline:`);
    for (const p of problems) console.error(`  - ${p}`);
    console.error("Restore them, or get the owner's approval and follow docs/UI-UX-DEVELOPMENT-PROTOCOL.md §6.");
    process.exit(1);
  }
  console.log(
    `UI/UX baseline V5.6.3: ${Object.keys(manifest.files).length} locked files and ${Object.keys(manifest.tokens).length} tokens match.`,
  );
}
