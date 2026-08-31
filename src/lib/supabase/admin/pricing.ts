import "server-only";
import { createClient } from "../server";
import { requireAdminPermission } from "../admin-auth";
import { recordAuditLog } from "./audit";
import { AdminValidationError } from "@/lib/admin/form-state";
import { parseMoneyInput } from "@/lib/admin/money";
import { PRICING_OFFER_STATUS_TRANSITIONS, PRICING_PLAN_VERSION_STATUS_TRANSITIONS, isValidTransition } from "@/lib/admin/status";
import { validateOfferShape, validateOfferAgainstPlan } from "@/lib/pricing/offers";
import { cleanFilterParam, clampPageSize, pageToRange, parsePageParam } from "@/lib/admin/pagination";
import { toPricingPlan, toPricingPlanVersion, toPricingOffer, toPricingInclusion } from "../pricing/public-plans";
import type { PricingCategory, PricingInclusion, PricingListResult, PricingOffer, PricingOfferStatus, PricingPlan, PricingPlanVersion, PricingPlanVersionStatus, PricingServiceItem } from "@/types/pricing";
import type { Json } from "@/types/database";

/**
 * Admin data access for NextWise Pricing & Offers. Every mutation here is
 * permission-gated on pricing:read/pricing:write (src/lib/admin/permissions.ts)
 * AND independently enforced by RLS on pricing_plans/pricing_plan_versions/
 * pricing_offers (0007_nextwise_pricing_offers.sql) — this file is not the
 * security boundary, only a convenience layer on top of one, same
 * convention as src/lib/supabase/admin/invoices.ts. Money is always integer
 * minor units, parsed via src/lib/admin/money.ts's parseMoneyInput — never
 * trusted from a raw form string without validation.
 */

function logDbError(context: string, error: unknown) {
  console.error(`[admin/pricing] ${context}:`, error);
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

// ---------------------------------------------------------------------------
// Plans
// ---------------------------------------------------------------------------

export interface PricingPlanFilters {
  query?: string;
  category?: PricingCategory;
  status?: "active" | "inactive";
  page?: number;
}

export interface PricingPlanListItem {
  plan: PricingPlan;
  currentVersion: PricingPlanVersion | null;
  offerCount: number;
}

const PAGE_SIZE = 30;

export async function listPricingPlans(filters: PricingPlanFilters = {}): Promise<PricingListResult<PricingPlanListItem>> {
  await requireAdminPermission("pricing:read");
  const supabase = await createClient();
  const page = parsePageParam(String(filters.page ?? 1));
  const pageSize = clampPageSize(PAGE_SIZE);
  const { from, to } = pageToRange(page, pageSize);

  let query = supabase.from("pricing_plans").select("*", { count: "exact" }).order("display_order", { ascending: true });
  if (filters.category) query = query.eq("category", filters.category);
  if (filters.status) query = query.eq("is_active", filters.status === "active");
  const cleanedQuery = cleanFilterParam(filters.query);
  if (cleanedQuery) {
    const term = cleanedQuery.replace(/[,()%]/g, "");
    query = query.or(`internal_name.ilike.%${term}%,slug.ilike.%${term}%`);
  }

  const { data, error, count } = await query.range(from, to);
  if (error) {
    logDbError("listPricingPlans", error);
    return { items: [], total: 0, page, pageSize };
  }
  const plans = (data ?? []).map(toPricingPlan);
  const planIds = plans.map((p) => p.id);

  const [versionsResult, offersResult] = await Promise.all([
    planIds.length > 0 ? supabase.from("pricing_plan_versions").select("*").in("id", plans.map((p) => p.currentVersionId).filter((id): id is string => !!id)) : Promise.resolve({ data: [] as unknown[] }),
    planIds.length > 0 ? supabase.from("pricing_offers").select("plan_id").in("plan_id", planIds) : Promise.resolve({ data: [] as { plan_id: string }[] }),
  ]);
  const versionById = new Map((versionsResult.data ?? []).map((v) => [(v as { id: string }).id, toPricingPlanVersion(v as Parameters<typeof toPricingPlanVersion>[0])]));
  const offerCountByPlan = new Map<string, number>();
  for (const row of (offersResult.data ?? []) as { plan_id: string }[]) {
    offerCountByPlan.set(row.plan_id, (offerCountByPlan.get(row.plan_id) ?? 0) + 1);
  }

  const items: PricingPlanListItem[] = plans.map((plan) => ({
    plan,
    currentVersion: plan.currentVersionId ? (versionById.get(plan.currentVersionId) ?? null) : null,
    offerCount: offerCountByPlan.get(plan.id) ?? 0,
  }));

  return { items, total: count ?? 0, page, pageSize };
}

export interface PricingPlanDetail {
  plan: PricingPlan;
  versions: PricingPlanVersion[];
  offers: PricingOffer[];
}

export async function getPricingPlanById(id: string): Promise<PricingPlanDetail | null> {
  await requireAdminPermission("pricing:read");
  const supabase = await createClient();

  const { data: planRow, error: planError } = await supabase.from("pricing_plans").select("*").eq("id", id).maybeSingle();
  if (planError) {
    logDbError("getPricingPlanById:plan", planError);
    return null;
  }
  if (!planRow) return null;

  const [{ data: versionRows, error: versionError }, { data: offerRows, error: offerError }] = await Promise.all([
    supabase.from("pricing_plan_versions").select("*").eq("plan_id", id).order("version_number", { ascending: false }),
    supabase.from("pricing_offers").select("*").eq("plan_id", id).order("created_at", { ascending: false }),
  ]);
  if (versionError) logDbError("getPricingPlanById:versions", versionError);
  if (offerError) logDbError("getPricingPlanById:offers", offerError);

  return {
    plan: toPricingPlan(planRow),
    versions: (versionRows ?? []).map(toPricingPlanVersion),
    offers: (offerRows ?? []).map(toPricingOffer),
  };
}

function parsePlanForm(formData: FormData): { slug: string; category: PricingCategory; internalName: string; displayOrder: number; isRecommended: boolean; isActive: boolean } {
  const slug = String(formData.get("slug") ?? "").trim().toLowerCase();
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) throw new AdminValidationError("Slug must be lowercase letters, numbers, and single hyphens only.");
  const category = String(formData.get("category") ?? "").trim() as PricingCategory;
  const VALID_CATEGORIES: PricingCategory[] = ["school_counselling", "class_11_counselling", "class_12_counselling", "bachelor_abroad", "master_abroad"];
  if (!VALID_CATEGORIES.includes(category)) throw new AdminValidationError("A valid category is required.");
  const internalName = String(formData.get("internalName") ?? "").trim();
  if (!internalName) throw new AdminValidationError("Internal name is required.");
  const displayOrderRaw = Number.parseInt(String(formData.get("displayOrder") ?? "0"), 10);
  const displayOrder = Number.isInteger(displayOrderRaw) ? displayOrderRaw : 0;
  const isRecommended = formData.get("isRecommended") === "on" || formData.get("isRecommended") === "true";
  const isActive = formData.get("isActive") === "on" || formData.get("isActive") === "true" || formData.get("isActive") === null;

  return { slug, category, internalName, displayOrder, isRecommended, isActive };
}

/** Admin capability: "Add plan". Creates catalog identity only — no version yet; the admin creates a draft version next. */
export async function createPricingPlan(formData: FormData): Promise<string> {
  const admin = await requireAdminPermission("pricing:write");
  const input = parsePlanForm(formData);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("pricing_plans")
    .insert({
      slug: input.slug,
      category: input.category,
      internal_name: input.internalName,
      display_order: input.displayOrder,
      is_recommended: input.isRecommended,
      is_active: input.isActive,
      created_by: admin.userId,
      updated_by: admin.userId,
    })
    .select("id")
    .single();

  if (error) {
    logDbError("createPricingPlan", error);
    throw new Error(error.message);
  }

  await recordAuditLog({
    action: "Created",
    entityType: "pricing_plan",
    entityId: data.id,
    entityLabel: `pricing plan "${input.internalName}"`,
    after: { slug: input.slug, category: input.category },
  });

  return data.id;
}

/** Admin capability: reorder / mark recommended / activate-deactivate / rename the INTERNAL (admin-only) name. Never touches price — see createPricingPlanVersion for that. */
export async function updatePricingPlan(id: string, formData: FormData): Promise<void> {
  const admin = await requireAdminPermission("pricing:write");
  const input = parsePlanForm(formData);
  const supabase = await createClient();

  const { data: before } = await supabase.from("pricing_plans").select("*").eq("id", id).maybeSingle();
  if (!before) throw new AdminValidationError("Pricing plan not found.");

  const { error } = await supabase
    .from("pricing_plans")
    .update({
      slug: input.slug,
      category: input.category,
      internal_name: input.internalName,
      display_order: input.displayOrder,
      is_recommended: input.isRecommended,
      is_active: input.isActive,
      updated_by: admin.userId,
    })
    .eq("id", id);

  if (error) {
    logDbError("updatePricingPlan", error);
    throw new Error(error.message);
  }

  await recordAuditLog({
    action: "Updated",
    entityType: "pricing_plan",
    entityId: id,
    entityLabel: `pricing plan "${input.internalName}"`,
    before: { internalName: before.internal_name, isActive: before.is_active, isRecommended: before.is_recommended, displayOrder: before.display_order },
    after: { internalName: input.internalName, isActive: input.isActive, isRecommended: input.isRecommended, displayOrder: input.displayOrder },
  });
}

/** Admin capability: "Reorder plans" — bulk-writes display_order for a full ordered list of plan ids (e.g. from a drag-and-drop admin table). */
export async function reorderPricingPlans(orderedPlanIds: string[]): Promise<void> {
  const admin = await requireAdminPermission("pricing:write");
  const supabase = await createClient();

  for (let i = 0; i < orderedPlanIds.length; i++) {
    const { error } = await supabase
      .from("pricing_plans")
      .update({ display_order: (i + 1) * 10, updated_by: admin.userId })
      .eq("id", orderedPlanIds[i]);
    if (error) {
      logDbError("reorderPricingPlans", error);
      throw new Error(error.message);
    }
  }

  await recordAuditLog({
    action: "Reordered",
    entityType: "pricing_plan",
    entityId: null,
    entityLabel: "pricing plan display order",
    after: { orderedPlanIds },
  });
}

// ---------------------------------------------------------------------------
// Plan versions
// ---------------------------------------------------------------------------

function parseServiceItemsForm(formData: FormData, labelField: string, descriptionField: string): PricingServiceItem[] {
  const labels = formData.getAll(labelField).map((v) => String(v).trim());
  const descriptions = formData.getAll(descriptionField).map((v) => String(v).trim());
  const items: PricingServiceItem[] = [];
  for (let i = 0; i < labels.length; i++) {
    if (!labels[i]) continue; // a blank row from "add another" is simply skipped, not an error
    items.push(descriptions[i] ? { label: labels[i], description: descriptions[i] } : { label: labels[i] });
  }
  return items;
}

interface PlanVersionInput {
  publicTitle: string;
  shortDescription: string | null;
  detailedDescription: string | null;
  currency: string;
  amountMinorUnits: number;
  includedServices: PricingServiceItem[];
  exclusions: PricingServiceItem[];
  ctaText: string | null;
  taxStatus: "unconfigured" | "tax_exclusive" | "tax_inclusive";
  effectiveFrom: string | null;
  effectiveUntil: string | null;
  // Milestone 11 — presentation settings / comparison-table fields
  // (0008_pricing_inclusions_and_presentation.sql PART 2).
  sessionCount: number | null;
  sessionDurationNote: string | null;
  audienceLabel: string | null;
  universityShortlistLimit: number | null;
  applicationSupportLimit: number | null;
  sopReviewRounds: number | null;
  scholarshipSupportNote: string | null;
  mockInterviewCount: number | null;
  counsellorTier: string | null;
  supportDurationNote: string | null;
}

/** Parses an optional non-negative integer form field. Returns null for a blank field (meaning "not configured"), throws for anything present but not a valid non-negative integer. */
function parseOptionalNonNegativeInt(formData: FormData, field: string, label: string): number | null {
  const raw = String(formData.get(field) ?? "").trim();
  if (!raw) return null;
  const n = Number.parseInt(raw, 10);
  if (!Number.isInteger(n) || n < 0 || String(n) !== raw) throw new AdminValidationError(`${label} must be a whole non-negative number, or left blank.`);
  return n;
}

function parseOptionalText(formData: FormData, field: string): string | null {
  const raw = String(formData.get(field) ?? "").trim();
  return raw || null;
}

function parsePlanVersionForm(formData: FormData): PlanVersionInput {
  const publicTitle = String(formData.get("publicTitle") ?? "").trim();
  if (!publicTitle) throw new AdminValidationError("Public title is required.");
  const currency = (String(formData.get("currency") ?? "INR").trim().toUpperCase() || "INR");
  const amountRaw = String(formData.get("amount") ?? "").trim();
  const amountMinorUnits = parseMoneyInput(amountRaw, currency);
  if (amountMinorUnits === null) throw new AdminValidationError("Price must be a valid non-negative amount.");
  const taxStatusRaw = String(formData.get("taxStatus") ?? "unconfigured").trim();
  const taxStatus = (["unconfigured", "tax_exclusive", "tax_inclusive"].includes(taxStatusRaw) ? taxStatusRaw : "unconfigured") as PlanVersionInput["taxStatus"];
  const effectiveFromRaw = String(formData.get("effectiveFrom") ?? "").trim();
  const effectiveUntilRaw = String(formData.get("effectiveUntil") ?? "").trim();
  const effectiveFrom = effectiveFromRaw ? new Date(effectiveFromRaw).toISOString() : null;
  const effectiveUntil = effectiveUntilRaw ? new Date(effectiveUntilRaw).toISOString() : null;
  if (effectiveFrom && effectiveUntil && new Date(effectiveUntil).getTime() <= new Date(effectiveFrom).getTime()) {
    throw new AdminValidationError("Effective-until must be after effective-from.");
  }

  return {
    publicTitle,
    shortDescription: String(formData.get("shortDescription") ?? "").trim() || null,
    detailedDescription: String(formData.get("detailedDescription") ?? "").trim() || null,
    currency,
    amountMinorUnits,
    includedServices: parseServiceItemsForm(formData, "serviceLabel", "serviceDescription"),
    exclusions: parseServiceItemsForm(formData, "exclusionLabel", "exclusionDescription"),
    ctaText: String(formData.get("ctaText") ?? "").trim() || null,
    taxStatus,
    effectiveFrom,
    effectiveUntil,
    sessionCount: parseOptionalNonNegativeInt(formData, "sessionCount", "Session count"),
    sessionDurationNote: parseOptionalText(formData, "sessionDurationNote"),
    audienceLabel: parseOptionalText(formData, "audienceLabel"),
    universityShortlistLimit: parseOptionalNonNegativeInt(formData, "universityShortlistLimit", "University shortlist limit"),
    applicationSupportLimit: parseOptionalNonNegativeInt(formData, "applicationSupportLimit", "Application support limit"),
    sopReviewRounds: parseOptionalNonNegativeInt(formData, "sopReviewRounds", "SOP review rounds"),
    scholarshipSupportNote: parseOptionalText(formData, "scholarshipSupportNote"),
    mockInterviewCount: parseOptionalNonNegativeInt(formData, "mockInterviewCount", "Mock interview count"),
    counsellorTier: parseOptionalText(formData, "counsellorTier"),
    supportDurationNote: parseOptionalText(formData, "supportDurationNote"),
  };
}

/** Admin capability: "Create a new price version" — always inserted as status='draft', version_number = max+1 for the plan. Never touches an existing version row (immutability). */
export async function createPricingPlanVersion(planId: string, formData: FormData): Promise<string> {
  const admin = await requireAdminPermission("pricing:write");
  const input = parsePlanVersionForm(formData);
  const supabase = await createClient();

  const { data: plan } = await supabase.from("pricing_plans").select("id, internal_name").eq("id", planId).maybeSingle();
  if (!plan) throw new AdminValidationError("Pricing plan not found.");

  const { data: existingVersions, error: versionsError } = await supabase.from("pricing_plan_versions").select("version_number").eq("plan_id", planId).order("version_number", { ascending: false }).limit(1);
  if (versionsError) {
    logDbError("createPricingPlanVersion:versions", versionsError);
    throw new Error(versionsError.message);
  }
  const nextVersionNumber = ((existingVersions ?? [])[0]?.version_number ?? 0) + 1;

  const { data, error } = await supabase
    .from("pricing_plan_versions")
    .insert({
      plan_id: planId,
      version_number: nextVersionNumber,
      public_title: input.publicTitle,
      short_description: input.shortDescription,
      detailed_description: input.detailedDescription,
      currency: input.currency,
      amount_minor_units: input.amountMinorUnits,
      payment_type: "one_time",
      billing_interval: null,
      included_services: input.includedServices as unknown as Json,
      exclusions: input.exclusions as unknown as Json,
      cta_text: input.ctaText,
      tax_status: input.taxStatus,
      status: "draft",
      effective_from: input.effectiveFrom,
      effective_until: input.effectiveUntil,
      session_count: input.sessionCount,
      session_duration_note: input.sessionDurationNote,
      audience_label: input.audienceLabel,
      university_shortlist_limit: input.universityShortlistLimit,
      application_support_limit: input.applicationSupportLimit,
      sop_review_rounds: input.sopReviewRounds,
      scholarship_support_note: input.scholarshipSupportNote,
      mock_interview_count: input.mockInterviewCount,
      counsellor_tier: input.counsellorTier,
      support_duration_note: input.supportDurationNote,
      created_by: admin.userId,
      updated_by: admin.userId,
    })
    .select("id")
    .single();

  if (error) {
    logDbError("createPricingPlanVersion", error);
    throw new Error(error.message);
  }

  await recordAuditLog({
    action: "Created",
    entityType: "pricing_plan_version",
    entityId: data.id,
    entityLabel: `pricing plan "${plan.internal_name}" version ${nextVersionNumber} (draft)`,
    after: { amountMinorUnits: input.amountMinorUnits, currency: input.currency, publicTitle: input.publicTitle },
  });

  return data.id;
}

/** Edits a DRAFT version's content — rejected by the database's own immutability trigger (and pre-checked here for a friendlier error) once the version has been published. */
export async function updatePricingPlanVersion(versionId: string, formData: FormData): Promise<void> {
  const admin = await requireAdminPermission("pricing:write");
  const input = parsePlanVersionForm(formData);
  const supabase = await createClient();

  const { data: before } = await supabase.from("pricing_plan_versions").select("*").eq("id", versionId).maybeSingle();
  if (!before) throw new AdminValidationError("Pricing plan version not found.");
  if (before.status !== "draft") {
    throw new AdminValidationError("Only a draft version can be edited — publish creates an immutable snapshot. Create a new version instead.");
  }

  const { error } = await supabase
    .from("pricing_plan_versions")
    .update({
      public_title: input.publicTitle,
      short_description: input.shortDescription,
      detailed_description: input.detailedDescription,
      currency: input.currency,
      amount_minor_units: input.amountMinorUnits,
      included_services: input.includedServices as unknown as Json,
      exclusions: input.exclusions as unknown as Json,
      cta_text: input.ctaText,
      tax_status: input.taxStatus,
      effective_from: input.effectiveFrom,
      effective_until: input.effectiveUntil,
      session_count: input.sessionCount,
      session_duration_note: input.sessionDurationNote,
      audience_label: input.audienceLabel,
      university_shortlist_limit: input.universityShortlistLimit,
      application_support_limit: input.applicationSupportLimit,
      sop_review_rounds: input.sopReviewRounds,
      scholarship_support_note: input.scholarshipSupportNote,
      mock_interview_count: input.mockInterviewCount,
      counsellor_tier: input.counsellorTier,
      support_duration_note: input.supportDurationNote,
      updated_by: admin.userId,
    })
    .eq("id", versionId);

  if (error) {
    logDbError("updatePricingPlanVersion", error);
    throw new Error(error.message);
  }

  await recordAuditLog({
    action: "Updated",
    entityType: "pricing_plan_version",
    entityId: versionId,
    entityLabel: `pricing plan version "${input.publicTitle}" (draft)`,
    before: { amountMinorUnits: before.amount_minor_units, publicTitle: before.public_title },
    after: { amountMinorUnits: input.amountMinorUnits, publicTitle: input.publicTitle },
  });
}

/**
 * Admin capability: "Publish future pricing". Publishing a version
 * archives any OTHER currently-published version of the same plan first
 * (so at most one version is ever live at a time — see
 * src/lib/supabase/pricing/public-plans.ts's docblock for why this
 * invariant matters), then publishes the target and points the plan's
 * current_version_id at it. `effective_from` may be in the future — that
 * is exactly what "publish future pricing" means: published now,
 * purchasable starting then (see the version's own RLS policy).
 */
export async function publishPricingPlanVersion(versionId: string): Promise<void> {
  const admin = await requireAdminPermission("pricing:write");
  const supabase = await createClient();

  const { data: version } = await supabase.from("pricing_plan_versions").select("*").eq("id", versionId).maybeSingle();
  if (!version) throw new AdminValidationError("Pricing plan version not found.");
  if (!isValidTransition(PRICING_PLAN_VERSION_STATUS_TRANSITIONS, version.status as PricingPlanVersionStatus, "published")) {
    throw new AdminValidationError(`Cannot publish a version from status "${version.status}".`);
  }

  const { data: otherPublished } = await supabase.from("pricing_plan_versions").select("id").eq("plan_id", version.plan_id).eq("status", "published").neq("id", versionId);
  for (const other of otherPublished ?? []) {
    const { error: archiveError } = await supabase.from("pricing_plan_versions").update({ status: "archived", updated_by: admin.userId }).eq("id", other.id);
    if (archiveError) logDbError("publishPricingPlanVersion:archiveOther", archiveError);
  }

  const { error: publishError } = await supabase.from("pricing_plan_versions").update({ status: "published", updated_by: admin.userId }).eq("id", versionId);
  if (publishError) {
    logDbError("publishPricingPlanVersion:publish", publishError);
    throw new Error(publishError.message);
  }

  const { error: pointerError } = await supabase.from("pricing_plans").update({ current_version_id: versionId, updated_by: admin.userId }).eq("id", version.plan_id);
  if (pointerError) logDbError("publishPricingPlanVersion:pointer", pointerError);

  await recordAuditLog({
    action: "Published",
    entityType: "pricing_plan_version",
    entityId: versionId,
    entityLabel: `pricing plan version "${version.public_title}" (v${version.version_number})`,
    fieldChangeSummaries: [`status: draft -> published`, `amount: ${version.amount_minor_units} ${version.currency} minor units`],
    before: { status: "draft" },
    after: { status: "published", effectiveFrom: version.effective_from },
  });
}

/** Admin capability: "Archive pricing" — retires a published version early. The plan simply has no purchasable version until a new one is published. */
export async function archivePricingPlanVersion(versionId: string): Promise<void> {
  const admin = await requireAdminPermission("pricing:write");
  const supabase = await createClient();

  const { data: version } = await supabase.from("pricing_plan_versions").select("*").eq("id", versionId).maybeSingle();
  if (!version) throw new AdminValidationError("Pricing plan version not found.");
  if (!isValidTransition(PRICING_PLAN_VERSION_STATUS_TRANSITIONS, version.status as PricingPlanVersionStatus, "archived")) {
    throw new AdminValidationError(`Cannot archive a version from status "${version.status}".`);
  }

  const { error } = await supabase.from("pricing_plan_versions").update({ status: "archived", updated_by: admin.userId }).eq("id", versionId);
  if (error) {
    logDbError("archivePricingPlanVersion", error);
    throw new Error(error.message);
  }

  await recordAuditLog({
    action: "Archived",
    entityType: "pricing_plan_version",
    entityId: versionId,
    entityLabel: `pricing plan version "${version.public_title}" (v${version.version_number})`,
    fieldChangeSummaries: [`status: ${version.status} -> archived`],
    before: { status: version.status },
    after: { status: "archived" },
  });
}

// ---------------------------------------------------------------------------
// Inclusions (Milestone 11 — 0008_pricing_inclusions_and_presentation.sql)
//
// "Add, edit, remove and reorder inclusions" / "Mark selected inclusions as
// highlights" (spec admin capabilities). Every mutation below only ever
// succeeds against a DRAFT version — enforced twice, exactly like every
// other pricing write in this file: here (a friendlier, immediate error)
// and, authoritatively, by pricing_plan_inclusions' own RLS write policies
// and its BEFORE UPDATE immutability trigger (0008 PART 1.1/1.2). A new
// inclusion for an already-published plan means creating a new draft
// version first (createPricingPlanVersion above) and adding inclusions to
// THAT version — never to the published one.
// ---------------------------------------------------------------------------

export async function getPricingInclusionById(id: string): Promise<PricingInclusion | null> {
  await requireAdminPermission("pricing:read");
  const supabase = await createClient();
  const { data, error } = await supabase.from("pricing_plan_inclusions").select("*").eq("id", id).maybeSingle();
  if (error) {
    logDbError("getPricingInclusionById", error);
    return null;
  }
  return data ? toPricingInclusion(data) : null;
}

export async function listPricingInclusions(planVersionId: string): Promise<PricingInclusion[]> {
  await requireAdminPermission("pricing:read");
  const supabase = await createClient();
  const { data, error } = await supabase.from("pricing_plan_inclusions").select("*").eq("plan_version_id", planVersionId).order("display_order", { ascending: true });
  if (error) {
    logDbError("listPricingInclusions", error);
    return [];
  }
  return (data ?? []).map(toPricingInclusion);
}

interface InclusionInput {
  title: string;
  explanation: string | null;
  category: string | null;
  numericAllowance: number | null;
  unit: string | null;
  isHighlight: boolean;
  isActive: boolean;
}

function parseInclusionForm(formData: FormData): InclusionInput {
  const title = String(formData.get("title") ?? "").trim();
  if (!title) throw new AdminValidationError("Title is required.");

  const numericAllowanceRaw = String(formData.get("numericAllowance") ?? "").trim();
  let numericAllowance: number | null = null;
  if (numericAllowanceRaw) {
    const n = Number.parseFloat(numericAllowanceRaw);
    if (!Number.isFinite(n)) throw new AdminValidationError("Numeric allowance must be a valid number, or left blank.");
    numericAllowance = n;
  }

  return {
    title,
    explanation: String(formData.get("explanation") ?? "").trim() || null,
    category: String(formData.get("category") ?? "").trim() || null,
    numericAllowance,
    unit: String(formData.get("unit") ?? "").trim() || null,
    isHighlight: formData.get("isHighlight") === "on" || formData.get("isHighlight") === "true",
    isActive: formData.get("isActive") === "on" || formData.get("isActive") === "true" || formData.get("isActive") === null,
  };
}

async function requireDraftVersion(supabase: Supabase, planVersionId: string): Promise<{ id: string; plan_id: string; public_title: string; status: string }> {
  const { data: version } = await supabase.from("pricing_plan_versions").select("id, plan_id, public_title, status").eq("id", planVersionId).maybeSingle();
  if (!version) throw new AdminValidationError("Pricing plan version not found.");
  if (version.status !== "draft") {
    throw new AdminValidationError("Inclusions can only be added or edited on a draft version — create a new version first.");
  }
  return version;
}

/** Admin capability: "Add inclusions" — appended after the current highest display_order for this version, defaulting to 10-apart spacing (same convention as reorderPricingPlans) so a later manual reorder has room to insert between rows without renumbering everything. */
export async function createPricingInclusion(planVersionId: string, formData: FormData): Promise<string> {
  const admin = await requireAdminPermission("pricing:write");
  const supabase = await createClient();
  const version = await requireDraftVersion(supabase, planVersionId);
  const input = parseInclusionForm(formData);

  const { data: existing } = await supabase.from("pricing_plan_inclusions").select("display_order").eq("plan_version_id", planVersionId).order("display_order", { ascending: false }).limit(1);
  const nextOrder = ((existing ?? [])[0]?.display_order ?? 0) + 10;

  const { data, error } = await supabase
    .from("pricing_plan_inclusions")
    .insert({
      plan_version_id: planVersionId,
      display_order: nextOrder,
      title: input.title,
      explanation: input.explanation,
      category: input.category,
      numeric_allowance: input.numericAllowance,
      unit: input.unit,
      is_highlight: input.isHighlight,
      is_active: input.isActive,
      created_by: admin.userId,
      updated_by: admin.userId,
    })
    .select("id")
    .single();

  if (error) {
    logDbError("createPricingInclusion", error);
    throw new Error(error.message);
  }

  await recordAuditLog({
    action: "Created",
    entityType: "pricing_plan_inclusion",
    entityId: data.id,
    entityLabel: `inclusion "${input.title}" on version "${version.public_title}" (draft)`,
    after: { title: input.title, isHighlight: input.isHighlight },
  });

  return data.id;
}

/** Admin capability: "Edit inclusions". Rejected (by requireDraftVersion, and independently by RLS/the trigger) once the parent version has left draft. */
export async function updatePricingInclusion(inclusionId: string, formData: FormData): Promise<void> {
  const admin = await requireAdminPermission("pricing:write");
  const supabase = await createClient();

  const { data: before } = await supabase.from("pricing_plan_inclusions").select("*").eq("id", inclusionId).maybeSingle();
  if (!before) throw new AdminValidationError("Inclusion not found.");
  await requireDraftVersion(supabase, before.plan_version_id);
  const input = parseInclusionForm(formData);

  const { error } = await supabase
    .from("pricing_plan_inclusions")
    .update({
      title: input.title,
      explanation: input.explanation,
      category: input.category,
      numeric_allowance: input.numericAllowance,
      unit: input.unit,
      is_highlight: input.isHighlight,
      is_active: input.isActive,
      updated_by: admin.userId,
    })
    .eq("id", inclusionId);

  if (error) {
    logDbError("updatePricingInclusion", error);
    throw new Error(error.message);
  }

  await recordAuditLog({
    action: "Updated",
    entityType: "pricing_plan_inclusion",
    entityId: inclusionId,
    entityLabel: `inclusion "${input.title}"`,
    before: { title: before.title, isHighlight: before.is_highlight },
    after: { title: input.title, isHighlight: input.isHighlight },
  });
}

/** Admin capability: "Remove inclusions". Rejected once the parent version has left draft — same guard as create/update, enforced here plus by RLS's own draft-only DELETE policy (0008 PART 1.1). */
export async function deletePricingInclusion(inclusionId: string): Promise<void> {
  await requireAdminPermission("pricing:write");
  const supabase = await createClient();

  const { data: before } = await supabase.from("pricing_plan_inclusions").select("id, plan_version_id, title").eq("id", inclusionId).maybeSingle();
  if (!before) throw new AdminValidationError("Inclusion not found.");
  await requireDraftVersion(supabase, before.plan_version_id);

  const { error } = await supabase.from("pricing_plan_inclusions").delete().eq("id", inclusionId);
  if (error) {
    logDbError("deletePricingInclusion", error);
    throw new Error(error.message);
  }

  await recordAuditLog({
    action: "Deleted",
    entityType: "pricing_plan_inclusion",
    entityId: inclusionId,
    entityLabel: `inclusion "${before.title}"`,
    before: { title: before.title },
  });
}

/** Admin capability: "Reorder inclusions" — bulk-writes display_order (10, 20, 30…) for exactly the ids given, same pattern as reorderPricingPlans. All ids must belong to the same draft version — enforced by requireDraftVersion on the version the FIRST id resolves to; a mismatched id from another version simply fails its own RLS-backed UPDATE and surfaces as a normal error. */
export async function reorderPricingInclusions(planVersionId: string, orderedInclusionIds: string[]): Promise<void> {
  const admin = await requireAdminPermission("pricing:write");
  const supabase = await createClient();
  await requireDraftVersion(supabase, planVersionId);

  for (let i = 0; i < orderedInclusionIds.length; i++) {
    const { error } = await supabase
      .from("pricing_plan_inclusions")
      .update({ display_order: (i + 1) * 10, updated_by: admin.userId })
      .eq("id", orderedInclusionIds[i])
      .eq("plan_version_id", planVersionId);
    if (error) {
      logDbError("reorderPricingInclusions", error);
      throw new Error(error.message);
    }
  }

  await recordAuditLog({
    action: "Reordered",
    entityType: "pricing_plan_inclusion",
    entityId: null,
    entityLabel: `inclusions on plan version ${planVersionId}`,
    after: { orderedInclusionIds },
  });
}

// ---------------------------------------------------------------------------
// Offers
// ---------------------------------------------------------------------------

export interface PricingOfferFilters {
  planId?: string;
  status?: PricingOfferStatus;
  page?: number;
}

export async function listPricingOffers(filters: PricingOfferFilters = {}): Promise<PricingListResult<PricingOffer>> {
  await requireAdminPermission("pricing:read");
  const supabase = await createClient();
  const page = parsePageParam(String(filters.page ?? 1));
  const pageSize = clampPageSize(PAGE_SIZE);
  const { from, to } = pageToRange(page, pageSize);

  let query = supabase.from("pricing_offers").select("*", { count: "exact" }).order("created_at", { ascending: false });
  if (filters.planId) query = query.eq("plan_id", filters.planId);
  if (filters.status) query = query.eq("status", filters.status);

  const { data, error, count } = await query.range(from, to);
  if (error) {
    logDbError("listPricingOffers", error);
    return { items: [], total: 0, page, pageSize };
  }
  return { items: (data ?? []).map(toPricingOffer), total: count ?? 0, page, pageSize };
}

export async function getPricingOfferById(id: string): Promise<PricingOffer | null> {
  await requireAdminPermission("pricing:read");
  const supabase = await createClient();
  const { data, error } = await supabase.from("pricing_offers").select("*").eq("id", id).maybeSingle();
  if (error) {
    logDbError("getPricingOfferById", error);
    return null;
  }
  return data ? toPricingOffer(data) : null;
}

interface OfferInput {
  publicOfferName: string;
  internalDescription: string | null;
  discountType: "fixed" | "percentage";
  discountPercentBps: number | null;
  discountAmountMinorUnits: number | null;
  discountCurrency: string | null;
  startsAt: string;
  endsAt: string;
  couponCode: string | null;
  maxRedemptions: number | null;
  perUserLimit: number | null;
}

async function parseOfferForm(formData: FormData, planCurrency: string): Promise<OfferInput> {
  const publicOfferName = String(formData.get("publicOfferName") ?? "").trim();
  if (!publicOfferName) throw new AdminValidationError("Public offer name is required.");
  const discountType = String(formData.get("discountType") ?? "").trim() as "fixed" | "percentage";
  if (!["fixed", "percentage"].includes(discountType)) throw new AdminValidationError("A valid discount type is required.");

  let discountPercentBps: number | null = null;
  let discountAmountMinorUnits: number | null = null;
  let discountCurrency: string | null = null;

  if (discountType === "percentage") {
    const pctRaw = String(formData.get("discountPercent") ?? "").trim();
    const pct = Number.parseFloat(pctRaw);
    if (!Number.isFinite(pct)) throw new AdminValidationError("Percentage must be greater than 0 and no more than 100.");
    discountPercentBps = Math.round(pct * 100);
  } else {
    discountCurrency = (String(formData.get("discountCurrency") ?? planCurrency).trim().toUpperCase() || planCurrency);
    const amountRaw = String(formData.get("discountAmount") ?? "").trim();
    const parsed = parseMoneyInput(amountRaw, discountCurrency);
    if (parsed === null || parsed <= 0) throw new AdminValidationError("Fixed discount amount must be a valid positive number.");
    discountAmountMinorUnits = parsed;
  }

  const startsAtRaw = String(formData.get("startsAt") ?? "").trim();
  const endsAtRaw = String(formData.get("endsAt") ?? "").trim();
  if (!startsAtRaw || !endsAtRaw) throw new AdminValidationError("Start and end date/time are both required.");
  const startsAt = new Date(startsAtRaw).toISOString();
  const endsAt = new Date(endsAtRaw).toISOString();

  const maxRedemptionsRaw = String(formData.get("maxRedemptions") ?? "").trim();
  const perUserLimitRaw = String(formData.get("perUserLimit") ?? "").trim();
  const maxRedemptions = maxRedemptionsRaw ? Number.parseInt(maxRedemptionsRaw, 10) : null;
  const perUserLimit = perUserLimitRaw ? Number.parseInt(perUserLimitRaw, 10) : null;
  const couponCodeRaw = String(formData.get("couponCode") ?? "").trim().toUpperCase();
  const couponCode = couponCodeRaw || null;

  const input: OfferInput = {
    publicOfferName,
    internalDescription: String(formData.get("internalDescription") ?? "").trim() || null,
    discountType,
    discountPercentBps,
    discountAmountMinorUnits,
    discountCurrency,
    startsAt,
    endsAt,
    couponCode,
    maxRedemptions: maxRedemptions !== null && Number.isInteger(maxRedemptions) ? maxRedemptions : null,
    perUserLimit: perUserLimit !== null && Number.isInteger(perUserLimit) ? perUserLimit : null,
  };

  const shapeErrors = validateOfferShape(input);
  if (shapeErrors.length > 0) throw new AdminValidationError(shapeErrors[0].message);

  return input;
}

/** Admin capability: "Add, schedule, disable and archive offers" — creation. Always is_active=false, status='draft' — "No offer should be active by default." */
export async function createPricingOffer(planId: string, formData: FormData): Promise<string> {
  const admin = await requireAdminPermission("pricing:write");
  const supabase = await createClient();

  const { data: plan } = await supabase.from("pricing_plans").select("id, internal_name, current_version_id").eq("id", planId).maybeSingle();
  if (!plan) throw new AdminValidationError("Pricing plan not found.");
  const { data: currentVersion } = plan.current_version_id ? await supabase.from("pricing_plan_versions").select("amount_minor_units, currency").eq("id", plan.current_version_id).maybeSingle() : { data: null };

  const input = await parseOfferForm(formData, currentVersion?.currency ?? "INR");
  if (currentVersion) {
    const planErrors = validateOfferAgainstPlan(input, { amountMinorUnits: currentVersion.amount_minor_units, currency: currentVersion.currency });
    if (planErrors.length > 0) throw new AdminValidationError(planErrors[0].message);
  }

  const { data, error } = await supabase
    .from("pricing_offers")
    .insert({
      plan_id: planId,
      public_offer_name: input.publicOfferName,
      internal_description: input.internalDescription,
      discount_type: input.discountType,
      discount_percent_bps: input.discountPercentBps,
      discount_amount_minor_units: input.discountAmountMinorUnits,
      discount_currency: input.discountCurrency,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      is_active: false,
      status: "draft",
      coupon_code: input.couponCode,
      max_redemptions: input.maxRedemptions,
      per_user_limit: input.perUserLimit,
      created_by: admin.userId,
      updated_by: admin.userId,
    })
    .select("id")
    .single();

  if (error) {
    logDbError("createPricingOffer", error);
    throw new Error(error.message);
  }

  await recordAuditLog({
    action: "Created",
    entityType: "pricing_offer",
    entityId: data.id,
    entityLabel: `offer "${input.publicOfferName}" on plan "${plan.internal_name}"`,
    after: { discountType: input.discountType, isActive: false, status: "draft" },
  });

  return data.id;
}

export async function updatePricingOffer(id: string, formData: FormData): Promise<void> {
  const admin = await requireAdminPermission("pricing:write");
  const supabase = await createClient();

  const { data: before } = await supabase.from("pricing_offers").select("*").eq("id", id).maybeSingle();
  if (!before) throw new AdminValidationError("Offer not found.");
  const { data: currentVersion } = await supabase.from("pricing_plans").select("current_version_id").eq("id", before.plan_id).maybeSingle();
  const { data: version } = currentVersion?.current_version_id ? await supabase.from("pricing_plan_versions").select("amount_minor_units, currency").eq("id", currentVersion.current_version_id).maybeSingle() : { data: null };

  const input = await parseOfferForm(formData, version?.currency ?? before.discount_currency ?? "INR");
  if (version) {
    const planErrors = validateOfferAgainstPlan(input, { amountMinorUnits: version.amount_minor_units, currency: version.currency });
    if (planErrors.length > 0) throw new AdminValidationError(planErrors[0].message);
  }

  const { error } = await supabase
    .from("pricing_offers")
    .update({
      public_offer_name: input.publicOfferName,
      internal_description: input.internalDescription,
      discount_type: input.discountType,
      discount_percent_bps: input.discountPercentBps,
      discount_amount_minor_units: input.discountAmountMinorUnits,
      discount_currency: input.discountCurrency,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      coupon_code: input.couponCode,
      max_redemptions: input.maxRedemptions,
      per_user_limit: input.perUserLimit,
      updated_by: admin.userId,
    })
    .eq("id", id);

  if (error) {
    logDbError("updatePricingOffer", error);
    throw new Error(error.message);
  }

  await recordAuditLog({
    action: "Updated",
    entityType: "pricing_offer",
    entityId: id,
    entityLabel: `offer "${input.publicOfferName}"`,
    before: { publicOfferName: before.public_offer_name },
    after: { publicOfferName: input.publicOfferName },
  });
}

/** Toggles the is_active flag only — spec's "disable" an offer, independent of its draft/published/archived status. */
export async function setPricingOfferActive(id: string, isActive: boolean): Promise<void> {
  const admin = await requireAdminPermission("pricing:write");
  const supabase = await createClient();

  const { data: before } = await supabase.from("pricing_offers").select("public_offer_name, is_active, status").eq("id", id).maybeSingle();
  if (!before) throw new AdminValidationError("Offer not found.");
  if (isActive && before.status !== "published") {
    throw new AdminValidationError("Only a published offer can be activated. Publish it first.");
  }

  const { error } = await supabase.from("pricing_offers").update({ is_active: isActive, updated_by: admin.userId }).eq("id", id);
  if (error) {
    logDbError("setPricingOfferActive", error);
    throw new Error(error.message);
  }

  await recordAuditLog({
    action: isActive ? "Activated" : "Deactivated",
    entityType: "pricing_offer",
    entityId: id,
    entityLabel: `offer "${before.public_offer_name}"`,
    fieldChangeSummaries: [`is_active: ${before.is_active} -> ${isActive}`],
    before: { isActive: before.is_active },
    after: { isActive },
  });
}

async function transitionOfferStatus(id: string, to: PricingOfferStatus): Promise<void> {
  const admin = await requireAdminPermission("pricing:write");
  const supabase = await createClient();

  const { data: before } = await supabase.from("pricing_offers").select("public_offer_name, status, is_active").eq("id", id).maybeSingle();
  if (!before) throw new AdminValidationError("Offer not found.");
  if (!isValidTransition(PRICING_OFFER_STATUS_TRANSITIONS, before.status as PricingOfferStatus, to)) {
    throw new AdminValidationError(`Cannot move an offer from "${before.status}" directly to "${to}".`);
  }

  // Archiving (or moving out of published) always also deactivates — an
  // offer that is not published can never be is_active (mirrors
  // setPricingOfferActive's own published-only guard above).
  const nextIsActive = to === "published" ? before.is_active : false;

  const { error } = await supabase.from("pricing_offers").update({ status: to, is_active: nextIsActive, updated_by: admin.userId }).eq("id", id);
  if (error) {
    logDbError("transitionOfferStatus", error);
    throw new Error(error.message);
  }

  await recordAuditLog({
    action: `Status changed to ${to}`,
    entityType: "pricing_offer",
    entityId: id,
    entityLabel: `offer "${before.public_offer_name}"`,
    fieldChangeSummaries: [`status: ${before.status} -> ${to}`],
    before: { status: before.status },
    after: { status: to },
  });
}

export async function publishPricingOffer(id: string): Promise<void> {
  await transitionOfferStatus(id, "published");
}

export async function archivePricingOffer(id: string): Promise<void> {
  await transitionOfferStatus(id, "archived");
}

export async function restorePricingOfferToDraft(id: string): Promise<void> {
  await transitionOfferStatus(id, "draft");
}
