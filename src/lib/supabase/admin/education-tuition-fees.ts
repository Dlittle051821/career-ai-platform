import "server-only";
import { createClient } from "../server";
import { requireAdminPermission } from "../admin-auth";
import { recordAuditLog } from "./audit";
import { AdminValidationError } from "@/lib/admin/form-state";
import { isValidCurrencyCodeFormat } from "@/lib/education/normalize";
import type { CourseTuitionFee, LivingCostsPeriod, TuitionBillingPeriod, TuitionStudentCategory } from "@/types/education";
import { LIVING_COSTS_PERIODS, TUITION_BILLING_PERIODS, TUITION_STUDENT_CATEGORIES } from "@/types/education";

/**
 * Milestone 9 — Tuition and fees (new table; see
 * supabase/migrations/0006_global_university_course_data.sql PART 6).
 * Currency is NEVER converted here — every amount is stored and returned in
 * whatever `currencyCode` the record itself carries (spec requirement).
 */

function logDbError(context: string, error: unknown) {
  console.error(`[admin/education-tuition-fees] ${context}:`, error);
}

interface TuitionFeeRow {
  id: string;
  course_id: string;
  student_category: string;
  amount_minor_units: number;
  currency_code: string;
  academic_year: string;
  billing_period: string | null;
  mandatory_fees_minor_units: number;
  estimated_living_costs_minor_units: number | null;
  estimated_living_costs_period: string | null;
  data_source: string | null;
  source_url: string | null;
  last_verified_at: string | null;
  created_at: string;
  updated_at: string;
}

function toTuitionFee(row: TuitionFeeRow): CourseTuitionFee {
  return {
    id: row.id,
    courseId: row.course_id,
    studentCategory: row.student_category as TuitionStudentCategory,
    amountMinorUnits: row.amount_minor_units,
    currencyCode: row.currency_code,
    academicYear: row.academic_year,
    billingPeriod: (row.billing_period as TuitionBillingPeriod | null) ?? null,
    mandatoryFeesMinorUnits: row.mandatory_fees_minor_units,
    estimatedLivingCostsMinorUnits: row.estimated_living_costs_minor_units,
    estimatedLivingCostsPeriod: (row.estimated_living_costs_period as LivingCostsPeriod | null) ?? null,
    dataSource: row.data_source,
    sourceUrl: row.source_url,
    lastVerifiedAt: row.last_verified_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listTuitionFeesForCourse(courseId: string): Promise<CourseTuitionFee[]> {
  await requireAdminPermission("courses:read");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("course_tuition_fees")
    .select("*")
    .eq("course_id", courseId)
    .order("academic_year", { ascending: false });
  if (error) {
    logDbError("listTuitionFeesForCourse", error);
    return [];
  }
  return (data ?? []).map(toTuitionFee);
}

export async function getTuitionFeeById(id: string): Promise<CourseTuitionFee | null> {
  await requireAdminPermission("courses:read");
  const supabase = await createClient();
  const { data, error } = await supabase.from("course_tuition_fees").select("*").eq("id", id).maybeSingle();
  if (error) {
    logDbError("getTuitionFeeById", error);
    return null;
  }
  return data ? toTuitionFee(data) : null;
}

interface TuitionFeeInput {
  courseId: string;
  studentCategory: TuitionStudentCategory;
  amountMinorUnits: number;
  currencyCode: string;
  academicYear: string;
  billingPeriod: TuitionBillingPeriod | null;
  mandatoryFeesMinorUnits: number;
  estimatedLivingCostsMinorUnits: number | null;
  estimatedLivingCostsPeriod: LivingCostsPeriod | null;
  dataSource: string | null;
  sourceUrl: string | null;
  lastVerifiedAt: string | null;
}

function parseMajorUnitsToMinor(raw: string, label: string, allowNull: boolean): number | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    if (allowNull) return null;
    throw new AdminValidationError(`${label} is required.`);
  }
  const parsed = Number.parseFloat(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) throw new AdminValidationError(`${label} must be a non-negative number.`);
  return Math.round(parsed * 100);
}

function parseTuitionFeeForm(formData: FormData): TuitionFeeInput {
  const courseId = String(formData.get("courseId") ?? "").trim();
  if (!courseId) throw new AdminValidationError("A course must be selected.");

  const studentCategoryRaw = String(formData.get("studentCategory") ?? "").trim();
  if (!(TUITION_STUDENT_CATEGORIES as readonly string[]).includes(studentCategoryRaw)) {
    throw new AdminValidationError("Student category must be one of: domestic, international, eu, other.");
  }

  const currencyCode = String(formData.get("currencyCode") ?? "").trim().toUpperCase();
  if (!isValidCurrencyCodeFormat(currencyCode)) {
    throw new AdminValidationError("Currency must be a 3-letter ISO 4217 code (e.g. EUR) — the institution's own original currency, never converted.");
  }

  const academicYear = String(formData.get("academicYear") ?? "").trim();
  if (!academicYear) throw new AdminValidationError("Academic year is required (e.g. \"2026/2027\" or \"2026\").");

  const billingPeriodRaw = String(formData.get("billingPeriod") ?? "").trim();
  const billingPeriod = (TUITION_BILLING_PERIODS as readonly string[]).includes(billingPeriodRaw)
    ? (billingPeriodRaw as TuitionBillingPeriod)
    : null;
  const livingCostsPeriodRaw = String(formData.get("estimatedLivingCostsPeriod") ?? "").trim();
  const estimatedLivingCostsPeriod = (LIVING_COSTS_PERIODS as readonly string[]).includes(livingCostsPeriodRaw)
    ? (livingCostsPeriodRaw as LivingCostsPeriod)
    : null;

  return {
    courseId,
    studentCategory: studentCategoryRaw as TuitionStudentCategory,
    amountMinorUnits: parseMajorUnitsToMinor(String(formData.get("amount") ?? ""), "Tuition amount", false) as number,
    currencyCode,
    academicYear,
    billingPeriod,
    mandatoryFeesMinorUnits: parseMajorUnitsToMinor(String(formData.get("mandatoryFeesAmount") ?? ""), "Mandatory fees", true) ?? 0,
    estimatedLivingCostsMinorUnits: parseMajorUnitsToMinor(String(formData.get("estimatedLivingCostsAmount") ?? ""), "Estimated living costs", true),
    estimatedLivingCostsPeriod,
    dataSource: String(formData.get("dataSource") ?? "").trim() || null,
    sourceUrl: String(formData.get("sourceUrl") ?? "").trim() || null,
    lastVerifiedAt: String(formData.get("lastVerifiedAt") ?? "").trim() || null,
  };
}

function tuitionFeeWriteFields(input: TuitionFeeInput) {
  return {
    course_id: input.courseId,
    student_category: input.studentCategory,
    amount_minor_units: input.amountMinorUnits,
    currency_code: input.currencyCode,
    academic_year: input.academicYear,
    billing_period: input.billingPeriod,
    mandatory_fees_minor_units: input.mandatoryFeesMinorUnits,
    estimated_living_costs_minor_units: input.estimatedLivingCostsMinorUnits,
    estimated_living_costs_period: input.estimatedLivingCostsPeriod,
    data_source: input.dataSource,
    source_url: input.sourceUrl,
    last_verified_at: input.lastVerifiedAt,
  };
}

export async function createTuitionFee(formData: FormData): Promise<string> {
  await requireAdminPermission("courses:write");
  const input = parseTuitionFeeForm(formData);
  const supabase = await createClient();

  const { data, error } = await supabase.from("course_tuition_fees").insert(tuitionFeeWriteFields(input)).select("id").single();
  if (error) {
    logDbError("createTuitionFee", error);
    throw new Error(error.message);
  }

  await recordAuditLog({
    action: "Created",
    entityType: "course_tuition_fee",
    entityId: data.id,
    entityLabel: `tuition fee (${input.studentCategory}, ${input.academicYear})`,
    after: { courseId: input.courseId, studentCategory: input.studentCategory, academicYear: input.academicYear, currencyCode: input.currencyCode },
  });

  return data.id;
}

export async function updateTuitionFee(id: string, formData: FormData): Promise<void> {
  await requireAdminPermission("courses:write");
  const input = parseTuitionFeeForm(formData);
  const supabase = await createClient();
  const before = await getTuitionFeeById(id);

  const { error } = await supabase.from("course_tuition_fees").update(tuitionFeeWriteFields(input)).eq("id", id);
  if (error) {
    logDbError("updateTuitionFee", error);
    throw new Error(error.message);
  }

  await recordAuditLog({
    action: "Updated",
    entityType: "course_tuition_fee",
    entityId: id,
    entityLabel: `tuition fee (${input.studentCategory}, ${input.academicYear})`,
    before: before ? { amountMinorUnits: before.amountMinorUnits, currencyCode: before.currencyCode } : undefined,
    after: { amountMinorUnits: input.amountMinorUnits, currencyCode: input.currencyCode },
  });
}

export async function deleteTuitionFee(id: string): Promise<void> {
  await requireAdminPermission("courses:write");
  const supabase = await createClient();
  const before = await getTuitionFeeById(id);
  const { error } = await supabase.from("course_tuition_fees").delete().eq("id", id);
  if (error) {
    logDbError("deleteTuitionFee", error);
    throw new Error(error.message);
  }
  await recordAuditLog({
    action: "Deleted",
    entityType: "course_tuition_fee",
    entityId: id,
    entityLabel: before ? `tuition fee (${before.studentCategory}, ${before.academicYear})` : "tuition fee",
  });
}
