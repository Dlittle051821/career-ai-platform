import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList, Plus } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/Button";
import { Select } from "@/components/forms/Select";
import { Input } from "@/components/forms/Input";
import { FormField } from "@/components/forms/FormField";
import { FilterBar } from "@/components/admin/FilterBar";
import { AdminTable, Td } from "@/components/admin/AdminTable";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { EmptyState } from "@/components/admin/EmptyState";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { WORK_QUEUE_BUCKET_ICON, WORK_QUEUE_BUCKET_ICON_CLASS, WORK_QUEUE_BUCKET_TONE } from "@/components/admin/applications/work-queue-visuals";
import { listApplications } from "@/lib/supabase/admin/applications";
import { listApplicationDocumentsForAdminBatch } from "@/lib/supabase/admin/application-documents";
import { getApplicationChecklistItemsBatch } from "@/lib/supabase/admin/application-checklist";
import { getApplicationDocumentCompleteness, getApplicationDocumentReviewCompleteness, type ApplicationDocumentType } from "@/lib/applications/application-documents";
import { getNextOperationalAction, type NextOperationalAction } from "@/lib/applications/next-operational-action";
import { getWorkQueueBucket, getWorkQueueSummary, sortByWorkQueueBucket, WORK_QUEUE_BUCKET_LABELS } from "@/lib/applications/application-work-queue";
import { getCurrentAdmin } from "@/lib/supabase/admin-auth";
import { hasPermission } from "@/lib/admin/permissions";
import { APPLICATION_STAGE_LABELS, type ApplicationStage } from "@/types/admin";

export const metadata: Metadata = { title: "Applications" };

const STAGES: ApplicationStage[] = [
  "inquiry",
  "preparing",
  "ready_to_submit",
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

  const [result, admin] = await Promise.all([listApplications({ query: query || undefined, stage, page }), getCurrentAdmin()]);

  const activeFilters: Record<string, string> = {};
  if (query) activeFilters.q = query;
  if (stage) activeFilters.stage = stage;
  const hasActiveFilters = Boolean(query || stage);

  // UX09 — work-queue grouping for the current PAGE of results only (never
  // an unbounded scan of every application). Gated behind
  // application-documents:read — a caller without it (finance/analyst/
  // content_editor) simply sees the original stage/decision columns, same
  // "falls back to the pre-UX09 table" posture as every other permission-
  // gated addition in this admin. Reuses getNextOperationalAction() as-is;
  // never a second rules engine.
  const canReadDocuments = hasPermission(admin?.role, "application-documents:read");
  const canReviewWorkspace = hasPermission(admin?.role, "application-documents:review");
  const nextActionById = new Map<string, NextOperationalAction>();
  if (canReadDocuments && result.items.length > 0) {
    const ids = result.items.map((a) => a.id);
    const [documentsByApp, checklistByApp] = await Promise.all([
      listApplicationDocumentsForAdminBatch(ids),
      canReviewWorkspace ? getApplicationChecklistItemsBatch(ids) : Promise.resolve(new Map()),
    ]);
    for (const a of result.items) {
      const documents = documentsByApp.get(a.id) ?? [];
      const checklistItems = checklistByApp.get(a.id) ?? [];
      const documentCompleteness = getApplicationDocumentCompleteness(documents.map((d) => ({ documentType: d.documentType as ApplicationDocumentType, originalFilename: d.originalFilename })));
      const documentReviewCompleteness = getApplicationDocumentReviewCompleteness(documents.map((d) => ({ documentType: d.documentType as ApplicationDocumentType, reviewStatus: d.reviewStatus })));
      nextActionById.set(
        a.id,
        getNextOperationalAction({
          stage: a.stage,
          currentDocuments: documents.map((d) => ({ documentType: d.documentType as ApplicationDocumentType, reviewStatus: d.reviewStatus })),
          documentCompleteness,
          documentReviewCompleteness,
          manualChecklistItems: checklistItems,
        })
      );
    }
  }
  const workQueueSummary = canReadDocuments ? getWorkQueueSummary(Array.from(nextActionById.values()).map((a) => a.kind)) : [];
  const sortedItems = canReadDocuments
    ? sortByWorkQueueBucket(result.items, (a) => getWorkQueueBucket(nextActionById.get(a.id)?.kind ?? "no_action"))
    : result.items;

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

      {/* UX09 — sticky work-queue summary bar. Purely a read-side re-grouping
          of the current page's own next-operational-action results (see
          above); never a second source of truth, never mutates anything.
          Omitted entirely when the caller lacks application-documents:read,
          or when the current page has nothing to summarize. */}
      {canReadDocuments && workQueueSummary.length > 0 ? (
        <div className="sm:sticky sm:top-0 sm:z-10 mb-4 flex flex-wrap items-center gap-2 rounded-[var(--radius-card)] border border-border bg-surface/95 p-3 sm:backdrop-blur-sm transition-shadow">
          <span className="text-xs font-semibold uppercase tracking-wide text-secondary">This page</span>
          {workQueueSummary.map(({ bucket, count }) => {
            const Icon = WORK_QUEUE_BUCKET_ICON[bucket];
            return (
              <Badge key={bucket} tone={WORK_QUEUE_BUCKET_TONE[bucket]} className="gap-1.5">
                <Icon aria-hidden="true" className={`h-3.5 w-3.5 ${WORK_QUEUE_BUCKET_ICON_CLASS[bucket]}`} />
                {count} {WORK_QUEUE_BUCKET_LABELS[bucket]}
              </Badge>
            );
          })}
        </div>
      ) : null}

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
          <AdminTable headers={canReadDocuments ? ["Student", "University / Course", "Stage", "Next step", "Counsellor", ""] : ["Student", "University / Course", "Stage", "Decision", "Counsellor", ""]}>
            {sortedItems.map((a) => {
              const nextAction = nextActionById.get(a.id);
              const bucket = nextAction ? getWorkQueueBucket(nextAction.kind) : null;
              const Icon = bucket ? WORK_QUEUE_BUCKET_ICON[bucket] : null;
              return (
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
                  {canReadDocuments ? (
                    <Td>
                      {nextAction && bucket ? (
                        <Badge tone={WORK_QUEUE_BUCKET_TONE[bucket]} className="gap-1.5">
                          {Icon ? <Icon aria-hidden="true" className={`h-3.5 w-3.5 ${WORK_QUEUE_BUCKET_ICON_CLASS[bucket]}`} /> : null}
                          <span className="max-w-[16rem] truncate">{nextAction.label}</span>
                        </Badge>
                      ) : (
                        <span className="text-text-soft">—</span>
                      )}
                    </Td>
                  ) : (
                    <Td>
                      <StatusBadge status={a.decisionStatus} />
                    </Td>
                  )}
                  <Td className="text-text-soft">{a.assignedCounsellorName ?? "Unassigned"}</Td>
                  <Td>
                    <Link href={`/admin/applications/${a.id}`} className="text-sm font-semibold text-secondary-dark hover:text-primary">
                      Edit
                    </Link>
                  </Td>
                </tr>
              );
            })}
          </AdminTable>
          <AdminPagination basePath="/admin/applications" page={result.page} pageSize={result.pageSize} total={result.total} searchParams={activeFilters} />
        </>
      )}
    </div>
  );
}
