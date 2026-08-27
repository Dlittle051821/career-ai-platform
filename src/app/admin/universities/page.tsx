import type { Metadata } from "next";
import Link from "next/link";
import { Landmark, Plus } from "lucide-react";
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
import { listUniversities } from "@/lib/supabase/admin/universities";

export const metadata: Metadata = { title: "Universities" };

interface UniversitiesPageProps {
  searchParams: Promise<{ q?: string; active?: string; page?: string }>;
}

export default async function AdminUniversitiesPage({ searchParams }: UniversitiesPageProps) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const activeParam = params.active ?? "";
  const parsedPage = params.page ? Number.parseInt(params.page, 10) : 1;
  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const isActive = activeParam === "active" ? true : activeParam === "inactive" ? false : undefined;

  const result = await listUniversities({ query: query || undefined, isActive, page });

  const activeFilters: Record<string, string> = {};
  if (query) activeFilters.q = query;
  if (activeParam) activeFilters.active = activeParam;
  const hasActiveFilters = Boolean(query || activeParam);

  return (
    <div className="max-w-6xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-secondary">Universities</p>
          <h1 className="mt-2 text-2xl font-semibold text-primary sm:text-3xl">University management</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Institutions referenced by courses and applications. Accreditation status reflects what has been
            verified internally — see docs/admin-system-guide.md §9 before marking one Verified.
          </p>
        </div>
        <LinkButton href="/admin/universities/new" icon={<Plus aria-hidden="true" className="h-4 w-4" />}>
          New university
        </LinkButton>
      </div>

      <Card className="mb-6">
        <FilterBar basePath="/admin/universities" hasActiveFilters={hasActiveFilters}>
          <FormField id="q" label="Search">
            <Input id="q" name="q" defaultValue={query} placeholder="Name, city, or country" />
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
          icon={Landmark}
          title={hasActiveFilters ? "No universities match your filters" : "No universities yet"}
          description={
            hasActiveFilters
              ? "Try a broader search term, or clear a filter."
              : "Add the first university to start linking courses and applications to it."
          }
          action={
            hasActiveFilters ? (
              <Link href="/admin/universities" className="text-sm font-semibold text-secondary-dark hover:text-primary">
                Clear filters
              </Link>
            ) : (
              <LinkButton href="/admin/universities/new" size="sm">
                New university
              </LinkButton>
            )
          }
        />
      ) : (
        <>
          <p className="mb-3 text-sm text-muted">
            {result.total} universit{result.total === 1 ? "y" : "ies"} found
          </p>
          <AdminTable headers={["Name", "Location", "Accreditation", "Status", ""]}>
            {result.items.map((u) => (
              <tr key={u.id} className="hover:bg-surface-alt/50">
                <Td className="font-medium text-text">
                  <Link href={`/admin/universities/${u.id}`} className="hover:text-primary hover:underline">
                    {u.name}
                  </Link>
                </Td>
                <Td className="text-text-soft">{[u.city, u.country].filter(Boolean).join(", ") || "—"}</Td>
                <Td>
                  <StatusBadge status={u.accreditationStatus} />
                </Td>
                <Td>
                  <StatusBadge status={u.isActive ? "active" : "inactive"} />
                </Td>
                <Td>
                  <Link href={`/admin/universities/${u.id}`} className="text-sm font-semibold text-secondary-dark hover:text-primary">
                    Edit
                  </Link>
                </Td>
              </tr>
            ))}
          </AdminTable>
          <AdminPagination basePath="/admin/universities" page={result.page} pageSize={result.pageSize} total={result.total} searchParams={activeFilters} />
        </>
      )}
    </div>
  );
}
