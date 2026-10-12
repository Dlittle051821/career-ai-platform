import Link from "next/link";
import { ArrowRight, Bookmark, GraduationCap } from "lucide-react";

export interface SavedPreviewItem {
  key: string;
  label: string;
  logoUrl: string | null;
}

/**
 * UX10-D01 — "Saved & Shortlist". `count` and `previews` are built in
 * page.tsx from the real `listSavedItems()` result (resolved to real
 * university/course names and logos via `getUniversitiesByIds`/
 * `getCoursesByIds`) — never an invented count.
 */
export function SavedShortlistCard({ count, previews }: { count: number; previews: SavedPreviewItem[] }) {
  const shown = previews.slice(0, 3);
  const extra = count - shown.length;

  return (
    <section aria-labelledby="saved-heading" className="flex h-full flex-col rounded-[1.5rem] border border-border bg-surface p-5 shadow-soft">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary-light text-secondary-dark">
          <Bookmark aria-hidden="true" className="h-4 w-4" />
        </span>
        <div>
          <h2 id="saved-heading" className="font-sans text-base font-semibold text-text">
            Saved &amp; Shortlist
          </h2>
          <p className="text-xs text-muted">{count === 0 ? "No saved items yet" : `${count} saved item${count === 1 ? "" : "s"}`}</p>
        </div>
      </div>

      {count === 0 ? (
        <p className="mt-4 flex-1 text-sm text-muted">No saved items yet. Explore careers, courses or universities to start your shortlist.</p>
      ) : (
        <div className="mt-4 flex flex-1 items-center gap-2">
          {shown.map((item) =>
            item.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- external, unconfigured logo host, same convention as UniversityCard.tsx.
              <img
                key={item.key}
                src={item.logoUrl}
                alt=""
                aria-hidden="true"
                className="h-11 w-11 shrink-0 rounded-xl border border-border bg-surface-alt object-contain"
              />
            ) : (
              <span key={item.key} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-alt text-muted">
                <GraduationCap aria-hidden="true" className="h-5 w-5" />
              </span>
            )
          )}
          {extra > 0 ? (
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-dashed border-border-strong text-sm font-medium text-muted">
              +{extra}
            </span>
          ) : null}
        </div>
      )}

      <Link href="/saved" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary-light">
        View Saved Items
        <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
      </Link>
    </section>
  );
}
