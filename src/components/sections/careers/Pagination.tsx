import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  /** Every filter param except `page` — appended to Prev/Next links so filters survive pagination. */
  searchParams: Record<string, string>;
}

function hrefFor(page: number, searchParams: Record<string, string>): string {
  const params = new URLSearchParams(searchParams);
  params.set("page", String(page));
  return `/careers?${params.toString()}`;
}

export function Pagination({ page, pageSize, total, searchParams }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  return (
    <nav aria-label="Career results pages" className="mt-8 flex items-center justify-between gap-3">
      <Link
        href={hasPrev ? hrefFor(page - 1, searchParams) : "#"}
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
        href={hasNext ? hrefFor(page + 1, searchParams) : "#"}
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
