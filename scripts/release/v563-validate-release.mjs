#!/usr/bin/env node
/**
 * V5.6.3 production release: proves over HTTP that a deployment is the approved V5.6.3 design, in
 * public-marketing mode, connected to the PRODUCTION Supabase project and never to QA.
 * Runs after v562-validate-deployment.mjs (public pages, redirects, 404s, 405s, legal labels).
 *
 *   node scripts/release/v563-validate-release.mjs https://<deployment>.vercel.app
 *
 * Deployment Protection: set VERCEL_AUTOMATION_BYPASS_SECRET (sent as a header, never printed).
 * Exit codes: 0 all pass, 1 a check failed, 2 usage, 3 blocked by Deployment Protection.
 */
const base = (process.argv[2] || "").replace(/\/+$/, "");
if (!/^https?:\/\//.test(base)) {
  console.error("usage: node v563-validate-release.mjs <deployment URL>");
  process.exit(2);
}
const PROD_REF = "bwlkxunujngksibfzzfv";
const QA_REF = "ynwzijulzksmrcwdhudv";
const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
const headers = bypass ? { "x-vercel-protection-bypass": bypass } : {};
const results = [];
const rec = (id, ok, detail = "") => results.push({ id, ok, detail });
const get = (path) => fetch(new URL(path, base + "/"), { redirect: "manual", headers });

const home = await get("/");
if (home.status === 401 || home.status === 403 || (home.status >= 300 && home.status < 400 && /vercel\.com\/(login|sso)/.test(home.headers.get("location") || ""))) {
  console.log(`BLOCKED: ${base} is behind Vercel Deployment Protection (HTTP ${home.status}). Set VERCEL_AUTOMATION_BYPASS_SECRET, or check it in a browser signed in to Vercel.`);
  process.exit(3);
}
const html = await home.text();
const mode = home.headers.get("x-nextwise-launch-mode");
rec("R1 homepage answers 200 in public-marketing mode", home.status === 200 && mode === "public-marketing", `HTTP ${home.status}, mode ${mode}`);

// Approved V5.6.3 design markers (server-rendered HTML)
rec("R2 Career Intelligence preview (V5.6.3) is present", /class="[^"]*\bci563\b/.test(html));
rec("R3 Robotics & Autonomous Systems Engineer card", /Robotics (&amp;|&) Autonomous Systems Engineer/.test(html));
rec("R4 Climate & Energy and Space Systems tabs", /Climate (&amp;|&) Energy Systems Engineer/.test(html) && /Space Systems Engineer/.test(html));
rec("R5 Illustrative career profile label", /Illustrative career profile/.test(html));
rec("R6 Explore Career Paths links to /careers", /<a[^>]*href="\/careers"[^>]*class="[^"]*\bci-cta\b|<a[^>]*class="[^"]*\bci-cta\b[^"]*"[^>]*href="\/careers"/.test(html) && /Explore Career Paths/.test(html));
rec("R7 official pink-arrow logo (Master Logo v2) in the header", /\/brand\/master-v2\//.test(html) && !/\/brand\/master-v1\//.test(html));
rec("R8 V5.4 opening animation and V5.6.2 Two Pathways present", /\bnw54\b/.test(html) && /tp562/.test(html));
rec("R9 unified header with Home", /class="[^"]*\bnwh\b/.test(html) && />\s*Home\s*</.test(html));

// Supabase project: production only, never QA. Scan the HTML and every first-party script it loads.
const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]).filter((s) => s.startsWith("/"));
let corpus = html;
for (const s of scripts) {
  const r = await get(s);
  if (r.ok) corpus += await r.text();
}
const refs = new Set([...corpus.matchAll(/([a-z]{20})\.supabase\.co/g)].map((m) => m[1]));
rec("R10 no QA Supabase project anywhere in the shipped code", !corpus.includes(QA_REF), [...refs].join(", ") || "no Supabase URL in client code");
rec("R11 only the production Supabase project (if any) is referenced", [...refs].every((r) => r === PROD_REF), [...refs].join(", ") || "none");
rec("R12 no secret-key patterns in client code", !/service_role|rzp_live_|sk-[A-Za-z0-9]{20}|SUPABASE_SERVICE_ROLE/.test(corpus), `${scripts.length} scripts scanned`);

// Brand assets referenced by the release exist
for (const p of ["/brand/master-v2/nextwise-master-horizontal-light.png", "/icon.png", "/favicon.ico"]) {
  const r = await get(p);
  rec(`R13 asset ${p}`, r.status === 200, `HTTP ${r.status}`);
}

let failed = 0;
for (const r of results) {
  if (!r.ok) failed++;
  console.log(`${r.ok ? "PASS" : "FAIL"} ${r.id}${r.detail ? " — " + r.detail : ""}`);
}
console.log(`\n${results.length - failed}/${results.length} PASS  (${base})`);
process.exit(failed ? 1 : 0);
