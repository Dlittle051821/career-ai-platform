import type { Metadata } from "next";
import Link from "next/link";
import { GraduationCap, Plus } from "lucide-react";
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
import { formatMoney } from "@/lib/admin/money";
import { listCourses } from "@/lib/supabase/admin/courses";
import { listUniversityOptions } from "@/lib/supabase/admin/universities";

export const metadata: Metadata = { title: "Courses" };

interface CoursesPageProps {
  searchParams: Promise<{ q?: string; university?: string; active?: string; page?: string }>;
}

export default async function AdminCoursesPage({ searchParams }: CoursesPageProps) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const universityId = params.university ?? "";
  const activeParam = params.active ?? "";
  const parsedPage = params.page ? Number.parseInt(params.page, 10) : 1;
  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const isActive = activeParam === "active" ? true : activeParam === "inactive" ? false : undefined;

  const [result, universityOptions] = await Promise.all([
    listCourses({ query: query || undefined, universityId: universityId || undefined, isActive, page }),
    listUniversityOptions(),
  ]);

  const activeFilters: Record<string, string> = {};
  if (query) activeFilters.q = query;
  if (universityId) activeFilters.university = universityId;
  if (activeParam) activeFilters.active = activeParam;
  const hasActiveFilters = Boolean(query || universityId || activeParam);

  return (
    <div className="max-w-6xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-secondary">Courses</p>
          <h1 className="mt-2 text-2xl font-semibold text-primary sm:text-3xl">Course management</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Courses linked to a university. Tuition and requirements shown here are internally recorded, not a live
            university feed — see docs/admin-system-guide.md §9.
          </p>
        </div>
        <LinkButton href="/admin/courses/new" icon={<Plus aria-hidden="true" className="h-4 w-4" />}>
          New course
        </LinkButton>
      </div>

      <Card className="mb-6">
        <FilterBar basePath="/admin/courses" hasActiveFilters={hasActiveFilters}>
          <FormField id="q" label="Search">
            <Input id="q" name="q" defaultValue={query} placeholder="Name or field of study" />
          </FormField>
          <FormField id="university" label="University">
            <Select id="university" name="university" defaultValue={universityId}>
              <option value="">All</option>
              {universityOptions.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Select>
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
          icon={GraduationCap}
          title={hasActiveFilters ? "No courses match your filters" : "No courses yet"}
          description={
            hasActiveFilters
              ? "Try a broader search term, or clear a filter."
              : universityOptions.length === 0
                ? "Add a university first, then add courses to it."
                : "Add the first course to start linking applications to it."
          }
          action={
            hasActiveFilters ? (
              <Link href="/admin/courses" className="text-sm font-semibold text-secondary-dark hover:text-primary">
                Clear filters
              </Link>
            ) : universityOptions.length > 0 ? (
              <LinkButton href="/admin/courses/new" size="sm">
                New course
              </LinkButton>
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
            {result.total} course{result.total === 1 ? "" : "s"} found
          </p>
          <AdminTable headers={["Course", "University", "Tuition", "Data quality", "Status", ""]}>
            {result.items.map((c) => (
              <tr key={c.id} className="hover:bg-surface-alt/50">
                <Td className="font-medium text-text">
                  <Link href={`/admin/courses/${c.id}`} className="hover:text-primary hover:underline">
                    {c.name}
                  </Link>
                </Td>
                <Td className="text-text-soft">{c.universityName || "—"}</Td>
                <Td className="text-text-soft">
                  {c.tuitionAmountMinorUnits != null ? formatMoney(c.tuitionAmountMinorUnits, c.tuitionCurrency) : "—"}
                </Td>
                <Td>
                  <StatusBadge status={c.dataQualityStatus} />
                </Td>
                <Td>
                  <StatusBadge status={c.isActive ? "active" : "inactive"} />
                </Td>
                <Td>
                  <Link href={`/admin/courses/${c.id}`} className="text-sm font-semibold text-secondary-dark hover:text-primary">
                    Edit
                  </Link>
                </Td>
              </tr>
            ))}
          </AdminTable>
          <AdminPagination basePath="/admin/courses" page={result.page} pageSize={result.pageSize} total={result.total} searchParams={activeFilters} />
        </>
      )}
    </div>
  );
}
