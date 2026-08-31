import type { Metadata } from "next";
import Link from "next/link";
import { GitMerge } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/forms/Select";
import { FormField } from "@/components/forms/FormField";
import { FilterBar } from "@/components/admin/FilterBar";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { EmptyState } from "@/components/admin/EmptyState";
import { DuplicateScanForm } from "@/components/admin/education/DuplicateScanForm";
import { DuplicateCandidateCard } from "@/components/admin/education/DuplicateCandidateCard";
import { listDuplicateCandidates } from "@/lib/supabase/admin/education-duplicates";
import { DUPLICATE_ENTITY_TYPES, type DuplicateEntityType } from "@/types/education";
import { mergeDuplicateCandidatesAction, rejectDuplicateCandidateAction, scanForDuplicatesAction } from "./actions";

export const metadata: Metadata = { title: "Duplicate Candidates" };

interface DuplicatesPageProps {
  searchParams: Promise<{ entityType?: string; page?: string }>;
}

export default async function AdminDuplicatesPage({ searchParams }: DuplicatesPageProps) {
  const params = await searchParams;
  const entityTypeParam = params.entityType ?? "";
  const entityType = (DUPLICATE_ENTITY_TYPES as readonly string[]).includes(entityTypeParam)
    ? (entityTypeParam as DuplicateEntityType)
    : undefined;
  const parsedPage = params.page ? Number.parseInt(params.page, 10) : 1;
  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  // No explicit `status` filter — listDuplicateCandidates defaults to the
  // pending review queue, which is exactly what this page is for. Resolved
  // candidates (rejected/merged) stay visible through the audit log rather
  // than a queue an admin has to page past.
  const result = await listDuplicateCandidates({ entityType, page });

  const activeFilters: Record<string, string> = {};
  if (entityTypeParam) activeFilters.entityType = entityTypeParam;
  const hasActiveFilters = Boolean(entityTypeParam);

  const scanUniversitiesAction = scanForDuplicatesAction.bind(null, "university");
  const scanCoursesAction = scanForDuplicatesAction.bind(null, "course");

  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-secondary">Global Education Data</p>
        <h1 className="mt-2 text-2xl font-semibold text-primary sm:text-3xl">Duplicate candidates</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Pairwise matches the scanner flagged as possible duplicates. Nothing is ever merged automatically — review
          each pair below and either reject it as unrelated or choose which record should survive a merge.
        </p>
      </div>

      <Card className="mb-6 flex flex-wrap gap-8">
        <DuplicateScanForm action={scanUniversitiesAction} label="Scan universities for duplicates" />
        <DuplicateScanForm action={scanCoursesAction} label="Scan courses for duplicates" />
      </Card>

      <Card className="mb-6">
        <FilterBar basePath="/admin/education/duplicates" hasActiveFilters={hasActiveFilters}>
          <FormField id="entityType" label="Entity type">
            <Select id="entityType" name="entityType" defaultValue={entityTypeParam}>
              <option value="">All</option>
              <option value="university">University</option>
              <option value="course">Course</option>
            </Select>
          </FormField>
        </FilterBar>
      </Card>

      {result.items.length === 0 ? (
        <EmptyState
          icon={GitMerge}
          title={hasActiveFilters ? "No pending candidates match your filter" : "No pending duplicate candidates"}
          description={
            hasActiveFilters
              ? "Try clearing the filter, or run a scan above."
              : "Run a scan above, or check back after the next import."
          }
          action={
            hasActiveFilters ? (
              <Link href="/admin/education/duplicates" className="text-sm font-semibold text-secondary-dark hover:text-primary">
                Clear filters
              </Link>
            ) : undefined
          }
        />
      ) : (
        <>
          <p className="mb-3 text-sm text-muted">
            {result.total} pending candidate{result.total === 1 ? "" : "s"}
          </p>
          <div className="space-y-5">
            {result.items.map((candidate) => (
              <DuplicateCandidateCard
                key={candidate.id}
                candidate={candidate}
                onReject={rejectDuplicateCandidateAction.bind(null, candidate.id)}
                onMerge={mergeDuplicateCandidatesAction.bind(null, candidate.id)}
              />
            ))}
          </div>
          <AdminPagination
            basePath="/admin/education/duplicates"
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
