import type { Metadata } from "next";
import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/forms/Select";
import { FormField } from "@/components/forms/FormField";
import { FilterBar } from "@/components/admin/FilterBar";
import { AdminTable, Td } from "@/components/admin/AdminTable";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { EmptyState } from "@/components/admin/EmptyState";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { formatMoney } from "@/lib/admin/money";
import { listRefunds } from "@/lib/supabase/admin/refunds";
import { REFUND_STATUSES, REFUND_STATUS_LABELS, type RefundStatus } from "@/types/payments";

export const metadata: Metadata = { title: "Refunds" };

interface RefundsPageProps {
  searchParams: Promise<{ status?: string; page?: string }>;
}

export default async function AdminRefundsPage({ searchParams }: RefundsPageProps) {
  const params = await searchParams;
  const statusParam = params.status ?? "";
  const status = (REFUND_STATUSES as readonly string[]).includes(statusParam) ? (statusParam as RefundStatus) : undefined;
  const parsedPage = params.page ? Number.parseInt(params.page, 10) : 1;
  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const result = await listRefunds({ status, page });

  const activeFilters: Record<string, string> = {};
  if (status) activeFilters.status = status;

  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-secondary">Refunds</p>
        <h1 className="mt-2 text-2xl font-semibold text-primary sm:text-3xl">Refunds</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Refunds are initiated from an invoice&apos;s payment activity. Final confirmation that a refund actually
          completed comes from Razorpay&apos;s webhook, not from this system alone.
        </p>
      </div>

      <Card className="mb-6">
        <FilterBar basePath="/admin/refunds" hasActiveFilters={Boolean(status)}>
          <FormField id="status" label="Status">
            <Select id="status" name="status" defaultValue={status ?? ""}>
              <option value="">All</option>
              {REFUND_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {REFUND_STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
          </FormField>
        </FilterBar>
      </Card>

      {result.items.length === 0 ? (
        <EmptyState icon={RotateCcw} title="No refunds yet" description="Refunds initiated from an invoice will appear here." />
      ) : (
        <>
          <p className="mb-3 text-sm text-muted">
            {result.total} refund{result.total === 1 ? "" : "s"} found
          </p>
          <AdminTable headers={["Invoice", "Amount", "Status", "Reason", "Requested"]}>
            {result.items.map((r) => (
              <tr key={r.id} className="hover:bg-surface-alt/50">
                <Td className="font-medium text-text">
                  <Link href={`/admin/invoices/${r.invoiceId}`} className="hover:text-primary hover:underline">
                    View invoice
                  </Link>
                </Td>
                <Td className="text-text-soft">{formatMoney(r.amountMinorUnits, "INR")}</Td>
                <Td>
                  <StatusBadge status={r.status} labelOverride={REFUND_STATUS_LABELS[r.status]} />
                </Td>
                <Td className="text-text-soft">{r.reason ?? "—"}</Td>
                <Td className="text-text-soft">{new Date(r.createdAt).toLocaleString("en-IN")}</Td>
              </tr>
            ))}
          </AdminTable>
          <AdminPagination basePath="/admin/refunds" page={result.page} pageSize={result.pageSize} total={result.total} searchParams={activeFilters} />
        </>
      )}
    </div>
  );
}
