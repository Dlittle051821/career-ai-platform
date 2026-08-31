import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, Link2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/forms/Select";
import { FormField } from "@/components/forms/FormField";
import { FilterBar } from "@/components/admin/FilterBar";
import { AdminTable, Td } from "@/components/admin/AdminTable";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { EmptyState } from "@/components/admin/EmptyState";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { MarkVerifiedForm } from "@/components/admin/education/MarkVerifiedForm";
import { listProvenanceRecords } from "@/lib/supabase/admin/education-sources";
import {
  DATA_QUALITY_STATUSES,
  EDUCATION_VERIFICATION_STATUSES,
  EDUCATION_VERIFICATION_STATUS_LABELS,
  PROVENANCE_ENTITY_TYPES,
  PROVENANCE_SOURCE_TYPES,
  type DataQualityStatus,
  type EducationVerificationStatus,
  type ProvenanceEntityType,
  type ProvenanceSourceType,
} from "@/types/education";

export const metadata: Metadata = { title: "Data Sources" };

function titleCase(value: string): string {
  return value
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Only university/course provenance rows have a standalone admin edit page to link to — campuses, intakes, tuition fees, admission requirements, and scholarships are sub-records with no route of their own. */
function entityHref(entityType: ProvenanceEntityType, entityId: string): string | null {
  if (entityType === "university") return `/admin/universities/${entityId}`;
  if (entityType === "course") return `/admin/courses/${entityId}`;
  return null;
}

interface SourcesPageProps {
  searchParams: Promise<{
    entityType?: string;
    verificationStatus?: string;
    dataQualityStatus?: string;
    sourceType?: string;
    page?: string;
  }>;
}

export default async function AdminSourcesPage({ searchParams }: SourcesPageProps) {
  const params = await searchParams;
  const entityTypeParam = params.entityType ?? "";
  const verificationStatusParam = params.verificationStatus ?? "";
  const dataQualityStatusParam = params.dataQualityStatus ?? "";
  const sourceTypeParam = params.sourceType ?? "";
  const parsedPage = params.page ? Number.parseInt(params.page, 10) : 1;
  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const entityType = (PROVENANCE_ENTITY_TYPES as readonly string[]).includes(entityTypeParam)
    ? (entityTypeParam as ProvenanceEntityType)
    : undefined;
  const verificationStatus = (EDUCATION_VERIFICATION_STATUSES as readonly string[]).includes(verificationStatusParam)
    ? (verificationStatusParam as EducationVerificationStatus)
    : undefined;
  const dataQualityStatus = (DATA_QUALITY_STATUSES as readonly string[]).includes(dataQualityStatusParam)
    ? (dataQualityStatusParam as DataQualityStatus)
    : undefined;
  const sourceType = (PROVENANCE_SOURCE_TYPES as readonly string[]).includes(sourceTypeParam)
    ? (sourceTypeParam as ProvenanceSourceType)
    : undefined;

  const result = await listProvenanceRecords({ entityType, verificationStatus, dataQualityStatus, sourceType, page });

  const activeFilters: Record<string, string> = {};
  if (entityTypeParam) activeFilters.entityType = entityTypeParam;
  if (verificationStatusParam) activeFilters.verificationStatus = verificationStatusParam;
  if (dataQualityStatusParam) activeFilters.dataQualityStatus = dataQualityStatusParam;
  if (sourceTypeParam) activeFilters.sourceType = sourceTypeParam;
  const hasActiveFilters = Boolean(entityTypeParam || verificationStatusParam || dataQualityStatusParam || sourceTypeParam);

  return (
    <div className="max-w-6xl">
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-secondary">Global Education Data</p>
        <h1 className="mt-2 text-2xl font-semibold text-primary sm:text-3xl">Data sources</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Where each record&apos;s data came from, and when it was retrieved or last verified. Most rows are written
          automatically by the CSV import pipeline — use this list to trace a record back to its source, not to
          re-import data.
        </p>
      </div>

      <Card className="mb-6">
        <FilterBar basePath="/admin/education/sources" hasActiveFilters={hasActiveFilters}>
          <FormField id="entityType" label="Entity type">
            <Select id="entityType" name="entityType" defaultValue={entityTypeParam}>
              <option value="">All</option>
              {PROVENANCE_ENTITY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {titleCase(t)}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField id="verificationStatus" label="Verification">
            <Select id="verificationStatus" name="verificationStatus" defaultValue={verificationStatusParam}>
              <option value="">All</option>
              {EDUCATION_VERIFICATION_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {EDUCATION_VERIFICATION_STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField id="dataQualityStatus" label="Data quality">
            <Select id="dataQualityStatus" name="dataQualityStatus" defaultValue={dataQualityStatusParam}>
              <option value="">All</option>
              {DATA_QUALITY_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {titleCase(s)}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField id="sourceType" label="Source type">
            <Select id="sourceType" name="sourceType" defaultValue={sourceTypeParam}>
              <option value="">All</option>
              {PROVENANCE_SOURCE_TYPES.map((s) => (
                <option key={s} value={s}>
                  {titleCase(s)}
                </option>
              ))}
            </Select>
          </FormField>
        </FilterBar>
      </Card>

      {result.items.length === 0 ? (
        <EmptyState
          icon={Link2}
          title={hasActiveFilters ? "No sources match your filters" : "No provenance records yet"}
          description={
            hasActiveFilters
              ? "Try a broader filter, or clear it."
              : "Provenance rows are created by CSV imports, or by a manual correction."
          }
          action={
            hasActiveFilters ? (
              <Link href="/admin/education/sources" className="text-sm font-semibold text-secondary-dark hover:text-primary">
                Clear filters
              </Link>
            ) : undefined
          }
        />
      ) : (
        <>
          <p className="mb-3 text-sm text-muted">
            {result.total} record{result.total === 1 ? "" : "s"} found
          </p>
          <AdminTable headers={["Entity", "Type", "Source", "Source URL", "Last verified", "Verification", "Data quality", ""]}>
            {result.items.map((r) => {
              const href = entityHref(r.entityType, r.entityId);
              const label = r.entityLabel ?? r.entityId;
              return (
                <tr key={r.id} className="hover:bg-surface-alt/50">
                  <Td className="font-medium text-text">
                    {href ? (
                      <Link href={href} className="hover:text-primary hover:underline">
                        {label}
                      </Link>
                    ) : (
                      label
                    )}
                  </Td>
                  <Td className="text-text-soft">{titleCase(r.entityType)}</Td>
                  <Td className="text-text-soft">{titleCase(r.sourceType)}</Td>
                  <Td className="text-text-soft">
                    {r.sourceUrl ? (
                      <a
                        href={r.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-secondary-dark hover:text-primary hover:underline"
                      >
                        Link
                        <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
                      </a>
                    ) : (
                      "—"
                    )}
                  </Td>
                  <Td className="text-text-soft">{r.lastVerifiedAt ?? "—"}</Td>
                  <Td>
                    <StatusBadge status={r.verificationStatus} labelOverride={EDUCATION_VERIFICATION_STATUS_LABELS[r.verificationStatus]} />
                  </Td>
                  <Td>
                    <StatusBadge status={r.dataQualityStatus} labelOverride={titleCase(r.dataQualityStatus)} />
                  </Td>
                  <Td>
                    <MarkVerifiedForm record={r} />
                  </Td>
                </tr>
              );
            })}
          </AdminTable>
          <AdminPagination
            basePath="/admin/education/sources"
            page={result.page}
            pageSize={result.pageSize}
            total={result.total}
            searchParams={activeFilters}
          />
        </>
      )}
    </div>
  );
}
