"use client";

import { useMemo, useState } from "react";
import { AdminTable, Td } from "@/components/admin/AdminTable";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { FormField } from "@/components/forms/FormField";
import { Select } from "@/components/forms/Select";
import { IMPORT_ROW_STATUSES, type EducationImportRow, type ImportRowIssue, type ImportRowStatus } from "@/types/education";

function formatIssues(issues: ImportRowIssue[]): string {
  return issues.map((i) => (i.field ? `${i.field}: ${i.message}` : i.message)).join("; ");
}

function titleCase(status: string): string {
  return status
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Row results for one import batch. All rows are fetched server-side in
 * one shot (listImportRowsForBatch has no dedicated pagination — batches
 * are capped at 20,000 rows by the CSV parser, see
 * src/lib/education/csv.ts) and filtered here purely client-side, so
 * switching the status filter never re-hits the server.
 */
export function ImportRowsPanel({ rows }: { rows: EducationImportRow[] }) {
  const [statusFilter, setStatusFilter] = useState<ImportRowStatus | "">("");

  const counts = useMemo(() => {
    const c = new Map<ImportRowStatus, number>();
    for (const row of rows) c.set(row.status, (c.get(row.status) ?? 0) + 1);
    return c;
  }, [rows]);

  const filteredRows = statusFilter ? rows.filter((row) => row.status === statusFilter) : rows;

  if (rows.length === 0) {
    return <p className="text-sm text-muted">This batch has no rows.</p>;
  }

  return (
    <div className="space-y-4">
      <FormField id="rowStatusFilter" label="Filter by row status">
        <Select id="rowStatusFilter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as ImportRowStatus | "")}>
          <option value="">All ({rows.length})</option>
          {IMPORT_ROW_STATUSES.filter((s) => counts.has(s)).map((s) => (
            <option key={s} value={s}>
              {titleCase(s)} ({counts.get(s)})
            </option>
          ))}
        </Select>
      </FormField>

      {filteredRows.length === 0 ? (
        <p className="text-sm text-muted">No rows match this filter.</p>
      ) : (
        <AdminTable headers={["Row", "Status", "Errors", "Warnings"]}>
          {filteredRows.map((row) => (
            <tr key={row.id} className="hover:bg-surface-alt/50">
              <Td className="font-medium text-text">{row.rowNumber}</Td>
              <Td>
                <StatusBadge status={row.status} labelOverride={titleCase(row.status)} />
              </Td>
              <Td className="text-text-soft">{row.errors.length > 0 ? formatIssues(row.errors) : "—"}</Td>
              <Td className="text-text-soft">{row.warnings.length > 0 ? formatIssues(row.warnings) : "—"}</Td>
            </tr>
          ))}
        </AdminTable>
      )}
    </div>
  );
}
