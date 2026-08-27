import type { Metadata } from "next";
import { ScrollText } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Select } from "@/components/forms/Select";
import { FormField } from "@/components/forms/FormField";
import { FilterBar } from "@/components/admin/FilterBar";
import { AdminTable, Td } from "@/components/admin/AdminTable";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { EmptyState } from "@/components/admin/EmptyState";
import { getAuditLog, AUDIT_ENTITY_TYPES } from "@/lib/supabase/admin/audit";
import { ADMIN_ROLE_LABELS } from "@/types/admin";

export const metadata: Metadata = { title: "Audit Log" };

interface AuditLogPageProps {
  searchParams: Promise<{ entityType?: string; action?: string; page?: string }>;
}

export default async function AdminAuditLogPage({ searchParams }: AuditLogPageProps) {
  const params = await searchParams;
  const entityTypeParam = params.entityType ?? "";
  const entityType = (AUDIT_ENTITY_TYPES as readonly string[]).includes(entityTypeParam) ? entityTypeParam : undefined;
  const action = params.action?.trim() || undefined;
  const parsedPage = params.page ? Number.parseInt(params.page, 10) : 1;
  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const result = await getAuditLog({ entityType, action, page });

  const activeFilters: Record<string, string> = {};
  if (entityType) activeFilters.entityType = entityType;
  if (action) activeFilters.action = action;
  const hasActiveFilters = Boolean(entityType || action);

  return (
    <div className="max-w-6xl">
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-secondary">Audit Log</p>
        <h1 className="mt-2 text-2xl font-semibold text-primary sm:text-3xl">Admin audit log</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Append-only. No admin, including super admins, can edit or delete an entry through this application — the
          only write path is a server-side function that stamps the acting user and timestamp itself. Visible only
          to super admin and admin roles.
        </p>
      </div>

      <Card className="mb-6">
        <FilterBar basePath="/admin/audit-log" hasActiveFilters={hasActiveFilters}>
          <FormField id="entityType" label="Entity type">
            <Select id="entityType" name="entityType" defaultValue={entityType ?? ""}>
              <option value="">All</option>
              {AUDIT_ENTITY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, " ")}
                </option>
              ))}
            </Select>
          </FormField>
        </FilterBar>
      </Card>

      {result.entries.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title={hasActiveFilters ? "No audit entries match your filters" : "No admin activity recorded yet"}
          description={hasActiveFilters ? "Try clearing a filter." : "Sensitive admin actions across every module will appear here as they happen."}
        />
      ) : (
        <>
          <p className="mb-3 text-sm text-muted">
            {result.total} entr{result.total === 1 ? "y" : "ies"} found
          </p>
          <AdminTable headers={["When", "Actor", "Action", "Entity", "Summary"]}>
            {result.entries.map((e) => (
              <tr key={e.id}>
                <Td className="whitespace-nowrap text-text-soft">{new Date(e.createdAt).toLocaleString("en-IN")}</Td>
                <Td className="text-text-soft">{e.actorRole ? ADMIN_ROLE_LABELS[e.actorRole] : "Unknown"}</Td>
                <Td>
                  <Badge tone="neutral">{e.action}</Badge>
                </Td>
                <Td className="text-text-soft">{e.entityType.replace(/_/g, " ")}</Td>
                <Td className="text-text-soft">{e.summary}</Td>
              </tr>
            ))}
          </AdminTable>
          <AdminPagination basePath="/admin/audit-log" page={result.page} pageSize={result.pageSize} total={result.total} searchParams={activeFilters} />
        </>
      )}
    </div>
  );
}
