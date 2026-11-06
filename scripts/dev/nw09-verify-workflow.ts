/**
 * NW09.2 — READ-ONLY verification of the AI-assisted draft workflow in QA,
 * after the live pilot (script or the Counsellor Studio Generate button).
 *
 *   npx tsx --conditions=react-server scripts/dev/nw09-verify-workflow.ts --qa --key-from-clipboard
 *
 * Normally run through scripts\nw09\Verify-NW09Workflow.ps1.
 *
 * Checks, as the QA counsellor and then as the fictional QA student (one-time
 * magic-link sessions; no password is changed; nothing is written):
 *   - the latest AI run for the student: provider, model, status, provider
 *     response id, token counts, estimated cost, linked draft
 *   - the draft exists in the NW07 workflow (status, versions, AI-assisted)
 *   - the recorded consent the run used
 *   - database pilot totals against the 5-run / $2 caps
 *   - the STUDENT cannot see AI runs, consents or usage settings, and sees the
 *     report only once it has been approved AND released
 * QA project only (by project ref); the production ref is refused.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { config as loadEnv } from "dotenv";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import type { Database } from "../../src/types/database";
import { checkKeyFormat, ClipboardError, normaliseKey, takeKeyFromClipboard, verifyKeyWithProject } from "./supabase-key-input";
import { KNOWN_PRODUCTION_REFS, QA_PROJECT_REF, checkQaTarget, refFromSupabaseUrl } from "./qa-db/qa-project";

loadEnv({ path: ".env.local" });

const COUNSELLOR_EMAIL = "qa-counsellor@nextwise.test";
const TEST_MARKER = "nw09-qa-test-account";
const argv = process.argv.slice(2);
const args = new Set(argv);
const studentEmail = (argv.find((a) => a.startsWith("--student="))?.slice(10) ?? "qa-student@nextwise.test").toLowerCase();

type Check = { label: string; ok: boolean | null; detail: string };
const checks: Check[] = [];
const check = (label: string, ok: boolean | null, detail = "") => checks.push({ label, ok, detail });

function fail(message: string): never {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

function assertQa(): string {
  if (!args.has("--qa")) fail("Add --qa to confirm the target is the Nextwise-Development-QA project.");
  if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV) fail("Refusing: a production/Vercel environment flag is set.");
  const ref = refFromSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const t = checkQaTarget(ref);
  if (!t.ok) fail(t.reason);
  if (ref !== QA_PROJECT_REF || KNOWN_PRODUCTION_REFS.includes(ref)) fail("Refusing: not the QA project.");
  return ref;
}

async function serviceKey(ref: string): Promise<string> {
  let key: string;
  if (args.has("--key-from-clipboard")) {
    await new Promise<void>((resolve) => {
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      rl.question("Copy the QA service_role / sb_secret_ key (QA project!), then press ENTER. ", () => {
        rl.close();
        resolve();
      });
    });
    try {
      const taken = takeKeyFromClipboard();
      key = taken.key;
      console.log(taken.cleared ? "✓ Key read from the clipboard; clipboard cleared." : "! Clear the clipboard manually (and Win+V history).");
    } catch (error) {
      fail(error instanceof ClipboardError ? error.message : "Could not read the clipboard.");
    }
  } else {
    key = normaliseKey(process.env.SUPABASE_SERVICE_ROLE_KEY);
    if (!key) fail("Run with --key-from-clipboard (the key is never saved).");
  }
  const f = checkKeyFormat(key, ref);
  if (!f.ok) fail(f.reason);
  const a = await verifyKeyWithProject(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", key);
  if (!a.ok) fail(a.reason);
  return key;
}

async function findUser(admin: SupabaseClient, email: string): Promise<User | null> {
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) fail("Could not list Auth users.");
    const hit = data.users.find((u) => u.email?.toLowerCase() === email);
    if (hit) return hit;
    if (data.users.length < 200) return null;
  }
  return null;
}

async function sessionFor(admin: SupabaseClient, email: string): Promise<SupabaseClient<Database>> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const tokenHash = data?.properties?.hashed_token;
  if (error || !tokenHash) fail(`Could not open a session for ${email}.`);
  const client = createClient<Database>(url, publishable, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error: e2 } = await client.auth.verifyOtp({ type: "magiclink", token_hash: tokenHash });
  if (e2) fail(`Could not open a session for ${email}.`);
  return client;
}

async function main() {
  console.log("\nNW09.2 — read-only workflow verification (QA)\n");
  const ref = assertQa();
  if (existsSync(path.resolve("supabase/.temp/linked-project.json"))) {
    try {
      const l = JSON.parse(readFileSync(path.resolve("supabase/.temp/linked-project.json"), "utf8")) as { ref?: string };
      if (l.ref && KNOWN_PRODUCTION_REFS.includes(l.ref)) console.log("! Note: the Supabase CLI here is linked to PRODUCTION; this script does not use it.");
    } catch {
      /* ignore */
    }
  }
  const key = await serviceKey(ref);
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", key, { auth: { autoRefreshToken: false, persistSession: false } });
  const [counsellor, student] = await Promise.all([findUser(admin, COUNSELLOR_EMAIL), findUser(admin, studentEmail)]);
  if (!counsellor || (counsellor.app_metadata as Record<string, unknown> | undefined)?.test_account !== TEST_MARKER) fail(`${COUNSELLOR_EMAIL} is not a seeded QA test account.`);
  if (!student || (student.app_metadata as Record<string, unknown> | undefined)?.test_account !== TEST_MARKER) fail(`${studentEmail} is not a seeded fictional QA account.`);

  // ── As the counsellor ──
  const c = await sessionFor(admin, COUNSELLOR_EMAIL);
  const runs = await c
    .from("ai_generation_runs")
    .select("id, status, reason, provider, model, data_class, input_tokens, output_tokens, cached_input_tokens, reasoning_tokens, estimated_cost_usd, attempts, latency_ms, provider_response_id, consent_id, draft_id, created_at")
    .eq("student_user_id", student.id)
    .order("created_at", { ascending: false })
    .limit(10);
  if (runs.error) fail(`Could not read the AI ledger as the counsellor (${runs.error.code}). Are NW09 and NW09.2 applied to QA?`);
  const openaiRuns = (runs.data ?? []).filter((r) => r.provider === "openai");
  const latest = openaiRuns[0];
  check("an OpenAI run exists for the fictional student", Boolean(latest), latest ? `${latest.created_at} · ${latest.status}` : "none found — run the live test first");
  if (latest) {
    check("run status is succeeded", latest.status === "succeeded", `${latest.status}${latest.reason ? ` · ${latest.reason}` : ""}`);
    check("provider response id recorded (evidence of a real API response)", Boolean(latest.provider_response_id), latest.provider_response_id ?? "missing");
    check("token usage recorded", latest.input_tokens > 0 && latest.output_tokens > 0, `${latest.input_tokens} in · ${latest.output_tokens} out · ${latest.reasoning_tokens ?? 0} reasoning · ${latest.cached_input_tokens ?? 0} cached`);
    check("estimated cost recorded", Number(latest.estimated_cost_usd) > 0, `$${Number(latest.estimated_cost_usd).toFixed(6)} (estimate)`);
    check("model recorded", Boolean(latest.model), latest.model);
    check("data class is fictional", latest.data_class === "fictional", latest.data_class);
    check("attempts = 1 (no retry)", latest.attempts === 1, String(latest.attempts));
    check("run is linked to a recorded consent", Boolean(latest.consent_id), latest.consent_id ?? "missing");
    check("run is linked to a draft", Boolean(latest.draft_id), latest.draft_id ?? "missing");
    if (latest.draft_id) {
      const d = await c.from("recommendation_drafts").select("id, status, created_by, approved_at, released_at").eq("id", latest.draft_id).maybeSingle();
      const v = await c.from("recommendation_draft_versions").select("version_number, content").eq("draft_id", latest.draft_id).order("version_number", { ascending: false }).limit(1);
      check("draft is in the NW07 workflow", Boolean(d.data), d.data ? `status: ${d.data.status}` : `not readable (${d.error?.code ?? "none"})`);
      const content = (v.data?.[0]?.content ?? {}) as Record<string, unknown>;
      check("draft marked AI-assisted", content.aiAssisted === true, `version ${v.data?.[0]?.version_number ?? "?"}`);
      check("draft was NOT auto-published", d.data ? d.data.status !== "released_to_student" || Boolean(d.data.approved_at) : null, d.data ? `approved_at: ${d.data.approved_at ?? "—"} · released_at: ${d.data.released_at ?? "—"}` : "");
    }
  }
  const consent = await c.from("student_ai_processing_consents").select("id, method, evidence_reference, withdrawn_at").eq("student_user_id", student.id).is("withdrawn_at", null).maybeSingle();
  check("an active recorded consent exists", Boolean(consent.data), consent.data ? `${consent.data.method} · ${consent.data.evidence_reference}` : `none (${consent.error?.code ?? "no row"})`);
  const usage = await c.rpc("staff_get_ai_usage_summary");
  const u = usage.data?.[0];
  check("pilot within 5 runs / $2.00 (database)", u ? u.paid_runs_total <= 5 && Number(u.paid_cost_total_usd) <= 2 : null, u ? `${u.paid_runs_total} runs · $${Number(u.paid_cost_total_usd).toFixed(4)} · caps ${u.paid_max_runs} / $${Number(u.paid_total_budget_usd).toFixed(2)}` : `usage RPC failed (${usage.error?.code ?? "?"})`);
  check("real-student processing still OFF in the database", u ? u.real_student_processing_approved === false : null, u ? String(u.real_student_processing_approved) : "");

  // ── As the student ──
  const s = await sessionFor(admin, studentEmail);
  const [sRuns, sConsents, sSettings, sReports] = await Promise.all([
    s.from("ai_generation_runs").select("id", { count: "exact", head: true }),
    s.from("student_ai_processing_consents").select("id", { count: "exact", head: true }),
    s.from("ai_usage_settings").select("id", { count: "exact", head: true }),
    s.rpc("get_my_recommendation_reports"),
  ]);
  check("student sees 0 AI runs", (sRuns.count ?? 0) === 0, `${sRuns.count ?? 0}${sRuns.error ? ` (${sRuns.error.code})` : ""}`);
  check("student sees 0 consent records", (sConsents.count ?? 0) === 0, `${sConsents.count ?? 0}`);
  check("student sees 0 AI usage settings", (sSettings.count ?? 0) === 0, `${sSettings.count ?? 0}`);
  const visible = (sReports.data ?? []).map((r) => r.id);
  const draftVisible = latest?.draft_id ? visible.includes(latest.draft_id) : false;
  const draftRow = latest?.draft_id ? (await c.from("recommendation_drafts").select("status").eq("id", latest.draft_id).maybeSingle()).data : null;
  check("student sees the report ONLY if approved and released", latest?.draft_id ? draftVisible === (draftRow?.status === "released_to_student") : null, latest?.draft_id ? `draft status ${draftRow?.status ?? "?"} · visible to student: ${draftVisible ? "yes" : "no"}` : "no draft");

  console.log("Results:");
  for (const r of checks) console.log(`  ${r.ok === null ? "–" : r.ok ? "✓" : "✗"} ${r.label}${r.detail ? ` — ${r.detail}` : ""}`);
  const failed = checks.filter((r) => r.ok === false).length;
  console.log(`\n${failed === 0 ? "ALL CHECKS PASSED" : `${failed} CHECK(S) FAILED`} — nothing was written.\n`);
  process.exit(failed === 0 ? 0 : 2);
}

main().catch((e: unknown) => {
  console.error(`\n✗ Verification aborted: ${e instanceof Error ? e.name : "error"}\n`);
  process.exit(1);
});
