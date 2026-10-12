import Link from "next/link";
import { CalendarDays } from "lucide-react";
import type { ImportantDateItem } from "@/lib/dashboard/important-dates";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/** UX10-D01 — "Important Dates". `items` come from getImportantDates() — real application/discovery/invoice dates only, never an invented sample date. */
export function ImportantDatesCard({ items }: { items: ImportantDateItem[] }) {
  return (
    <section aria-labelledby="important-dates-heading" className="flex h-full flex-col rounded-[1.5rem] border border-border bg-surface p-5 shadow-soft">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary-light text-secondary-dark">
          <CalendarDays aria-hidden="true" className="h-4 w-4" />
        </span>
        <h2 id="important-dates-heading" className="font-sans text-base font-semibold text-text">
          Important Dates
        </h2>
      </div>

      {items.length === 0 ? (
        <p className="mt-4 flex-1 text-sm text-muted">No important dates yet.</p>
      ) : (
        <ul className="mt-4 flex-1 space-y-3">
          {items.map((item) => (
            <li key={item.key}>
              <Link href={item.href} className="flex items-start justify-between gap-2 text-sm hover:text-primary">
                <div className="min-w-0">
                  <p className="truncate font-medium text-text">{item.label}</p>
                  <p className="truncate text-xs text-muted">{item.sublabel}</p>
                </div>
                <span className="shrink-0 text-xs font-medium text-muted">{formatDate(item.date)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
