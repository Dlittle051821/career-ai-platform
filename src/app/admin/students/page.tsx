import type { Metadata } from "next";
import Link from "next/link";
import { Users } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/forms/Select";
import { Input } from "@/components/forms/Input";
import { FormField } from "@/components/forms/FormField";
import { FilterBar } from "@/components/admin/FilterBar";
import { AdminTable, Td } from "@/components/admin/AdminTable";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { EmptyState } from "@/components/admin/EmptyState";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { listStudents } from "@/lib/supabase/admin/students";
import { ADMIN_STUDENT_STATUS_LABELS, type AdminStudentStatus } from "@/types/admin";

export const metadata: Metadata = { title: "Students" };

const STATUSES: AdminStudentStatus[] = ["prospect", "active", "inactive", "archived"];

interface StudentsPageProps {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}

export default async function AdminStudentsPage({ searchParams }: StudentsPageProps) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const statusParam = params.status ?? "";
  const status = STATUSES.includes(statusParam as AdminStudentStatus) ? (statusParam as AdminStudentStatus) : undefined;
  const parsedPage = params.page ? Number.parseInt(params.page, 10) : 1;
  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const result = await listStudents({ query: query || undefined, status, page });

  const activeFilters: Record<string, string> = {};
  if (query) activeFilters.q = query;
  if (status) activeFilters.status = status;
  const hasActiveFilters = Boolean(query || status);

  return (
    <div className="max-w-6xl">
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-secondary">Students</p>
        <h1 className="mt-2 text-2xl font-semibold text-primary sm:text-3xl">Student management</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Students register and complete their own profile — this list is read-only for self-reported data. Admins
          can only set operational status, assign a counsellor, and add internal notes.
        </p>
      </div>

      <Card className="mb-6">
        <FilterBar basePath="/admin/students" hasActiveFilters={hasActiveFilters}>
          <FormField id="q" label="Search">
            <Input id="q" name="q" defaultValue={query} placeholder="Name, email, or phone" />
          </FormField>
          <FormField id="status" label="Status">
            <Select id="status" name="status" defaultValue={status ?? ""}>
              <option value="">All</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {ADMIN_STUDENT_STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
          </FormField>
        </FilterBar>
      </Card>

      {result.items.length === 0 ? (
        <EmptyState
          icon={Users}
          title={hasActiveFilters ? "No students match your filters" : "No students yet"}
          description={hasActiveFilters ? "Try a broader search term, or clear a filter." : "Students appear here once they register on the public site."}
          action={
            hasActiveFilters ? (
              <Link href="/admin/students" className="text-sm font-semibold text-secondary-dark hover:text-primary">
                Clear filters
              </Link>
            ) : undefined
          }
        />
      ) : (
        <>
          <p className="mb-3 text-sm text-muted">
            {result.total} student{result.total === 1 ? "" : "s"} found
          </p>
          <AdminTable headers={["Name", "Contact", "Profile", "Counsellor", "Status", ""]}>
            {result.items.map((s) => (
              <tr key={s.userId} className="hover:bg-surface-alt/50">
                <Td className="font-medium text-text">
                  <Link href={`/admin/students/${s.userId}`} className="hover:text-primary hover:underline">
                    {s.fullName || "Unnamed student"}
                  </Link>
                </Td>
                <Td className="text-text-soft">{s.email || s.phone || "—"}</Td>
                <Td className="text-text-soft">{s.profileCompletionPercent}% complete</Td>
                <Td className="text-text-soft">{s.assignedCounsellorName ?? "Unassigned"}</Td>
                <Td>
                  <StatusBadge status={s.status} />
                </Td>
                <Td>
                  <Link href={`/admin/students/${s.userId}`} className="text-sm font-semibold text-secondary-dark hover:text-primary">
                    View
                  </Link>
                </Td>
              </tr>
            ))}
          </AdminTable>
          <AdminPagination basePath="/admin/students" page={result.page} pageSize={result.pageSize} total={result.total} searchParams={activeFilters} />
        </>
      )}
    </div>
  );
}
