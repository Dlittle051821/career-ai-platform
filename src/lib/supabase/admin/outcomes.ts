import "server-only";
import { createClient } from "../server";
import { requireAdminPermission } from "../admin-auth";
import { AdminValidationError } from "@/lib/admin/form-state";
import { recordAuditLog } from "./audit";
import { OUTCOME_STAGES, type OutcomeStage, type StudentOutcome, type StudentOutcomeManualPatch } from "@/types/admin";
import type { Json } from "@/types/database";

/**
 * Milestone 9 — the manual admin/counsellor write path for student_outcomes
 * (supabase/migrations/0010_product_events_and_outcomes.sql PART 2). This
 * is deliberately NOT the primary way most of this table's rows get
 * updated — sync_student_outcome_from_application() (a database trigger on
 * `applications`) keeps journeyStage/outcomeStatus/applicationCount/
 * offerCount/finalDecisionStatus/finalApplicationId current automatically
 * the moment any of a student's applications rows change, with no
 * application-code call site required. This module exists for the fields
 * that trigger deliberately never touches (targetCareerId/targetCourseId/
 * targetUniversityId/destinationCountry/metadata — see the migration's
 * table comment) and for the pre-application journey stages
 * (not_started/exploring/shortlisted) an admin/counsellor may want to
 * record by hand before any application exists.
 *
 * Requires "students:write", the exact same permission
 * src/lib/supabase/admin/students.ts's updateStudentMeta()/addStudentNote()
 * require — today only super_admin/admin hold that permission at the
 * application layer (see src/lib/admin/permissions.ts). student_outcomes'
 * own RLS additionally allows a counsellor to write their assigned
 * students' rows directly (matching admin_student_notes' RLS exactly), but
 * — again matching admin_student_meta/admin_student_notes' own real-world
 * behavior in this codebase today — the current admin UI does not expose
 * that path to counsellor; it exists as defense-in-depth/future-proofing,
 * not as something reachable from this module until a future change grants
 * counsellor "students:write" too. See docs/OUT-001_OUTCOME_DATA_FOUNDATION.md.
 */

function logDbError(context: string, error: unknown) {
  console.error(`[admin/outcomes] ${context}:`, error);
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

function toStudentOutcome(row: {
  id: string;
  student_user_id: string;
  journey_stage: string;
  outcome_status: string;
  target_career_id: string | null;
  target_course_id: string | null;
  target_university_id: string | null;
  final_application_id: string | null;
  destination_country: string | null;
  application_count: number;
  offer_count: number;
  final_decision_status: string | null;
  outcome_source: string;
  recorded_by: string | null;
  metadata: unknown;
  recorded_at: string;
  updated_at: string;
}): StudentOutcome {
  return {
    id: row.id,
    studentUserId: row.student_user_id,
    journeyStage: row.journey_stage as OutcomeStage,
    outcomeStatus: row.outcome_status as OutcomeStage,
    targetCareerId: row.target_career_id,
    targetCourseId: row.target_course_id,
    targetUniversityId: row.target_university_id,
    finalApplicationId: row.final_application_id,
    destinationCountry: row.destination_country,
    applicationCount: row.application_count,
    offerCount: row.offer_count,
    finalDecisionStatus: row.final_decision_status,
    outcomeSource: row.outcome_source as StudentOutcome["outcomeSource"],
    recordedBy: row.recorded_by,
    metadata: (row.metadata as Record<string, unknown> | null) ?? {},
    recordedAt: row.recorded_at,
    updatedAt: row.updated_at,
  };
}

/** A single student's outcome row, or null if nothing has ever synced/been recorded for them yet (a student who has never started an application and has no manual outcome record) — treat a null result as "not_started", not as an error. */
export async function getStudentOutcome(studentUserId: string): Promise<StudentOutcome | null> {
  await requireAdminPermission("students:read");
  const supabase = await createClient();
  const { data, error } = await supabase.from("student_outcomes").select("*").eq("student_user_id", studentUserId).maybeSingle();
  if (error) {
    logDbError("getStudentOutcome", error);
    return null;
  }
  return data ? toStudentOutcome(data) : null;
}

function assertValidStage(value: string | undefined, field: string) {
  if (value !== undefined && !OUTCOME_STAGES.includes(value as OutcomeStage)) {
    throw new AdminValidationError(`Invalid ${field}.`);
  }
}

/**
 * Creates or updates the manually-controlled fields of a student's outcome
 * row. Idempotent/upsert by student_user_id (student_outcomes has a unique
 * constraint on that column) — safe to call repeatedly as an admin/
 * counsellor revises their understanding of a student's plans.
 */
export async function upsertStudentOutcome(studentUserId: string, patch: StudentOutcomeManualPatch): Promise<StudentOutcome> {
  const admin = await requireAdminPermission("students:write");
  assertValidStage(patch.journeyStage, "journeyStage");
  assertValidStage(patch.outcomeStatus, "outcomeStatus");
  if (patch.destinationCountry !== undefined && patch.destinationCountry !== null && patch.destinationCountry.length > 128) {
    throw new AdminValidationError("Destination country is too long (128 characters max).");
  }

  const supabase = await createClient();
  const { data: existing } = await supabase.from("student_outcomes").select("*").eq("student_user_id", studentUserId).maybeSingle();

  const outcomeSource: StudentOutcome["outcomeSource"] = admin.role === "counsellor" ? "counsellor" : "admin";

  const nextRow = {
    student_user_id: studentUserId,
    target_career_id: patch.targetCareerId !== undefined ? patch.targetCareerId : (existing?.target_career_id ?? null),
    target_course_id: patch.targetCourseId !== undefined ? patch.targetCourseId : (existing?.target_course_id ?? null),
    target_university_id: patch.targetUniversityId !== undefined ? patch.targetUniversityId : (existing?.target_university_id ?? null),
    destination_country: patch.destinationCountry !== undefined ? patch.destinationCountry : (existing?.destination_country ?? null),
    metadata: (patch.metadata !== undefined ? patch.metadata : (existing?.metadata ?? {})) as unknown as Json,
    journey_stage: patch.journeyStage ?? existing?.journey_stage ?? "not_started",
    outcome_status: patch.outcomeStatus ?? existing?.outcome_status ?? "unknown",
    outcome_source: outcomeSource,
    recorded_by: admin.userId,
    recorded_at: new Date().toISOString(),
    // Never set by this manual path — these are application-derived and
    // owned entirely by sync_student_outcome_from_application() (the
    // database trigger). Preserved as-is from the existing row (or left
    // at their column defaults for a brand-new row) so a manual edit here
    // can never clobber what the trigger already computed.
    final_application_id: existing?.final_application_id ?? null,
    final_decision_status: existing?.final_decision_status ?? null,
    application_count: existing?.application_count ?? 0,
    offer_count: existing?.offer_count ?? 0,
  };

  const { data, error } = await supabase.from("student_outcomes").upsert(nextRow, { onConflict: "student_user_id" }).select("*").single();
  if (error) {
    logDbError("upsertStudentOutcome", error);
    throw new Error(error.message);
  }

  await recordAuditLog({
    action: existing ? "Updated" : "Created",
    entityType: "student_outcome",
    entityId: studentUserId,
    entityLabel: `outcome for student ${studentUserId}`,
    before: existing ? { journeyStage: existing.journey_stage, outcomeStatus: existing.outcome_status } : undefined,
    after: { journeyStage: nextRow.journey_stage, outcomeStatus: nextRow.outcome_status },
    context: { actorRole: admin.role },
  });

  return toStudentOutcome(data);
}

/** Counts of student_outcomes rows grouped by outcome_status — the admin analytics dashboard's outcome-funnel view. Bounded single-column select, same pattern as src/lib/supabase/admin/analytics.ts's topLeadSources/topUniversitiesByApplicationCount. */
export async function getOutcomeStatusDistribution(): Promise<{ status: string; count: number }[]> {
  await requireAdminPermission("analytics:read");
  const supabase = await createClient();
  return outcomeStatusCounts(supabase);
}

async function outcomeStatusCounts(supabase: Supabase): Promise<{ status: string; count: number }[]> {
  const { data, error } = await supabase.from("student_outcomes").select("outcome_status");
  if (error) {
    logDbError("outcomeStatusCounts", error);
    return [];
  }
  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    counts.set(row.outcome_status, (counts.get(row.outcome_status) ?? 0) + 1);
  }
  return Array.from(counts.entries()).map(([status, count]) => ({ status, count }));
}
