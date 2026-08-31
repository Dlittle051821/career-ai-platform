import "server-only";
import { createClient } from "../server";
import { requireAdminPermission, requireAdminRole } from "../admin-auth";
import { recordAuditLog } from "./audit";
import { AdminValidationError } from "@/lib/admin/form-state";
import { clampPageSize, pageToRange, parsePageParam } from "@/lib/admin/pagination";
import type { AdminListResult } from "@/types/admin";
import type {
  DataQualityStatus,
  EducationDataProvenance,
  EducationVerificationStatus,
  ProvenanceEntityType,
  ProvenanceSourceType,
} from "@/types/education";
import { PROVENANCE_ENTITY_TYPES, PROVENANCE_SOURCE_TYPES } from "@/types/education";

/**
 * Milestone 9 — Data provenance / source listing (new table; see
 * supabase/migrations/0006_global_university_course_data.sql PART 9).
 *
 * This table is the single admin-facing place to see, per record, where its
 * data came from, when it was retrieved/verified, and which import batch
 * (if any) produced it — the spec's "traceable provenance for every
 * imported entity" requirement. The public-safe subset (last verified date,
 * source URL) is separately mirrored as plain columns directly on
 * universities/courses/etc. (see education-*.ts's own toX() mappers) so
 * public pages never need read access to this admin-only table.
 *
 * Writing here has no dedicated "education-sources:write" permission in
 * src/lib/admin/permissions.ts — RLS (see 0006 PART 9) allows
 * super_admin/admin/content_editor to write regardless of entity type, so
 * `upsertProvenanceRecord` mirrors that with requireAdminRole rather than a
 * permission string. In practice most provenance rows are written by the
 * CSV import pipeline (src/lib/supabase/admin/education-imports.ts); this
 * function exists for the rarer manual correction (e.g. an admin marking a
 * record newly verified after confirming it against the official page).
 */

function logDbError(context: string, error: unknown) {
  console.error(`[admin/education-sources] ${context}:`, error);
}

interface ProvenanceRow {
  id: string;
  entity_type: string;
  entity_id: string;
  source_provider: string | null;
  source_type: string;
  source_url: string | null;
  source_record_id: string | null;
  retrieved_at: string | null;
  last_verified_at: string | null;
  import_batch_id: string | null;
  raw_record_checksum: string | null;
  verification_status: string;
  data_quality_status: string;
  created_at: string;
  updated_at: string;
}

/** Which table (and its display-label column) backs each provenance entity type. */
type EntityTableName = "universities" | "campuses" | "courses" | "course_intakes" | "course_tuition_fees" | "course_admission_requirements" | "scholarships";

const ENTITY_TABLE_MAP: Record<ProvenanceEntityType, { table: EntityTableName; labelColumn: string }> = {
  university: { table: "universities", labelColumn: "name" },
  campus: { table: "campuses", labelColumn: "name" },
  course: { table: "courses", labelColumn: "name" },
  course_intake: { table: "course_intakes", labelColumn: "intake_name" },
  course_tuition_fee: { table: "course_tuition_fees", labelColumn: "academic_year" },
  course_admission_requirement: { table: "course_admission_requirements", labelColumn: "accepted_qualification" },
  scholarship: { table: "scholarships", labelColumn: "name" },
};

function toProvenance(row: ProvenanceRow, entityLabel: string | null): EducationDataProvenance & { entityLabel: string | null } {
  return {
    id: row.id,
    entityType: row.entity_type as ProvenanceEntityType,
    entityId: row.entity_id,
    entityLabel,
    sourceProvider: row.source_provider,
    sourceType: row.source_type as ProvenanceSourceType,
    sourceUrl: row.source_url,
    sourceRecordId: row.source_record_id,
    retrievedAt: row.retrieved_at,
    lastVerifiedAt: row.last_verified_at,
    importBatchId: row.import_batch_id,
    rawRecordChecksum: row.raw_record_checksum,
    verificationStatus: row.verification_status as EducationVerificationStatus,
    dataQualityStatus: row.data_quality_status as DataQualityStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function resolveEntityLabels(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rows: ProvenanceRow[],
): Promise<Map<string, string>> {
  const labelById = new Map<string, string>();
  const idsByType = new Map<ProvenanceEntityType, string[]>();
  for (const row of rows) {
    const type = row.entity_type as ProvenanceEntityType;
    const bucket = idsByType.get(type) ?? [];
    bucket.push(row.entity_id);
    idsByType.set(type, bucket);
  }
  await Promise.all(
    Array.from(idsByType.entries()).map(async ([type, ids]) => {
      const { table, labelColumn } = ENTITY_TABLE_MAP[type];
      // Selecting "*" rather than a dynamically-built column list: the
      // hand-written Supabase types in src/types/database.ts parse a
      // literal select string at compile time, which a template-literal
      // column name (labelColumn varies per entity type) can't satisfy.
      const { data } = await supabase.from(table).select("*").in("id", Array.from(new Set(ids)));
      for (const record of (data ?? []) as unknown as Array<Record<string, unknown>>) {
        const id = String(record.id);
        const label = record[labelColumn];
        labelById.set(`${type}:${id}`, typeof label === "string" ? label : id);
      }
    }),
  );
  return labelById;
}

export interface ProvenanceFilters {
  entityType?: ProvenanceEntityType;
  verificationStatus?: EducationVerificationStatus;
  dataQualityStatus?: DataQualityStatus;
  sourceType?: ProvenanceSourceType;
  importBatchId?: string;
  page?: number;
  pageSize?: number;
}

export async function listProvenanceRecords(
  filters: ProvenanceFilters = {},
): Promise<AdminListResult<EducationDataProvenance & { entityLabel: string | null }>> {
  await requireAdminPermission("education-sources:read");
  const supabase = await createClient();
  const page = parsePageParam(filters.page ? String(filters.page) : undefined);
  const pageSize = clampPageSize(filters.pageSize);
  const { from, to } = pageToRange(page, pageSize);

  let query = supabase.from("education_data_provenance").select("*", { count: "exact" }).order("updated_at", { ascending: false }).range(from, to);
  if (filters.entityType) query = query.eq("entity_type", filters.entityType);
  if (filters.verificationStatus) query = query.eq("verification_status", filters.verificationStatus);
  if (filters.dataQualityStatus) query = query.eq("data_quality_status", filters.dataQualityStatus);
  if (filters.sourceType) query = query.eq("source_type", filters.sourceType);
  if (filters.importBatchId) query = query.eq("import_batch_id", filters.importBatchId);

  const { data, error, count } = await query;
  if (error) {
    logDbError("listProvenanceRecords", error);
    return { items: [], total: 0, page, pageSize };
  }

  const rows = (data ?? []) as ProvenanceRow[];
  const labelById = await resolveEntityLabels(supabase, rows);
  return {
    items: rows.map((r) => toProvenance(r, labelById.get(`${r.entity_type}:${r.entity_id}`) ?? null)),
    total: count ?? 0,
    page,
    pageSize,
  };
}

export async function getProvenanceForEntity(entityType: ProvenanceEntityType, entityId: string): Promise<(EducationDataProvenance & { entityLabel: string | null }) | null> {
  await requireAdminPermission("education-sources:read");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("education_data_provenance")
    .select("*")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .maybeSingle();
  if (error) {
    logDbError("getProvenanceForEntity", error);
    return null;
  }
  if (!data) return null;
  const row = data as ProvenanceRow;
  const labelById = await resolveEntityLabels(supabase, [row]);
  return toProvenance(row, labelById.get(`${row.entity_type}:${row.entity_id}`) ?? null);
}

interface ProvenanceInput {
  entityType: ProvenanceEntityType;
  entityId: string;
  sourceProvider: string | null;
  sourceType: ProvenanceSourceType;
  sourceUrl: string | null;
  sourceRecordId: string | null;
  retrievedAt: string | null;
  lastVerifiedAt: string | null;
  verificationStatus: EducationVerificationStatus;
  dataQualityStatus: DataQualityStatus;
}

function parseDateField(formData: FormData, key: string, label: string): string | null {
  const raw = String(formData.get(key) ?? "").trim();
  if (!raw) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new AdminValidationError(`${label} must be a valid date (YYYY-MM-DD).`);
  return raw;
}

function parseProvenanceForm(formData: FormData): ProvenanceInput {
  const entityTypeRaw = String(formData.get("entityType") ?? "").trim();
  if (!(PROVENANCE_ENTITY_TYPES as readonly string[]).includes(entityTypeRaw)) {
    throw new AdminValidationError("Entity type is not recognized.");
  }
  const entityId = String(formData.get("entityId") ?? "").trim();
  if (!entityId) throw new AdminValidationError("An entity must be specified.");

  const sourceTypeRaw = String(formData.get("sourceType") ?? "manual_admin_entry").trim();
  const sourceType = (PROVENANCE_SOURCE_TYPES as readonly string[]).includes(sourceTypeRaw)
    ? (sourceTypeRaw as ProvenanceSourceType)
    : "manual_admin_entry";

  const verificationStatusRaw = String(formData.get("verificationStatus") ?? "unverified").trim();
  const verificationStatus: EducationVerificationStatus = ["unverified", "needs_review", "verified"].includes(verificationStatusRaw)
    ? (verificationStatusRaw as EducationVerificationStatus)
    : "unverified";

  const dataQualityStatusRaw = String(formData.get("dataQualityStatus") ?? "unknown").trim();
  const dataQualityStatus: DataQualityStatus = ["current", "review_soon", "stale", "unknown"].includes(dataQualityStatusRaw)
    ? (dataQualityStatusRaw as DataQualityStatus)
    : "unknown";

  return {
    entityType: entityTypeRaw as ProvenanceEntityType,
    entityId,
    sourceProvider: String(formData.get("sourceProvider") ?? "").trim() || null,
    sourceType,
    sourceUrl: String(formData.get("sourceUrl") ?? "").trim() || null,
    sourceRecordId: String(formData.get("sourceRecordId") ?? "").trim() || null,
    retrievedAt: parseDateField(formData, "retrievedAt", "Retrieved date"),
    lastVerifiedAt: parseDateField(formData, "lastVerifiedAt", "Last-verified date"),
    verificationStatus,
    dataQualityStatus,
  };
}

/** Creates or updates the single provenance row for (entityType, entityId) — matches the table's `unique (entity_type, entity_id)` constraint. */
export async function upsertProvenanceRecord(formData: FormData): Promise<void> {
  const admin = await requireAdminRole(["super_admin", "admin", "content_editor"]);
  const input = parseProvenanceForm(formData);
  const supabase = await createClient();

  // `.upsert()` replaces the whole row, and this table's Insert type
  // requires every column — so a manual correction here must carry
  // forward any existing import_batch_id/raw_record_checksum rather than
  // silently wiping the link back to the import batch that originally
  // created this row (same class of bug as universityWriteFields
  // clobbering `ranking`/`merged_into_id` — see education-imports.ts).
  const { data: existing } = await supabase
    .from("education_data_provenance")
    .select("import_batch_id, raw_record_checksum")
    .eq("entity_type", input.entityType)
    .eq("entity_id", input.entityId)
    .maybeSingle();

  const { error } = await supabase
    .from("education_data_provenance")
    .upsert(
      {
        entity_type: input.entityType,
        entity_id: input.entityId,
        source_provider: input.sourceProvider,
        source_type: input.sourceType,
        source_url: input.sourceUrl,
        source_record_id: input.sourceRecordId,
        retrieved_at: input.retrievedAt,
        last_verified_at: input.lastVerifiedAt,
        verification_status: input.verificationStatus,
        data_quality_status: input.dataQualityStatus,
        import_batch_id: existing?.import_batch_id ?? null,
        raw_record_checksum: existing?.raw_record_checksum ?? null,
      },
      { onConflict: "entity_type,entity_id" },
    );
  if (error) {
    logDbError("upsertProvenanceRecord", error);
    throw new Error(error.message);
  }

  await recordAuditLog({
    action: "Updated",
    entityType: "education_data_provenance",
    entityId: input.entityId,
    entityLabel: `provenance for ${input.entityType} (${input.entityId})`,
    context: { updatedBy: admin.userId },
    after: { verificationStatus: input.verificationStatus, dataQualityStatus: input.dataQualityStatus, sourceType: input.sourceType },
  });
}
