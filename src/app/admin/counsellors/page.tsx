import type { Metadata } from "next";
import Link from "next/link";
import { UserCog, Plus } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Select } from "@/components/forms/Select";
import { Input } from "@/components/forms/Input";
import { FormField } from "@/components/forms/FormField";
import { FilterBar } from "@/components/admin/FilterBar";
import { AdminTable, Td } from "@/components/admin/AdminTable";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { EmptyState } from "@/components/admin/EmptyState";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { listCounsellors, listCounsellorWorkload } from "@/lib/supabase/admin/counsellors";

export const metadata: Metadata = { title: "Counsellors" };

interface CounsellorsPageProps {
  searchParams: Promise<{ q?: string; active?: string; page?: string; view?: string }>;
}

export default async function AdminCounsellorsPage({ searchParams }: CounsellorsPageProps) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const activeParam = params.active ?? "";
  const showWorkload = params.view === "workload";
  const parsedPage = params.page ? Number.parseInt(params.page, 10) : 1;
  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const isActive = activeParam === "active" ? true : activeParam === "inactive" ? false : undefined;

  const [result, workload] = await Promise.all([
    listCounsellors({ query: query || undefined, isActive, page }),
    showWorkload ? listCounsellorWorkload() : Promise.resolve(null),
  ]);

  const activeFilters: Record<string, string> = {};
  if (query) activeFilters.q = query;
  if (activeParam) activeFilters.active = activeParam;
  const hasActiveFilters = Boolean(query || activeParam);

  return (
    <div className="max-w-6xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-secondary">Counsellors</p>
          <h1 className="mt-2 text-2xl font-semibold text-primary sm:text-3xl">Counsellor management</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Editing a counsellor record can never grant admin privileges — there is no role field here, and this
            table has no self-edit path.
          </p>
        </div>
        <div className="flex gap-2">
          <LinkButton href={showWorkload ? "/admin/counsellors" : "/admin/counsellors?view=workload"} variant="outline" size="md">
            {showWorkload ? "View directory" : "View workload"}
          </LinkButton>
          <LinkButton href="/admin/counsellors/new" icon={<Plus aria-hidden="true" className="h-4 w-4" />}>
            New counsellor
          </LinkButton>
        </div>
      </div>

      {showWorkload && workload ? (
        workload.length === 0 ? (
          <EmptyState icon={UserCog} title="No counsellors yet" description="Add a counsellor to see workload here." />
        ) : (
          <>
            {/* NW08.4 — Team Overview: the same workload data as before,
                now also surfacing specializations/regions (already part of
                CounsellorWorkload/Counsellor — simply not rendered before)
                and a capacity-utilization flag, plus cross-links into the
                existing Leads/Applications lists filtered to this
                counsellor's own caseload (assignedCounsellorId, wired into
                both pages' querystring handling this milestone). */}
            <AdminTable headers={["Counsellor", "Active", "Specializations", "Capacity", "Students", "Leads", "Applications", ""]}>
              {workload.map((c) => {
                const totalAssigned = c.assignedStudentCount + c.assignedLeadCount + c.assignedApplicationCount;
                const overCapacity = c.capacity !== null && totalAssigned > c.capacity;
                return (
                  <tr key={c.id} className="hover:bg-surface-alt/50">
                    <Td className="font-medium text-text">
                      <Link href={`/admin/counsellors/${c.id}`} className="hover:text-primary hover:underline">
                        {c.displayName}
                      </Link>
                    </Td>
                    <Td>
                      <StatusBadge status={c.isActive ? "active" : "inactive"} />
                    </Td>
                    <Td className="max-w-[220px]">
                      {c.specializations.length === 0 ? (
                        <span className="text-text-soft">—</span>
                      ) : (
                        <span className="flex flex-wrap gap-1">
                          {c.specializations.slice(0, 3).map((s) => (
                            <Badge key={s} tone="accent">
                              {s}
                            </Badge>
                          ))}
                          {c.specializations.length > 3 ? <span className="text-xs text-muted">+{c.specializations.length - 3}</span> : null}
                        </span>
                      )}
                    </Td>
                    <Td>
                      <span className={overCapacity ? "font-medium text-warning" : "text-text-soft"}>
                        {c.capacity ?? "—"}
                        {overCapacity ? " (over)" : ""}
                      </span>
                    </Td>
                    <Td>
                      <Badge tone="neutral">{c.assignedStudentCount}</Badge>
                    </Td>
                    <Td>
                      <Link href={`/admin/leads?assignedCounsellorId=${c.id}`} className="hover:underline">
                        <Badge tone="neutral">{c.assignedLeadCount}</Badge>
                      </Link>
                    </Td>
                    <Td>
                      <Link href={`/admin/applications?assignedCounsellorId=${c.id}`} className="hover:underline">
                        <Badge tone="neutral">{c.assignedApplicationCount}</Badge>
                      </Link>
                    </Td>
                    <Td>
                      {overCapacity ? (
                        <Badge tone="warning">Over capacity</Badge>
                      ) : totalAssigned === 0 ? (
                        <Badge tone="neutral">Idle</Badge>
                      ) : null}
                    </Td>
                  </tr>
                );
              })}
            </AdminTable>
          </>
        )
      ) : (
        <>
          <Card className="mb-6">
            <FilterBar basePath="/admin/counsellors" hasActiveFilters={hasActiveFilters}>
              <FormField id="q" label="Search">
                <Input id="q" name="q" defaultValue={query} placeholder="Name or email" />
              </FormField>
              <FormField id="active" label="Status">
                <Select id="active" name="active" defaultValue={activeParam}>
                  <option value="">All</option>
                  <option value="active">Active only</option>
                  <option value="inactive">Inactive only</option>
                </Select>
              </FormField>
            </FilterBar>
          </Card>

          {result.items.length === 0 ? (
            <EmptyState
              icon={UserCog}
              title={hasActiveFilters ? "No counsellors match your filters" : "No counsellors yet"}
              description={hasActiveFilters ? "Try a broader search term, or clear a filter." : "Add the first counsellor to start assigning students and leads."}
              action={
                hasActiveFilters ? (
                  <Link href="/admin/counsellors" className="text-sm font-semibold text-secondary-dark hover:text-primary">
                    Clear filters
                  </Link>
                ) : (
                  <LinkButton href="/admin/counsellors/new" size="sm">
                    New counsellor
                  </LinkButton>
                )
              }
            />
          ) : (
            <>
              <p className="mb-3 text-sm text-muted">
                {result.total} counsellor{result.total === 1 ? "" : "s"} found
              </p>
              <AdminTable headers={["Name", "Email", "Capacity", "Status", ""]}>
                {result.items.map((c) => (
                  <tr key={c.id} className="hover:bg-surface-alt/50">
                    <Td className="font-medium text-text">
                      <Link href={`/admin/counsellors/${c.id}`} className="hover:text-primary hover:underline">
                        {c.displayName}
                      </Link>
                    </Td>
                    <Td className="text-text-soft">{c.email ?? "—"}</Td>
                    <Td className="text-text-soft">{c.capacity ?? "—"}</Td>
                    <Td>
                      <StatusBadge status={c.isActive ? "active" : "inactive"} />
                    </Td>
                    <Td>
                      <Link href={`/admin/counsellors/${c.id}`} className="text-sm font-semibold text-secondary-dark hover:text-primary">
                        Edit
                      </Link>
                    </Td>
                  </tr>
                ))}
              </AdminTable>
              <AdminPagination basePath="/admin/counsellors" page={result.page} pageSize={result.pageSize} total={result.total} searchParams={activeFilters} />
            </>
          )}
        </>
      )}
    </div>
  );
}
