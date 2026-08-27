import type { Metadata } from "next";
import Link from "next/link";
import { Wallet, Plus } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";
import { Select } from "@/components/forms/Select";
import { Input } from "@/components/forms/Input";
import { FormField } from "@/components/forms/FormField";
import { FilterBar } from "@/components/admin/FilterBar";
import { AdminTable, Td } from "@/components/admin/AdminTable";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { EmptyState } from "@/components/admin/EmptyState";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { formatMoney } from "@/lib/admin/money";
import { listPayments } from "@/lib/supabase/admin/payments";
import { PAYMENT_STATUS_LABELS, type PaymentStatus } from "@/types/admin";

export const metadata: Metadata = { title: "Payments" };

const STATUSES: PaymentStatus[] = ["pending", "paid", "failed", "refunded", "partially_refunded", "cancelled"];

interface PaymentsPageProps {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}

export default async function AdminPaymentsPage({ searchParams }: PaymentsPageProps) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const statusParam = params.status ?? "";
  const status = STATUSES.includes(statusParam as PaymentStatus) ? (statusParam as PaymentStatus) : undefined;
  const parsedPage = params.page ? Number.parseInt(params.page, 10) : 1;
  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const result = await listPayments({ query: query || undefined, status, page });

  const activeFilters: Record<string, string> = {};
  if (query) activeFilters.q = query;
  if (status) activeFilters.status = status;
  const hasActiveFilters = Boolean(query || status);

  return (
    <div className="max-w-6xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-secondary">Payments</p>
          <h1 className="mt-2 text-2xl font-semibold text-primary sm:text-3xl">Payment management</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Operational tracking only — this is not a payment processor. A &quot;paid&quot; record means an admin
            recorded that payment was received, not that a transaction was processed here.
          </p>
        </div>
        <LinkButton href="/admin/payments/new" icon={<Plus aria-hidden="true" className="h-4 w-4" />}>
          New payment record
        </LinkButton>
      </div>

      <Card className="mb-6">
        <FilterBar basePath="/admin/payments" hasActiveFilters={hasActiveFilters}>
          <FormField id="q" label="Search">
            <Input id="q" name="q" defaultValue={query} placeholder="Invoice or transaction reference" />
          </FormField>
          <FormField id="status" label="Status">
            <Select id="status" name="status" defaultValue={status ?? ""}>
              <option value="">All</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {PAYMENT_STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
          </FormField>
        </FilterBar>
      </Card>

      {result.items.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title={hasActiveFilters ? "No payments match your filters" : "No payment records yet"}
          description={hasActiveFilters ? "Try a broader search term, or clear a filter." : "Add the first payment record to start tracking it."}
          action={
            hasActiveFilters ? (
              <Link href="/admin/payments" className="text-sm font-semibold text-secondary-dark hover:text-primary">
                Clear filters
              </Link>
            ) : (
              <LinkButton href="/admin/payments/new" size="sm">
                New payment record
              </LinkButton>
            )
          }
        />
      ) : (
        <>
          <p className="mb-3 text-sm text-muted">
            {result.total} payment{result.total === 1 ? "" : "s"} found
          </p>
          <AdminTable headers={["Invoice", "Student", "Amount", "Status", "Due date", ""]}>
            {result.items.map((p) => (
              <tr key={p.id} className="hover:bg-surface-alt/50">
                <Td className="font-medium text-text">
                  <Link href={`/admin/payments/${p.id}`} className="hover:text-primary hover:underline">
                    {p.invoiceReference ?? p.id.slice(0, 8)}
                  </Link>
                </Td>
                <Td className="text-text-soft">{p.studentName ?? "Unlinked"}</Td>
                <Td className="text-text-soft">{formatMoney(p.amountMinorUnits, p.currency)}</Td>
                <Td>
                  <StatusBadge status={p.status} />
                </Td>
                <Td className="text-text-soft">{p.dueDate ? new Date(p.dueDate).toLocaleDateString("en-IN") : "—"}</Td>
                <Td>
                  <Link href={`/admin/payments/${p.id}`} className="text-sm font-semibold text-secondary-dark hover:text-primary">
                    Edit
                  </Link>
                </Td>
              </tr>
            ))}
          </AdminTable>
          <AdminPagination basePath="/admin/payments" page={result.page} pageSize={result.pageSize} total={result.total} searchParams={activeFilters} />
        </>
      )}
    </div>
  );
}
