import Link from "next/link";
import type { ReactNode } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/Button";

/**
 * Plain `method="get"` filter form — same zero-client-JS philosophy as
 * CareerFilterBar (src/components/sections/careers/CareerFilterBar.tsx):
 * keyboard-accessible, shareable/bookmarkable URLs, no JavaScript required
 * for a filter to apply. Each admin module supplies its own `<Select>`/
 * `<Input>` fields as children; this component only provides the shared
 * layout, submit button, and "clear filters" link.
 */
export function FilterBar({ basePath, hasActiveFilters, children }: { basePath: string; hasActiveFilters: boolean; children: ReactNode }) {
  return (
    <form method="get" className="flex flex-wrap items-end gap-3">
      {children}
      <Button type="submit" size="sm" icon={<Search aria-hidden="true" className="h-4 w-4" />}>
        Filter
      </Button>
      {hasActiveFilters ? (
        <Link href={basePath} className="text-sm font-semibold text-secondary-dark hover:text-primary">
          Clear filters
        </Link>
      ) : null}
    </form>
  );
}
