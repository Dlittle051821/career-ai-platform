import "server-only";
import { createClient } from "../server";
import { requireAdminPermission } from "../admin-auth";
import { recordAuditLog } from "./audit";
import { AdminValidationError } from "@/lib/admin/form-state";
import { AGREEMENT_STATUS_TRANSITIONS, SIGNATURE_STATUS_TRANSITIONS, isValidTransition } from "@/lib/admin/status";
import { cleanFilterParam, clampPageSize, pageToRange, parsePageParam } from "@/lib/admin/pagination";
import type { AdminListResult, Agreement, AgreementStatus, SignatureStatus } from "@/types/admin";

/**
 * Agreement TRACKING only — no e-signature is performed here, and there is
 * no document storage beyond a reference URL field the admin types in
 * manually. `signatureStatus` reflects what an admin has honestly recorded,
 * never an automated signing event.
 */

function logDbError(context: string, error: unknown) {
  console.error(`[admin/agreements] ${context}:`, error);
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function buildStudentNameMap(supabase: Supabase, ids: (string | null)[]): Promise<Map<string, string>> {
  const uniqueIds = Array.from(new Set(ids.filter((id): id is string => id !== null)));
  if (uniqueIds.length === 0) return new Map();
  const { data, error } = await supabase.from("profiles").select("id, full_name").in("id", uniqueIds);
  if (error) {
    logDbError("buildStudentNameMap", error);
    return new Map();
  }
  return new Map((data ?? []).map((p) => [p.id, p.full_name ?? "Unnamed student"]));
}

async function buildCounsellorNameMap(supabase: Supabase, ids: (string | null)[]): Promise<Map<string, string>> {
  const uniqueIds = Array.from(new Set(ids.filter((id): id is string => id !== null)));
  if (uniqueIds.length === 0) return new Map();
  const { data, error } = await supabase.from("counsellors").select("id, display_name").in("id", uniqueIds);
  if (error) {
    logDbError("buildCounsellorNameMap", error);
    return new Map();
  }
  return new Map((data ?? []).map((c) => [c.id, c.display_name]));
}

async function buildUniversityNameMap(supabase: Supabase, ids: (string | null)[]): Promise<Map<string, string>> {
  const uniqueIds = Array.from(new Set(ids.filter((id): id is string => id !== null)));
  if (uniqueIds.length === 0) return new Map();
  const { data, error } = await supabase.from("universities").select("id, name").in("id", uniqueIds);
  if (error) {
    logDbError("buildUniversityNameMap", error);
    return new Map();
  }
  return new Map((data ?? []).map((u) => [u.id, u.name]));
}

interface AgreementRow {
  id: string;
  agreement_type: string;
  student_user_id: string | null;
  lead_id: string | null;
  counsellor_id: string | null;
  university_id: string | null;
  version: string | null;
  status: string;
  effective_date: string | null;
  expiry_date: string | null;
  document_reference_url: string | null;
  signature_status: string;
  internal_notes: string | null;
  created_at: string;
  updated_at: string;
}

function toAgreement(
  row: AgreementRow,
  studentNameById: Map<string, string>,
  counsellorNameById: Map<string, string>,
  universityNameById: Map<string, string>
): Agreement {
  return {
    id: row.id,
    agreementType: row.agreement_type,
    studentUserId: row.student_user_id,
    studentName: row.student_user_id ? (studentNameById.get(row.student_user_id) ?? null) : null,
    leadId: row.lead_id,
    counsellorId: row.counsellor_id,
    counsellorName: row.counsellor_id ? (counsellorNameById.get(row.counsellor_id) ?? null) : null,
    universityId: row.university_id,
    universityName: row.university_id ? (universityNameById.get(row.university_id) ?? null) : null,
    version: row.version,
    status: row.status as AgreementStatus,
    effectiveDate: row.effective_date,
    expiryDate: row.expiry_date,
    documentReferenceUrl: row.document_reference_url,
    signatureStatus: row.signature_status as SignatureStatus,
    internalNotes: row.internal_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface AgreementFilters {
  query?: string;
  status?: AgreementStatus;
  page?: number;
}

const PAGE_SIZE = 20;

export async function listAgreements(filters: AgreementFilters = {}): Promise<AdminListResult<Agreement>> {
  await requireAdminPermission("agreements:read");
  const supabase = await createClient();
  const page = parsePageParam(String(filters.page ?? 1));
  const pageSize = clampPageSize(PAGE_SIZE);
  const { from, to } = pageToRange(page, pageSize);

  let query = supabase.from("agreements").select("*", { count: "exact" }).order("created_at", { ascending: false });
  if (filters.status) query = query.eq("status", filters.status);
  const cleanedQuery = cleanFilterParam(filters.query);
  if (cleanedQuery) {
    const term = cleanedQuery.replace(/[,()%]/g, "");
    query = query.ilike("agreement_type", `%${term}%`);
  }

  const { data, error, count } = await query.range(from, to);
  if (error) {
    logDbError("listAgreements", error);
    return { items: [], total: 0, page, pageSize };
  }
  const rows = (data ?? []) as AgreementRow[];
  const [studentNameById, counsellorNameById, universityNameById] = await Promise.all([
    buildStudentNameMap(supabase, rows.map((r) => r.student_user_id)),
    buildCounsellorNameMap(supabase, rows.map((r) => r.counsellor_id)),
    buildUniversityNameMap(supabase, rows.map((r) => r.university_id)),
  ]);

  return {
    items: rows.map((row) => toAgreement(row, studentNameById, counsellorNameById, universityNameById)),
    total: count ?? 0,
    page,
    pageSize,
  };
}

export async function getAgreementById(id: string): Promise<Agreement | null> {
  await requireAdminPermission("agreements:read");
  const supabase = await createClient();
  const { data, error } = await supabase.from("agreements").select("*").eq("id", id).maybeSingle();
  if (error) {
    logDbError("getAgreementById", error);
    return null;
  }
  if (!data) return null;
  const row = data as AgreementRow;
  const [studentNameById, counsellorNameById, universityNameById] = await Promise.all([
    buildStudentNameMap(supabase, [row.student_user_id]),
    buildCounsellorNameMap(supabase, [row.counsellor_id]),
    buildUniversityNameMap(supabase, [row.university_id]),
  ]);
  return toAgreement(row, studentNameById, counsellorNameById, universityNameById);
}

interface AgreementInput {
  agreementType: string;
  studentUserId: string | null;
  counsellorId: string | null;
  universityId: string | null;
  version: string | null;
  effectiveDate: string | null;
  expiryDate: string | null;
  documentReferenceUrl: string | null;
  signatureStatus: SignatureStatus;
  internalNotes: string | null;
}

const SIGNATURE_STATUSES: SignatureStatus[] = ["not_started", "pending_signature", "signed"];

function parseAgreementForm(formData: FormData): AgreementInput {
  const agreementType = String(formData.get("agreementType") ?? "").trim();
  if (!agreementType) throw new AdminValidationError("Agreement type is required.");

  const studentUserId = String(formData.get("studentUserId") ?? "").trim() || null;
  const counsellorId = String(formData.get("counsellorId") ?? "").trim() || null;
  const universityId = String(formData.get("universityId") ?? "").trim() || null;
  if (!studentUserId && !counsellorId && !universityId) {
    throw new AdminValidationError("At least one party (student, counsellor, or university) must be linked to this agreement.");
  }

  const documentReferenceUrl = String(formData.get("documentReferenceUrl") ?? "").trim();
  if (documentReferenceUrl && !/^https?:\/\//i.test(documentReferenceUrl)) {
    throw new AdminValidationError("Document reference URL must start with http:// or https://.");
  }

  const signatureStatusRaw = String(formData.get("signatureStatus") ?? "not_started").trim();
  const signatureStatus = SIGNATURE_STATUSES.includes(signatureStatusRaw as SignatureStatus) ? (signatureStatusRaw as SignatureStatus) : "not_started";

  return {
    agreementType,
    studentUserId,
    counsellorId,
    universityId,
    version: String(formData.get("version") ?? "").trim() || null,
    effectiveDate: String(formData.get("effectiveDate") ?? "").trim() || null,
    expiryDate: String(formData.get("expiryDate") ?? "").trim() || null,
    documentReferenceUrl: documentReferenceUrl || null,
    signatureStatus,
    internalNotes: String(formData.get("internalNotes") ?? "").trim() || null,
  };
}

export async function createAgreement(formData: FormData): Promise<string> {
  await requireAdminPermission("agreements:write");
  const input = parseAgreementForm(formData);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("agreements")
    .insert({
      agreement_type: input.agreementType,
      student_user_id: input.studentUserId,
      lead_id: null,
      counsellor_id: input.counsellorId,
      university_id: input.universityId,
      version: input.version,
      status: "draft",
      effective_date: input.effectiveDate,
      expiry_date: input.expiryDate,
      document_reference_url: input.documentReferenceUrl,
      signature_status: input.signatureStatus,
      internal_notes: input.internalNotes,
    })
    .select("id")
    .single();

  if (error) {
    logDbError("createAgreement", error);
    throw new Error(error.message);
  }

  await recordAuditLog({
    action: "Created",
    entityType: "agreement",
    entityId: data.id,
    entityLabel: `agreement "${input.agreementType}"`,
    after: { status: "draft", signatureStatus: input.signatureStatus },
  });

  return data.id;
}

export async function updateAgreement(id: string, formData: FormData): Promise<void> {
  await requireAdminPermission("agreements:write");
  const input = parseAgreementForm(formData);
  const requestedStatusRaw = String(formData.get("status") ?? "").trim();
  const requestedSignatureRaw = String(formData.get("signatureStatus") ?? "").trim();
  const supabase = await createClient();

  const before = await getAgreementById(id);
  if (!before) throw new AdminValidationError("Agreement not found.");

  const requestedStatus = (requestedStatusRaw || before.status) as AgreementStatus;
  if (!isValidTransition(AGREEMENT_STATUS_TRANSITIONS, before.status, requestedStatus)) {
    throw new AdminValidationError(`Cannot move an agreement from "${before.status}" directly to "${requestedStatus}".`);
  }
  const requestedSignature = (requestedSignatureRaw || before.signatureStatus) as SignatureStatus;
  if (!isValidTransition(SIGNATURE_STATUS_TRANSITIONS, before.signatureStatus, requestedSignature)) {
    throw new AdminValidationError(`Cannot move signature status from "${before.signatureStatus}" directly to "${requestedSignature}".`);
  }

  const { error } = await supabase
    .from("agreements")
    .update({
      agreement_type: input.agreementType,
      student_user_id: input.studentUserId,
      counsellor_id: input.counsellorId,
      university_id: input.universityId,
      version: input.version,
      status: requestedStatus,
      effective_date: input.effectiveDate,
      expiry_date: input.expiryDate,
      document_reference_url: input.documentReferenceUrl,
      signature_status: requestedSignature,
      internal_notes: input.internalNotes,
    })
    .eq("id", id);

  if (error) {
    logDbError("updateAgreement", error);
    throw new Error(error.message);
  }

  const fieldChangeSummaries: string[] = [];
  if (before.status !== requestedStatus) fieldChangeSummaries.push(`status: ${before.status} -> ${requestedStatus}`);
  if (before.signatureStatus !== requestedSignature) fieldChangeSummaries.push(`signatureStatus: ${before.signatureStatus} -> ${requestedSignature}`);

  await recordAuditLog({
    action: "Updated",
    entityType: "agreement",
    entityId: id,
    entityLabel: `agreement "${input.agreementType}"`,
    fieldChangeSummaries,
    before: { status: before.status, signatureStatus: before.signatureStatus },
    after: { status: requestedStatus, signatureStatus: requestedSignature },
  });
}
