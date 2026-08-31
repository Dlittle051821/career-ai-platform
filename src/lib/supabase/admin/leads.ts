import "server-only";
import { createClient } from "../server";
import { requireAdminPermission } from "../admin-auth";
import { recordAuditLog } from "./audit";
import { AdminValidationError } from "@/lib/admin/form-state";
import { LEAD_STAGE_TRANSITIONS, isValidTransition } from "@/lib/admin/status";
import { cleanFilterParam, clampPageSize, pageToRange, parsePageParam } from "@/lib/admin/pagination";
import type { AdminListResult, Lead, LeadPriority, LeadStage, LeadStatusHistoryEntry } from "@/types/admin";
import { trackEvent } from "../analytics/track";

function logDbError(context: string, error: unknown) {
  console.error(`[admin/leads] ${context}:`, error);
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

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

function toLead(
  row: {
    id: string;
    full_name: string;
    email: string | null;
    phone: string | null;
    source: string | null;
    campaign: string | null;
    stage: string;
    priority: string;
    assigned_counsellor_id: string | null;
    next_follow_up_date: string | null;
    last_contact_date: string | null;
    consent_marketing: boolean;
    notes: string | null;
    converted_student_user_id: string | null;
    utm_source: string | null;
    utm_medium: string | null;
    utm_campaign: string | null;
    landing_page: string | null;
    created_at: string;
    updated_at: string;
  },
  counsellorNameById: Map<string, string>
): Lead {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    source: row.source,
    campaign: row.campaign,
    stage: row.stage as LeadStage,
    priority: row.priority as LeadPriority,
    assignedCounsellorId: row.assigned_counsellor_id,
    assignedCounsellorName: row.assigned_counsellor_id ? (counsellorNameById.get(row.assigned_counsellor_id) ?? null) : null,
    nextFollowUpDate: row.next_follow_up_date,
    lastContactDate: row.last_contact_date,
    consentMarketing: row.consent_marketing,
    notes: row.notes,
    convertedStudentUserId: row.converted_student_user_id,
    utmSource: row.utm_source,
    utmMedium: row.utm_medium,
    utmCampaign: row.utm_campaign,
    landingPage: row.landing_page,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface LeadFilters {
  query?: string;
  stage?: LeadStage;
  assignedCounsellorId?: string;
  page?: number;
}

const PAGE_SIZE = 20;

export async function listLeads(filters: LeadFilters = {}): Promise<AdminListResult<Lead>> {
  await requireAdminPermission("leads:read");
  const supabase = await createClient();
  const page = parsePageParam(String(filters.page ?? 1));
  const pageSize = clampPageSize(PAGE_SIZE);
  const { from, to } = pageToRange(page, pageSize);

  // RLS additionally scopes a counsellor's own session to their assigned
  // leads — this query never needs to filter by "assigned to me" itself for
  // that to be true; a broader query from a counsellor session simply
  // returns fewer rows than the count implies for other roles.
  let query = supabase.from("leads").select("*", { count: "exact" }).order("created_at", { ascending: false });
  const cleanedQuery = cleanFilterParam(filters.query);
  if (cleanedQuery) {
    const term = cleanedQuery.replace(/[,()%]/g, "");
    query = query.or(`full_name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`);
  }
  if (filters.stage) query = query.eq("stage", filters.stage);
  if (filters.assignedCounsellorId) query = query.eq("assigned_counsellor_id", filters.assignedCounsellorId);

  const { data, error, count } = await query.range(from, to);
  if (error) {
    logDbError("listLeads", error);
    return { items: [], total: 0, page, pageSize };
  }
  const rows = data ?? [];
  const counsellorNameById = await buildCounsellorNameMap(supabase, rows.map((r) => r.assigned_counsellor_id));
  return { items: rows.map((row) => toLead(row, counsellorNameById)), total: count ?? 0, page, pageSize };
}

export interface LeadDetail extends Lead {
  statusHistory: LeadStatusHistoryEntry[];
}

export async function getLeadById(id: string): Promise<LeadDetail | null> {
  await requireAdminPermission("leads:read");
  const supabase = await createClient();
  const { data, error } = await supabase.from("leads").select("*").eq("id", id).maybeSingle();
  if (error) {
    logDbError("getLeadById", error);
    return null;
  }
  if (!data) return null;

  const [counsellorNameById, historyRes] = await Promise.all([
    buildCounsellorNameMap(supabase, [data.assigned_counsellor_id]),
    supabase.from("lead_status_history").select("*").eq("lead_id", id).order("created_at", { ascending: false }),
  ]);
  if (historyRes.error) logDbError("getLeadById:history", historyRes.error);

  return {
    ...toLead(data, counsellorNameById),
    statusHistory: (historyRes.data ?? []).map((h) => ({
      id: h.id,
      leadId: h.lead_id,
      fromStage: h.from_stage as LeadStage | null,
      toStage: h.to_stage as LeadStage,
      changedBy: h.changed_by,
      note: h.note,
      createdAt: h.created_at,
    })),
  };
}

const PRIORITIES: LeadPriority[] = ["low", "medium", "high"];

interface LeadInput {
  fullName: string;
  email: string | null;
  phone: string | null;
  source: string | null;
  campaign: string | null;
  priority: LeadPriority;
  assignedCounsellorId: string | null;
  nextFollowUpDate: string | null;
  lastContactDate: string | null;
  consentMarketing: boolean;
  notes: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  landingPage: string | null;
}

function parseLeadForm(formData: FormData): LeadInput {
  const fullName = String(formData.get("fullName") ?? "").trim();
  if (!fullName) throw new AdminValidationError("Full name is required.");
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  if (!email && !phone) throw new AdminValidationError("At least one of email or phone is required.");

  const priorityRaw = String(formData.get("priority") ?? "medium").trim();
  const priority = PRIORITIES.includes(priorityRaw as LeadPriority) ? (priorityRaw as LeadPriority) : "medium";

  return {
    fullName,
    email: email || null,
    phone: phone || null,
    source: String(formData.get("source") ?? "").trim() || null,
    campaign: String(formData.get("campaign") ?? "").trim() || null,
    priority,
    assignedCounsellorId: String(formData.get("assignedCounsellorId") ?? "").trim() || null,
    nextFollowUpDate: String(formData.get("nextFollowUpDate") ?? "").trim() || null,
    lastContactDate: String(formData.get("lastContactDate") ?? "").trim() || null,
    consentMarketing: formData.get("consentMarketing") === "on",
    notes: String(formData.get("notes") ?? "").trim() || null,
    utmSource: String(formData.get("utmSource") ?? "").trim() || null,
    utmMedium: String(formData.get("utmMedium") ?? "").trim() || null,
    utmCampaign: String(formData.get("utmCampaign") ?? "").trim() || null,
    landingPage: String(formData.get("landingPage") ?? "").trim() || null,
  };
}

export async function createLead(formData: FormData): Promise<string> {
  const admin = await requireAdminPermission("leads:write");
  const input = parseLeadForm(formData);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("leads")
    .insert({
      full_name: input.fullName,
      email: input.email,
      phone: input.phone,
      source: input.source,
      campaign: input.campaign,
      stage: "new",
      priority: input.priority,
      assigned_counsellor_id: input.assignedCounsellorId,
      next_follow_up_date: input.nextFollowUpDate,
      last_contact_date: input.lastContactDate,
      consent_marketing: input.consentMarketing,
      notes: input.notes,
      utm_source: input.utmSource,
      utm_medium: input.utmMedium,
      utm_campaign: input.utmCampaign,
      landing_page: input.landingPage,
      converted_student_user_id: null,
    })
    .select("id")
    .single();

  if (error) {
    logDbError("createLead", error);
    throw new Error(error.message);
  }

  await supabase.from("lead_status_history").insert({ lead_id: data.id, from_stage: null, to_stage: "new", changed_by: admin.userId, note: null });

  await recordAuditLog({
    action: "Created",
    entityType: "lead",
    entityId: data.id,
    entityLabel: `lead "${input.fullName}"`,
    after: { fullName: input.fullName, stage: "new", priority: input.priority },
  });

  // Admin/counsellor-recorded, not a public self-service submission — see
  // docs/M9_EVENT_TAXONOMY.md's note on lead_created/counselling_requested.
  void trackEvent({
    eventName: "lead_created",
    source: "admin_crm",
    feature: "leads",
    entityType: "lead",
    entityId: data.id,
    properties: { priority: input.priority, hasSource: Boolean(input.source) },
    utm: { source: input.utmSource, medium: input.utmMedium, campaign: input.utmCampaign },
  });

  return data.id;
}

export async function updateLead(id: string, formData: FormData): Promise<void> {
  const admin = await requireAdminPermission("leads:write");
  const input = parseLeadForm(formData);
  const requestedStageRaw = String(formData.get("stage") ?? "").trim();
  const supabase = await createClient();

  const before = await getLeadById(id);
  if (!before) throw new AdminValidationError("Lead not found.");

  const requestedStage = (requestedStageRaw || before.stage) as LeadStage;
  if (!isValidTransition(LEAD_STAGE_TRANSITIONS, before.stage, requestedStage)) {
    throw new AdminValidationError(`Cannot move a lead from "${before.stage}" directly to "${requestedStage}".`);
  }

  const { error } = await supabase
    .from("leads")
    .update({
      full_name: input.fullName,
      email: input.email,
      phone: input.phone,
      source: input.source,
      campaign: input.campaign,
      stage: requestedStage,
      priority: input.priority,
      assigned_counsellor_id: input.assignedCounsellorId,
      next_follow_up_date: input.nextFollowUpDate,
      last_contact_date: input.lastContactDate,
      consent_marketing: input.consentMarketing,
      notes: input.notes,
      utm_source: input.utmSource,
      utm_medium: input.utmMedium,
      utm_campaign: input.utmCampaign,
      landing_page: input.landingPage,
    })
    .eq("id", id);

  if (error) {
    logDbError("updateLead", error);
    throw new Error(error.message);
  }

  if (requestedStage !== before.stage) {
    await supabase.from("lead_status_history").insert({ lead_id: id, from_stage: before.stage, to_stage: requestedStage, changed_by: admin.userId, note: null });
  }

  const fieldChangeSummaries: string[] = [];
  if (before.stage !== requestedStage) fieldChangeSummaries.push(`stage: ${before.stage} -> ${requestedStage}`);
  if (before.assignedCounsellorId !== input.assignedCounsellorId) {
    fieldChangeSummaries.push(`assignedCounsellorId: ${before.assignedCounsellorId ?? "none"} -> ${input.assignedCounsellorId ?? "none"}`);
  }
  if (before.priority !== input.priority) fieldChangeSummaries.push(`priority: ${before.priority} -> ${input.priority}`);

  await recordAuditLog({
    action: "Updated",
    entityType: "lead",
    entityId: id,
    entityLabel: `lead "${input.fullName}"`,
    fieldChangeSummaries,
    before: { stage: before.stage, priority: before.priority, assignedCounsellorId: before.assignedCounsellorId },
    after: { stage: requestedStage, priority: input.priority, assignedCounsellorId: input.assignedCounsellorId },
  });
}

/**
 * Links a lead to an already-registered student account by email lookup.
 * This never creates or edits a student profile — it only records that a
 * pre-existing student registration is the outcome of this lead, for
 * conversion tracking. If no matching student account exists yet, this
 * fails with a clear validation error rather than silently no-op'ing.
 */
export async function convertLeadToStudent(id: string, studentEmail: string): Promise<void> {
  const admin = await requireAdminPermission("leads:write");
  const email = studentEmail.trim().toLowerCase();
  if (!email) throw new AdminValidationError("A student email is required to record a conversion.");

  const supabase = await createClient();
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, account_type")
    .eq("email", email)
    .maybeSingle();
  if (profileError) {
    logDbError("convertLeadToStudent:lookup", profileError);
    throw new Error(profileError.message);
  }
  if (!profile || profile.account_type !== "student") {
    throw new AdminValidationError("No registered student account found with that email.");
  }

  const before = await getLeadById(id);
  if (!before) throw new AdminValidationError("Lead not found.");
  if (!isValidTransition(LEAD_STAGE_TRANSITIONS, before.stage, "converted")) {
    throw new AdminValidationError(`Cannot mark this lead converted directly from "${before.stage}".`);
  }

  const { error } = await supabase.from("leads").update({ converted_student_user_id: profile.id, stage: "converted" }).eq("id", id);
  if (error) {
    logDbError("convertLeadToStudent", error);
    throw new Error(error.message);
  }

  await supabase.from("lead_status_history").insert({ lead_id: id, from_stage: before.stage, to_stage: "converted", changed_by: admin.userId, note: null });

  await recordAuditLog({
    action: "Converted",
    entityType: "lead",
    entityId: id,
    entityLabel: `lead "${before.fullName}"`,
    fieldChangeSummaries: [`stage: ${before.stage} -> converted`],
    context: { linkedStudentUserId: profile.id },
  });
}
