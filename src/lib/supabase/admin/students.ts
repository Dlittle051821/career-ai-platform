import "server-only";
import { createClient } from "../server";
import { requireAdminPermission } from "../admin-auth";
import { recordAuditLog } from "./audit";
import { AdminValidationError } from "@/lib/admin/form-state";
import { cleanFilterParam, clampPageSize, pageToRange, parsePageParam } from "@/lib/admin/pagination";
import type {
  AdminListResult,
  AdminStudentNote,
  AdminStudentStatus,
  AdminStudentSummary,
  Agreement,
  Application,
  Lead,
  Payment,
} from "@/types/admin";

/**
 * Student management reads from Milestone 2/3's `profiles` + `student_profiles`
 * tables (never edited here — see "no silent edits to self-reported profile"
 * in docs/admin-system-guide.md §4) plus Milestone 7's `admin_student_meta`
 * (operational status + counsellor assignment) and `admin_student_notes`
 * (append-only internal notes). A student never gets a meta row until an
 * admin first touches them — every read here treats a missing meta row as
 * status "prospect" with no assigned counsellor, matching the migration's
 * column default.
 *
 * No embedded relational selects (same `Relationships: []` constraint noted
 * throughout src/types/database.ts) — every join here is a follow-up query
 * plus an in-memory Map, never a single `.select("*, other(...)")` call.
 */

const ADMIN_STUDENT_STATUSES: AdminStudentStatus[] = ["prospect", "active", "inactive", "archived"];

function logDbError(context: string, error: unknown) {
  console.error(`[admin/students] ${context}:`, error);
}

export interface StudentFilters {
  query?: string;
  status?: AdminStudentStatus;
  page?: number;
}

const PAGE_SIZE = 20;

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function buildCounsellorNameMap(supabase: Supabase, counsellorIds: string[]): Promise<Map<string, string>> {
  const uniqueIds = Array.from(new Set(counsellorIds));
  if (uniqueIds.length === 0) return new Map();
  const { data, error } = await supabase.from("counsellors").select("id, display_name").in("id", uniqueIds);
  if (error) {
    logDbError("buildCounsellorNameMap", error);
    return new Map();
  }
  return new Map((data ?? []).map((c) => [c.id, c.display_name]));
}

export async function listStudents(filters: StudentFilters = {}): Promise<AdminListResult<AdminStudentSummary>> {
  await requireAdminPermission("students:read");
  const supabase = await createClient();
  const page = parsePageParam(String(filters.page ?? 1));
  const pageSize = clampPageSize(PAGE_SIZE);
  const { from, to } = pageToRange(page, pageSize);

  let baseQuery = supabase.from("profiles").select("id, full_name, email, phone, created_at", { count: "exact" }).eq("account_type", "student");

  const cleanedQuery = cleanFilterParam(filters.query);
  if (cleanedQuery) {
    const term = cleanedQuery.replace(/[,()%]/g, "");
    baseQuery = baseQuery.or(`full_name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`);
  }

  if (filters.status) {
    if (filters.status === "prospect") {
      // "Prospect" is both the explicit meta status AND the implicit default for
      // students with no meta row at all — so exclude everyone whose meta row
      // says something else, rather than trying to filter FOR an absence.
      const { data: nonProspect, error: nonProspectError } = await supabase
        .from("admin_student_meta")
        .select("student_user_id")
        .neq("status", "prospect");
      if (nonProspectError) {
        logDbError("listStudents:nonProspectLookup", nonProspectError);
        return { items: [], total: 0, page, pageSize };
      }
      const excludeIds = (nonProspect ?? []).map((r) => r.student_user_id);
      if (excludeIds.length > 0) {
        baseQuery = baseQuery.not("id", "in", `(${excludeIds.join(",")})`);
      }
    } else {
      const { data: matching, error: matchingError } = await supabase
        .from("admin_student_meta")
        .select("student_user_id")
        .eq("status", filters.status);
      if (matchingError) {
        logDbError("listStudents:statusLookup", matchingError);
        return { items: [], total: 0, page, pageSize };
      }
      const ids = (matching ?? []).map((r) => r.student_user_id);
      if (ids.length === 0) return { items: [], total: 0, page, pageSize };
      baseQuery = baseQuery.in("id", ids);
    }
  }

  const { data: profileRows, error, count } = await baseQuery.order("created_at", { ascending: false }).range(from, to);
  if (error) {
    logDbError("listStudents", error);
    return { items: [], total: 0, page, pageSize };
  }
  const rows = profileRows ?? [];
  const userIds = rows.map((r) => r.id);

  const [metaResult, completionResult] = await Promise.all([
    userIds.length > 0
      ? supabase.from("admin_student_meta").select("student_user_id, status, assigned_counsellor_id").in("student_user_id", userIds)
      : Promise.resolve({ data: [], error: null }),
    userIds.length > 0
      ? supabase.from("student_profiles").select("user_id, profile_completion_percent").in("user_id", userIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (metaResult.error) logDbError("listStudents:meta", metaResult.error);
  if (completionResult.error) logDbError("listStudents:completion", completionResult.error);

  const metaByUserId = new Map((metaResult.data ?? []).map((m) => [m.student_user_id, m]));
  const completionByUserId = new Map((completionResult.data ?? []).map((p) => [p.user_id, p.profile_completion_percent]));
  const counsellorNameById = await buildCounsellorNameMap(
    supabase,
    (metaResult.data ?? []).map((m) => m.assigned_counsellor_id).filter((id): id is string => id !== null)
  );

  const items: AdminStudentSummary[] = rows.map((row) => {
    const meta = metaByUserId.get(row.id);
    return {
      userId: row.id,
      fullName: row.full_name,
      email: row.email,
      phone: row.phone,
      status: (meta?.status as AdminStudentStatus | undefined) ?? "prospect",
      assignedCounsellorId: meta?.assigned_counsellor_id ?? null,
      assignedCounsellorName: meta?.assigned_counsellor_id ? (counsellorNameById.get(meta.assigned_counsellor_id) ?? null) : null,
      profileCompletionPercent: completionByUserId.get(row.id) ?? 0,
      createdAt: row.created_at,
    };
  });

  return { items, total: count ?? 0, page, pageSize };
}

export interface StudentDetail extends AdminStudentSummary {
  notes: AdminStudentNote[];
  leads: Lead[];
  applications: Application[];
  payments: Payment[];
  agreements: Agreement[];
}

export async function getStudentDetail(userId: string): Promise<StudentDetail | null> {
  await requireAdminPermission("students:read");
  const supabase = await createClient();

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, email, phone, account_type, created_at")
    .eq("id", userId)
    .maybeSingle();
  if (profileError) {
    logDbError("getStudentDetail:profile", profileError);
    return null;
  }
  if (!profile || profile.account_type !== "student") return null;

  const [metaRes, completionRes, notesRes, leadsRes, applicationsRes, paymentsRes, agreementsRes] = await Promise.all([
    supabase.from("admin_student_meta").select("status, assigned_counsellor_id").eq("student_user_id", userId).maybeSingle(),
    supabase.from("student_profiles").select("profile_completion_percent").eq("user_id", userId).maybeSingle(),
    supabase.from("admin_student_notes").select("*").eq("student_user_id", userId).order("created_at", { ascending: false }),
    supabase.from("leads").select("*").eq("converted_student_user_id", userId).order("created_at", { ascending: false }),
    supabase.from("applications").select("*").eq("student_user_id", userId).order("created_at", { ascending: false }),
    supabase.from("payments").select("*").eq("student_user_id", userId).order("created_at", { ascending: false }),
    supabase.from("agreements").select("*").eq("student_user_id", userId).order("created_at", { ascending: false }),
  ]);

  for (const [label, res] of [
    ["meta", metaRes],
    ["completion", completionRes],
    ["notes", notesRes],
    ["leads", leadsRes],
    ["applications", applicationsRes],
    ["payments", paymentsRes],
    ["agreements", agreementsRes],
  ] as const) {
    if (res.error) logDbError(`getStudentDetail:${label}`, res.error);
  }

  const meta = metaRes.data;
  const counsellorNameById = meta?.assigned_counsellor_id
    ? await buildCounsellorNameMap(supabase, [meta.assigned_counsellor_id])
    : new Map<string, string>();

  const noteAuthorIds = (notesRes.data ?? []).map((n) => n.author_user_id).filter((id): id is string => id !== null);
  let authorNameById = new Map<string, string>();
  if (noteAuthorIds.length > 0) {
    const { data: authorProfiles, error: authorError } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", Array.from(new Set(noteAuthorIds)));
    if (authorError) logDbError("getStudentDetail:authors", authorError);
    authorNameById = new Map((authorProfiles ?? []).map((a) => [a.id, a.full_name ?? "Admin"]));
  }

  // University/course names for the application list — same follow-up-query
  // pattern as src/lib/supabase/admin/courses.ts, avoiding embedded selects.
  const applicationRows = applicationsRes.data ?? [];
  const universityIds = applicationRows.map((a) => a.university_id).filter((id): id is string => id !== null);
  const courseIds = applicationRows.map((a) => a.course_id).filter((id): id is string => id !== null);
  const [universityNames, courseNames] = await Promise.all([
    universityIds.length > 0
      ? supabase.from("universities").select("id, name").in("id", Array.from(new Set(universityIds)))
      : Promise.resolve({ data: [], error: null }),
    courseIds.length > 0 ? supabase.from("courses").select("id, name").in("id", Array.from(new Set(courseIds))) : Promise.resolve({ data: [], error: null }),
  ]);
  const universityNameById = new Map((universityNames.data ?? []).map((u) => [u.id, u.name]));
  const courseNameById = new Map((courseNames.data ?? []).map((c) => [c.id, c.name]));

  return {
    userId: profile.id,
    fullName: profile.full_name,
    email: profile.email,
    phone: profile.phone,
    status: (meta?.status as AdminStudentStatus | undefined) ?? "prospect",
    assignedCounsellorId: meta?.assigned_counsellor_id ?? null,
    assignedCounsellorName: meta?.assigned_counsellor_id ? (counsellorNameById.get(meta.assigned_counsellor_id) ?? null) : null,
    profileCompletionPercent: completionRes.data?.profile_completion_percent ?? 0,
    createdAt: profile.created_at,
    notes: (notesRes.data ?? []).map((n) => ({
      id: n.id,
      studentUserId: n.student_user_id,
      authorUserId: n.author_user_id,
      authorName: n.author_user_id ? (authorNameById.get(n.author_user_id) ?? "Admin") : null,
      note: n.note,
      createdAt: n.created_at,
    })),
    leads: (leadsRes.data ?? []).map((l) => ({
      id: l.id,
      fullName: l.full_name,
      email: l.email,
      phone: l.phone,
      source: l.source,
      campaign: l.campaign,
      stage: l.stage as Lead["stage"],
      priority: l.priority as Lead["priority"],
      assignedCounsellorId: l.assigned_counsellor_id,
      assignedCounsellorName: null,
      nextFollowUpDate: l.next_follow_up_date,
      lastContactDate: l.last_contact_date,
      consentMarketing: l.consent_marketing,
      notes: l.notes,
      convertedStudentUserId: l.converted_student_user_id,
      utmSource: l.utm_source,
      utmMedium: l.utm_medium,
      utmCampaign: l.utm_campaign,
      landingPage: l.landing_page,
      createdAt: l.created_at,
      updatedAt: l.updated_at,
    })),
    applications: applicationRows.map((a) => ({
      id: a.id,
      studentUserId: a.student_user_id,
      studentName: profile.full_name,
      universityId: a.university_id,
      universityName: a.university_id ? (universityNameById.get(a.university_id) ?? null) : null,
      courseId: a.course_id,
      courseName: a.course_id ? (courseNameById.get(a.course_id) ?? null) : null,
      assignedCounsellorId: a.assigned_counsellor_id,
      assignedCounsellorName: null,
      stage: a.stage as Application["stage"],
      intake: a.intake,
      submissionDate: a.submission_date,
      decisionStatus: a.decision_status as Application["decisionStatus"],
      offerType: a.offer_type,
      deadlines: Array.isArray(a.deadlines) ? (a.deadlines as unknown as Application["deadlines"]) : [],
      nextAction: a.next_action,
      nextActionDate: a.next_action_date,
      lastContactDate: a.last_contact_date,
      internalNotes: a.internal_notes,
      createdAt: a.created_at,
      updatedAt: a.updated_at,
    })),
    payments: (paymentsRes.data ?? []).map((p) => ({
      id: p.id,
      studentUserId: p.student_user_id,
      studentName: profile.full_name,
      applicationId: p.application_id,
      invoiceReference: p.invoice_reference,
      amountMinorUnits: p.amount_minor_units,
      currency: p.currency,
      paymentType: p.payment_type,
      paymentMethodLabel: p.payment_method_label,
      status: p.status as Payment["status"],
      dueDate: p.due_date,
      paidDate: p.paid_date,
      externalTransactionReference: p.external_transaction_reference,
      refundStatus: p.refund_status as Payment["refundStatus"],
      refundAmountMinorUnits: p.refund_amount_minor_units,
      internalNotes: p.internal_notes,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    })),
    agreements: (agreementsRes.data ?? []).map((ag) => ({
      id: ag.id,
      agreementType: ag.agreement_type,
      studentUserId: ag.student_user_id,
      studentName: profile.full_name,
      leadId: ag.lead_id,
      counsellorId: ag.counsellor_id,
      counsellorName: null,
      universityId: ag.university_id,
      universityName: null,
      version: ag.version,
      status: ag.status as Agreement["status"],
      effectiveDate: ag.effective_date,
      expiryDate: ag.expiry_date,
      documentReferenceUrl: ag.document_reference_url,
      signatureStatus: ag.signature_status as Agreement["signatureStatus"],
      stampSignSequence: ag.stamp_sign_sequence as Agreement["stampSignSequence"],
      stampStatus: ag.stamp_status as Agreement["stampStatus"],
      internalNotes: ag.internal_notes,
      createdAt: ag.created_at,
      updatedAt: ag.updated_at,
    })),
  };
}

/** Upserts the admin_student_meta row — this is the ONLY function that may change a student's operational status or counsellor assignment. Never touches profiles/student_profiles. */
export async function updateStudentMeta(
  studentUserId: string,
  input: { status?: AdminStudentStatus; assignedCounsellorId?: string | null }
): Promise<void> {
  const admin = await requireAdminPermission("students:write");
  const supabase = await createClient();

  if (input.status && !ADMIN_STUDENT_STATUSES.includes(input.status)) {
    throw new AdminValidationError("Invalid student status.");
  }

  const { data: existing } = await supabase.from("admin_student_meta").select("status, assigned_counsellor_id").eq("student_user_id", studentUserId).maybeSingle();

  const nextStatus = input.status ?? existing?.status ?? "prospect";
  const nextCounsellorId = input.assignedCounsellorId !== undefined ? input.assignedCounsellorId : (existing?.assigned_counsellor_id ?? null);

  const { error } = await supabase.from("admin_student_meta").upsert(
    { student_user_id: studentUserId, status: nextStatus, assigned_counsellor_id: nextCounsellorId },
    { onConflict: "student_user_id" }
  );
  if (error) {
    logDbError("updateStudentMeta", error);
    throw new Error(error.message);
  }

  const fieldChangeSummaries: string[] = [];
  if (existing?.status !== nextStatus) fieldChangeSummaries.push(`status: ${existing?.status ?? "prospect"} -> ${nextStatus}`);
  if ((existing?.assigned_counsellor_id ?? null) !== nextCounsellorId) {
    fieldChangeSummaries.push(`assignedCounsellorId: ${existing?.assigned_counsellor_id ?? "none"} -> ${nextCounsellorId ?? "none"}`);
  }
  if (fieldChangeSummaries.length === 0) return;

  await recordAuditLog({
    action: "Updated",
    entityType: "student",
    entityId: studentUserId,
    entityLabel: `student ${studentUserId}`,
    fieldChangeSummaries,
    before: { status: existing?.status ?? "prospect", assignedCounsellorId: existing?.assigned_counsellor_id ?? null },
    after: { status: nextStatus, assignedCounsellorId: nextCounsellorId },
    context: { actorRole: admin.role },
  });
}

export async function addStudentNote(studentUserId: string, formData: FormData): Promise<void> {
  const admin = await requireAdminPermission("students:write");
  const note = String(formData.get("note") ?? "").trim();
  if (!note) throw new AdminValidationError("Note text is required.");
  if (note.length > 4000) throw new AdminValidationError("Note is too long (4000 characters max).");

  const supabase = await createClient();
  const { error } = await supabase.from("admin_student_notes").insert({ student_user_id: studentUserId, author_user_id: admin.userId, note });
  if (error) {
    logDbError("addStudentNote", error);
    throw new Error(error.message);
  }

  await recordAuditLog({
    action: "Added note",
    entityType: "student",
    entityId: studentUserId,
    entityLabel: `student ${studentUserId}`,
  });
}
