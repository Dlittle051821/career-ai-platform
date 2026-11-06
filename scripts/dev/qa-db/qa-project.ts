/**
 * The ONE Supabase project local development and QA may write to, and the
 * projects nothing in scripts/dev may ever touch. Project refs are not
 * secrets (they appear in every public Supabase URL).
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

/** Nextwise-Development-QA (created 3 Nov 2026, empty). */
export const QA_PROJECT_REF = "ynwzijulzksmrcwdhudv";
/** Confirmed by the founder (3 Nov 2026): the live production website's database. Never writable from here. */
export const KNOWN_PRODUCTION_REFS = ["bwlkxunujngksibfzzfv"];

export function refFromSupabaseUrl(url: string | undefined): string | null {
  const m = /^https:\/\/([a-z0-9]{20})\.supabase\.co\/?$/i.exec((url ?? "").trim());
  return m ? m[1].toLowerCase() : null;
}

/** Postgres connection strings: direct (db.<ref>.supabase.co) or pooler (user postgres.<ref>). */
export function refFromDbUrl(dbUrl: string): string | null {
  let u: URL;
  try {
    u = new URL(dbUrl);
  } catch {
    return null;
  }
  if (u.protocol !== "postgresql:" && u.protocol !== "postgres:") return null;
  const host = /^db\.([a-z0-9]{20})\.supabase\.co$/i.exec(u.hostname);
  if (host) return host[1].toLowerCase();
  const user = /^postgres\.([a-z0-9]{20})$/i.exec(decodeURIComponent(u.username));
  if (user && /\.pooler\.supabase\.com$/i.test(u.hostname)) return user[1].toLowerCase();
  return null;
}

export type TargetCheck = { ok: true } | { ok: false; reason: string };

export function checkQaTarget(ref: string | null): TargetCheck {
  if (!ref) return { ok: false, reason: "Could not identify the Supabase project." };
  if (KNOWN_PRODUCTION_REFS.includes(ref)) return { ok: false, reason: `Refusing: ${ref} is the LIVE PRODUCTION database.` };
  if (ref !== QA_PROJECT_REF) return { ok: false, reason: `Refusing: ${ref} is not the Nextwise-Development-QA project (${QA_PROJECT_REF}).` };
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Installation plan — order verified by a full local rehearsal (3 Nov 2026)
// ---------------------------------------------------------------------------

export interface PlanStep {
  file: string;
  kind: "migration" | "proposed-migration" | "seed";
  why: string;
}

const M = (n: string, why = "applied history"): PlanStep => ({ file: `supabase/migrations/${n}`, kind: "migration", why });
const P = (n: string, why: string): PlanStep => ({ file: `supabase/migrations-proposed/${n}`, kind: "proposed-migration", why });
const S = (n: string, why: string): PlanStep => ({ file: `supabase/seed/${n}`, kind: "seed", why });

export const QA_PLAN: PlanStep[] = [
  M("0001_profiles.sql"),
  M("0002_student_profile.sql"),
  M("0003_career_database.sql"),
  M("0004_admin_system.sql"),
  M("0005_payments_billing.sql"),
  M("0006_global_university_course_data.sql"),
  M("0007_nextwise_pricing_offers.sql"),
  M("0008_pricing_inclusions_and_presentation.sql"),
  M("0009_trusted_course_search.sql"),
  M("0010_product_events_and_outcomes.sql"),
  M("0011_electronic_signature.sql"),
  M("0012_electronic_stamping_and_assisted_onboarding.sql"),
  M("0013_assisted_onboarding_and_recommendation_readiness.sql"),
  M("0014_discovery_session_counsellor_scope.sql"),
  M("0015_discovery_session_duplicate_booking_guard.sql"),
  M("0016_refund_operations.sql"),
  M("0017_student_application_workflow.sql"),
  M("0018_application_documents_foundation.sql"),
  M("0019_application_document_rpc_permissions.sql"),
  M("0020_application_processing_workspace.sql"),
  M("0021_application_submission_tracking.sql"),
  M("0022_authoritative_submission_invariant.sql"),
  P("NW05_student_mark_section_self_entered.sql", "app code calls student_mark_section_self_entered()"),
  P("NW06_application_tasks.sql", "app code reads/writes application_tasks"),
  P("NW07_counsellor_studio_foundation.sql", "Counsellor Studio drafts + counsellor_has_case_access(); required by NW09"),
  P("NW09_ai_career_intelligence.sql", "AI Career Intelligence ledger, limits and RPCs"),
  S("0001_careers_seed.sql", "career catalogue — required for matching and AI analysis"),
  S("0003_global_education_dev_seed.sql", "fictional universities/courses (dev only)"),
  S("0004_pricing_offers_seed.sql", "pricing history, prerequisite of later pricing seeds"),
  S("0005_pricing_inclusions_seed.sql", "pricing inclusions"),
  S("0006_trusted_course_search_seed.sql", "course search data (dev)"),
  S("0007_m12_current_pricing_catalogue_seed.sql", "current pricing catalogue"),
  S("0008_m20a_launch_country_sources_seed.sql", "launch-country sources"),
  S("0009_pr01_new_commercial_catalogue_seed.sql", "Nextwise Verified ₹1,999 etc. (prices unchanged)"),
];

/** Deliberately NOT in the plan (see the QA migration plan doc). */
export const EXCLUDED = [
  { file: "supabase/migrations-proposed/NW01_fix_purchase_pricing_plan_tax_handling.sql", why: "changes checkout tax calculation (pricing); needs its own approval" },
  { file: "supabase/seed/0002_admin_dev_seed.sql", why: "fails on a fresh database (course education_level check added by 0006); sample data only" },
];

export function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

export function readPlan(root: string, plan: PlanStep[] = QA_PLAN): (PlanStep & { sql: string; sha256: string; bytes: number })[] {
  return plan.map((step) => {
    // Normalise line endings so Windows (CRLF) and Unix checkouts hash the same.
    const sql = readFileSync(path.join(root, step.file), "utf8").replace(/\r\n/g, "\n");
    return { ...step, sql, sha256: sha256(sql), bytes: Buffer.byteLength(sql) };
  });
}

/** Short fingerprint of the exact plan (file names + content). Approval is given for this value. */
export function planFingerprint(steps: { file: string; sha256: string }[]): string {
  return sha256(steps.map((s) => `${s.file}:${s.sha256}`).join("\n")).slice(0, 12);
}
