import type { Metadata } from "next";
import Link from "next/link";
import { Receipt, Plus } from "lucide-react";
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
import { listInvoices } from "@/lib/supabase/admin/invoices";
import { INVOICE_STATUSES, INVOICE_STATUS_LABELS, type InvoiceStatus } from "@/types/payments";

export const metadata: Metadata = { title: "Invoices" };

interface InvoicesPageProps {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}

export default async function AdminInvoicesPage({ searchParams }: InvoicesPageProps) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const statusParam = params.status ?? "";
  const status = (INVOICE_STATUSES as readonly string[]).includes(statusParam) ? (statusParam as InvoiceStatus) : undefined;
  const parsedPage = params.page ? Number.parseInt(params.page, 10) : 1;
  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const result = await listInvoices({ query: query || undefined, status, page });

  const activeFilters: Record<string, string> = {};
  if (query) activeFilters.q = query;
  if (status) activeFilters.status = status;
  const hasActiveFilters = Boolean(query || status);

  return (
    <div className="max-w-6xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-secondary">Invoices</p>
          <h1 className="mt-2 text-2xl font-semibold text-primary sm:text-3xl">Invoices</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Create, issue, and track invoices. A status only ever moves to &quot;paid&quot; from cryptographically
            verified gateway evidence or an explicitly recorded offline payment — never automatically because a
            browser returned to a success page.
          </p>
        </div>
        <LinkButton href="/admin/invoices/new" icon={<Plus aria-hidden="true" className="h-4 w-4" />}>
          New invoice
        </LinkButton>
      </div>

      <Card className="mb-6">
        <FilterBar basePath="/admin/invoices" hasActiveFilters={hasActiveFilters}>
          <FormField id="q" label="Search">
            <Input id="q" name="q" defaultValue={query} placeholder="Invoice number" />
          </FormField>
          <FormField id="status" label="Status">
            <Select id="status" name="status" defaultValue={status ?? ""}>
              <option value="">All</option>
              {INVOICE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {INVOICE_STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
          </FormField>
        </FilterBar>
      </Card>

      {result.items.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title={hasActiveFilters ? "No invoices match your filters" : "No invoices yet"}
          description={hasActiveFilters ? "Try a broader search term, or clear a filter." : "Create the first invoice to start billing a student."}
          action={
            hasActiveFilters ? (
              <Link href="/admin/invoices" className="text-sm font-semibold text-secondary-dark hover:text-primary">
                Clear filters
              </Link>
            ) : (
              <LinkButton href="/admin/invoices/new" size="sm">
                New invoice
              </LinkButton>
            )
          }
        />
      ) : (
        <>
          <p className="mb-3 text-sm text-muted">
            {result.total} invoice{result.total === 1 ? "" : "s"} found
          </p>
          <AdminTable headers={["Invoice", "Student", "Total", "Due", "Status", "Due date", ""]}>
            {result.items.map((inv) => (
              <tr key={inv.id} className="hover:bg-surface-alt/50">
                <Td className="font-medium text-text">
                  <Link href={`/admin/invoices/${inv.id}`} className="hover:text-primary hover:underline">
                    {inv.invoiceNumber ?? `Draft ${inv.id.slice(0, 8)}`}
                  </Link>
                </Td>
                <Td className="text-text-soft">{inv.studentName ?? inv.studentEmail ?? "—"}</Td>
                <Td className="text-text-soft">{formatMoney(inv.totalMinorUnits, inv.currency)}</Td>
                <Td className="text-text-soft">{inv.dueMinorUnits > 0 ? formatMoney(inv.dueMinorUnits, inv.currency) : "—"}</Td>
                <Td>
                  <StatusBadge status={inv.status} labelOverride={INVOICE_STATUS_LABELS[inv.status]} />
                </Td>
                <Td className="text-text-soft">{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString("en-IN") : "—"}</Td>
                <Td>
                  <Link href={`/admin/invoices/${inv.id}`} className="text-sm font-semibold text-secondary-dark hover:text-primary">
                    View
                  </Link>
                </Td>
              </tr>
            ))}
          </AdminTable>
          <AdminPagination basePath="/admin/invoices" page={result.page} pageSize={result.pageSize} total={result.total} searchParams={activeFilters} />
        </>
      )}
    </div>
  );
}
