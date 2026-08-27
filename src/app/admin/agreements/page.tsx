import type { Metadata } from "next";
import Link from "next/link";
import { Signature, Plus } from "lucide-react";
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
import { listAgreements } from "@/lib/supabase/admin/agreements";
import type { AgreementStatus } from "@/types/admin";

export const metadata: Metadata = { title: "Agreements" };

const STATUSES: AgreementStatus[] = ["draft", "sent", "signed", "declined", "expired", "cancelled"];

interface AgreementsPageProps {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}

export default async function AdminAgreementsPage({ searchParams }: AgreementsPageProps) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const statusParam = params.status ?? "";
  const status = STATUSES.includes(statusParam as AgreementStatus) ? (statusParam as AgreementStatus) : undefined;
  const parsedPage = params.page ? Number.parseInt(params.page, 10) : 1;
  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const result = await listAgreements({ query: query || undefined, status, page });

  const activeFilters: Record<string, string> = {};
  if (query) activeFilters.q = query;
  if (status) activeFilters.status = status;
  const hasActiveFilters = Boolean(query || status);

  return (
    <div className="max-w-6xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-secondary">Agreements</p>
          <h1 className="mt-2 text-2xl font-semibold text-primary sm:text-3xl">Agreement management</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">No e-signature capability — signature status is manually and honestly tracked.</p>
        </div>
        <LinkButton href="/admin/agreements/new" icon={<Plus aria-hidden="true" className="h-4 w-4" />}>
          New agreement
        </LinkButton>
      </div>

      <Card className="mb-6">
        <FilterBar basePath="/admin/agreements" hasActiveFilters={hasActiveFilters}>
          <FormField id="q" label="Search">
            <Input id="q" name="q" defaultValue={query} placeholder="Agreement type" />
          </FormField>
          <FormField id="status" label="Status">
            <Select id="status" name="status" defaultValue={status ?? ""}>
              <option value="">All</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </Select>
          </FormField>
        </FilterBar>
      </Card>

      {result.items.length === 0 ? (
        <EmptyState
          icon={Signature}
          title={hasActiveFilters ? "No agreements match your filters" : "No agreements yet"}
          description={hasActiveFilters ? "Try a broader search term, or clear a filter." : "Add the first agreement to start tracking it."}
          action={
            hasActiveFilters ? (
              <Link href="/admin/agreements" className="text-sm font-semibold text-secondary-dark hover:text-primary">
                Clear filters
              </Link>
            ) : (
              <LinkButton href="/admin/agreements/new" size="sm">
                New agreement
              </LinkButton>
            )
          }
        />
      ) : (
        <>
          <p className="mb-3 text-sm text-muted">
            {result.total} agreement{result.total === 1 ? "" : "s"} found
          </p>
          <AdminTable headers={["Type", "Party", "Status", "Signature", ""]}>
            {result.items.map((a) => (
              <tr key={a.id} className="hover:bg-surface-alt/50">
                <Td className="font-medium text-text">
                  <Link href={`/admin/agreements/${a.id}`} className="hover:text-primary hover:underline">
                    {a.agreementType}
                  </Link>
                </Td>
                <Td className="text-text-soft">{a.studentName ?? a.counsellorName ?? a.universityName ?? "—"}</Td>
                <Td>
                  <StatusBadge status={a.status} />
                </Td>
                <Td>
                  <StatusBadge status={a.signatureStatus} />
                </Td>
                <Td>
                  <Link href={`/admin/agreements/${a.id}`} className="text-sm font-semibold text-secondary-dark hover:text-primary">
                    Edit
                  </Link>
                </Td>
              </tr>
            ))}
          </AdminTable>
          <AdminPagination basePath="/admin/agreements" page={result.page} pageSize={result.pageSize} total={result.total} searchParams={activeFilters} />
        </>
      )}
    </div>
  );
}
