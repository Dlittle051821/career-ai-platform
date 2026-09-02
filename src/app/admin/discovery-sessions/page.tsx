import type { Metadata } from "next";
import Link from "next/link";
import { CalendarHeart } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/forms/Select";
import { FormField } from "@/components/forms/FormField";
import { Checkbox } from "@/components/forms/Checkbox";
import { FilterBar } from "@/components/admin/FilterBar";
import { AdminTable, Td } from "@/components/admin/AdminTable";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { EmptyState } from "@/components/admin/EmptyState";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { listDiscoverySessions } from "@/lib/supabase/admin/discovery-sessions";
import { DISCOVERY_SESSION_STATUS_LABELS, DISCOVERY_SESSION_STATUSES, type DiscoverySessionStatus } from "@/types/discovery-session";

export const metadata: Metadata = { title: "Discovery Sessions" };

interface DiscoverySessionsPageProps {
  searchParams: Promise<{ status?: string; unassigned?: string; page?: string }>;
}

export default async function AdminDiscoverySessionsPage({ searchParams }: DiscoverySessionsPageProps) {
  const params = await searchParams;
  const statusParam = params.status ?? "";
  const status = (DISCOVERY_SESSION_STATUSES as readonly string[]).includes(statusParam) ? (statusParam as DiscoverySessionStatus) : undefined;
  const unassignedOnly = params.unassigned === "on";
  const parsedPage = params.page ? Number.parseInt(params.page, 10) : 1;
  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const result = await listDiscoverySessions({ status, unassignedOnly, page });

  const activeFilters: Record<string, string> = {};
  if (status) activeFilters.status = status;
  if (unassignedOnly) activeFilters.unassigned = "on";
  const hasActiveFilters = Boolean(status || unassignedOnly);

  return (
    <div className="max-w-6xl">
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-secondary">Discovery Sessions</p>
        <h1 className="mt-2 text-2xl font-semibold text-primary sm:text-3xl">Discovery Session requests</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Free, no-obligation first conversations students book from the Assisted Onboarding choice screen. A
          counsellor sees unclaimed requests plus their own — claim one to start the Counsellor Workspace.
        </p>
      </div>

      <Card className="mb-6">
        <FilterBar basePath="/admin/discovery-sessions" hasActiveFilters={hasActiveFilters}>
          <FormField id="status" label="Status">
            <Select id="status" name="status" defaultValue={status ?? ""}>
              <option value="">All</option>
              {DISCOVERY_SESSION_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {DISCOVERY_SESSION_STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
          </FormField>
          <div className="flex items-end pb-2">
            <Checkbox id="unassigned" name="unassigned" defaultChecked={unassignedOnly} label="Unassigned only" />
          </div>
        </FilterBar>
      </Card>

      {result.items.length === 0 ? (
        <EmptyState
          icon={CalendarHeart}
          title={hasActiveFilters ? "No Discovery Sessions match your filters" : "No Discovery Sessions yet"}
          description={hasActiveFilters ? "Try a broader filter." : "Requests booked from the Assisted Onboarding choice screen will appear here."}
          action={
            hasActiveFilters ? (
              <Link href="/admin/discovery-sessions" className="text-sm font-semibold text-secondary-dark hover:text-primary">
                Clear filters
              </Link>
            ) : undefined
          }
        />
      ) : (
        <>
          <p className="mb-3 text-sm text-muted">
            {result.total} request{result.total === 1 ? "" : "s"} found
          </p>
          <AdminTable headers={["Student", "Status", "Counsellor", "Preferred time", "Requested", ""]}>
            {result.items.map((s) => (
              <tr key={s.id} className="hover:bg-surface-alt/50">
                <Td className="font-medium text-text">
                  <Link href={`/admin/discovery-sessions/${s.id}`} className="hover:text-primary hover:underline">
                    {s.studentName ?? "Unnamed student"}
                  </Link>
                  {s.studentEmail ? <div className="text-xs font-normal text-muted">{s.studentEmail}</div> : null}
                </Td>
                <Td>
                  <StatusBadge status={s.status} labelOverride={DISCOVERY_SESSION_STATUS_LABELS[s.status]} />
                </Td>
                <Td className="text-text-soft">{s.assignedCounsellorName ?? "Unassigned"}</Td>
                <Td className="text-text-soft">{s.preferredTimeRange ?? "No preference"}</Td>
                <Td className="text-text-soft">{new Date(s.createdAt).toLocaleDateString("en-IN")}</Td>
                <Td>
                  <Link href={`/admin/discovery-sessions/${s.id}`} className="text-sm font-semibold text-secondary-dark hover:text-primary">
                    View
                  </Link>
                </Td>
              </tr>
            ))}
          </AdminTable>
          <AdminPagination basePath="/admin/discovery-sessions" page={result.page} pageSize={result.pageSize} total={result.total} searchParams={activeFilters} />
        </>
      )}
    </div>
  );
}
