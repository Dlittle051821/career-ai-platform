import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList, Plus } from "lucide-react";
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
import { listApplications } from "@/lib/supabase/admin/applications";
import { APPLICATION_STAGE_LABELS, type ApplicationStage } from "@/types/admin";

export const metadata: Metadata = { title: "Applications" };

const STAGES: ApplicationStage[] = [
  "inquiry",
  "preparing",
  "submitted",
  "under_review",
  "interview",
  "decision_pending",
  "offer_received",
  "enrolled",
  "rejected",
  "withdrawn",
];

interface ApplicationsPageProps {
  searchParams: Promise<{ q?: string; stage?: string; page?: string }>;
}

export default async function AdminApplicationsPage({ searchParams }: ApplicationsPageProps) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const stageParam = params.stage ?? "";
  const stage = STAGES.includes(stageParam as ApplicationStage) ? (stageParam as ApplicationStage) : undefined;
  const parsedPage = params.page ? Number.parseInt(params.page, 10) : 1;
  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const result = await listApplications({ query: query || undefined, stage, page });

  const activeFilters: Record<string, string> = {};
  if (query) activeFilters.q = query;
  if (stage) activeFilters.stage = stage;
  const hasActiveFilters = Boolean(query || stage);

  return (
    <div className="max-w-6xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-secondary">Applications</p>
          <h1 className="mt-2 text-2xl font-semibold text-primary sm:text-3xl">Application management</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            No direct university integration — every stage change here is a manually recorded, auditable update.
          </p>
        </div>
        <LinkButton href="/admin/applications/new" icon={<Plus aria-hidden="true" className="h-4 w-4" />}>
          New application
        </LinkButton>
      </div>

      <Card className="mb-6">
        <FilterBar basePath="/admin/applications" hasActiveFilters={hasActiveFilters}>
          <FormField id="q" label="Search">
            <Input id="q" name="q" defaultValue={query} placeholder="Student name or email" />
          </FormField>
          <FormField id="stage" label="Stage">
            <Select id="stage" name="stage" defaultValue={stage ?? ""}>
              <option value="">All</option>
              {STAGES.map((s) => (
                <option key={s} value={s}>
                  {APPLICATION_STAGE_LABELS[s]}
                </option>
              ))}
            </Select>
          </FormField>
        </FilterBar>
      </Card>

      {result.items.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={hasActiveFilters ? "No applications match your filters" : "No applications yet"}
          description={hasActiveFilters ? "Try a broader search term, or clear a filter." : "Add the first application to start tracking it."}
          action={
            hasActiveFilters ? (
              <Link href="/admin/applications" className="text-sm font-semibold text-secondary-dark hover:text-primary">
                Clear filters
              </Link>
            ) : (
              <LinkButton href="/admin/applications/new" size="sm">
                New application
              </LinkButton>
            )
          }
        />
      ) : (
        <>
          <p className="mb-3 text-sm text-muted">
            {result.total} application{result.total === 1 ? "" : "s"} found
          </p>
          <AdminTable headers={["Student", "University / Course", "Stage", "Decision", "Counsellor", ""]}>
            {result.items.map((a) => (
              <tr key={a.id} className="hover:bg-surface-alt/50">
                <Td className="font-medium text-text">
                  <Link href={`/admin/applications/${a.id}`} className="hover:text-primary hover:underline">
                    {a.studentName ?? "Unnamed student"}
                  </Link>
                </Td>
                <Td className="text-text-soft">{[a.universityName, a.courseName].filter(Boolean).join(" · ") || "—"}</Td>
                <Td>
                  <StatusBadge status={a.stage} labelOverride={APPLICATION_STAGE_LABELS[a.stage]} />
                </Td>
                <Td>
                  <StatusBadge status={a.decisionStatus} />
                </Td>
                <Td className="text-text-soft">{a.assignedCounsellorName ?? "Unassigned"}</Td>
                <Td>
                  <Link href={`/admin/applications/${a.id}`} className="text-sm font-semibold text-secondary-dark hover:text-primary">
                    Edit
                  </Link>
                </Td>
              </tr>
            ))}
          </AdminTable>
          <AdminPagination basePath="/admin/applications" page={result.page} pageSize={result.pageSize} total={result.total} searchParams={activeFilters} />
        </>
      )}
    </div>
  );
}
