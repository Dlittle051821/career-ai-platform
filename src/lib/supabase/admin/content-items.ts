import "server-only";
import { createClient } from "../server";
import { requireAdminPermission } from "../admin-auth";
import { recordAuditLog } from "./audit";
import { AdminValidationError } from "@/lib/admin/form-state";
import { normalizeContentBody, isValidContentSlug } from "@/lib/admin/content";
import { CONTENT_STATUS_TRANSITIONS, isValidTransition } from "@/lib/admin/status";
import { cleanFilterParam, clampPageSize, pageToRange, parsePageParam } from "@/lib/admin/pagination";
import type { AdminListResult, ContentItem, ContentStatus, ContentType } from "@/types/admin";

function logDbError(context: string, error: unknown) {
  console.error(`[admin/content-items] ${context}:`, error);
}

function toContentItem(row: {
  id: string;
  content_type: string;
  slug: string;
  content_key: string | null;
  locale: string;
  title: string;
  body: string;
  status: string;
  sort_order: number;
  published_at: string | null;
  editor_user_id: string | null;
  created_at: string;
  updated_at: string;
}): ContentItem {
  return {
    id: row.id,
    contentType: row.content_type as ContentType,
    slug: row.slug,
    contentKey: row.content_key,
    locale: row.locale,
    title: row.title,
    body: row.body,
    status: row.status as ContentStatus,
    sortOrder: row.sort_order,
    publishedAt: row.published_at,
    editorUserId: row.editor_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface ContentItemFilters {
  query?: string;
  contentType?: ContentType;
  status?: ContentStatus;
  page?: number;
}

const PAGE_SIZE = 20;

export async function listContentItems(filters: ContentItemFilters = {}): Promise<AdminListResult<ContentItem>> {
  await requireAdminPermission("content:read");
  const supabase = await createClient();
  const page = parsePageParam(String(filters.page ?? 1));
  const pageSize = clampPageSize(PAGE_SIZE);
  const { from, to } = pageToRange(page, pageSize);

  let query = supabase.from("content_items").select("*", { count: "exact" }).order("sort_order", { ascending: true }).order("created_at", { ascending: false });
  if (filters.contentType) query = query.eq("content_type", filters.contentType);
  if (filters.status) query = query.eq("status", filters.status);
  const cleanedQuery = cleanFilterParam(filters.query);
  if (cleanedQuery) {
    const term = cleanedQuery.replace(/[,()%]/g, "");
    query = query.or(`title.ilike.%${term}%,slug.ilike.%${term}%`);
  }

  const { data, error, count } = await query.range(from, to);
  if (error) {
    logDbError("listContentItems", error);
    return { items: [], total: 0, page, pageSize };
  }
  return { items: (data ?? []).map(toContentItem), total: count ?? 0, page, pageSize };
}

export async function getContentItemById(id: string): Promise<ContentItem | null> {
  await requireAdminPermission("content:read");
  const supabase = await createClient();
  const { data, error } = await supabase.from("content_items").select("*").eq("id", id).maybeSingle();
  if (error) {
    logDbError("getContentItemById", error);
    return null;
  }
  return data ? toContentItem(data) : null;
}

const CONTENT_TYPES: ContentType[] = ["faq", "announcement", "page_block"];

interface ContentItemInput {
  contentType: ContentType;
  slug: string;
  contentKey: string | null;
  locale: string;
  title: string;
  body: string;
  sortOrder: number;
}

function parseContentItemForm(formData: FormData): ContentItemInput {
  const contentTypeRaw = String(formData.get("contentType") ?? "").trim();
  if (!CONTENT_TYPES.includes(contentTypeRaw as ContentType)) throw new AdminValidationError("A valid content type is required.");
  const slug = String(formData.get("slug") ?? "").trim().toLowerCase();
  if (!isValidContentSlug(slug)) throw new AdminValidationError("Slug must be lowercase letters, numbers, and single hyphens only.");
  const title = String(formData.get("title") ?? "").trim();
  if (!title) throw new AdminValidationError("Title is required.");
  const body = normalizeContentBody(String(formData.get("body") ?? ""));
  if (!body) throw new AdminValidationError("Body is required.");

  const sortOrderRaw = String(formData.get("sortOrder") ?? "0").trim();
  const sortOrder = Number.parseInt(sortOrderRaw, 10);

  return {
    contentType: contentTypeRaw as ContentType,
    slug,
    contentKey: String(formData.get("contentKey") ?? "").trim() || null,
    locale: String(formData.get("locale") ?? "en").trim() || "en",
    title,
    body,
    sortOrder: Number.isInteger(sortOrder) ? sortOrder : 0,
  };
}

export async function createContentItem(formData: FormData): Promise<string> {
  const admin = await requireAdminPermission("content:write");
  const input = parseContentItemForm(formData);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("content_items")
    .insert({
      content_type: input.contentType,
      slug: input.slug,
      content_key: input.contentKey,
      locale: input.locale,
      title: input.title,
      body: input.body,
      status: "draft",
      sort_order: input.sortOrder,
      published_at: null,
      editor_user_id: admin.userId,
    })
    .select("id")
    .single();

  if (error) {
    logDbError("createContentItem", error);
    throw new Error(error.message);
  }

  await recordAuditLog({
    action: "Created",
    entityType: "content_item",
    entityId: data.id,
    entityLabel: `content "${input.title}"`,
    after: { status: "draft", contentType: input.contentType },
  });

  return data.id;
}

export async function updateContentItem(id: string, formData: FormData): Promise<void> {
  const admin = await requireAdminPermission("content:write");
  const input = parseContentItemForm(formData);
  const requestedStatusRaw = String(formData.get("status") ?? "").trim();
  const supabase = await createClient();

  const before = await getContentItemById(id);
  if (!before) throw new AdminValidationError("Content item not found.");

  const requestedStatus = (requestedStatusRaw || before.status) as ContentStatus;
  if (!isValidTransition(CONTENT_STATUS_TRANSITIONS, before.status, requestedStatus)) {
    throw new AdminValidationError(`Cannot move content from "${before.status}" directly to "${requestedStatus}".`);
  }

  // Publishing stamps published_at fresh every time a draft becomes
  // published (never editable directly) — an honest "when did this go
  // live" timestamp, not something a form field could backdate.
  const nowPublishing = requestedStatus === "published" && before.status !== "published";
  const publishedAt = nowPublishing ? new Date().toISOString() : before.publishedAt;

  const { error } = await supabase
    .from("content_items")
    .update({
      content_type: input.contentType,
      slug: input.slug,
      content_key: input.contentKey,
      locale: input.locale,
      title: input.title,
      body: input.body,
      status: requestedStatus,
      sort_order: input.sortOrder,
      published_at: publishedAt,
      editor_user_id: admin.userId,
    })
    .eq("id", id);

  if (error) {
    logDbError("updateContentItem", error);
    throw new Error(error.message);
  }

  const fieldChangeSummaries: string[] = [];
  if (before.status !== requestedStatus) fieldChangeSummaries.push(`status: ${before.status} -> ${requestedStatus}`);
  if (before.title !== input.title) fieldChangeSummaries.push(`title: ${before.title} -> ${input.title}`);

  await recordAuditLog({
    action: "Updated",
    entityType: "content_item",
    entityId: id,
    entityLabel: `content "${input.title}"`,
    fieldChangeSummaries,
    before: { status: before.status, title: before.title },
    after: { status: requestedStatus, title: input.title },
  });
}
