import type { Metadata } from "next";
import Link from "next/link";
import { Tag, Plus, ChartColumn } from "lucide-react";
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
import { Badge } from "@/components/ui/Badge";
import { PricingReorderButtons } from "@/components/admin/pricing/PricingReorderButtons";
import { listPricingPlans } from "@/lib/supabase/admin/pricing";
import { formatMoney } from "@/lib/admin/money";
import { PRICING_CATEGORIES, PRICING_CATEGORY_LABELS, type PricingCategory } from "@/types/pricing";

export const metadata: Metadata = { title: "Pricing" };

interface PricingPageProps {
  searchParams: Promise<{ q?: string; category?: string; status?: string; page?: string }>;
}

export default async function AdminPricingPage({ searchParams }: PricingPageProps) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const categoryParam = params.category ?? "";
  const statusParam = params.status ?? "";
  const parsedPage = params.page ? Number.parseInt(params.page, 10) : 1;
  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const category = (PRICING_CATEGORIES as readonly string[]).includes(categoryParam) ? (categoryParam as PricingCategory) : undefined;
  const status = statusParam === "active" || statusParam === "inactive" ? statusParam : undefined;

  const result = await listPricingPlans({ query: query || undefined, category, status, page });

  const activeFilters: Record<string, string> = {};
  if (query) activeFilters.q = query;
  if (categoryParam) activeFilters.category = categoryParam;
  if (statusParam) activeFilters.status = statusParam;
  const hasActiveFilters = Boolean(query || categoryParam || statusParam);

  // Reorder controls only make sense (and are only enabled) when the list is
  // scoped to exactly one category with no search term — see
  // PricingReorderButtons' docblock.
  const canReorder = Boolean(category) && !query;
  const orderedIdsInCategory = result.items.map((item) => item.plan.id);

  return (
    <div className="max-w-6xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-secondary">Pricing</p>
          <h1 className="mt-2 text-2xl font-semibold text-primary sm:text-3xl">Pricing &amp; offers</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            The official NextWise price list. A plan&rsquo;s price lives in its own immutable version history — open a
            plan to publish a new price, schedule future pricing, or manage its offers.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <LinkButton href="/admin/pricing/analytics" variant="outline" icon={<ChartColumn aria-hidden="true" className="h-4 w-4" />}>
            Analytics
          </LinkButton>
          <LinkButton href="/admin/pricing/new" icon={<Plus aria-hidden="true" className="h-4 w-4" />}>
            New plan
          </LinkButton>
        </div>
      </div>

      <Card className="mb-6">
        <FilterBar basePath="/admin/pricing" hasActiveFilters={hasActiveFilters}>
          <FormField id="q" label="Search">
            <Input id="q" name="q" defaultValue={query} placeholder="Plan name or slug" />
          </FormField>
          <FormField id="category" label="Category" hint="Filter to one category to enable reordering.">
            <Select id="category" name="category" defaultValue={categoryParam}>
              <option value="">All</option>
              {PRICING_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {PRICING_CATEGORY_LABELS[c]}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField id="status" label="Status">
            <Select id="status" name="status" defaultValue={statusParam}>
              <option value="">All</option>
              <option value="active">Active only</option>
              <option value="inactive">Inactive only</option>
            </Select>
          </FormField>
        </FilterBar>
      </Card>

      {result.items.length === 0 ? (
        <EmptyState
          icon={Tag}
          title={hasActiveFilters ? "No plans match your filters" : "No pricing plans yet"}
          description={
            hasActiveFilters
              ? "Try a broader search term, or clear a filter."
              : "Add the first plan, then publish a version to give it a live price."
          }
          action={
            hasActiveFilters ? (
              <Link href="/admin/pricing" className="text-sm font-semibold text-secondary-dark hover:text-primary">
                Clear filters
              </Link>
            ) : (
              <LinkButton href="/admin/pricing/new" size="sm">
                New plan
              </LinkButton>
            )
          }
        />
      ) : (
        <>
          <p className="mb-3 text-sm text-muted">
            {result.total} plan{result.total === 1 ? "" : "s"} found
          </p>
          <AdminTable headers={[canReorder ? "Order" : "", "Plan", "Category", "Price", "Status", "Offers", ""]}>
            {result.items.map(({ plan, currentVersion, offerCount }) => (
              <tr key={plan.id} className="hover:bg-surface-alt/50">
                <Td>{canReorder ? <PricingReorderButtons orderedIdsInCategory={orderedIdsInCategory} planId={plan.id} /> : null}</Td>
                <Td className="font-medium text-text">
                  <Link href={`/admin/pricing/${plan.id}`} className="hover:text-primary hover:underline">
                    {plan.internalName}
                  </Link>
                  {plan.isRecommended ? (
                    <span className="ml-2">
                      <Badge tone="accent">Recommended</Badge>
                    </span>
                  ) : null}
                  <p className="mt-0.5 text-xs text-muted">{plan.slug}</p>
                </Td>
                <Td className="text-text-soft">{PRICING_CATEGORY_LABELS[plan.category]}</Td>
                <Td className="text-text-soft">
                  {currentVersion ? (
                    <>
                      {formatMoney(currentVersion.amountMinorUnits, currentVersion.currency)}
                      <span className="ml-1.5">
                        <StatusBadge status={currentVersion.status} />
                      </span>
                    </>
                  ) : (
                    <span className="text-muted">No version yet</span>
                  )}
                </Td>
                <Td>
                  <StatusBadge status={plan.isActive ? "active" : "inactive"} />
                </Td>
                <Td className="text-text-soft">{offerCount}</Td>
                <Td>
                  <Link href={`/admin/pricing/${plan.id}`} className="text-sm font-semibold text-secondary-dark hover:text-primary">
                    Manage
                  </Link>
                </Td>
              </tr>
            ))}
          </AdminTable>
          <AdminPagination basePath="/admin/pricing" page={result.page} pageSize={result.pageSize} total={result.total} searchParams={activeFilters} />
        </>
      )}
    </div>
  );
}
