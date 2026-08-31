import "server-only";
import { createClient } from "../server";
import { requireAdminPermission } from "../admin-auth";
import { recordAuditLog } from "./audit";
import { AdminValidationError } from "@/lib/admin/form-state";
import type { CourseAdmissionRequirement } from "@/types/education";

/** Milestone 9 — Admission requirements (new table; see supabase/migrations/0006_global_university_course_data.sql PART 7). */

function logDbError(context: string, error: unknown) {
  console.error(`[admin/education-admission-requirements] ${context}:`, error);
}

interface AdmissionRequirementRow {
  id: string;
  course_id: string;
  country_context_id: string | null;
  accepted_qualification: string;
  minimum_grade: string | null;
  minimum_gpa: number | null;
  required_subjects: string[] | null;
  language_test: string | null;
  language_test_min_score: number | null;
  standardized_test: string | null;
  standardized_test_min_score: number | null;
  work_experience_required: string | null;
  portfolio_required: boolean;
  interview_required: boolean;
  additional_documents: string[] | null;
  data_source: string | null;
  source_url: string | null;
  last_verified_at: string | null;
  created_at: string;
  updated_at: string;
}

function toAdmissionRequirement(row: AdmissionRequirementRow, countryNameById: Map<string, string>): CourseAdmissionRequirement {
  return {
    id: row.id,
    courseId: row.course_id,
    countryContextId: row.country_context_id,
    countryContextName: row.country_context_id ? (countryNameById.get(row.country_context_id) ?? null) : null,
    acceptedQualification: row.accepted_qualification,
    minimumGrade: row.minimum_grade,
    minimumGpa: row.minimum_gpa,
    requiredSubjects: row.required_subjects ?? [],
    languageTest: row.language_test,
    languageTestMinScore: row.language_test_min_score,
    standardizedTest: row.standardized_test,
    standardizedTestMinScore: row.standardized_test_min_score,
    workExperienceRequired: row.work_experience_required,
    portfolioRequired: row.portfolio_required,
    interviewRequired: row.interview_required,
    additionalDocuments: row.additional_documents ?? [],
    dataSource: row.data_source,
    sourceUrl: row.source_url,
    lastVerifiedAt: row.last_verified_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listAdmissionRequirementsForCourse(courseId: string): Promise<CourseAdmissionRequirement[]> {
  await requireAdminPermission("courses:read");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("course_admission_requirements")
    .select("*")
    .eq("course_id", courseId)
    .order("created_at", { ascending: true });
  if (error) {
    logDbError("listAdmissionRequirementsForCourse", error);
    return [];
  }
  const rows = (data ?? []) as AdmissionRequirementRow[];
  const countryIds = Array.from(new Set(rows.map((r) => r.country_context_id).filter((id): id is string => !!id)));
  const countryNameById = new Map<string, string>();
  if (countryIds.length > 0) {
    const { data: countries } = await supabase.from("countries").select("id, name").in("id", countryIds);
    for (const c of countries ?? []) countryNameById.set(c.id, c.name);
  }
  return rows.map((r) => toAdmissionRequirement(r, countryNameById));
}

export async function getAdmissionRequirementById(id: string): Promise<CourseAdmissionRequirement | null> {
  await requireAdminPermission("courses:read");
  const supabase = await createClient();
  const { data, error } = await supabase.from("course_admission_requirements").select("*").eq("id", id).maybeSingle();
  if (error) {
    logDbError("getAdmissionRequirementById", error);
    return null;
  }
  if (!data) return null;
  const row = data as AdmissionRequirementRow;
  const countryNameById = new Map<string, string>();
  if (row.country_context_id) {
    const { data: country } = await supabase.from("countries").select("id, name").eq("id", row.country_context_id).maybeSingle();
    if (country) countryNameById.set(country.id, country.name);
  }
  return toAdmissionRequirement(row, countryNameById);
}

interface AdmissionRequirementInput {
  courseId: string;
  countryContextId: string | null;
  acceptedQualification: string;
  minimumGrade: string | null;
  minimumGpa: number | null;
  requiredSubjects: string[];
  languageTest: string | null;
  languageTestMinScore: number | null;
  standardizedTest: string | null;
  standardizedTestMinScore: number | null;
  workExperienceRequired: string | null;
  portfolioRequired: boolean;
  interviewRequired: boolean;
  additionalDocuments: string[];
  dataSource: string | null;
  sourceUrl: string | null;
  lastVerifiedAt: string | null;
}

function parseListField(formData: FormData, key: string): string[] {
  const raw = String(formData.get(key) ?? "").trim();
  if (!raw) return [];
  return raw.split(/[,;]/).map((v) => v.trim()).filter(Boolean);
}

function parseScore(formData: FormData, key: string, min: number, max: number, label: string): number | null {
  const raw = String(formData.get(key) ?? "").trim();
  if (!raw) return null;
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) throw new AdminValidationError(`${label} must be a number between ${min} and ${max}.`);
  return parsed;
}

function parseAdmissionRequirementForm(formData: FormData): AdmissionRequirementInput {
  const courseId = String(formData.get("courseId") ?? "").trim();
  if (!courseId) throw new AdminValidationError("A course must be selected.");
  const acceptedQualification = String(formData.get("acceptedQualification") ?? "").trim();
  if (!acceptedQualification) throw new AdminValidationError("Accepted qualification is required.");

  return {
    courseId,
    countryContextId: String(formData.get("countryContextId") ?? "").trim() || null,
    acceptedQualification,
    minimumGrade: String(formData.get("minimumGrade") ?? "").trim() || null,
    minimumGpa: parseScore(formData, "minimumGpa", 0, 100, "Minimum GPA"),
    requiredSubjects: parseListField(formData, "requiredSubjects"),
    languageTest: String(formData.get("languageTest") ?? "").trim() || null,
    languageTestMinScore: parseScore(formData, "languageTestMinScore", 0, 990, "Language test minimum score"),
    standardizedTest: String(formData.get("standardizedTest") ?? "").trim() || null,
    standardizedTestMinScore: parseScore(formData, "standardizedTestMinScore", 0, 9999, "Standardized test minimum score"),
    workExperienceRequired: String(formData.get("workExperienceRequired") ?? "").trim() || null,
    portfolioRequired: formData.get("portfolioRequired") === "on",
    interviewRequired: formData.get("interviewRequired") === "on",
    additionalDocuments: parseListField(formData, "additionalDocuments"),
    dataSource: String(formData.get("dataSource") ?? "").trim() || null,
    sourceUrl: String(formData.get("sourceUrl") ?? "").trim() || null,
    lastVerifiedAt: String(formData.get("lastVerifiedAt") ?? "").trim() || null,
  };
}

function admissionRequirementWriteFields(input: AdmissionRequirementInput) {
  return {
    course_id: input.courseId,
    country_context_id: input.countryContextId,
    accepted_qualification: input.acceptedQualification,
    minimum_grade: input.minimumGrade,
    minimum_gpa: input.minimumGpa,
    required_subjects: input.requiredSubjects,
    language_test: input.languageTest,
    language_test_min_score: input.languageTestMinScore,
    standardized_test: input.standardizedTest,
    standardized_test_min_score: input.standardizedTestMinScore,
    work_experience_required: input.workExperienceRequired,
    portfolio_required: input.portfolioRequired,
    interview_required: input.interviewRequired,
    additional_documents: input.additionalDocuments,
    data_source: input.dataSource,
    source_url: input.sourceUrl,
    last_verified_at: input.lastVerifiedAt,
  };
}

export async function createAdmissionRequirement(formData: FormData): Promise<string> {
  await requireAdminPermission("courses:write");
  const input = parseAdmissionRequirementForm(formData);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("course_admission_requirements")
    .insert(admissionRequirementWriteFields(input))
    .select("id")
    .single();
  if (error) {
    logDbError("createAdmissionRequirement", error);
    throw new Error(error.message);
  }

  await recordAuditLog({
    action: "Created",
    entityType: "course_admission_requirement",
    entityId: data.id,
    entityLabel: `admission requirement "${input.acceptedQualification}"`,
    after: { courseId: input.courseId, acceptedQualification: input.acceptedQualification },
  });

  return data.id;
}

export async function updateAdmissionRequirement(id: string, formData: FormData): Promise<void> {
  await requireAdminPermission("courses:write");
  const input = parseAdmissionRequirementForm(formData);
  const supabase = await createClient();
  const before = await getAdmissionRequirementById(id);

  const { error } = await supabase.from("course_admission_requirements").update(admissionRequirementWriteFields(input)).eq("id", id);
  if (error) {
    logDbError("updateAdmissionRequirement", error);
    throw new Error(error.message);
  }

  await recordAuditLog({
    action: "Updated",
    entityType: "course_admission_requirement",
    entityId: id,
    entityLabel: `admission requirement "${input.acceptedQualification}"`,
    before: before ? { acceptedQualification: before.acceptedQualification } : undefined,
    after: { acceptedQualification: input.acceptedQualification },
  });
}

export async function deleteAdmissionRequirement(id: string): Promise<void> {
  await requireAdminPermission("courses:write");
  const supabase = await createClient();
  const before = await getAdmissionRequirementById(id);
  const { error } = await supabase.from("course_admission_requirements").delete().eq("id", id);
  if (error) {
    logDbError("deleteAdmissionRequirement", error);
    throw new Error(error.message);
  }
  await recordAuditLog({
    action: "Deleted",
    entityType: "course_admission_requirement",
    entityId: id,
    entityLabel: before ? `admission requirement "${before.acceptedQualification}"` : "admission requirement",
  });
}
