import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Download } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { CommitImportForm } from "@/components/admin/education-imports/CommitImportForm";
import { ImportRowsPanel } from "@/components/admin/education-imports/ImportRowsPanel";
import { getImportBatchById, listImportRowsForBatch } from "@/lib/supabase/admin/education-imports";
import { IMPORT_DUPLICATE_STRATEGY_LABELS, IMPORT_ENTITY_TYPE_LABELS } from "@/lib/admin/education-import-labels";
import { IMPORT_BATCH_STATUS_LABELS } from "@/types/education";
import { commitImportBatchAction } from "../actions";

interface ImportBatchDetailPageProps {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = { title: "Import Batch" };

function formatBytes(bytes: number | null): string {
  if (bytes === null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export default async function EducationImportBatchDetailPage({ params }: ImportBatchDetailPageProps) {
  const { id } = await params;
  const batch = await getImportBatchById(id);
  if (!batch) notFound();

  const rows = await listImportRowsForBatch(id);
  const commitAction = commitImportBatchAction.bind(null, id);

  return (
    <div className="max-w-4xl">
      <Link href="/admin/education/imports" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-secondary-dark hover:text-primary">
        <ChevronLeft aria-hidden="true" className="h-4 w-4" />
        Back to imports
      </Link>
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-secondary">Data Imports</p>
        <h1 className="mt-2 text-2xl font-semibold text-primary sm:text-3xl">{batch.fileName ?? "Import batch"}</h1>
        <p className="mt-2 text-sm text-muted">Created {new Date(batch.createdAt).toLocaleString("en-IN")}</p>
      </div>

      <Card className="mb-6 space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge status={batch.status} labelOverride={IMPORT_BATCH_STATUS_LABELS[batch.status]} />
          <StatusBadge
            status={batch.dryRun ? "pending" : "active"}
            labelOverride={batch.dryRun ? "Preview only — not yet applied" : "Applied to live database"}
          />
        </div>

        <dl className="grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted">Data type</dt>
            <dd className="mt-0.5 font-medium text-text">{IMPORT_ENTITY_TYPE_LABELS[batch.entityType]}</dd>
          </div>
          <div>
            <dt className="text-muted">Duplicate handling</dt>
            <dd className="mt-0.5 font-medium text-text">{IMPORT_DUPLICATE_STRATEGY_LABELS[batch.duplicateStrategy]}</dd>
          </div>
          <div>
            <dt className="text-muted">File</dt>
            <dd className="mt-0.5 font-medium text-text">
              {batch.fileName ?? "—"} ({formatBytes(batch.fileSizeBytes)})
            </dd>
          </div>
          <div>
            <dt className="text-muted">Rows</dt>
            <dd className="mt-0.5 font-medium text-text">
              {batch.totalRecords} total · {batch.successfulRecords} successful · {batch.rejectedRecords} rejected
              {batch.warningCount > 0 ? ` · ${batch.warningCount} with warnings` : ""}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Started</dt>
            <dd className="mt-0.5 font-medium text-text">{batch.startedAt ? new Date(batch.startedAt).toLocaleString("en-IN") : "—"}</dd>
          </div>
          <div>
            <dt className="text-muted">Completed</dt>
            <dd className="mt-0.5 font-medium text-text">{batch.completedAt ? new Date(batch.completedAt).toLocaleString("en-IN") : "—"}</dd>
          </div>
        </dl>

        {batch.notes ? (
          <p role="alert" className="rounded-[var(--radius-control)] border border-error/25 bg-error-light px-3.5 py-2.5 text-sm text-error">
            {batch.notes}
          </p>
        ) : null}

        {batch.rejectedRecords > 0 ? (
          <a
            href={`/admin/education/imports/${id}/rejected-rows`}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-[var(--radius-control)] border border-border-strong px-4 py-2 text-sm font-medium text-primary hover:bg-surface-alt"
          >
            <Download aria-hidden="true" className="h-4 w-4" />
            Download rejected rows (CSV)
          </a>
        ) : null}
      </Card>

      {batch.status === "validated" ? (
        <div className="mb-6">
          <CommitImportForm action={commitAction} successfulRecords={batch.successfulRecords} totalRecords={batch.totalRecords} />
        </div>
      ) : null}

      <Card>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-primary">Rows</h2>
          <p className="mt-1 text-sm text-muted">Every row parsed from the file, with the validation result recorded for it.</p>
        </div>
        <ImportRowsPanel rows={rows} />
      </Card>
    </div>
  );
}
