import type { Metadata } from "next";
import Link from "next/link";
import { Webhook } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/forms/Input";
import { Select } from "@/components/forms/Select";
import { FormField } from "@/components/forms/FormField";
import { FilterBar } from "@/components/admin/FilterBar";
import { AdminTable, Td } from "@/components/admin/AdminTable";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { EmptyState } from "@/components/admin/EmptyState";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { listWebhookEvents } from "@/lib/supabase/admin/webhook-events";
import type { WebhookProcessingStatus } from "@/types/payments";

export const metadata: Metadata = { title: "Payment Events" };

const PROCESSING_STATUSES: WebhookProcessingStatus[] = ["received", "processed", "ignored", "failed"];

interface PaymentEventsPageProps {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}

export default async function AdminPaymentEventsPage({ searchParams }: PaymentEventsPageProps) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const statusParam = params.status ?? "";
  const processingStatus = (PROCESSING_STATUSES as readonly string[]).includes(statusParam) ? (statusParam as WebhookProcessingStatus) : undefined;
  const parsedPage = params.page ? Number.parseInt(params.page, 10) : 1;
  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const result = await listWebhookEvents({ query: query || undefined, processingStatus, page });

  const activeFilters: Record<string, string> = {};
  if (query) activeFilters.q = query;
  if (processingStatus) activeFilters.status = processingStatus;

  return (
    <div className="max-w-6xl">
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-secondary">Payment Events</p>
        <h1 className="mt-2 text-2xl font-semibold text-primary sm:text-3xl">Payment gateway events</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Every Razorpay webhook delivery this system has verified and accepted, in order. Only a small, redacted
          summary is stored — never the raw webhook body, and never any secret or card data.
        </p>
      </div>

      <Card className="mb-6">
        <FilterBar basePath="/admin/payment-events" hasActiveFilters={Boolean(query || processingStatus)}>
          <FormField id="q" label="Event type">
            <Input id="q" name="q" defaultValue={query} placeholder="e.g. payment.captured" />
          </FormField>
          <FormField id="status" label="Processing status">
            <Select id="status" name="status" defaultValue={processingStatus ?? ""}>
              <option value="">All</option>
              {PROCESSING_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </FormField>
        </FilterBar>
      </Card>

      {result.items.length === 0 ? (
        <EmptyState icon={Webhook} title="No webhook events yet" description="Once your Razorpay webhook is configured and deliveries start arriving, they'll be listed here." />
      ) : (
        <>
          <p className="mb-3 text-sm text-muted">
            {result.total} event{result.total === 1 ? "" : "s"} found
          </p>
          <AdminTable headers={["Event", "Status", "Invoice", "Note", "Received"]}>
            {result.items.map((e) => (
              <tr key={e.id} className="hover:bg-surface-alt/50">
                <Td className="font-medium text-text">{e.eventType}</Td>
                <Td>
                  <StatusBadge status={e.processingStatus} />
                </Td>
                <Td className="text-text-soft">
                  {e.relatedInvoiceId ? (
                    <Link href={`/admin/invoices/${e.relatedInvoiceId}`} className="text-secondary-dark hover:text-primary hover:underline">
                      View invoice
                    </Link>
                  ) : (
                    "—"
                  )}
                </Td>
                <Td className="max-w-xs text-text-soft">
                  <span className="block truncate" title={e.diagnosticMessage ?? undefined}>
                    {e.diagnosticMessage ?? "—"}
                  </span>
                </Td>
                <Td className="text-text-soft">{new Date(e.createdAt).toLocaleString("en-IN")}</Td>
              </tr>
            ))}
          </AdminTable>
          <AdminPagination basePath="/admin/payment-events" page={result.page} pageSize={result.pageSize} total={result.total} searchParams={activeFilters} />
        </>
      )}
    </div>
  );
}
