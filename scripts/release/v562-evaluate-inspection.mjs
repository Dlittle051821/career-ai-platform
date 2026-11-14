#!/usr/bin/env node
/**
 * V5.6.2 public launch: evaluates the read-only production inspection.
 *
 *   node scripts/release/v562-evaluate-inspection.mjs prod-inspection.json prod-attestation.json
 *
 * prod-inspection.json  = the single value returned by supabase/release/v562_prod_inspection_readonly.sql
 * prod-attestation.json = the owner's answers to what SQL cannot see (template: docs/release/prod-attestation.template.json)
 *
 * Prints one line per gate (PASS / FAIL / NEEDS-ATTESTATION) and exits 0 only when every gate passes.
 * It reads two local files and contacts nothing.
 */
import { readFileSync } from "node:fs";

const PRODUCTION_REF = "bwlkxunujngksibfzzfv";

// Anonymous INSERT policies that exist by design: anonymous counters with no personal data.
const ANON_WRITE_ALLOWLIST = new Set([
  "external_search_clicks|INSERT",
  "pricing_analytics_events|INSERT",
  "product_events|INSERT",
]);

const [inspPath, attPath] = process.argv.slice(2);
if (!inspPath) {
  console.error("usage: node v562-evaluate-inspection.mjs <prod-inspection.json> [prod-attestation.json]");
  process.exit(2);
}
const strip = (t) => t.replace(/^﻿/, "").trim().replace(/^"|"$/g, "");
let insp;
try {
  const raw = strip(readFileSync(inspPath, "utf8"));
  insp = JSON.parse(raw.startsWith("{") ? raw : JSON.parse(`"${raw}"`));
} catch (e) {
  console.error(`Could not read ${inspPath} as the inspection JSON: ${e.message}`);
  process.exit(2);
}
if (insp.inspection !== "nextwise-v562-production-readonly") {
  console.error("This is not the output of v562_prod_inspection_readonly.sql.");
  process.exit(2);
}
const att = attPath ? JSON.parse(strip(readFileSync(attPath, "utf8"))) : {};

const results = [];
const gate = (id, title, status, detail) => results.push({ id, title, status, detail });

// DB-0 identity
gate(
  "DB-0",
  "Inspection ran read-only on the production project",
  att.inspected_project_ref === PRODUCTION_REF && insp.identity?.transaction_read_only !== undefined ? "PASS" : "NEEDS-ATTESTATION",
  `attested project ref: ${att.inspected_project_ref ?? "(not given)"}; inspected at ${insp.identity?.inspected_at_utc}`,
);

// DB-1 anonymous SECURITY DEFINER functions without a caller check
const anonFns = insp.anon_executable_security_definer_functions ?? [];
const unchecked = anonFns.filter((f) => !f.returns_trigger && !f.body_checks_caller).map((f) => f.function);
gate(
  "DB-1",
  "The public key cannot run internal database functions that skip a caller check (CC-25 0024)",
  unchecked.length === 0 ? "PASS" : "FAIL",
  unchecked.length ? `anon can execute: ${unchecked.join(", ")}` : `${anonFns.length} anon-executable functions, all check the caller or are triggers`,
);

// DB-2 tables without RLS
const noRls = insp.tables_without_rls_reachable_by_clients ?? [];
const anonViews = insp.views_reachable_by_anon ?? [];
gate(
  "DB-2",
  "Every client-reachable table has row-level security",
  noRls.length === 0 && anonViews.length === 0 ? "PASS" : "FAIL",
  noRls.length || anonViews.length ? `no RLS: ${noRls.join(", ") || "-"}; anon views: ${anonViews.join(", ") || "-"}` : "none without RLS",
);

// DB-3 anonymous write policies
const anonWrites = (insp.anon_policies ?? []).filter((p) => p.cmd !== "SELECT");
const unexpected = anonWrites.filter((p) => !ANON_WRITE_ALLOWLIST.has(`${p.table}|${p.cmd}`));
gate(
  "DB-3",
  "The public key can write only the three anonymous counters",
  unexpected.length === 0 ? "PASS" : "FAIL",
  unexpected.length
    ? `unexpected: ${unexpected.map((p) => `${p.table} ${p.cmd} "${p.policy}"`).join("; ")}`
    : `${anonWrites.length} anonymous write policies, all allow-listed`,
);

// DB-4 staff escalation
const priv = insp.privilege_policies ?? [];
const staffWrites = priv.filter((p) => ["admin_roles", "counsellors"].includes(p.table) && p.cmd !== "SELECT");
const weak = staffWrites.filter((p) => !p.mentions_is_admin_or_super_admin || (p.roles ?? []).some((r) => r === "anon" || r === "public"));
const guard = insp.profiles_account_type_guard ?? {};
gate(
  "DB-4",
  "Nobody but an admin can create staff access",
  weak.length === 0 && guard.signup_trigger_forces_student === true && guard.authenticated_can_update_account_type_column === false
    ? "PASS"
    : "FAIL",
  `staff write policies: ${staffWrites.length} (weak: ${weak.map((p) => `${p.table} ${p.cmd}`).join(", ") || "none"}); signup forces student: ${guard.signup_trigger_forces_student}; client can change account_type: ${guard.authenticated_can_update_account_type_column}`,
);

// DB-5 storage
const publicBuckets = (insp.storage_buckets ?? []).filter((b) => b.public).map((b) => b.bucket);
gate(
  "DB-5",
  "No public storage bucket and no anonymous storage policy",
  publicBuckets.length === 0 && (insp.storage_object_policies_for_anon ?? 0) === 0 ? "PASS" : "FAIL",
  `public buckets: ${publicBuckets.join(", ") || "none"}; anon storage policies: ${insp.storage_object_policies_for_anon}`,
);

// DB-6 NW07 / F2-F5 staff over-privilege
const m = insp.markers ?? {};
const fixed = m.cc25_0023_r2_effective === true && m.cc26_0025_applied === true;
const nw07 = m.nw07_applied ? insp.nw07?.case_access_classification : "not present";
const active = insp.counts?.counsellors_active;
let db6;
if (fixed) db6 = "PASS";
else if (att.all_active_staff_accounts_trusted === true && Number.isInteger(att.active_counsellor_accounts_reviewed) && att.active_counsellor_accounts_reviewed === active)
  db6 = "PASS";
else db6 = "NEEDS-ATTESTATION";
gate(
  "DB-6",
  "Counsellor over-privilege (F2-F5, NW07) cannot be reached by the public",
  db6,
  fixed
    ? "0023 r2 and 0025 are applied"
    : `NOT FIXED in the database (NW07: ${nw07}; 0023 r2: ${m.cc25_0023_r2_effective}; 0025: ${m.cc26_0025_applied}). ` +
        `It needs a counsellor login, and only an admin can create one (DB-4). ${active} active counsellor accounts. ` +
        `Owner must confirm every one belongs to a trusted person (attestation), and schedule 0023 r2 + 0025 after the QA cycle.`,
);

// DB-7 Auth sign-ups (dashboard setting, not visible to SQL)
gate(
  "DB-7",
  "New sign-ups are switched off in Supabase Auth (the website has no registration)",
  att.auth_allow_new_signups === false && att.auth_allow_anonymous_signins === false ? "PASS" : "NEEDS-ATTESTATION",
  `allow new users to sign up: ${att.auth_allow_new_signups ?? "(not attested)"}; anonymous sign-ins: ${att.auth_allow_anonymous_signins ?? "(not attested)"}; anonymous users in auth.users: ${insp.counts?.auth_users_anonymous}`,
);

// DB-8 backup (for any later database change)
gate(
  "DB-8",
  "A current backup exists",
  typeof att.backup_confirmed_at === "string" && att.backup_confirmed_at.length >= 10 ? "PASS" : "NEEDS-ATTESTATION",
  `backup confirmed at: ${att.backup_confirmed_at ?? "(not attested)"}`,
);

const info = {
  markers: m,
  nw07: insp.nw07,
  role_counts: insp.role_counts,
  counts: insp.counts,
  tables_with_client_truncate: insp.tables_with_client_truncate,
  migrations_recorded: insp.migrations_recorded,
};

for (const r of results) console.log(`${r.status.padEnd(17)} ${r.id}  ${r.title}\n${" ".repeat(23)}${r.detail}`);
console.log("\nFacts (counts only):\n" + JSON.stringify(info, null, 2));
const ok = results.every((r) => r.status === "PASS");
console.log(`\nDATABASE GATE: ${ok ? "PASS" : "NOT PASSED"}`);
process.exit(ok ? 0 : 1);
