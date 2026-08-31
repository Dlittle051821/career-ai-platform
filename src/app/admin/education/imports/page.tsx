import type { Metadata } from "next";
import Link from "next/link";
import { UploadCloud, Plus } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";
import { Select } from "@/components/forms/Select";
import { FormField } from "@/components/forms/FormField";
import { FilterBar } from "@/components/admin/FilterBar";
import { AdminTable, Td } from "@/components/admin/AdminTable";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { EmptyState } from "@/components/admin/EmptyState";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { listImportBatches } from "@/lib/supabase/admin/education-imports";
import { IMPORT_ENTITY_TYPE_LABELS } from "@/lib/admin/education-import-labels";
import { IMPORT_BATCH_STATUSES, IMPORT_BATCH_STATUS_LABELS, IMPORT_ENTITY_TYPES, type ImportBatchStatus, type ImportEntityType } from "@/types/education";

export const metadata: Metadata = { title: "Data Imports" };

interface ImportsPageProps {
  searchParams: Promise<{ entityType?: string; status?: string; page?: string }>;
}

export default async function AdminEducationImportsPage({ searchParams }: ImportsPageProps) {
  const params = await searchParams;
  const entityTypeParam = params.entityType ?? "";
  const statusParam = params.status ?? "";
  const parsedPage = params.page ? Number.parseInt(params.page, 10) : 1;
  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const entityType = (IMPORT_ENTITY_TYPES as readonly string[]).includes(entityTypeParam) ? (entityTypeParam as ImportEntityType) : undefined;
  const status = (IMPORT_BATCH_STATUSES as readonly string[]).includes(statusParam) ? (statusParam as ImportBatchStatus) : undefined;

  const result = await listImportBatches({ entityType, status, page });

  const activeFilters: Record<string, string> = {};
  if (entityTypeParam) activeFilters.entityType = entityTypeParam;
  if (statusParam) activeFilters.status = statusParam;
  const hasActiveFilters = Boolean(entityTypeParam || statusParam);

  return (
    <div className="max-w-6xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-secondary">Data Imports</p>
          <h1 className="mt-2 text-2xl font-semibold text-primary sm:text-3xl">CSV import batches</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Bulk-load universities, courses, and related data from a local CSV file. Every upload is validated and
            previewed first — nothing is written to the live database until an admin explicitly confirms it. This
            pipeline only reads files you upload here; it never fetches anything from the web.
          </p>
        </div>
        <LinkButton href="/admin/education/imports/new" icon={<Plus aria-hidden="true" className="h-4 w-4" />}>
          New import
        </LinkButton>
      </div>

      <Card className="mb-6">
        <FilterBar basePath="/admin/education/imports" hasActiveFilters={hasActiveFilters}>
          <FormField id="entityType" label="Data type">
            <Select id="entityType" name="entityType" defaultValue={entityTypeParam}>
              <option value="">All</option>
              {IMPORT_ENTITY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {IMPORT_ENTITY_TYPE_LABELS[t]}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField id="status" label="Status">
            <Select id="status" name="status" defaultValue={statusParam}>
              <option value="">All</option>
              {IMPORT_BATCH_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {IMPORT_BATCH_STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
          </FormField>
        </FilterBar>
      </Card>

      {result.items.length === 0 ? (
        <EmptyState
          icon={UploadCloud}
          title={hasActiveFilters ? "No imports match your filters" : "No imports yet"}
          description={
            hasActiveFilters
              ? "Try a broader filter, or clear it."
              : "Upload a CSV to bulk-load universities, courses, or related records."
          }
          action={
            hasActiveFilters ? (
              <Link href="/admin/education/imports" className="text-sm font-semibold text-secondary-dark hover:text-primary">
                Clear filters
              </Link>
            ) : (
              <LinkButton href="/admin/education/imports/new" size="sm">
                New import
              </LinkButton>
            )
          }
        />
      ) : (
        <>
          <p className="mb-3 text-sm text-muted">
            {result.total} batch{result.total === 1 ? "" : "es"} found
          </p>
          <AdminTable headers={["File", "Data type", "Status", "Rows", "Applied", "Created", ""]}>
            {result.items.map((b) => (
              <tr key={b.id} className="hover:bg-surface-alt/50">
                <Td className="font-medium text-text">
                  <Link href={`/admin/education/imports/${b.id}`} className="hover:text-primary hover:underline">
                    {b.fileName ?? "—"}
                  </Link>
                </Td>
                <Td className="text-text-soft">{IMPORT_ENTITY_TYPE_LABELS[b.entityType]}</Td>
                <Td>
                  <StatusBadge status={b.status} labelOverride={IMPORT_BATCH_STATUS_LABELS[b.status]} />
                </Td>
                <Td className="text-text-soft">
                  {b.totalRecords} total · {b.successfulRecords} ok · {b.rejectedRecords} rejected
                  {b.warningCount > 0 ? ` · ${b.warningCount} warning${b.warningCount === 1 ? "" : "s"}` : ""}
                </Td>
                <Td>
                  <StatusBadge status={b.dryRun ? "pending" : "active"} labelOverride={b.dryRun ? "Preview only" : "Applied"} />
                </Td>
                <Td className="text-text-soft">{new Date(b.createdAt).toLocaleString("en-IN")}</Td>
                <Td>
                  <Link href={`/admin/education/imports/${b.id}`} className="text-sm font-semibold text-secondary-dark hover:text-primary">
                    View
                  </Link>
                </Td>
              </tr>
            ))}
          </AdminTable>
          <AdminPagination basePath="/admin/education/imports" page={result.page} pageSize={result.pageSize} total={result.total} searchParams={activeFilters} />
        </>
      )}
    </div>
  );
}
