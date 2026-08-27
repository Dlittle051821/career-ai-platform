import "server-only";
import { createClient } from "../server";
import { requireAdminPermission } from "../admin-auth";
import { cleanFilterParam, clampPageSize, pageToRange, parsePageParam } from "@/lib/admin/pagination";
import type { PaymentsListResult, WebhookEvent, WebhookProcessingStatus } from "@/types/payments";

/**
 * Read-only view of public.payment_webhook_events (the /admin/payment-events
 * page). Deliberately never exposes anything beyond what's already stored
 * in `payload_summary` — a small, pre-redacted JSON object built inside
 * apply_webhook_event() (event type, entity ids, amount, status). The raw
 * webhook body is never stored anywhere, so there is nothing more granular
 * to leak even if this query were broadened.
 */

function logDbError(context: string, error: unknown) {
  console.error(`[admin/webhook-events] ${context}:`, error);
}

interface WebhookEventRow {
  id: string;
  provider: string;
  event_type: string;
  processing_status: string;
  related_invoice_id: string | null;
  diagnostic_message: string | null;
  payload_summary: unknown;
  created_at: string;
  processed_at: string | null;
}

function toWebhookEvent(row: WebhookEventRow): WebhookEvent {
  return {
    id: row.id,
    provider: row.provider,
    eventType: row.event_type,
    processingStatus: row.processing_status as WebhookProcessingStatus,
    relatedInvoiceId: row.related_invoice_id,
    diagnosticMessage: row.diagnostic_message,
    payloadSummary: (row.payload_summary as Record<string, unknown> | null) ?? null,
    createdAt: row.created_at,
    processedAt: row.processed_at,
  };
}

export interface WebhookEventFilters {
  eventType?: string;
  processingStatus?: WebhookProcessingStatus;
  query?: string;
  page?: number;
}

const PAGE_SIZE = 30;

export async function listWebhookEvents(filters: WebhookEventFilters = {}): Promise<PaymentsListResult<WebhookEvent>> {
  await requireAdminPermission("payment-events:read");
  const supabase = await createClient();
  const page = parsePageParam(String(filters.page ?? 1));
  const pageSize = clampPageSize(PAGE_SIZE);
  const { from, to } = pageToRange(page, pageSize);

  let query = supabase.from("payment_webhook_events").select("*", { count: "exact" }).order("created_at", { ascending: false });
  if (filters.eventType) query = query.eq("event_type", filters.eventType);
  if (filters.processingStatus) query = query.eq("processing_status", filters.processingStatus);
  const cleanedQuery = cleanFilterParam(filters.query);
  if (cleanedQuery) query = query.ilike("event_type", `%${cleanedQuery.replace(/[,()%]/g, "")}%`);

  const { data, error, count } = await query.range(from, to);
  if (error) {
    logDbError("listWebhookEvents", error);
    return { items: [], total: 0, page, pageSize };
  }
  return { items: ((data ?? []) as WebhookEventRow[]).map(toWebhookEvent), total: count ?? 0, page, pageSize };
}

export async function getWebhookEventById(id: string): Promise<WebhookEvent | null> {
  await requireAdminPermission("payment-events:read");
  const supabase = await createClient();
  const { data, error } = await supabase.from("payment_webhook_events").select("*").eq("id", id).maybeSingle();
  if (error) {
    logDbError("getWebhookEventById", error);
    return null;
  }
  return data ? toWebhookEvent(data as WebhookEventRow) : null;
}
