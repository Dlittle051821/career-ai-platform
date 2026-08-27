import type { Metadata } from "next";
import Link from "next/link";
import { FileText, Plus } from "lucide-react";
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
import { contentPreview } from "@/lib/admin/content";
import { listContentItems } from "@/lib/supabase/admin/content-items";
import type { ContentStatus, ContentType } from "@/types/admin";

export const metadata: Metadata = { title: "Content" };

const CONTENT_TYPES: ContentType[] = ["faq", "announcement", "page_block"];
const STATUSES: ContentStatus[] = ["draft", "published", "archived"];

interface ContentPageProps {
  searchParams: Promise<{ q?: string; type?: string; status?: string; page?: string }>;
}

export default async function AdminContentPage({ searchParams }: ContentPageProps) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const typeParam = params.type ?? "";
  const contentType = CONTENT_TYPES.includes(typeParam as ContentType) ? (typeParam as ContentType) : undefined;
  const statusParam = params.status ?? "";
  const status = STATUSES.includes(statusParam as ContentStatus) ? (statusParam as ContentStatus) : undefined;
  const parsedPage = params.page ? Number.parseInt(params.page, 10) : 1;
  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const result = await listContentItems({ query: query || undefined, contentType, status, page });

  const activeFilters: Record<string, string> = {};
  if (query) activeFilters.q = query;
  if (contentType) activeFilters.type = contentType;
  if (status) activeFilters.status = status;
  const hasActiveFilters = Boolean(query || contentType || status);

  return (
    <div className="max-w-6xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-secondary">Content</p>
          <h1 className="mt-2 text-2xl font-semibold text-primary sm:text-3xl">Content management</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            FAQs, announcements, and reusable page blocks. Body content is always plain text — never HTML.
          </p>
        </div>
        <LinkButton href="/admin/content/new" icon={<Plus aria-hidden="true" className="h-4 w-4" />}>
          New content item
        </LinkButton>
      </div>

      <Card className="mb-6">
        <FilterBar basePath="/admin/content" hasActiveFilters={hasActiveFilters}>
          <FormField id="q" label="Search">
            <Input id="q" name="q" defaultValue={query} placeholder="Title or slug" />
          </FormField>
          <FormField id="type" label="Type">
            <Select id="type" name="type" defaultValue={contentType ?? ""}>
              <option value="">All</option>
              {CONTENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, " ")}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField id="status" label="Status">
            <Select id="status" name="status" defaultValue={status ?? ""}>
              <option value="">All</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </Select>
          </FormField>
        </FilterBar>
      </Card>

      {result.items.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={hasActiveFilters ? "No content matches your filters" : "No content items yet"}
          description={hasActiveFilters ? "Try a broader search term, or clear a filter." : "Public pages fall back to their existing static content until something is published here."}
          action={
            hasActiveFilters ? (
              <Link href="/admin/content" className="text-sm font-semibold text-secondary-dark hover:text-primary">
                Clear filters
              </Link>
            ) : (
              <LinkButton href="/admin/content/new" size="sm">
                New content item
              </LinkButton>
            )
          }
        />
      ) : (
        <>
          <p className="mb-3 text-sm text-muted">
            {result.total} item{result.total === 1 ? "" : "s"} found
          </p>
          <AdminTable headers={["Title", "Type", "Preview", "Status", ""]}>
            {result.items.map((c) => (
              <tr key={c.id} className="hover:bg-surface-alt/50">
                <Td className="font-medium text-text">
                  <Link href={`/admin/content/${c.id}`} className="hover:text-primary hover:underline">
                    {c.title}
                  </Link>
                </Td>
                <Td className="text-text-soft">{c.contentType.replace(/_/g, " ")}</Td>
                <Td className="max-w-xs truncate text-text-soft">{contentPreview(c.body, 80)}</Td>
                <Td>
                  <StatusBadge status={c.status} />
                </Td>
                <Td>
                  <Link href={`/admin/content/${c.id}`} className="text-sm font-semibold text-secondary-dark hover:text-primary">
                    Edit
                  </Link>
                </Td>
              </tr>
            ))}
          </AdminTable>
          <AdminPagination basePath="/admin/content" page={result.page} pageSize={result.pageSize} total={result.total} searchParams={activeFilters} />
        </>
      )}
    </div>
  );
}
