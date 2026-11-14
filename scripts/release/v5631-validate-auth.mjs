#!/usr/bin/env node
/**
 * V5.6.3.1 authentication hotfix: proves over HTTP, without signing in, that a deployment serves the
 * approved V5.6.3 design in public-accounts mode with the authentication pages restored.
 * Replaces v562-validate-deployment.mjs and v563-validate-release.mjs for this release (those two
 * expect public-marketing mode, where /login redirects to /book-counselling).
 *
 *   node scripts/release/v5631-validate-auth.mjs https://<deployment>.vercel.app
 *
 * Signed-in checks (student -> /studio, admin -> /admin, sign-up confirmation) are done by a person
 * with test accounts; see the release report. Deployment Protection: set
 * VERCEL_AUTOMATION_BYPASS_SECRET (sent as a header, never printed).
 * Exit codes: 0 all pass, 1 a check failed, 2 usage, 3 blocked by Deployment Protection.
 */
const base = (process.argv[2] || "").replace(/\/+$/, "");
if (!/^https?:\/\//.test(base)) {
  console.error("usage: node v5631-validate-auth.mjs <deployment URL>");
  process.exit(2);
}
const PROD_REF = "bwlkxunujngksibfzzfv";
const QA_REF = "ynwzijulzksmrcwdhudv";
const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
const headers = bypass ? { "x-vercel-protection-bypass": bypass } : {};
const results = [];
const rec = (id, ok, detail = "") => results.push({ id, ok, detail });
const get = (path) => fetch(new URL(path, base + "/"), { redirect: "manual", headers });
const loc = (r) => {
  const l = r.headers.get("location") || "";
  try { const u = new URL(l, base + "/"); return u.pathname + u.search; } catch { return l; }
};

const home = await get("/");
if (home.status === 401 || home.status === 403 || (home.status >= 300 && home.status < 400 && /vercel\.com\/(login|sso)/.test(home.headers.get("location") || ""))) {
  console.log(`BLOCKED: ${base} is behind Vercel Deployment Protection (HTTP ${home.status}). Set VERCEL_AUTOMATION_BYPASS_SECRET, or check it in a browser signed in to Vercel.`);
  process.exit(3);
}
const html = await home.text();
const mode = home.headers.get("x-nextwise-launch-mode");
rec("A1 homepage answers 200 in public-accounts mode", home.status === 200 && mode === "public-accounts", `HTTP ${home.status}, mode ${mode}`);

// Approved V5.6.3 design markers are unchanged.
rec("A2 V5.6.3 Career Intelligence, Two Pathways and opening animation present", /\bci563\b/.test(html) && /tp562/.test(html) && /\bnw54\b/.test(html));
rec("A3 official pink-arrow logo (Master Logo v2)", /\/brand\/master-v2\//.test(html) && !/\/brand\/master-v1\//.test(html));
rec("A4 header offers Log in -> /login and Sign up -> /register", /<a[^>]*href="\/login"[^>]*>\s*Log in\s*</.test(html) && /<a[^>]*href="\/register"[^>]*>\s*Sign up\s*</.test(html));

// Authentication pages are served, not redirected to booking.
for (const [p, field] of [["/login", 'id="login-email"'], ["/register", 'id="register-email"'], ["/forgot-password", 'id="forgot-email"']]) {
  const r = await get(p);
  const body = r.status === 200 ? await r.text() : "";
  rec(`A5 ${p} answers 200 with its form`, r.status === 200 && body.includes(field), `HTTP ${r.status}${r.status >= 300 && r.status < 400 ? " -> " + loc(r) : ""}`);
  if (p === "/register") rec("A6 sign-up form has no role or account-type field", !/name="(role|account_?type|accountType)"/i.test(body));
}
const book = await get("/book-counselling");
rec("A7 Book counselling answers 200 (consultation flow)", book.status === 200, `HTTP ${book.status}`);

// Private areas need a session: a visitor is sent to /login?next=..., never shown data.
for (const p of ["/studio", "/admin", "/admin/students", "/dashboard", "/counsellor", "/welcome", "/profile/onboarding"]) {
  const r = await get(p);
  rec(`A8 ${p} redirects a visitor to /login`, r.status === 307 && loc(r).startsWith(`/login?next=${encodeURIComponent(p)}`), `HTTP ${r.status} -> ${loc(r)}`);
}
const cb = await get("/auth/callback");
rec("A9 /auth/callback without a code returns to /login?authError=1", cb.status === 307 && loc(cb) === "/login?authError=1", `HTTP ${cb.status} -> ${loc(cb)}`);

// Payments stay closed.
const pricing = await get("/pricing");
const pricingHtml = pricing.status === 200 ? await pricing.text() : "";
rec("A10 pricing page has no checkout link", pricing.status === 200 && !/href="\/pricing\/checkout/.test(pricingHtml), `HTTP ${pricing.status}`);

// Supabase project: production only, never QA; no secrets in client code.
const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]).filter((s) => s.startsWith("/"));
let corpus = html;
for (const s of scripts) {
  const r = await get(s);
  if (r.ok) corpus += await r.text();
}
const refs = new Set([...corpus.matchAll(/([a-z]{20})\.supabase\.co/g)].map((m) => m[1]));
rec("A11 no QA Supabase project in shipped code", !corpus.includes(QA_REF), [...refs].join(", ") || "no Supabase URL in client code");
rec("A12 only the production Supabase project is referenced", refs.size > 0 && [...refs].every((r) => r === PROD_REF), [...refs].join(", ") || "none");
rec("A13 no secret-key patterns in client code", !/service_role|rzp_live_|sk-[A-Za-z0-9]{20}|SUPABASE_SERVICE_ROLE/.test(corpus), `${scripts.length} scripts scanned`);

let failed = 0;
for (const r of results) {
  if (!r.ok) failed++;
  console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.id}${r.detail ? `  (${r.detail})` : ""}`);
}
console.log(`\n${results.length - failed}/${results.length} passed for ${base}`);
process.exit(failed ? 1 : 0);
