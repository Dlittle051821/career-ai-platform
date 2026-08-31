import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  /** Base path this pagination links back into, e.g. "/universities". */
  basePath: string;
  /** Every filter param except `page` — appended to Prev/Next links so filters survive pagination. */
  searchParams: Record<string, string | string[]>;
}

function hrefFor(page: number, basePath: string, searchParams: Record<string, string | string[]>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) {
      for (const v of value) params.append(key, v);
    } else {
      params.set(key, value);
    }
  }
  params.set("page", String(page));
  return `${basePath}?${params.toString()}`;
}

/**
 * Same Prev/Next pattern as src/components/sections/careers/Pagination.tsx,
 * generalised with a `basePath` prop (instead of hardcoding `/careers`) and
 * repeatable filter params (e.g. `?country=IN&country=US`) so it can back
 * both `/universities` and, eventually, other public education list pages.
 * A deliberate copy, not a shared import — see this module's docblock
 * convention across the codebase for why list pages don't share pagination
 * components across unrelated domains.
 */
export function Pagination({ page, pageSize, total, basePath, searchParams }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  return (
    <nav aria-label="Results pages" className="mt-8 flex items-center justify-between gap-3">
      <Link
        href={hasPrev ? hrefFor(page - 1, basePath, searchParams) : "#"}
        aria-disabled={!hasPrev}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-[var(--radius-control)] border border-border-strong px-4 py-2 text-sm font-medium text-text-soft transition-colors",
          hasPrev ? "hover:bg-surface-alt" : "pointer-events-none opacity-40"
        )}
      >
        <ChevronLeft aria-hidden="true" className="h-4 w-4" />
        Previous
      </Link>

      <p className="text-sm text-muted">
        Page {page} of {totalPages}
      </p>

      <Link
        href={hasNext ? hrefFor(page + 1, basePath, searchParams) : "#"}
        aria-disabled={!hasNext}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-[var(--radius-control)] border border-border-strong px-4 py-2 text-sm font-medium text-text-soft transition-colors",
          hasNext ? "hover:bg-surface-alt" : "pointer-events-none opacity-40"
        )}
      >
        Next
        <ChevronRight aria-hidden="true" className="h-4 w-4" />
      </Link>
    </nav>
  );
}
