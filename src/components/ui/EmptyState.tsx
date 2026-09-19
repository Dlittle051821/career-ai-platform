import type { ReactNode } from "react";
import { Inbox, SearchX, TriangleAlert } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";

/**
 * UX06G — shared student-facing empty/error state card. Mirrors
 * src/components/admin/EmptyState.tsx's shape (that one is admin-only and
 * stays untouched), but adds a `tone` so a list page can render three
 * genuinely different states with three genuinely different icons and
 * copy, instead of collapsing "no data available", "no results matching
 * filters", and "an actual load error" into one "couldn't be loaded"
 * message. See src/lib/ui/list-state.ts for the pure resolver this is
 * meant to be paired with.
 *
 * - "filtered": a search/filter combination matched nothing — the
 *   default icon (SearchX) and a "clear filters" affordance make sense.
 * - "empty": the underlying dataset genuinely has no rows yet — never
 *   phrased as a failure.
 * - "error": the query actually failed — the only tone that uses warning
 *   styling, since it is the only one where something went wrong.
 */
export function EmptyState({
  title,
  description,
  action,
  icon,
  tone = "filtered",
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: typeof Inbox;
  tone?: "filtered" | "empty" | "error";
}) {
  const Icon = icon ?? (tone === "error" ? TriangleAlert : tone === "empty" ? Inbox : SearchX);
  return (
    <Card className="flex flex-col items-center gap-3 py-14 text-center">
      <Icon aria-hidden="true" className={cn("h-9 w-9", tone === "error" ? "text-warning" : "text-muted")} />
      <h2 className="text-base font-semibold text-primary">{title}</h2>
      {description ? <p className="max-w-sm text-sm text-muted">{description}</p> : null}
      {action}
    </Card>
  );
}
