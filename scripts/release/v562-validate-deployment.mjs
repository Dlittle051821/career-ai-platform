#!/usr/bin/env node
/**
 * V5.6.2 public launch: checks a deployment over HTTP, without a browser and without credentials.
 *
 *   node scripts/release/v562-validate-deployment.mjs https://<deployment>.vercel.app
 *
 * If the deployment is behind Vercel Deployment Protection, set VERCEL_AUTOMATION_BYPASS_SECRET in the
 * environment (Vercel project → Settings → Deployment Protection → Protection Bypass for Automation).
 * The secret is sent as a header only and is never printed.
 *
 * Exits 0 only if every check passes.
 */
const base = (process.argv[2] || "").replace(/\/+$/, "");
if (!/^https?:\/\//.test(base)) {
  console.error("usage: node v562-validate-deployment.mjs <deployment URL>");
  process.exit(2);
}
const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
const headers = bypass ? { "x-vercel-protection-bypass": bypass } : {};

const PUBLIC = [
  "/", "/how-it-works", "/career", "/careers", "/career-discovery", "/compare", "/universities", "/courses",
  "/courses/compare", "/abroad", "/study-europe", "/study-options", "/pricing", "/about", "/contact", "/parents",
  "/trust", "/privacy", "/terms", "/refund-policy", "/book-counselling", "/robots.txt", "/sitemap.xml",
];
const TO_BOOKING = [
  "/login", "/register", "/forgot-password", "/welcome", "/discovery-session/book", "/dashboard", "/recommendations",
  "/profile", "/saved", "/applications", "/payments", "/pay/x", "/pay/x.png", "/pricing/checkout/x", "/agreements/x", "/studio",
];
const NOT_FOUND = [
  "/admin", "/admin/students", "/admin/invoices/x/receipts/y.png", "/counsellor", "/counsellor/students",
  "/api/webhooks/razorpay", "/api/webhooks/signature", "/api/webhooks/stamp", "/auth/callback", "/homepage-preview",
];

const results = [];
const rec = (id, ok, detail) => results.push({ id, ok, detail });
const req = (path, init = {}) =>
  fetch(base + path, { redirect: "manual", ...init, headers: { ...headers, ...(init.headers || {}) } });

const probe = await req("/");
if (probe.status === 401 || probe.status === 403) {
  console.error(
    `The deployment answered ${probe.status}: it is behind Vercel Deployment Protection. ` +
      "Set VERCEL_AUTOMATION_BYPASS_SECRET and run again, or check it in a browser signed in to Vercel.",
  );
  process.exit(3);
}

if (probe.status !== 200 || probe.headers.get("x-nextwise-launch-mode") !== "public-marketing") {
  console.error(
    `FAIL: ${base}/ answered ${probe.status} with launch mode "${probe.headers.get("x-nextwise-launch-mode")}". ` +
      "This is not a Nextwise deployment running in public-marketing mode. Do not promote it.",
  );
  process.exit(4);
}

for (const p of PUBLIC) {
  const r = await req(p);
  const body = p.endsWith(".txt") || p.endsWith(".xml") ? "" : await r.text();
  const mode = r.headers.get("x-nextwise-launch-mode");
  const cookies = r.headers.getSetCookie?.() ?? [];
  rec(`public ${p}`, r.status === 200 && mode === "public-marketing" && cookies.length === 0, `${r.status}, mode ${mode}, set-cookie ${cookies.length}`);
  if (p === "/") {
    rec("homepage: unified header with Home first", /class="[^"]*\bnwh\b/.test(body) && />Home</.test(body), "nwh header + Home");
    rec("homepage: V5.6.2 Two Pathways", /tp562/.test(body) && /data-tp-path="discovery"/.test(body) && /data-tp-path="clarity"/.test(body), "tp562 discovery + clarity");
  }
  if (p === "/contact") {
    rec(
      "contact: official details",
      body.includes("mailto:founder@nextwise.com") && body.includes("mailto:co-founder@nextwise.com") && body.includes("tel:+917205720437"),
      "founder, co-founder, phone",
    );
  }
  if (["/privacy", "/terms", "/refund-policy"].includes(p)) {
    rec(`${p}: draft is labelled (or approved with an effective date)`, /Draft · under legal review|Effective \d/.test(body.replace(/&#x27;|&amp;/g, "")), "status line present");
    rec(`${p}: no placeholder wording`, !/placeholder|will be published after professional legal review/i.test(body), "");
  }
  if (p === "/pricing") rec("pricing: no checkout link", !/\/pricing\/checkout\//.test(body), "");
  if (p === "/book-counselling") rec("booking: email and phone, no account links", /mailto:founder@nextwise\.com\?subject=/.test(body) && /tel:\+917205720437/.test(body) && !/(register|login)\?next=/.test(body), "");
}
for (const p of TO_BOOKING) {
  const r = await req(p);
  const loc = r.headers.get("location") || "";
  rec(`closed ${p}`, r.status === 307 && /\/book-counselling$/.test(loc), `${r.status} -> ${loc}`);
}
for (const p of NOT_FOUND) {
  const r = await req(p);
  rec(`not served ${p}`, r.status === 404, `${r.status}`);
}
for (const [m, p, h] of [["POST", "/contact"], ["POST", "/login"], ["POST", "/api/webhooks/razorpay"], ["POST", "/", { "next-action": "0" }], ["GET", "/", { "next-action": "0" }], ["PUT", "/pricing"]]) {
  const r = await req(p, { method: m, headers: h || {}, body: m === "POST" || m === "PUT" ? "x" : undefined });
  rec(`refused ${m} ${p}${h ? " (Server Action header)" : ""}`, r.status === 405, `${r.status}`);
}

let failed = 0;
for (const r of results) {
  if (!r.ok) failed++;
  console.log(`${r.ok ? "PASS" : "FAIL"} ${r.id}${r.detail ? " — " + r.detail : ""}`);
}
console.log(`\n${results.length - failed}/${results.length} PASS  (${base})`);
process.exit(failed ? 1 : 0);
