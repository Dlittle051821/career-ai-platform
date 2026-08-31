import "server-only";
import { createClient } from "../server";
import { requireAdminPermission } from "../admin-auth";
import { recordAuditLog } from "./audit";
import { AdminValidationError } from "@/lib/admin/form-state";
import type { CourseIntake, CourseIntakeCapacityStatus, CourseIntakeStatus } from "@/types/education";
import { COURSE_INTAKE_CAPACITY_STATUSES, COURSE_INTAKE_STATUSES } from "@/types/education";

/** Milestone 9 — Course intakes (new table; see supabase/migrations/0006_global_university_course_data.sql PART 5). Gated on the existing "courses:write"/"courses:read" permissions — an intake is a sub-record of a course. */

function logDbError(context: string, error: unknown) {
  console.error(`[admin/education-course-intakes] ${context}:`, error);
}

interface CourseIntakeRow {
  id: string;
  course_id: string;
  intake_name: string;
  start_month: number | null;
  start_year: number | null;
  applications_open_at: string | null;
  priority_deadline: string | null;
  final_deadline: string | null;
  international_deadline: string | null;
  capacity_status: string;
  intake_status: string;
  data_source: string | null;
  source_url: string | null;
  last_verified_at: string | null;
  created_at: string;
  updated_at: string;
}

function toCourseIntake(row: CourseIntakeRow): CourseIntake {
  return {
    id: row.id,
    courseId: row.course_id,
    intakeName: row.intake_name,
    startMonth: row.start_month,
    startYear: row.start_year,
    applicationsOpenAt: row.applications_open_at,
    priorityDeadline: row.priority_deadline,
    finalDeadline: row.final_deadline,
    internationalDeadline: row.international_deadline,
    capacityStatus: row.capacity_status as CourseIntakeCapacityStatus,
    intakeStatus: row.intake_status as CourseIntakeStatus,
    dataSource: row.data_source,
    sourceUrl: row.source_url,
    lastVerifiedAt: row.last_verified_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listCourseIntakesForCourse(courseId: string): Promise<CourseIntake[]> {
  await requireAdminPermission("courses:read");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("course_intakes")
    .select("*")
    .eq("course_id", courseId)
    .order("start_year", { ascending: true })
    .order("start_month", { ascending: true });
  if (error) {
    logDbError("listCourseIntakesForCourse", error);
    return [];
  }
  return (data ?? []).map(toCourseIntake);
}

export async function getCourseIntakeById(id: string): Promise<CourseIntake | null> {
  await requireAdminPermission("courses:read");
  const supabase = await createClient();
  const { data, error } = await supabase.from("course_intakes").select("*").eq("id", id).maybeSingle();
  if (error) {
    logDbError("getCourseIntakeById", error);
    return null;
  }
  return data ? toCourseIntake(data) : null;
}

interface CourseIntakeInput {
  courseId: string;
  intakeName: string;
  startMonth: number | null;
  startYear: number | null;
  applicationsOpenAt: string | null;
  priorityDeadline: string | null;
  finalDeadline: string | null;
  internationalDeadline: string | null;
  capacityStatus: CourseIntakeCapacityStatus;
  intakeStatus: CourseIntakeStatus;
  dataSource: string | null;
  sourceUrl: string | null;
  lastVerifiedAt: string | null;
}

function parseDateField(formData: FormData, key: string, label: string): string | null {
  const raw = String(formData.get(key) ?? "").trim();
  if (!raw) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new AdminValidationError(`${label} must be a valid date (YYYY-MM-DD).`);
  return raw;
}

function parseCourseIntakeForm(formData: FormData): CourseIntakeInput {
  const courseId = String(formData.get("courseId") ?? "").trim();
  if (!courseId) throw new AdminValidationError("A course must be selected.");
  const intakeName = String(formData.get("intakeName") ?? "").trim();
  if (!intakeName) throw new AdminValidationError("Intake name is required.");

  const startMonthRaw = String(formData.get("startMonth") ?? "").trim();
  let startMonth: number | null = null;
  if (startMonthRaw) {
    const parsed = Number.parseInt(startMonthRaw, 10);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 12) throw new AdminValidationError("Start month must be between 1 and 12.");
    startMonth = parsed;
  }
  const startYearRaw = String(formData.get("startYear") ?? "").trim();
  const startYear = startYearRaw ? Number.parseInt(startYearRaw, 10) : null;
  if (startYearRaw && (!Number.isInteger(startYear) || (startYear as number) < 1900)) {
    throw new AdminValidationError("Start year must be a valid year.");
  }

  const applicationsOpenAt = parseDateField(formData, "applicationsOpenAt", "Applications-open date");
  const priorityDeadline = parseDateField(formData, "priorityDeadline", "Priority deadline");
  const finalDeadline = parseDateField(formData, "finalDeadline", "Final deadline");
  const internationalDeadline = parseDateField(formData, "internationalDeadline", "International deadline");

  // Mirrors course_intakes_deadline_order_check in 0006 — checked here too
  // so a clear validation message appears before the DB constraint would
  // reject it.
  if (applicationsOpenAt && priorityDeadline && priorityDeadline < applicationsOpenAt) {
    throw new AdminValidationError("Priority deadline cannot be before the applications-open date.");
  }
  if (applicationsOpenAt && finalDeadline && finalDeadline < applicationsOpenAt) {
    throw new AdminValidationError("Final deadline cannot be before the applications-open date.");
  }
  if (priorityDeadline && finalDeadline && finalDeadline < priorityDeadline) {
    throw new AdminValidationError("Final deadline cannot be before the priority deadline.");
  }

  const capacityStatusRaw = String(formData.get("capacityStatus") ?? "unknown").trim();
  const capacityStatus = (COURSE_INTAKE_CAPACITY_STATUSES as readonly string[]).includes(capacityStatusRaw)
    ? (capacityStatusRaw as CourseIntakeCapacityStatus)
    : "unknown";
  const intakeStatusRaw = String(formData.get("intakeStatus") ?? "upcoming").trim();
  const intakeStatus = (COURSE_INTAKE_STATUSES as readonly string[]).includes(intakeStatusRaw)
    ? (intakeStatusRaw as CourseIntakeStatus)
    : "upcoming";

  return {
    courseId,
    intakeName,
    startMonth,
    startYear,
    applicationsOpenAt,
    priorityDeadline,
    finalDeadline,
    internationalDeadline,
    capacityStatus,
    intakeStatus,
    dataSource: String(formData.get("dataSource") ?? "").trim() || null,
    sourceUrl: String(formData.get("sourceUrl") ?? "").trim() || null,
    lastVerifiedAt: String(formData.get("lastVerifiedAt") ?? "").trim() || null,
  };
}

function intakeWriteFields(input: CourseIntakeInput) {
  return {
    course_id: input.courseId,
    intake_name: input.intakeName,
    start_month: input.startMonth,
    start_year: input.startYear,
    applications_open_at: input.applicationsOpenAt,
    priority_deadline: input.priorityDeadline,
    final_deadline: input.finalDeadline,
    international_deadline: input.internationalDeadline,
    capacity_status: input.capacityStatus,
    intake_status: input.intakeStatus,
    data_source: input.dataSource,
    source_url: input.sourceUrl,
    last_verified_at: input.lastVerifiedAt,
  };
}

export async function createCourseIntake(formData: FormData): Promise<string> {
  await requireAdminPermission("courses:write");
  const input = parseCourseIntakeForm(formData);
  const supabase = await createClient();

  const { data, error } = await supabase.from("course_intakes").insert(intakeWriteFields(input)).select("id").single();
  if (error) {
    logDbError("createCourseIntake", error);
    throw new Error(error.message);
  }

  await recordAuditLog({
    action: "Created",
    entityType: "course_intake",
    entityId: data.id,
    entityLabel: `intake "${input.intakeName}"`,
    after: { intakeName: input.intakeName, courseId: input.courseId, intakeStatus: input.intakeStatus },
  });

  return data.id;
}

export async function updateCourseIntake(id: string, formData: FormData): Promise<void> {
  await requireAdminPermission("courses:write");
  const input = parseCourseIntakeForm(formData);
  const supabase = await createClient();
  const before = await getCourseIntakeById(id);

  const { error } = await supabase.from("course_intakes").update(intakeWriteFields(input)).eq("id", id);
  if (error) {
    logDbError("updateCourseIntake", error);
    throw new Error(error.message);
  }

  await recordAuditLog({
    action: "Updated",
    entityType: "course_intake",
    entityId: id,
    entityLabel: `intake "${input.intakeName}"`,
    before: before ? { intakeStatus: before.intakeStatus } : undefined,
    after: { intakeStatus: input.intakeStatus },
  });
}

export async function deleteCourseIntake(id: string): Promise<void> {
  await requireAdminPermission("courses:write");
  const supabase = await createClient();
  const before = await getCourseIntakeById(id);
  const { error } = await supabase.from("course_intakes").delete().eq("id", id);
  if (error) {
    logDbError("deleteCourseIntake", error);
    throw new Error(error.message);
  }
  await recordAuditLog({
    action: "Deleted",
    entityType: "course_intake",
    entityId: id,
    entityLabel: before ? `intake "${before.intakeName}"` : "course intake",
  });
}
